"""
SSB (Statistics Norway) API utility functions for fetching age statistics.
"""
import logging
import requests
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

SSB_API_URL = "https://data.ssb.no/api/v0/en/table/13536"
SSB_REQUEST_TIMEOUT = 30  # seconds


def validate_region_code(area_type: str, code: str) -> bool:
    """
    Validate region code format.
    
    Args:
        area_type: Either 'fylke' or 'kommune'
        code: The region code to validate
        
    Returns:
        True if valid, False otherwise
    """
    if area_type == 'kommune' and len(code) != 4:
        logger.warning(f"Invalid kommune code: {code} (expected 4 digits)")
        return False
    if area_type == 'fylke' and len(code) != 2:
        logger.warning(f"Invalid fylke code: {code} (expected 2 digits)")
        return False
    return True


def fetch_ssb_13536_stats(region_codes: List[str]) -> Dict[str, Dict[str, Optional[float]]]:
    """
    Fetch age statistics from SSB API table 13536.
    
    This function makes a single bulk API call that can handle both
    fylke (2-digit) and kommune (4-digit) codes mixed together.
    
    Args:
        region_codes: List of region codes (can mix fylke and kommune codes)
        
    Returns:
        Dictionary mapping region_code -> {
            'mean': float or None,
            'median': float or None,
            'year': int or None
        }
        
    Example:
        >>> stats = fetch_ssb_13536_stats(['0301', '3201', '31'])
        >>> stats['0301']
        {'mean': 38.7, 'median': 36.0, 'year': 2025}
    """
    if not region_codes:
        return {}
    
    # Remove duplicates while preserving order
    unique_codes = list(dict.fromkeys(region_codes))
    
    # Build SSB API request payload
    payload = {
        "query": [
            {
                "code": "Region",
                "selection": {
                    "filter": "item",
                    "values": unique_codes
                }
            },
            {
                "code": "ContentsCode",
                "selection": {
                    "filter": "item",
                    "values": ["Gjennomsnittsalder", "Medianalder"]
                }
            },
            {
                "code": "Tid",
                "selection": {
                    "filter": "top",
                    "values": ["1"]
                }
            }
        ],
        "response": {"format": "json-stat2"}
    }
    
    try:
        logger.info(f"Fetching SSB stats for {len(unique_codes)} regions: {unique_codes[:5]}...")
        
        response = requests.post(
            SSB_API_URL,
            json=payload,
            timeout=SSB_REQUEST_TIMEOUT,
            headers={"Content-Type": "application/json"}
        )
        response.raise_for_status()
        
        data = response.json()
        
        # Parse the response using dimension indexes
        return parse_ssb_response(data, unique_codes)
        
    except requests.exceptions.Timeout:
        logger.error(f"SSB API request timed out after {SSB_REQUEST_TIMEOUT} seconds")
        return {code: {'mean': None, 'median': None, 'year': None} for code in unique_codes}
    
    except requests.exceptions.RequestException as e:
        logger.error(f"SSB API request failed: {str(e)}")
        return {code: {'mean': None, 'median': None, 'year': None} for code in unique_codes}
    
    except Exception as e:
        logger.error(f"Error parsing SSB response: {str(e)}")
        return {code: {'mean': None, 'median': None, 'year': None} for code in unique_codes}


def parse_ssb_response(data: dict, region_codes: List[str]) -> Dict[str, Dict[str, Optional[float]]]:
    """
    Parse SSB API response using dimension indexes.
    
    The response structure:
    {
        "dimension": {
            "Region": {
                "category": {
                    "index": {"0301": 0, "3201": 1, "31": 2}
                }
            },
            "ContentsCode": {
                "category": {
                    "index": {
                        "Gjennomsnittsalder": 0,
                        "Medianalder": 1
                    }
                }
            },
            "Tid": {
                "category": {
                    "label": {"2025": "2025"}
                }
            }
        },
        "value": [38.7, 36, 41.4, 41, 43.0, 43.0]
    }
    
    Args:
        data: The JSON response from SSB API
        region_codes: List of region codes that were requested
        
    Returns:
        Dictionary mapping region_code -> {mean, median, year}
    """
    result = {}
    
    try:
        # Extract dimension indexes
        region_index = data["dimension"]["Region"]["category"]["index"]
        content_index = data["dimension"]["ContentsCode"]["category"]["index"]
        values = data["value"]
        
        # Extract year (only one entry since Tid = top(1))
        tid_label = data["dimension"]["Tid"]["category"]["label"]
        stats_year = int(list(tid_label.keys())[0]) if tid_label else None
        
        # Parse each region
        for region_code in region_codes:
            if region_code not in region_index:
                # Region code not found in response (might be invalid)
                logger.warning(f"Region code {region_code} not found in SSB response")
                result[region_code] = {'mean': None, 'median': None, 'year': None}
                continue
            
            r = region_index[region_code]
            mean_idx = r * 2 + content_index["Gjennomsnittsalder"]
            median_idx = r * 2 + content_index["Medianalder"]
            
            # Extract values (handle None/missing values)
            mean_age = float(values[mean_idx]) if mean_idx < len(values) and values[mean_idx] is not None else None
            median_age = float(values[median_idx]) if median_idx < len(values) and values[median_idx] is not None else None
            
            result[region_code] = {
                'mean': mean_age,
                'median': median_age,
                'year': stats_year
            }
        
        logger.info(f"Successfully parsed SSB stats for {len(result)} regions")
        return result
        
    except (KeyError, IndexError, ValueError, TypeError) as e:
        logger.error(f"Error parsing SSB response structure: {str(e)}")
        # Return empty stats for all codes
        return {code: {'mean': None, 'median': None, 'year': None} for code in region_codes}

