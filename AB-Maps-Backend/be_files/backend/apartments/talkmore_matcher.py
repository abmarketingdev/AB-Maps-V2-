"""
Talkmore Enriched Address Result ↔ Apartment Matching Utilities

This module implements the matching workflow between:
- talkmore_enriched_address_result (enriched with carrier information)
- apartment table (user-created apartments from frontend)
"""
import re
import logging
from typing import Dict, Optional, List, Tuple
from django.db import connection
from django.contrib.gis.geos import Point

logger = logging.getLogger(__name__)


def extract_postcode_from_address(address: str) -> Optional[str]:
    """
    Extract postcode from address string.
    
    Format: "Street Name Number[Letter], Postcode City"
    Example: "Stordamveien 31, 0671 Oslo" → "0671"
    
    Args:
        address: Full address string
        
    Returns:
        4-digit postcode string or None if not found
    """
    if not address:
        return None
    
    # Pattern: 4 digits after comma
    match = re.search(r',\s*(\d{4})\s+', address)
    if match:
        return match.group(1)
    
    # Fallback: any 4-digit sequence
    match = re.search(r'(\d{4})', address)
    if match:
        return match.group(1)
    
    return None


def get_talkmore_enriched_data(enriched_id):
    """
    Extract data from talkmore_enriched_address_result.
    
    Args:
        enriched_id: BigAutoField ID (integer) or address_uuid (UUID) from talkmore_enriched_address_result
        
    Returns:
        dict with:
            - id
            - address_uuid
            - address_text
            - postcode
            - geom (Point object)
            - people (list)
            - carrier_summary (dict)
            - show_marker (bool)
            - status
        or None if not found
    """
    with connection.cursor() as cursor:
        # Try as integer ID first, then as address_uuid
        if isinstance(enriched_id, int) or (isinstance(enriched_id, str) and enriched_id.isdigit()):
            cursor.execute("""
                SELECT 
                    id,
                    address_uuid,
                    address_text,
                    postcode,
                    ST_AsText(geom) as geom_wkt,
                    ST_X(geom) as lon,
                    ST_Y(geom) as lat,
                    people,
                    carrier_summary,
                    show_marker,
                    status
                FROM talkmore_enriched_address_result
                WHERE id = %s
            """, [int(enriched_id)])
        else:
            # Try as address_uuid
            cursor.execute("""
                SELECT 
                    id,
                    address_uuid,
                    address_text,
                    postcode,
                    ST_AsText(geom) as geom_wkt,
                    ST_X(geom) as lon,
                    ST_Y(geom) as lat,
                    people,
                    carrier_summary,
                    show_marker,
                    status
                FROM talkmore_enriched_address_result
                WHERE address_uuid = %s
            """, [enriched_id])
        
        row = cursor.fetchone()
        if not row:
            logger.warning(f"Talkmore enriched address result not found: {enriched_id}")
            return None
        
        # Convert geometry WKT to Point object
        geom = None
        if row[4]:  # geom_wkt
            try:
                from django.contrib.gis.geos import GEOSGeometry
                geom = GEOSGeometry(row[4], srid=4326)
            except Exception as e:
                logger.error(f"Error parsing geometry: {e}")
                # Fallback to lon/lat if WKT fails
                if row[5] is not None and row[6] is not None:  # lon and lat
                    geom = Point(row[5], row[6], srid=4326)
        
        return {
            'id': row[0],
            'address_uuid': row[1],
            'address_text': row[2],
            'postcode': row[3],
            'geom': geom,
            'lon': row[5],
            'lat': row[6],
            'people': row[7] if row[7] else [],
            'carrier_summary': row[8] if row[8] else {},
            'show_marker': row[9] if row[9] is not None else False,
            'status': row[10]
        }


