"""
1881 API Client for talkmore_enrichment app.
Handles Extended Search and Lookup by ID operations.
"""
import logging
import time
import requests
from typing import List, Dict, Optional
from django.conf import settings
import phonenumbers
from phonenumbers import NumberParseException

logger = logging.getLogger(__name__)

# 1881 API Configuration
API1881_BASE_URL = "https://services.api1881.no"
API1881_EXTENDED_SEARCH_ENDPOINT = "/extendedsearch/search/person"
API1881_LOOKUP_ENDPOINT = "/lookup/id/{id}"

# Retry configuration
MAX_RETRIES = 3
TIMEOUT_SECONDS = 10
BACKOFF_BASE = 1  # Base delay in seconds


class API1881Error(Exception):
    """Base exception for 1881 API errors."""
    pass


class API1881RateLimitError(API1881Error):
    """Raised when rate limit is exceeded (429)."""
    pass


class API1881NotFoundError(API1881Error):
    """Raised when resource is not found (404)."""
    pass


class API1881TimeoutError(API1881Error):
    """Raised when request times out."""
    pass


def _make_request_with_retry(
    method: str,
    url: str,
    headers: Dict,
    params: Optional[Dict] = None,
    data: Optional[Dict] = None,
    max_retries: int = MAX_RETRIES
) -> requests.Response:
    """
    Make HTTP request with exponential backoff retry logic.
    
    Args:
        method: HTTP method (GET, POST, etc.)
        url: Request URL
        headers: Request headers
        params: Query parameters
        data: Request body data
        max_retries: Maximum number of retries
    
    Returns:
        Response object
    
    Raises:
        API1881RateLimitError: On 429 status
        API1881NotFoundError: On 404 status
        API1881TimeoutError: On timeout
        API1881Error: On other errors
    """
    for attempt in range(max_retries + 1):
        try:
            response = requests.request(
                method=method,
                url=url,
                headers=headers,
                params=params,
                json=data,
                timeout=TIMEOUT_SECONDS
            )
            
            # Handle rate limiting (429)
            if response.status_code == 429:
                if attempt < max_retries:
                    wait_time = BACKOFF_BASE * (2 ** attempt)
                    logger.warning(f"Rate limited (429), retrying in {wait_time}s (attempt {attempt + 1}/{max_retries})")
                    time.sleep(wait_time)
                    continue
                else:
                    raise API1881RateLimitError(f"Rate limit exceeded after {max_retries} retries")
            
            # Handle not found (404) - don't retry
            if response.status_code == 404:
                raise API1881NotFoundError(f"Resource not found: {url}")
            
            # Handle server errors (5xx) - retry
            if 500 <= response.status_code < 600:
                if attempt < max_retries:
                    wait_time = BACKOFF_BASE * (2 ** attempt)
                    logger.warning(f"Server error {response.status_code}, retrying in {wait_time}s (attempt {attempt + 1}/{max_retries})")
                    time.sleep(wait_time)
                    continue
                else:
                    response.raise_for_status()
            
            # Success or client error (4xx except 404, 429)
            response.raise_for_status()
            return response
            
        except requests.exceptions.Timeout:
            if attempt < max_retries:
                wait_time = BACKOFF_BASE * (2 ** attempt)
                logger.warning(f"Request timeout, retrying in {wait_time}s (attempt {attempt + 1}/{max_retries})")
                time.sleep(wait_time)
                continue
            else:
                raise API1881TimeoutError(f"Request timeout after {max_retries} retries")
        
        except requests.exceptions.RequestException as e:
            if attempt < max_retries:
                wait_time = BACKOFF_BASE * (2 ** attempt)
                logger.warning(f"Request error: {e}, retrying in {wait_time}s (attempt {attempt + 1}/{max_retries})")
                time.sleep(wait_time)
                continue
            else:
                raise API1881Error(f"Request failed after {max_retries} retries: {e}")
    
    raise API1881Error("Unexpected error in retry logic")


def extended_search(query_string: str, limit: int = 15) -> List[Dict]:
    """
    Search for persons using 1881 Extended Search API.
    
    Args:
        query_string: Search query
        limit: Maximum number of results
    """
    api_key = getattr(settings, 'API1881_EXTENDED_KEY', None)
    if not api_key:
        raise API1881Error("API1881_EXTENDED_KEY not configured in settings")
    
    url = f"{API1881_BASE_URL}{API1881_EXTENDED_SEARCH_ENDPOINT}"
    headers = {
        "Ocp-Apim-Subscription-Key": api_key,
        "Cache-Control": "no-cache"
    }
    
    params = {
        "query": query_string,
        "size": limit  
    }
    
    try:
        response = _make_request_with_retry("GET", url, headers, params=params)
        data = response.json()
        
        # Parse response
        contacts = data.get("contacts", []) or []
        results = []
        
        # Note: We iterate over the full returned list, or slice if you want to be safe
        for contact in contacts:
            contact_id = contact.get("id")
            name = contact.get("name", "Unknown")
            
            if contact_id:
                results.append({
                    "person_id": str(contact_id),
                    "name": name,
                    "phone": None
                })
        
        logger.info(f"Extended search for '{query_string}' returned {len(results)} results")
        return results
        
    except API1881NotFoundError:
        logger.debug(f"No results found for query: {query_string}")
        return []
    except Exception as e:
        logger.error(f"Error in extended_search for '{query_string}': {e}")
        raise

