"""
Geocoding utilities for the uploaded_addresses app.

Uses Google Geocoding API via settings.GOOGLE_PLACES_API_KEY.
"""
import logging
import urllib.parse
from django.utils import timezone
from django.conf import settings
from .models import UploadedAddress
from services.google_geocoding import geocode_with_google

logger = logging.getLogger(__name__)


def geocode_address(address_id):
    """
    Geocode an address. Prefer Google Geocoding if configured; otherwise use
    OpenStreetMap Nominatim.

    Args:
        address_id (str): UUID of the UploadedAddress to geocode

    Returns:
        dict: Result of the geocoding operation
    """
    try:
        # Get the uploaded address
        uploaded_address = UploadedAddress.objects.get(id=address_id)
        
        logger.info(f"Starting geocoding for address {address_id}: {uploaded_address.address_text}")
        
        # Skip if already geocoded
        if uploaded_address.latitude is not None and uploaded_address.longitude is not None:
            logger.info(f"Address {address_id} already geocoded, skipping")
            return {
                'status': 'skipped',
                'reason': 'Already geocoded',
                'address_id': address_id
            }
        
        # Prepare the address for geocoding
        address_text = uploaded_address.address_text.strip()
        if not address_text:
            logger.warning(f"Address {address_id} has empty address text, skipping")
            return {
                'status': 'failed',
                'reason': 'Empty address text',
                'address_id': address_id
            }
        
        # Google Geocoding (required)
        google_key = getattr(settings, 'GOOGLE_PLACES_API_KEY', '')
        if not google_key:
            logger.error("GOOGLE_PLACES_API_KEY is not configured; cannot geocode")
            return {
                'status': 'failed',
                'reason': 'Google API key not configured',
                'address_id': address_id,
                'address_text': address_text,
            }

        logger.info(f"Using Google Geocoding for address {address_id}")
        g = geocode_with_google(address_text, google_key, country_code='NO', region='no')
        if g.get('status') == 'success':
            latitude = g['latitude']
            longitude = g['longitude']
        else:
            logger.warning(
                "Google geocoding failed for %s: status=%s reason=%s error=%s",
                address_id, g.get('google_status'), g.get('reason'), g.get('error_message')
            )
            return {
                'status': 'failed',
                'reason': g.get('reason', 'Google geocoding failed'),
                'google_status': g.get('google_status'),
                'error_message': g.get('error_message'),
                'address_id': address_id,
                'address_text': address_text,
            }

        # Validate coordinates
        if latitude is None or longitude is None or (latitude == 0 and longitude == 0):
            logger.warning(f"Geocoding failed or invalid coords for address {address_id}")
            return {
                'status': 'failed',
                'reason': 'No results found',
                'address_id': address_id,
                'address_text': address_text
            }
        
        # Update the uploaded address with coordinates
        uploaded_address.latitude = latitude
        uploaded_address.longitude = longitude
        uploaded_address.geocoded_at = timezone.now()
        uploaded_address.save()
        
        logger.info(f"Successfully geocoded address {address_id}: {address_text} -> ({latitude}, {longitude})")
        
        return {
            'status': 'success',
            'address_id': address_id,
            'address_text': address_text,
            'latitude': latitude,
            'longitude': longitude,
        }
        
    except UploadedAddress.DoesNotExist:
        logger.error(f"UploadedAddress with ID {address_id} not found")
        return {
            'status': 'failed',
            'reason': 'Address not found',
            'address_id': address_id
        }
    
    except Exception as e:
        logger.error(f"Unexpected error while geocoding address {address_id}: {e}")
        return {
            'status': 'failed',
            'reason': str(e),
            'address_id': address_id
        }


def retry_failed_geocoding():
    """
    Retry geocoding for addresses that failed.
    This function can be called manually or via Django management command.
    """
    try:
        # Get all addresses that haven't been geocoded yet
        ungeocoded_addresses = UploadedAddress.objects.filter(
            latitude__isnull=True,
            longitude__isnull=True
        )
        
        count = ungeocoded_addresses.count()
        logger.info(f"Found {count} ungeocoded addresses to retry")
        
        if count == 0:
            logger.info("No ungeocoded addresses found, skipping retry")
            return {
                'status': 'success',
                'message': 'No addresses to retry',
                'count': 0
            }
        
        # Geocode each address
        success_count = 0
        failed_count = 0
        for address in ungeocoded_addresses:
            try:
                result = geocode_address(str(address.id))
                if result['status'] == 'success':
                    success_count += 1
                else:
                    failed_count += 1
                    logger.debug(f"Failed to geocode address {address.id}: {result.get('reason', 'Unknown error')}")
            except Exception as e:
                failed_count += 1
                logger.error(f"Error geocoding address {address.id}: {e}")
        
        logger.info(f"Retry completed. Success: {success_count}, Failed: {failed_count} out of {count} addresses")
        
        return {
            'status': 'success',
            'message': f'Processed {count} addresses',
            'total_addresses': count,
            'success_count': success_count,
            'failed_count': failed_count
        }
        
    except Exception as e:
        logger.error(f"Error in retry_failed_geocoding: {e}")
        return {
            'status': 'failed',
            'error': str(e)
        }


def bulk_geocode_addresses(address_ids):
    """
    Bulk geocode multiple addresses.
    
    Args:
        address_ids (list): List of address UUIDs to geocode
        
    Returns:
        dict: Summary of the bulk geocoding operation
    """
    try:
        logger.info(f"Starting bulk geocoding for {len(address_ids)} addresses")
        
        results = {
            'total': len(address_ids),
            'success': 0,
            'failed': 0,
            'skipped': 0,
            'errors': []
        }
        
        for address_id in address_ids:
            try:
                result = geocode_address(address_id)
                if result['status'] == 'success':
                    results['success'] += 1
                elif result['status'] == 'failed':
                    results['failed'] += 1
                elif result['status'] == 'skipped':
                    results['skipped'] += 1
            except Exception as e:
                results['failed'] += 1
                results['errors'].append({
                    'address_id': address_id,
                    'error': str(e)
                })
                logger.error(f"Error geocoding address {address_id}: {e}")
        
        logger.info(f"Bulk geocoding completed. Success: {results['success']}, Failed: {results['failed']}, Skipped: {results['skipped']}")
        
        return results
        
    except Exception as e:
        logger.error(f"Error in bulk_geocode_addresses: {e}")
        return {
            'status': 'failed',
            'error': str(e)
        } 
