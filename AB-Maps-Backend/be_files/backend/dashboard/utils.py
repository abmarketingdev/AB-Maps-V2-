"""
Utility functions for dashboard app.

Provides city extraction and address parsing for hierarchical dashboard views.
"""
import re
import logging
from typing import Optional, Dict

logger = logging.getLogger(__name__)


def extract_city_from_address(address_text: str) -> str:
    """
    Extract city name from Norwegian address string.

    Handles formats:
    - "Street Number, Postcode City, Apartment" → extracts "City"
    - "Street Number, Postcode City" → extracts "City"
    - "Street Number" → returns "Unknown"

    Examples:
    - "Gjøvikgata 4B, 0470 Oslo, leilighet H0302" → "Oslo"
    - "Vinkelvegen 8, 4120 Tau" → "Tau"
    - "Lyngmarka 20, 5302 Strusshamn, leilighet U0101" → "Strusshamn"
    - "Bakken 27" → "Unknown"

    Returns:
        City name or "Unknown" if not found.
    """
    if not address_text:
        return 'Unknown'

    # Strip "Contacted address: " prefix if present
    cleaned = re.sub(r'^Contacted address:\s*', '', address_text, flags=re.IGNORECASE).strip()

    # ── Pattern 1: ", Postcode City" (most reliable) ────────────────────
    # Matches: ", 0470 Oslo" / ", 4120 Tau" / ", 5302 Strusshamn"
    # City name: word chars (incl Norwegian chars) until comma or end-of-string
    pattern1 = r',\s*\d{4}\s+([A-Za-zÅåÆæØøÉéÜü\s]+?)(?:\s*,|$)'
    match = re.search(pattern1, cleaned)
    if match:
        city_part = match.group(1).strip()
        if city_part:
            return city_part

    # ── Pattern 2: Fallback – any 4-digit postcode followed by text ─────
    pattern2 = r'\d{4}\s+([A-Za-zÅåÆæØøÉéÜü]+)'
    match = re.search(pattern2, cleaned)
    if match:
        city_part = match.group(1).strip()
        if city_part:
            return city_part

    return 'Unknown'


def parse_address_components(address_text: str) -> Dict[str, Optional[str]]:
    """
    Parse address text into base_address, apartment_number, and city.

    Handles formats produced by the AB Maps frontend / signals:
    - "Street Number, Postcode City, leilighet H0302"
    - "Street Number, Postcode City"
    - "Street Number"

    Examples:
        >>> parse_address_components("Gjøvikgata 4B, 0470 Oslo, leilighet H0302")
        {'base_address': 'Gjøvikgata 4B, 0470 Oslo', 'apartment_number': 'leilighet H0302', 'city': 'Oslo'}

        >>> parse_address_components("Vinkelvegen 8, 4120 Tau")
        {'base_address': 'Vinkelvegen 8, 4120 Tau', 'apartment_number': None, 'city': 'Tau'}

        >>> parse_address_components("Bakken 27")
        {'base_address': 'Bakken 27', 'apartment_number': None, 'city': 'Unknown'}

    Returns:
        dict with keys: base_address, apartment_number (or None), city
    """
    if not address_text:
        return {
            'base_address': None,
            'apartment_number': None,
            'city': 'Unknown',
        }

    # Strip "Contacted address: " prefix if present
    cleaned = re.sub(
        r'^Contacted address:\s*', '', address_text, flags=re.IGNORECASE
    ).strip()

    # ── Try to locate the "Postcode City" segment ────────────────────────
    # This lets us split into base_address + optional apartment
    postcode_city_re = re.compile(
        r',\s*(\d{4}\s+[A-Za-zÅåÆæØøÉéÜü\s]+?)(?:\s*,|$)'
    )
    match = postcode_city_re.search(cleaned)

    if match:
        # Everything up to AND including the postcode+city block is the base address
        postcode_city_end = match.end()

        # Check whether something comes AFTER (i.e. an apartment part)
        remainder = cleaned[postcode_city_end:].strip()

        if remainder:
            # Strip leading comma from the apartment portion
            apartment_number = remainder.lstrip(',').strip() or None
            # base_address ends just before the apartment portion
            base_address = cleaned[:postcode_city_end].rstrip(',').strip()
        else:
            apartment_number = None
            base_address = cleaned.strip()

        city = extract_city_from_address(cleaned)
        return {
            'base_address': base_address,
            'apartment_number': apartment_number,
            'city': city,
        }

    # ── No postcode found ─ might be a simple street address ─────────────
    if ',' in cleaned:
        parts = cleaned.rsplit(',', 1)
        base_address = parts[0].strip()
        potential_apartment = parts[1].strip()

        # If it doesn't look like a postcode, treat as apartment
        if not re.match(r'^\d{4}', potential_apartment):
            return {
                'base_address': base_address,
                'apartment_number': potential_apartment,
                'city': 'Unknown',
            }

    return {
        'base_address': cleaned,
        'apartment_number': None,
        'city': 'Unknown',
    }


def normalize_status_value(status_value: str) -> str:
    """
    Normalize a door-knocking status string into a canonical label.

    Returns one of: 'Ja', 'Nei', 'Ikke Hjemme', 'Følg Opp', or capitalised
    version of the original value.
    """
    value = (status_value or '').strip().lower()
    if value in ('ja', 'yes', 'positive'):
        return 'Ja'
    if value in ('nei', 'no', 'negative'):
        return 'Nei'
    if value in ('ikke_hjemme', 'ikke_hjem', 'not_home', 'not at home',
                 'ikke hjemme', 'ikke heime'):
        return 'Ikke Hjemme'
    if value in ('folg_opp', 'følg_opp', 'follow_up', 'følg opp'):
        return 'Følg Opp'
    return value.capitalize() if value else 'Unknown'
