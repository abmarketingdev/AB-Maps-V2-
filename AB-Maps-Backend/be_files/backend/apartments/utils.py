"""
Utility functions for the apartments app.
"""
import re
from typing import Tuple, Optional
import logging

logger = logging.getLogger(__name__)


def parse_address_text(address_text: str) -> Tuple[str, Optional[str]]:
    """
    Parse address_text into base_address and apartment_number.
    
    Uses "last comma" rule to extract apartment number from full address.
    
    Format: "{base_address}, {apartment_number}"
    
    The apartment number is identified as the last comma-separated segment
    that contains only alphanumeric characters (and optionally spaces/hyphens).
    
    Examples:
        >>> parse_address_text("Hausmanns gate 19A, 0182 Oslo, 1")
        ("Hausmanns gate 19A, 0182 Oslo", "1")
        
        >>> parse_address_text("Hausmanns gate 19A, 0182 Oslo, H0102")
        ("Hausmanns gate 19A, 0182 Oslo", "H0102")
        
        >>> parse_address_text("Storgata 5, Oslo, 2A")
        ("Storgata 5, Oslo", "2A")
        
        >>> parse_address_text("Hausmanns gate 19A, 0182 Oslo")
        ("Hausmanns gate 19A, 0182 Oslo", None)
        
        >>> parse_address_text("Karl Johans gate 1, 0123 Oslo")
        ("Karl Johans gate 1, 0123 Oslo", None)
    
    Args:
        address_text (str): Full address string, possibly including apartment number
        
    Returns:
        Tuple[str, Optional[str]]: A tuple of (base_address, apartment_number)
            - base_address: The address without the apartment number
            - apartment_number: The apartment/unit number, or None if not present
    
    Notes:
        - The pattern matches addresses ending with ", {alphanumeric}"
        - Spaces around the comma and apartment number are automatically stripped
        - The apartment number must be alphanumeric (letters and/or numbers)
        - If no apartment number is found, returns (address_text, None)
    """
    if not address_text:
        return "", None
    
    # Pattern: anything ending with ", {alphanumeric}"
    # Matches: ", 1" or ", 2A" or ", H0102" or ", H-0102" at the end
    # Allows optional spaces and hyphens in apartment number
    pattern = r'^(.+),\s*([A-Za-z0-9\s\-]+)$'
    
    match = re.match(pattern, address_text.strip())
    
    if match:
        base_address = match.group(1).strip()
        potential_apartment = match.group(2).strip()
        
        # Additional validation to distinguish apartment numbers from postal codes/cities
        # Apartment numbers are typically:
        # - Short (1-10 characters, not counting spaces/hyphens)
        # - Don't contain spaces indicating a postal code + city (e.g. "0182 Oslo")
        # - Not 4+ digit numbers followed by a space and text (postal code pattern)
        
        # Check for postal code pattern (e.g. "0182 Oslo", "1234 Bergen")
        if re.match(r'^\d{4,5}\s+\w+', potential_apartment):
            # This looks like a postal code + city, not an apartment
            logger.debug(
                f"'{potential_apartment}' looks like postal code + city, "
                f"treating as part of base address"
            )
            return address_text.strip(), None
        
        # Check length (apartment numbers are typically short)
        if len(potential_apartment.replace(' ', '').replace('-', '')) > 10:
            # Too long to be an apartment number
            logger.debug(
                f"'{potential_apartment}' too long to be apartment number, "
                f"treating as part of base address"
            )
            return address_text.strip(), None
        
        # If it's just digits and longer than 3 digits, might be postal code
        if potential_apartment.isdigit() and len(potential_apartment) >= 4:
            # Could be a postal code, be cautious
            logger.debug(
                f"'{potential_apartment}' looks like postal code, "
                f"treating as part of base address"
            )
            return address_text.strip(), None
        
        # Looks like a valid apartment number
        logger.debug(
            f"Parsed address: base='{base_address}', apt='{potential_apartment}'"
        )
        return base_address, potential_apartment
    else:
        # No apartment number found
        logger.debug(f"No apartment number found in: '{address_text}'")
        return address_text.strip(), None