def get_apartment_data(apartment_id):
    """
    Extract data from apartment and building tables.
    
    Args:
        apartment_id: UUID from apartment table
        
    Returns:
        dict with:
            - apartment_id
            - apartment_number
            - building_id
            - building_base_address
            - building_position (Point object)
            - building_postcode (extracted from base_address)
            - status
            - campaign_id
        or None if not found
    """
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT 
                a.id,
                a.apartment_number,
                a.building_id,
                a.status,
                b.id as building_id_full,
                b.base_address,
                ST_AsText(b.position) as building_geom_wkt,
                ST_X(b.position) as building_lon,
                ST_Y(b.position) as building_lat,
                b.campaign_id
            FROM apartment a
            LEFT JOIN building b ON a.building_id = b.id
            WHERE a.id = %s
        """, [apartment_id])
        
        row = cursor.fetchone()
        if not row:
            logger.warning(f"Apartment not found: {apartment_id}")
            return None
        
        # Parse postcode from base_address
        postcode = extract_postcode_from_address(row[5]) if row[5] else None
        
        # Convert geometry WKT to Point object
        building_position = None
        if row[6]:  # building_geom_wkt
            try:
                from django.contrib.gis.geos import GEOSGeometry
                building_position = GEOSGeometry(row[6], srid=4326)
            except Exception as e:
                logger.error(f"Error parsing building geometry: {e}")
                # Fallback to lon/lat if WKT fails
                if row[7] is not None and row[8] is not None:  # building_lon and building_lat
                    building_position = Point(row[7], row[8], srid=4326)
        
        return {
            'apartment_id': row[0],
            'apartment_number': row[1],
            'building_id': row[2],
            'status': row[3],
            'building_id_full': row[4],
            'building_base_address': row[5],
            'building_position': building_position,
            'building_lon': row[7],
            'building_lat': row[8],
            'building_postcode': postcode,
            'campaign_id': row[9]
        }


# ============================================================================
# Phase 2: Building-Level Matching
# ============================================================================

def find_buildings_by_geometry(enriched_geom, enriched_postcode, tolerance_meters=50):
    """
    Find buildings within tolerance distance of enriched address geometry.
    
    Args:
        enriched_geom: Point geometry from talkmore_enriched_address_result
        enriched_postcode: Postcode from talkmore_enriched_address_result
        tolerance_meters: Distance tolerance in meters (default: 50)
        
    Returns:
        List of building matches with:
            - building_id
            - base_address
            - position (Point object)
            - distance_meters
            - postcode_match (bool)
    """
    if not enriched_geom:
        logger.warning("No geometry provided for building search")
        return []
    
    with connection.cursor() as cursor:
        cursor.execute("""
            WITH enriched_info AS (
                SELECT 
                    %s::geometry(Point, 4326) as geom,
                    %s as postcode
            )
            SELECT 
                b.id,
                b.base_address,
                ST_AsText(b.position) as position_wkt,
                ST_X(b.position) as position_lon,
                ST_Y(b.position) as position_lat,
                ST_Distance(
                    b.position::geography,
                    ei.geom::geography
                ) as distance_meters
            FROM building b
            CROSS JOIN enriched_info ei
            WHERE ST_DWithin(
                b.position::geography,
                ei.geom::geography,
                %s
            )
            ORDER BY distance_meters ASC
            LIMIT 10
        """, [enriched_geom.wkt, enriched_postcode, tolerance_meters])
        
        columns = [col[0] for col in cursor.description]
        results = []
        
        for row in cursor.fetchall():
            result = dict(zip(columns, row))
            
            # Convert geometry WKT to Point object
            position = None
            if result['position_wkt']:
                try:
                    from django.contrib.gis.geos import GEOSGeometry
                    position = GEOSGeometry(result['position_wkt'], srid=4326)
                except Exception as e:
                    logger.error(f"Error parsing building position: {e}")
                    # Fallback to lon/lat
                    if result['position_lon'] is not None and result['position_lat'] is not None:
                        position = Point(result['position_lon'], result['position_lat'], srid=4326)
            
            # Verify postcode match in Python (more reliable than SQL regex)
            postcode_match = verify_postcode_match(enriched_postcode, result['base_address'])
            
            results.append({
                'building_id': result['id'],
                'base_address': result['base_address'],
                'position': position,
                'distance_meters': float(result['distance_meters']),
                'postcode_match': postcode_match
            })
        
        return results


def verify_postcode_match(enriched_postcode, building_base_address):
    """
    Extract and compare postcodes.
    
    Args:
        enriched_postcode: Postcode from talkmore_enriched_address_result
        building_base_address: Base address from building table
        
    Returns:
        bool: True if postcodes match
    """
    if not enriched_postcode or not building_base_address:
        return False
    
    # Extract postcode from building address using our utility function
    building_postcode = extract_postcode_from_address(building_base_address)
    
    if not building_postcode:
        return False
    
    return building_postcode == enriched_postcode


def select_best_building_match(enriched_data, building_matches, tolerance_meters=50):
    """
    Select the best building match from candidates.
    
    Criteria (in order):
    1. Postcode match (required)
    2. Smallest distance (preferred)
    3. Within tolerance (required)
    
    Args:
        enriched_data: Data from talkmore_enriched_address_result
        building_matches: List from find_buildings_by_geometry()
        tolerance_meters: Maximum distance tolerance (default: 50)
        
    Returns:
        dict: Best match or None
    """
    if not building_matches:
        return None
    
    # Filter by postcode match
    postcode_matches = [m for m in building_matches if m['postcode_match']]
    
    if not postcode_matches:
        logger.info(f"No buildings found with matching postcode {enriched_data.get('postcode')}")
        return None
    
    # Select closest match
    best_match = min(postcode_matches, key=lambda x: x['distance_meters'])
    
    # Verify within tolerance
    if best_match['distance_meters'] > tolerance_meters:
        logger.warning(
            f"Best match distance {best_match['distance_meters']:.2f}m exceeds tolerance {tolerance_meters}m"
        )
        return None
    
    logger.info(
        f"Selected building match: {best_match['building_id']} "
        f"(distance: {best_match['distance_meters']:.2f}m, postcode: {enriched_data.get('postcode')})"
    )
    
    return best_match


# ============================================================================
# Phase 3: Apartment-Level Matching
# ============================================================================

def parse_enriched_address_text(address_text):
    """
    Parse address_text from talkmore_enriched_address_result.
    
    Supported formats:
    1. Apartment format: "Street Name Number[Letter]-UnitID"
       Example: "Akersgata 65B-H0402" → unit_id: "H0402", is_apartment: True
    
    2. Single house format: "Street Name Number[Letter]"
       Example: "Stordamveien 31" → unit_id: None, is_apartment: False
    
    3. Cadastral format: "Property/Section-Unit"
       Example: "208/18-1" → unit_id: "1", is_apartment: True
       Example: "208/672-3" → unit_id: "3", is_apartment: True
    
    Args:
        address_text: Full address string from enriched result
        
    Returns:
        dict with:
            - street_name: Street name
            - house_number: House number
            - house_letter: Optional letter (A, B, C, etc.)
            - unit_id: Unit identifier if apartment, None if single house
            - base_address: Street + number + letter (without unit)
            - is_apartment: bool
            - is_cadastral: bool (True if cadastral format)
        or None if parsing fails
    """
    if not address_text:
        return None
    
    # Pattern 1: Apartment format "Street NumberLetter-UnitID"
    # Example: "Akersgata 65B-H0402"
    apartment_pattern = r'^(.+?)\s+(\d+)([A-Z]?)-([A-Z]\d+)$'
    match = re.match(apartment_pattern, address_text.strip())
    
    if match:
        return {
            'street_name': match.group(1).strip(),
            'house_number': int(match.group(2)),
            'house_letter': match.group(3) if match.group(3) else None,
            'unit_id': match.group(4),
            'base_address': f"{match.group(1)} {match.group(2)}{match.group(3) or ''}",
            'is_apartment': True,
            'is_cadastral': False
        }
    
    # Pattern 2: Single house format "Street NumberLetter"
    # Example: "Stordamveien 31"
    house_pattern = r'^(.+?)\s+(\d+)([A-Z]?)$'
    match = re.match(house_pattern, address_text.strip())
    
    if match:
        return {
            'street_name': match.group(1).strip(),
            'house_number': int(match.group(2)),
            'house_letter': match.group(3) if match.group(3) else None,
            'unit_id': None,
            'base_address': f"{match.group(1)} {match.group(2)}{match.group(3) or ''}",
            'is_apartment': False,
            'is_cadastral': False
        }
    
    # Pattern 3: Cadastral format "Property/Section-Unit"
    # Example: "208/18-1", "208/672-3"
    cadastral_pattern = r'^(\d+)/(\d+)-(\d+)$'
    match = re.match(cadastral_pattern, address_text.strip())
    
    if match:
        return {
            'street_name': None,
            'house_number': None,
            'house_letter': None,
            'unit_id': match.group(3),  # The unit number after the hyphen
            'base_address': f"{match.group(1)}/{match.group(2)}",
            'is_apartment': True,  # Cadastral with unit means it's an apartment
            'is_cadastral': True,
            'property_number': match.group(1),
            'section_number': match.group(2)
        }
    
    logger.warning(f"Could not parse address_text: {address_text}")
    return None


def normalize_unit_id(unit_id):
    """
    Normalize unit ID for comparison.
    
    Matches Apartment.normalize_apartment_number behavior:
    - Case differences (H0101 vs h0101)
    - Spaces and hyphens (H-0101 vs H0101)
    - Leading zeros ONLY if at start of string (keeps zeros in alphanumeric codes)
    
    Examples:
        "H0202" → "H0202" (zeros kept - alphanumeric)
        "0202" → "202" (zeros removed - purely numeric)
        "H-0101" → "H0101" (hyphen removed, zeros kept)
    
    Args:
        unit_id: Unit identifier string
        
    Returns:
        Normalized string (uppercase, no spaces/hyphens, leading zeros removed only from start)
        or None if unit_id is None/empty
    """
    if not unit_id:
        return None
    
    # Remove spaces and hyphens
    normalized = str(unit_id).strip().replace(' ', '').replace('-', '')
    
    if not normalized:
        return None
    
    # Uppercase
    normalized = normalized.upper()
    
    # Remove leading zeros ONLY from the start of the string
    # This matches Apartment.normalize_apartment_number behavior
    # For "H0202", zeros are kept because "H" is first
    # For "0202", zeros are removed → "202"
    normalized = normalized.lstrip('0') or '0'
    
    return normalized


def find_matching_apartments_in_building(building_id, enriched_unit_id):
    """
    Find apartments in building that match the enriched unit ID.
    
    Args:
        building_id: UUID of matched building
        enriched_unit_id: Unit ID extracted from address_text
        
    Returns:
        List of matching apartments with:
            - apartment_id
            - apartment_number
            - status
            - match_type: 'exact'
    """
    if not enriched_unit_id:
        return []  # Single house, no apartment match needed
    
    if not building_id:
        logger.warning("No building_id provided for apartment matching")
        return []
    
    normalized_enriched = normalize_unit_id(enriched_unit_id)
    
    if not normalized_enriched:
        return []
    
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT 
                id,
                apartment_number,
                status
            FROM apartment
            WHERE building_id = %s
        """, [building_id])
        
        matches = []
        
        for row in cursor.fetchall():
            apartment_id, apartment_number, status = row
            
            if not apartment_number:
                continue
            
            # Normalize apartment number
            normalized_apt = normalize_unit_id(apartment_number)
            
            # Check for exact match
            if normalized_apt == normalized_enriched:
                matches.append({
                    'apartment_id': apartment_id,
                    'apartment_number': apartment_number,
                    'status': status,
                    'match_type': 'exact'
                })
        
        return matches


