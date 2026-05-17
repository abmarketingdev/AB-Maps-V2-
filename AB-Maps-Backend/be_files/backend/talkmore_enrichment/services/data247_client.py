"""
Data247 API Client for talkmore_enrichment app.
Handles Carrier Identification with dual caching (DB + Redis).
"""
import logging
import time
import requests
from typing import Optional, Dict
from datetime import timedelta
from django.conf import settings
from django.utils import timezone
from django.core.cache import cache
from talkmore_enrichment.models import PhoneCarrierCache

logger = logging.getLogger(__name__)

# Data247 API Configuration
DATA247_BASE_URL = "https://api.data247.com/v3.0"
DATA247_SERVICE_CODE = "CI"  # Carrier Identification service code

# Retry configuration
MAX_RETRIES = 3
TIMEOUT_SECONDS = 15
BACKOFF_BASE = 1  # Base delay in seconds

# Cache configuration
REDIS_CACHE_TTL = 86400 * 7  # 7 days in seconds
DB_CACHE_EXPIRY_DAYS = 30  # 30 days


class Data247Error(Exception):
    """Base exception for Data247 API errors."""
    pass


class Data247RateLimitError(Data247Error):
    """Raised when rate limit is exceeded (429)."""
    pass


class Data247TimeoutError(Data247Error):
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
        Data247RateLimitError: On 429 status
        Data247TimeoutError: On timeout
        Data247Error: On other errors
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
                    raise Data247RateLimitError(f"Rate limit exceeded after {max_retries} retries")
            
            # Handle server errors (5xx) - retry
            if 500 <= response.status_code < 600:
                if attempt < max_retries:
                    wait_time = BACKOFF_BASE * (2 ** attempt)
                    logger.warning(f"Server error {response.status_code}, retrying in {wait_time}s (attempt {attempt + 1}/{max_retries})")
                    time.sleep(wait_time)
                    continue
                else:
                    response.raise_for_status()
            
            # Handle transient errors (503, 504) - retry
            if response.status_code in [503, 504]:
                if attempt < max_retries:
                    wait_time = BACKOFF_BASE * (2 ** attempt)
                    logger.warning(f"Transient error {response.status_code}, retrying in {wait_time}s (attempt {attempt + 1}/{max_retries})")
                    time.sleep(wait_time)
                    continue
                else:
                    response.raise_for_status()
            
            # Success or client error (4xx except 429)
            response.raise_for_status()
            return response
            
        except requests.exceptions.Timeout:
            if attempt < max_retries:
                wait_time = BACKOFF_BASE * (2 ** attempt)
                logger.warning(f"Request timeout, retrying in {wait_time}s (attempt {attempt + 1}/{max_retries})")
                time.sleep(wait_time)
                continue
            else:
                raise Data247TimeoutError(f"Request timeout after {max_retries} retries")
        
        except requests.exceptions.RequestException as e:
            if attempt < max_retries:
                wait_time = BACKOFF_BASE * (2 ** attempt)
                logger.warning(f"Request error: {e}, retrying in {wait_time}s (attempt {attempt + 1}/{max_retries})")
                time.sleep(wait_time)
                continue
            else:
                raise Data247Error(f"Request failed after {max_retries} retries: {e}")
    
    raise Data247Error("Unexpected error in retry logic")


def get_carrier(phone_e164: str) -> Optional[str]:
    """
    Get carrier name for a phone number in E.164 format.
    Checks cache first (DB, then Redis), then calls API if needed.
    
    Args:
        phone_e164: Phone number in E.164 format (e.g., "+4791234567")
    
    Returns:
        Carrier name (e.g., "Talkmore", "Telenor") or None if not found/error
    """
    if not phone_e164:
        return None
    
    # 1. Check Redis cache first (fastest)
    cache_key = f"data247:carrier:{phone_e164}"
    try:
        cached_carrier = cache.get(cache_key)
        if cached_carrier:
            logger.debug(f"Carrier cache hit (Redis) for {phone_e164}: {cached_carrier}")
            return cached_carrier
    except Exception as e:
        # Redis connection error - continue to DB cache
        logger.debug(f"Redis cache unavailable: {e}, falling back to DB cache")
    
    # 2. Check DB cache
    try:
        db_cache = PhoneCarrierCache.objects.get(phone_e164=phone_e164)
        
        # Check if expired
        if db_cache.expires_at and db_cache.expires_at < timezone.now():
            logger.debug(f"DB cache expired for {phone_e164}, will refresh")
            db_cache.delete()
        else:
            # Cache hit - also update Redis cache (if available)
            try:
                cache.set(cache_key, db_cache.carrier, REDIS_CACHE_TTL)
            except Exception:
                # Redis unavailable - continue without Redis cache
                pass
            logger.debug(f"Carrier cache hit (DB) for {phone_e164}: {db_cache.carrier}")
            return db_cache.carrier
    except PhoneCarrierCache.DoesNotExist:
        pass
    
    # 3. Cache miss - call API
    logger.debug(f"Cache miss for {phone_e164}, calling Data247 API")
    carrier = _fetch_carrier_from_api(phone_e164)
    
    # 4. Store in both caches
    if carrier:
        cache_carrier(phone_e164, carrier)
    
    return carrier