def lookup_by_id(person_id: str) -> Dict:
    """
    Lookup full person details by ID using 1881 Lookup API.
    
    Args:
        person_id: Person/contact ID from extended_search
    
    Returns:
        Dictionary with full person details including phones
    
    Raises:
        API1881NotFoundError: If person not found
        API1881Error: On other API errors
    """
    api_key = getattr(settings, 'API1881_BASIC_KEY', None)
    if not api_key:
        raise API1881Error("API1881_BASIC_KEY not configured in settings")
    
    url = API1881_LOOKUP_ENDPOINT.format(id=person_id)
    url = f"{API1881_BASE_URL}{url}"
    headers = {
        "Ocp-Apim-Subscription-Key": api_key,
        "Cache-Control": "no-cache"
    }
    
    try:
        response = _make_request_with_retry("GET", url, headers)
        data = response.json()
        
        # Parse response: data.get("contacts", [])[0]
        contacts = data.get("contacts", []) or []
        if not contacts:
            raise API1881NotFoundError(f"No contact found for id {person_id}")
        
        detail = contacts[0]
        
        # Extract phones from contactPoints array
        phones = []
        contact_points = detail.get("contactPoints", []) or []
        for cp in contact_points:
            cp_type = (cp.get("type") or "").lower()
            cp_value = cp.get("value")
            if not cp_value:
                continue
            # Match phone types: phone, mobile, telefon, mobil
            if "phone" in cp_type or "mobile" in cp_type or "telefon" in cp_type or "mobil" in cp_type:
                phones.append(cp_value)
        
        # Deduplicate phones (preserve order)
        phones = list(dict.fromkeys(phones))
        
        result = {
            "person_id": str(person_id),
            "name": detail.get("name", "Unknown"),
            "phones": phones,
            "address": detail.get("address") or detail.get("street"),
            "postcode": detail.get("postcode") or detail.get("postal_code"),
            "full_data": detail  # Keep full response for debugging
        }
        
        logger.info(f"Lookup for person_id {person_id} returned {len(phones)} phone(s)")
        return result
        
    except API1881NotFoundError:
        logger.debug(f"Person not found: {person_id}")
        raise
    except Exception as e:
        logger.error(f"Error in lookup_by_id for '{person_id}': {e}")
        raise


def normalize_phone(phone_number: str, country_code: str = "NO") -> Optional[str]:
    """
    Normalize phone number to E.164 format.
    
    Args:
        phone_number: Phone number in any format
        country_code: ISO country code (default "NO" for Norway)
    
    Returns:
        E.164 formatted phone number (e.g., "+4791234567") or None if invalid
    """
    if not phone_number:
        return None
    
    try:
        # Parse phone number
        parsed = phonenumbers.parse(phone_number, country_code)
        
        # Check if valid
        if not phonenumbers.is_valid_number(parsed):
            logger.debug(f"Invalid phone number: {phone_number}")
            return None
        
        # Format as E.164
        e164 = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
        return e164
        
    except NumberParseException as e:
        logger.debug(f"Could not parse phone number '{phone_number}': {e}")
        return None
    except Exception as e:
        logger.error(f"Error normalizing phone '{phone_number}': {e}")
        return None


def enrich_address_with_1881(
    address_text: str,
    postcode: Optional[str] = None,
    municipality_code: Optional[str] = None
) -> List[Dict]:
    """
    Enrich an address with 1881 data.
    
    Tries once with: "Street 124A 4375" (full address + postcode)
    If no results found, returns empty list (moves to next apartment).
    Requires postcode - will not search without it.
    
    Args:
        address_text: Full address text
        postcode: Postal code (required for search)
        municipality_code: Municipality code
    
    Returns:
        List of people with phones: [{name, phone_e164, carrier}]
    """
    if not address_text or not postcode:
        return []
    
    # Single query: full address + postcode
    query = f"{address_text} {postcode}"
    
    all_people = []
    seen_phones = set()
    
    try:
        # Extended search
        search_results = extended_search(query, limit=10)
        
        for result in search_results:
            person_id = result.get("person_id")
            if not person_id:
                continue
            
            # Lookup full details
            try:
                person_data = lookup_by_id(person_id)
                name = person_data.get("name", "Unknown")
                phones = person_data.get("phones", [])
                
                # Process phones
                for phone in phones:
                    if not phone:
                        continue
                    
                    # Normalize to E.164
                    phone_e164 = normalize_phone(phone)
                    if not phone_e164:
                        continue
                    
                    # Deduplicate
                    if phone_e164 in seen_phones:
                        continue
                    seen_phones.add(phone_e164)
                    
                    all_people.append({
                        "name": name,
                        "phone_e164": phone_e164,
                        "carrier": None  # Will be filled by Data247 client
                    })
            
            except API1881NotFoundError:
                # Person not found, but we might have phone from extended search
                phone = result.get("phone")
                if phone:
                    phone_e164 = normalize_phone(phone)
                    if phone_e164 and phone_e164 not in seen_phones:
                        seen_phones.add(phone_e164)
                        all_people.append({
                            "name": result.get("name", "Unknown"),
                            "phone_e164": phone_e164,
                            "carrier": None
                        })
                continue
            except Exception as e:
                logger.warning(f"Error looking up person_id {person_id}: {e}")
                continue
        
    except Exception as e:
        logger.warning(f"Error in extended_search for query '{query}': {e}")
        # Return empty list on error - will be marked as 'no_data' by Worker B
    
    logger.info(f"Enriched address '{address_text}' with {len(all_people)} people")
    return all_people