# ============================================================================
# Phase 4: Verification and Validation
# ============================================================================

def verify_address_text_match(enriched_address_text, building_base_address):
    """
    Verify that address_text matches building base_address.
    
    Compare:
    - Enriched: "Akersgata 65B-H0402" → base: "Akersgata 65B"
    - Building: "Akersgata 65B, 0165 Oslo" → base: "Akersgata 65B"
    
    Args:
        enriched_address_text: Full address from enriched result
        building_base_address: Base address from building table
        
    Returns:
        bool: True if addresses match (ignoring postcode/city)
    """
    if not enriched_address_text or not building_base_address:
        return False
    
    # Parse enriched address
    enriched_parsed = parse_enriched_address_text(enriched_address_text)
    if not enriched_parsed:
        return False
    
    enriched_base = enriched_parsed['base_address']
    
    # Extract base from building address (remove postcode and city)
    # Format: "Street NumberLetter, Postcode City"
    building_match = re.match(r'^(.+?),\s*\d{4}\s+.+$', building_base_address)
    if building_match:
        building_base = building_match.group(1).strip()
    else:
        building_base = building_base_address.strip()
    
    # Normalize and compare (case-insensitive, ignore spaces)
    enriched_normalized = enriched_base.upper().replace(' ', '')
    building_normalized = building_base.upper().replace(' ', '')
    
    return enriched_normalized == building_normalized