def _fetch_carrier_from_api(phone_e164: str) -> Optional[str]:
    """
    Fetch carrier information from Data247 API.
    
    Args:
        phone_e164: Phone number in E.164 format
    
    Returns:
        Carrier name or None if error/not found
    """
    api_key = getattr(settings, 'DATA247_KEY', None)
    if not api_key:
        raise Data247Error("DATA247_KEY not configured in settings")
    
    # Data247 uses query string format: ?key={api_key}&api={service_code}&phone={phone}
    from urllib.parse import urlencode
    params = {
        "key": api_key,
        "api": DATA247_SERVICE_CODE,
        "phone": phone_e164
    }
    url = f"{DATA247_BASE_URL}?{urlencode(params)}"
    headers = {}  # No special headers needed
    
    try:
        response = _make_request_with_retry("GET", url, headers, params=None)
        data = response.json()
        
        # Parse response: data["response"]["results"][0]
        response_obj = data.get("response", {})
        status = response_obj.get("status")
        
        if status != "OK":
            error_msg = response_obj.get("message", f"Status: {status}")
            logger.warning(f"Data247 API returned status '{status}': {error_msg}")
            return None
        
        results = response_obj.get("results", []) or []
        if not results:
            logger.warning(f"Data247 API returned no results for {phone_e164}")
            return None
        
        result = results[0]
        carrier = result.get("carrier_name")
        
        if carrier:
            logger.info(f"Data247 API returned carrier '{carrier}' for {phone_e164}")
        else:
            logger.warning(f"Data247 API did not return carrier_name for {phone_e164}, response: {result}")
        
        return carrier
        
    except Data247RateLimitError:
        logger.error(f"Rate limit exceeded for Data247 API")
        return None
    except Data247TimeoutError:
        logger.error(f"Timeout calling Data247 API for {phone_e164}")
        return None
    except Exception as e:
        logger.error(f"Error calling Data247 API for {phone_e164}: {e}")
        return None


def cache_carrier(phone_e164: str, carrier_name: str, ttl_days: int = DB_CACHE_EXPIRY_DAYS):
    """
    Cache carrier information in both DB and Redis.
    
    Args:
        phone_e164: Phone number in E.164 format
        carrier_name: Carrier name
        ttl_days: TTL in days for DB cache (default 30)
    """
    if not phone_e164 or not carrier_name:
        return
    
    try:
        # Store in DB cache
        expires_at = timezone.now() + timedelta(days=ttl_days)
        PhoneCarrierCache.objects.update_or_create(
            phone_e164=phone_e164,
            defaults={
                'carrier': carrier_name,
                'source': 'data247',
                'expires_at': expires_at
            }
        )
        
        # Store in Redis cache (shorter TTL)
        cache_key = f"data247:carrier:{phone_e164}"
        cache.set(cache_key, carrier_name, REDIS_CACHE_TTL)
        
        logger.debug(f"Cached carrier '{carrier_name}' for {phone_e164} (DB + Redis)")
        
    except Exception as e:
        logger.error(f"Error caching carrier for {phone_e164}: {e}")


def get_carriers_batch(phone_e164_list: list) -> dict:
    """
    Get carriers for multiple phone numbers (with caching).
    This is more efficient than calling get_carrier() multiple times.
    
    Args:
        phone_e164_list: List of phone numbers in E.164 format (may contain duplicates)
    
    Returns:
        Dictionary mapping phone_e164 -> carrier_name (or None)
    """
    # Deduplicate input list (preserves order, keeps first occurrence)
    unique_phones = list(dict.fromkeys(phone_e164_list))
    
    if len(unique_phones) < len(phone_e164_list):
        logger.debug(f"Deduplicated phone list: {len(phone_e164_list)} -> {len(unique_phones)} unique phones")
    
    result = {}
    
    # Check all caches first
    uncached_phones = []
    
    for phone_e164 in unique_phones:
        if not phone_e164:
            result[phone_e164] = None
            continue
        
        # Check Redis cache
        cache_key = f"data247:carrier:{phone_e164}"
        cached_carrier = cache.get(cache_key)
        if cached_carrier:
            result[phone_e164] = cached_carrier
            continue
        
        # Check DB cache
        try:
            db_cache = PhoneCarrierCache.objects.get(phone_e164=phone_e164)
            if not db_cache.expires_at or db_cache.expires_at >= timezone.now():
                result[phone_e164] = db_cache.carrier
                # Also update Redis
                cache.set(cache_key, db_cache.carrier, REDIS_CACHE_TTL)
                continue
            else:
                # Expired, delete it
                db_cache.delete()
        except PhoneCarrierCache.DoesNotExist:
            pass
        
        # Need to fetch from API
        uncached_phones.append(phone_e164)
    
    # Fetch uncached phones from API (one by one, but with caching)
    for phone_e164 in uncached_phones:
        carrier = _fetch_carrier_from_api(phone_e164)
        result[phone_e164] = carrier
        if carrier:
            cache_carrier(phone_e164, carrier)
    
    return result