def validate_address_format(address_text: str, require_apartment: bool = False) -> bool:
    """
    Validate that address follows expected format.
    
    Args:
        address_text (str): Address to validate
        require_apartment (bool): If True, requires apartment number to be present
        
    Returns:
        bool: True if address format is valid
        
    Examples:
        >>> validate_address_format("Hausmanns gate 19A, 0182 Oslo, 1")
        True
        
        >>> validate_address_format("Hausmanns gate 19A, 0182 Oslo")
        True
        
        >>> validate_address_format("Hausmanns gate 19A, 0182 Oslo", require_apartment=True)
        False
        
        >>> validate_address_format("")
        False
    """
    if not address_text or not address_text.strip():
        return False
    
    base, apt = parse_address_text(address_text)
    
    # Must have a valid base address
    if not base:
        return False
    
    # If apartment is required, must have one
    if require_apartment and not apt:
        return False
    
    return True


def format_apartment_address(base_address: str, apartment_number: str) -> str:
    """
    Format base address and apartment number into full address.
    
    This is the reverse operation of parse_address_text().
    
    Args:
        base_address (str): Base address without apartment
        apartment_number (str): Apartment/unit number
        
    Returns:
        str: Formatted full address
        
    Examples:
        >>> format_apartment_address("Hausmanns gate 19A, 0182 Oslo", "1")
        "Hausmanns gate 19A, 0182 Oslo, 1"
        
        >>> format_apartment_address("Storgata 5, Oslo", "H0102")
        "Storgata 5, Oslo, H0102"
    """
    base = base_address.strip()
    apt = apartment_number.strip()
    
    return f"{base}, {apt}"


def extract_base_addresses_from_queryset(addresses_qs):
    """
    Extract unique base addresses from a queryset of Address objects.
    
    Useful for finding all buildings that have apartments in a queryset.
    
    Args:
        addresses_qs: Django queryset of Address objects
        
    Returns:
        set: Set of unique base addresses
        
    Example:
        >>> from addresses.models import Address
        >>> addresses = Address.objects.filter(campaign_id=some_id)
        >>> bases = extract_base_addresses_from_queryset(addresses)
        >>> print(bases)
        {'Hausmanns gate 19A, 0182 Oslo', 'Storgata 5, Oslo', ...}
    """
    base_addresses = set()
    
    for address in addresses_qs:
        base, apt = parse_address_text(address.address_text)
        if apt:  # Only include if it has an apartment number
            base_addresses.add(base)
    
    return base_addresses


def is_apartment_address(address_text: str) -> bool:
    """
    Check if an address includes an apartment number.
    
    Args:
        address_text (str): Address to check
        
    Returns:
        bool: True if address includes apartment number
        
    Examples:
        >>> is_apartment_address("Hausmanns gate 19A, 0182 Oslo, 1")
        True
        
        >>> is_apartment_address("Hausmanns gate 19A, 0182 Oslo")
        False
    """
    _, apt = parse_address_text(address_text)
    return apt is not None


def get_apartment_count_from_numbers(apartment_numbers: list) -> dict:
    """
    Get statistics about apartment numbers.
    
    Args:
        apartment_numbers (list): List of apartment number strings
        
    Returns:
        dict: Statistics about the apartment numbers
        
    Example:
        >>> get_apartment_count_from_numbers(["1", "2", "3", "4", "5"])
        {'total': 5, 'numeric': 5, 'alphanumeric': 0, 'format': 'numeric'}
    """
    if not apartment_numbers:
        return {
            'total': 0,
            'numeric': 0,
            'alphanumeric': 0,
            'format': 'unknown'
        }
    
    numeric = sum(1 for n in apartment_numbers if n.strip().isdigit())
    alphanumeric = len(apartment_numbers) - numeric
    
    # Determine predominant format
    if numeric > alphanumeric:
        format_type = 'numeric'
    elif alphanumeric > numeric:
        format_type = 'alphanumeric'
    else:
        format_type = 'mixed'
    
    return {
        'total': len(apartment_numbers),
        'numeric': numeric,
        'alphanumeric': alphanumeric,
        'format': format_type
    }