def validate_complete_match(enriched_data, building_match, apartment_matches):
    """
    Validate that the complete match is correct.
    
    Validation checks:
    1. Building geometry within tolerance ✓
    2. Postcode matches ✓
    3. Address text matches building base address ✓
    4. Apartment unit ID matches (if apartment) ✓
    
    Args:
        enriched_data: Data from talkmore_enriched_address_result
        building_match: Best building match
        apartment_matches: List of matching apartments
        
    Returns:
        dict with validation results:
            - is_valid: bool
            - errors: list of error messages (invalid matches)
            - warnings: list of warning messages (suspicious but valid)
    """
    validation = {
        'is_valid': True,
        'errors': [],
        'warnings': []
    }
    
    if not building_match:
        validation['is_valid'] = False
        validation['errors'].append("No building match provided")
        return validation
    
    # Check 1: Geometry distance
    if building_match.get('distance_meters', float('inf')) > 50:
        validation['is_valid'] = False
        validation['errors'].append(
            f"Distance too large: {building_match['distance_meters']:.2f}m (max: 50m)"
        )
    
    # Check 2: Postcode match
    if not building_match.get('postcode_match', False):
        validation['is_valid'] = False
        validation['errors'].append("Postcode mismatch")
    
    # Check 3: Address text match
    if enriched_data and enriched_data.get('address_text'):
        address_match = verify_address_text_match(
            enriched_data['address_text'],
            building_match.get('base_address', '')
        )
        if not address_match:
            validation['warnings'].append(
                f"Address text doesn't exactly match building address. "
                f"Enriched: '{enriched_data['address_text']}', "
                f"Building: '{building_match.get('base_address', '')}'"
            )
    
    # Check 4: Apartment match (if apartment)
    if enriched_data and enriched_data.get('address_text'):
        enriched_parsed = parse_enriched_address_text(enriched_data['address_text'])
        if enriched_parsed and enriched_parsed.get('is_apartment'):
            if not apartment_matches:
                validation['warnings'].append(
                    f"No matching apartment found for unit ID '{enriched_parsed.get('unit_id')}'"
                )
            elif len(apartment_matches) > 1:
                validation['warnings'].append(
                    f"Multiple apartments ({len(apartment_matches)}) match unit ID "
                    f"'{enriched_parsed.get('unit_id')}'"
                )
    
    return validation


# ============================================================================
# Phase 5: Complete Matching Function
# ============================================================================

def match_talkmore_to_apartment(enriched_id, apartment_id):
    """
    Complete workflow to match talkmore_enriched_address_result with apartment.
    
    Workflow:
    1. Extract data from both tables
    2. Find building matches by geometry
    3. Select best building match
    4. Find matching apartments in building
    5. Validate complete match
    
    Args:
        enriched_id: ID from talkmore_enriched_address_result
        apartment_id: UUID from apartment table
        
    Returns:
        dict with:
            - match_found: bool
            - building_match: dict or None
            - apartment_matches: list
            - validation: dict
            - enriched_data: dict
            - apartment_data: dict
            - error: str (if match_found is False)
    """
    # Step 1: Extract data
    enriched_data = get_talkmore_enriched_data(enriched_id)
    apartment_data = get_apartment_data(apartment_id)
    
    if not enriched_data or not apartment_data:
        return {
            'match_found': False,
            'error': 'Data not found',
            'enriched_data_found': enriched_data is not None,
            'apartment_data_found': apartment_data is not None
        }
    
    # Step 2: Find building matches
    building_matches = find_buildings_by_geometry(
        enriched_data['geom'],
        enriched_data['postcode'],
        tolerance_meters=50
    )
    
    if not building_matches:
        return {
            'match_found': False,
            'error': 'No buildings found within tolerance',
            'enriched_data': {
                'address_text': enriched_data['address_text'],
                'postcode': enriched_data['postcode'],
                'position': f"{enriched_data['lat']:.6f}, {enriched_data['lon']:.6f}"
            },
            'apartment_data': {
                'apartment_number': apartment_data['apartment_number'],
                'building_address': apartment_data['building_base_address'],
                'building_position': f"{apartment_data['building_lat']:.6f}, {apartment_data['building_lon']:.6f}"
            }
        }
    
    # Step 3: Select best building match
    best_building = select_best_building_match(enriched_data, building_matches, tolerance_meters=50)
    
    if not best_building:
        return {
            'match_found': False,
            'error': 'No building match with postcode',
            'building_candidates': len(building_matches),
            'enriched_data': {
                'address_text': enriched_data['address_text'],
                'postcode': enriched_data['postcode']
            },
            'apartment_data': {
                'apartment_number': apartment_data['apartment_number'],
                'building_address': apartment_data['building_base_address']
            }
        }
    
    # Step 4: Check if matched building is the same as apartment's building
    if best_building['building_id'] != apartment_data['building_id']:
        return {
            'match_found': False,
            'error': 'Matched building does not match apartment building',
            'matched_building_id': str(best_building['building_id']),
            'matched_building_address': best_building['base_address'],
            'apartment_building_id': str(apartment_data['building_id']),
            'apartment_building_address': apartment_data['building_base_address'],
            'enriched_data': {
                'address_text': enriched_data['address_text'],
                'postcode': enriched_data['postcode']
            },
            'apartment_data': {
                'apartment_number': apartment_data['apartment_number']
            }
        }
    
    # Step 5: Find matching apartments
    enriched_parsed = parse_enriched_address_text(enriched_data['address_text'])
    enriched_unit_id = enriched_parsed['unit_id'] if enriched_parsed else None
    
    apartment_matches = find_matching_apartments_in_building(
        best_building['building_id'],
        enriched_unit_id
    )
    
    # Step 6: Validate
    validation = validate_complete_match(
        enriched_data,
        best_building,
        apartment_matches
    )
    
    return {
        'match_found': True,
        'building_match': {
            'building_id': str(best_building['building_id']),
            'base_address': best_building['base_address'],
            'distance_meters': best_building['distance_meters'],
            'postcode_match': best_building['postcode_match']
        },
        'apartment_matches': [
            {
                'apartment_id': str(match['apartment_id']),
                'apartment_number': match['apartment_number'],
                'status': match['status'],
                'match_type': match['match_type']
            }
            for match in apartment_matches
        ],
        'validation': validation,
        'enriched_data': {
            'id': enriched_data['id'],
            'address_text': enriched_data['address_text'],
            'postcode': enriched_data['postcode'],
            'carrier_summary': enriched_data['carrier_summary'],
            'show_marker': enriched_data['show_marker'],
            'people_count': len(enriched_data['people'])
        },
        'apartment_data': {
            'apartment_id': str(apartment_data['apartment_id']),
            'apartment_number': apartment_data['apartment_number'],
            'building_address': apartment_data['building_base_address']
        }
    }


def get_carrier_info_for_apartment(apartment_id):
    """
    Get carrier information for an apartment by finding matching enriched addresses.
    
    This is the main goal: for each apartment, find which carriers it has.
    
    Args:
        apartment_id: UUID from apartment table
        
    Returns:
        dict with:
            - apartment_id
            - apartment_number
            - building_address
            - matches: list of enriched address matches with carrier info
            - total_carriers: total count of carriers found
            - carrier_summary: aggregated carrier summary
    """
    # Get apartment data
    apartment_data = get_apartment_data(apartment_id)
    if not apartment_data:
        return {
            'apartment_id': str(apartment_id),
            'error': 'Apartment not found'
        }
    
    # Get building position and postcode
    building_position = apartment_data['building_position']
    building_postcode = apartment_data['building_postcode']
    
    if not building_position or not building_postcode:
        return {
            'apartment_id': str(apartment_id),
            'apartment_number': apartment_data['apartment_number'],
            'error': 'Building position or postcode not available'
        }
    
    # Find enriched addresses near this building
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT 
                id,
                address_text,
                postcode,
                ST_AsText(geom) as geom_wkt,
                ST_X(geom) as lon,
                ST_Y(geom) as lat,
                people,
                carrier_summary,
                show_marker
            FROM talkmore_enriched_address_result
            WHERE postcode = %s
                AND ST_DWithin(
                    geom::geography,
                    %s::geography,
                    50
                )
            ORDER BY ST_Distance(
                geom::geography,
                %s::geography
            ) ASC
            LIMIT 20
        """, [building_postcode, building_position.wkt, building_position.wkt])
        
        columns = [col[0] for col in cursor.description]
        enriched_candidates = []
        
        # FIX: Normalize building base address for comparison to prevent
        # cross-building matching (e.g., Building 23 matching with Building 22's data)
        building_base = apartment_data['building_base_address']
        building_base_normalized = building_base.split(',')[0].strip().upper().replace(' ', '') if building_base else ''
        
        for row in cursor.fetchall():
            result = dict(zip(columns, row))
            
            # Parse address to get unit ID and base_address
            parsed = parse_enriched_address_text(result['address_text'])
            if parsed and parsed.get('is_apartment'):
                # FIX: Verify base_address matches building
                enriched_base = parsed.get('base_address', '')
                enriched_base_normalized = enriched_base.upper().replace(' ', '')
                
                # Skip if base addresses don't match
                if enriched_base_normalized != building_base_normalized:
                    logger.debug(
                        f"Skipping enriched address '{result['address_text']}' - "
                        f"base address mismatch: '{enriched_base}' != '{building_base.split(',')[0].strip() if building_base else ''}'"
                    )
                    continue
                
                unit_id = parsed['unit_id']
                normalized_unit = normalize_unit_id(unit_id)
                normalized_apt = normalize_unit_id(apartment_data['apartment_number'])
                
                # Check if unit matches apartment number
                if normalized_unit == normalized_apt:
                    # Parse JSON fields if they're strings
                    people = result['people'] if result['people'] else []
                    carrier_summary = result['carrier_summary'] if result['carrier_summary'] else {}
                    
                    # Handle case where JSON comes as string
                    import json
                    if isinstance(people, str):
                        try:
                            people = json.loads(people)
                        except (json.JSONDecodeError, TypeError):
                            people = []
                    
                    if isinstance(carrier_summary, str):
                        try:
                            carrier_summary = json.loads(carrier_summary)
                        except (json.JSONDecodeError, TypeError):
                            carrier_summary = {}
                    
                    enriched_candidates.append({
                        'enriched_id': result['id'],
                        'address_text': result['address_text'],
                        'unit_id': unit_id,
                        'people': people,
                        'carrier_summary': carrier_summary,
                        'show_marker': result['show_marker']
                    })
    
    # Aggregate carrier information
    all_carriers = {}
    total_people = 0
    
    for candidate in enriched_candidates:
        total_people += len(candidate['people'])
        for carrier, count in candidate['carrier_summary'].items():
            all_carriers[carrier] = all_carriers.get(carrier, 0) + count
    
    return {
        'apartment_id': str(apartment_id),
        'apartment_number': apartment_data['apartment_number'],
        'building_address': apartment_data['building_base_address'],
        'matches': enriched_candidates,
        'total_matches': len(enriched_candidates),
        'total_people': total_people,
        'carrier_summary': all_carriers,
        'has_carriers': len(all_carriers) > 0,
        'show_marker': any(c['show_marker'] for c in enriched_candidates)
    }


# ============================================================================
# Batch Carrier Status for Building (Optimized for API)
# ============================================================================

# Talkmore Campaign Name - carrier info is only available for this campaign
# Note: We look up by name instead of hardcoding ID to support different environments
TALKMORE_CAMPAIGN_NAME = 'Talkmore'

from talkmore_enrichment.carrier_rules import apartment_carrier_status


def get_carrier_status_for_building(building_id):
    """
    Get carrier availability status for all apartments in a building.
    
    This is an optimized batch query that returns carrier status for all
    apartments in a building in a single database query.
    
    Only works for buildings in the Talkmore campaign.
    
    Args:
        building_id: UUID of the building
        
    Returns:
        dict with:
            - apartment_statuses: dict mapping apartment_id to carrier_status
            - is_talkmore_campaign: bool indicating if this is a Talkmore building
            
        carrier_status values:
            - 'telenor_talkmore_available': all lines are Telenor/Talkmore only
            - 'business_carrier': all lines allowed and includes Unifon/Phonero
            - 'other_carriers': any disallowed carrier (Ice, OneCall, mixed, etc.)
            - 'not_enriched': No enriched data found for this apartment
            - 'not_applicable': Building is not in Talkmore campaign
    """
    import json
    
    with connection.cursor() as cursor:
        # First check if building is in Talkmore campaign
        cursor.execute("""
            SELECT b.campaign_id, b.base_address, ST_AsText(b.position) as position_wkt,
                   ST_X(b.position) as lon, ST_Y(b.position) as lat
            FROM building b
            WHERE b.id = %s
        """, [building_id])
        
        building_row = cursor.fetchone()
        if not building_row:
            return {
                'apartment_statuses': {},
                'is_talkmore_campaign': False,
                'error': 'Building not found'
            }
        
        campaign_id = str(building_row[0]) if building_row[0] else None
        base_address = building_row[1]
        building_lon = building_row[3]
        building_lat = building_row[4]
        
        # Check if this is a Talkmore campaign (lookup by name, not hardcoded ID)
        is_talkmore = False
        if campaign_id:
            cursor.execute("""
                SELECT name FROM campaign WHERE id = %s
            """, [campaign_id])
            campaign_row = cursor.fetchone()
            if campaign_row and campaign_row[0] and campaign_row[0].upper() == TALKMORE_CAMPAIGN_NAME.upper():
                is_talkmore = True
        
        if not is_talkmore:
            return {
                'apartment_statuses': {},
                'is_talkmore_campaign': False,
                'message': 'Carrier info only available for Talkmore campaign'
            }
        
        # Extract postcode from building address
        postcode = extract_postcode_from_address(base_address)
        
        if not postcode or not building_lon or not building_lat:
            return {
                'apartment_statuses': {},
                'is_talkmore_campaign': True,
                'error': 'Building missing postcode or position'
            }
        
        # Get all apartments for this building
        cursor.execute("""
            SELECT id, apartment_number
            FROM apartment
            WHERE building_id = %s
        """, [building_id])
        
        apartments = cursor.fetchall()
        if not apartments:
            return {
                'apartment_statuses': {},
                'is_talkmore_campaign': True,
                'message': 'No apartments found for building'
            }
        
        # Get all enriched addresses near this building with matching postcode
        cursor.execute("""
            SELECT 
                id,
                address_text,
                carrier_summary,
                show_marker
            FROM talkmore_enriched_address_result
            WHERE postcode = %s
                AND ST_DWithin(
                    geom::geography,
                    ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
                    50
                )
        """, [postcode, building_lon, building_lat])
        
        enriched_rows = cursor.fetchall()
        
        # Build a map of unit_id -> enriched data
        # FIX: Also verify base_address matches building address to prevent
        # cross-building matching (e.g., Building 23 matching with Building 22's data)
        enriched_by_unit = {}
        
        # Normalize building base address for comparison (remove postcode/city)
        building_base_normalized = base_address.split(',')[0].strip().upper().replace(' ', '')
        
        for row in enriched_rows:
            enriched_id, address_text, carrier_summary, show_marker = row
            
            # Parse address to get unit ID and base_address
            parsed = parse_enriched_address_text(address_text)
            if parsed and parsed.get('is_apartment') and parsed.get('unit_id'):
                # FIX: Check if base_address matches building
                enriched_base = parsed.get('base_address', '')
                enriched_base_normalized = enriched_base.upper().replace(' ', '')
                
                # Only match if base addresses are similar
                if enriched_base_normalized != building_base_normalized:
                    # Skip - this enriched address is for a different building
                    logger.debug(
                        f"Skipping enriched address '{address_text}' - "
                        f"base address mismatch: '{enriched_base}' != '{base_address.split(',')[0].strip()}'"
                    )
                    continue
                
                unit_id = normalize_unit_id(parsed['unit_id'])
                if unit_id:
                    # Parse carrier_summary if it's a string
                    if isinstance(carrier_summary, str):
                        try:
                            carrier_summary = json.loads(carrier_summary)
                        except (json.JSONDecodeError, TypeError):
                            carrier_summary = {}
                    
                    enriched_by_unit[unit_id] = {
                        'enriched_id': enriched_id,
                        'carrier_summary': carrier_summary or {},
                        'show_marker': show_marker
                    }
        
        # Determine carrier status for each apartment
        apartment_statuses = {}
        
        for apt_id, apt_number in apartments:
            normalized_apt = normalize_unit_id(apt_number)
            
            if normalized_apt and normalized_apt in enriched_by_unit:
                enriched_data = enriched_by_unit[normalized_apt]
                carrier_summary = enriched_data['carrier_summary']
                
                if carrier_summary:
                    apartment_statuses[str(apt_id)] = apartment_carrier_status(
                        carrier_summary
                    )
                else:
                    apartment_statuses[str(apt_id)] = 'not_enriched'
            else:
                apartment_statuses[str(apt_id)] = 'not_enriched'
        
        return {
            'apartment_statuses': apartment_statuses,
            'is_talkmore_campaign': True,
            'building_address': base_address,
            'enriched_count': len(enriched_by_unit),
            'apartments_count': len(apartments)
        }
