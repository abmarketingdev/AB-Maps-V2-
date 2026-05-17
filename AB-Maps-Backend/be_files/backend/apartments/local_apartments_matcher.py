"""
Utilities for matching apartments/buildings with local_apartments table.

Provides bidirectional lookup and geometry comparison between:
- apartment/building tables (user-created data)
- local_apartments table (official Kartverket data)
"""
import re
import logging
from typing import Dict, List, Optional, Tuple
from django.db import connection
from django.contrib.gis.geos import Point

logger = logging.getLogger(__name__)


def parse_cadastral_address(full_address: str) -> Optional[Dict]:
    """
    Parse Norwegian cadastral address format from local_apartments.
    
    Formats:
    - Apartment: "Haukland, 24/4-H0102" → area="Haukland", property=24, section=4, unit="H0102"
    - Single house: "Surdal, 33/50" → area="Surdal", property=33, section=50, unit=None
    
    Args:
        full_address: Full address string from local_apartments
        
    Returns:
        dict with keys: area, property_number, section_number, unit_id, base_address
        Returns None if pattern doesn't match
    """
    if not full_address:
        return None
    
    # Pattern 1: Apartment format "Area, Property/Section-Unit"
    # Example: "Haukland, 24/4-H0102"
    apartment_pattern = r'^([^,]+),\s*(\d+)/(\d+)-([A-Za-z0-9]+)$'
    match = re.match(apartment_pattern, full_address.strip())
    
    if match:
        area = match.group(1).strip()
        property_number = int(match.group(2))
        section_number = int(match.group(3))
        unit_id = match.group(4)
        
        return {
            'area': area,
            'property_number': property_number,
            'section_number': section_number,
            'unit_id': unit_id,
            'base_address': f"{area}, {property_number}/{section_number}",
            'is_apartment': True
        }
    
    # Pattern 2: Single house format "Area, Property/Section"
    # Example: "Surdal, 33/50"
    house_pattern = r'^([^,]+),\s*(\d+)/(\d+)$'
    match = re.match(house_pattern, full_address.strip())
    
    if match:
        area = match.group(1).strip()
        property_number = int(match.group(2))
        section_number = int(match.group(3))
        
        return {
            'area': area,
            'property_number': property_number,
            'section_number': section_number,
            'unit_id': None,
            'base_address': full_address.strip(),
            'is_apartment': False
        }
    
    return None


def parse_standard_address(address_string: str) -> Optional[Dict]:
    """
    Parse standard address format (from apartment/building tables).
    
    Formats:
    - "Street Name Number[Letter], Postcode City"
    - "Street Name, Postcode City"
    
    Args:
        address_string: Address string from apartment/building
        
    Returns:
        dict with keys: street_name, house_number, house_letter, postcode, city
    """
    if not address_string:
        return None
    
    # Pattern 1: "Street Name Number[Letter], Postcode City"
    pattern_with_number = r'^(.+?)\s+(\d+)([A-Za-z]?),\s*(\d{4})\s+(.+)$'
    match = re.match(pattern_with_number, address_string.strip())
    
    if match:
        street_name = match.group(1).strip()
        house_number = int(match.group(2))
        house_letter = match.group(3).strip().upper() if match.group(3) else None
        postcode = match.group(4).strip()
        city = match.group(5).strip()
        
        return {
            'street_name': street_name,
            'house_number': house_number,
            'house_letter': house_letter,
            'postcode': postcode,
            'city': city
        }
    
    # Pattern 2: "Street Name, Postcode City"
    pattern_without_number = r'^(.+?),\s*(\d{4})\s+(.+)$'
    match = re.match(pattern_without_number, address_string.strip())
    
    if match:
        street_name = match.group(1).strip()
        postcode = match.group(2).strip()
        city = match.group(3).strip()
        
        return {
            'street_name': street_name,
            'house_number': None,
            'house_letter': None,
            'postcode': postcode,
            'city': city
        }
    
    return None


def normalize_unit_id(unit_id: Optional[str]) -> Optional[str]:
    """
    Normalize unit ID for comparison (same logic as Apartment.normalize_apartment_number).
    
    Args:
        unit_id: Unit identifier string
        
    Returns:
        Normalized unit ID (uppercase, no spaces/hyphens, no leading zeros)
    """
    if not unit_id:
        return None
    
    # Remove spaces and hyphens
    normalized = str(unit_id).strip().replace(' ', '').replace('-', '')
    
    # Uppercase
    normalized = normalized.upper()
    
    # Remove leading zeros (but keep if only zeros)
    normalized = normalized.lstrip('0') or '0'
    
    return normalized


def find_local_apartments_for_building(
    building_base_address: str,
    building_position: Point,
    apartment_numbers: Optional[List[str]] = None
) -> List[Dict]:
    """
    Find matching addresses in local_apartments for a building.
    
    Uses multiple matching strategies:
    1. Geometry proximity (within 50m)
    2. Postcode matching
    3. Address parsing and comparison
    
    Args:
        building_base_address: Base address from building table
        building_position: Geometry point from building table
        apartment_numbers: Optional list of apartment numbers to match
        
    Returns:
        List of matching local_apartments records with match scores
    """
    with connection.cursor() as cursor:
        # Parse building address
        building_parts = parse_standard_address(building_base_address)
        if not building_parts:
            logger.warning(f"Could not parse building address: {building_base_address}")
            return []
        
        postcode = building_parts.get('postcode')
        if not postcode:
            logger.warning(f"No postcode found in building address: {building_base_address}")
            return []
        
        street_name = building_parts.get('street_name', '')
        
        # Build query with multiple matching criteria
        query = """
            WITH building_info AS (
                SELECT 
                    %s::geometry(Point, 4326) as position,
                    %s as postcode,
                    %s as street_name
            ),
            matched_addresses AS (
                SELECT 
                    la.id,
                    la.full_address,
                    la.unit_id,
                    la.grunnkretsnavn,
                    la.grunnkretsnummer,
                    la.postcode,
                    la.post_area,
                    la.position,
                    la.address_uuid,
                    ST_X(la.position) as lon,
                    ST_Y(la.position) as lat,
                    -- Calculate match score (simplified - removed complex CASE for now)
                    CASE 
                        WHEN la.postcode = bi.postcode THEN 10 ELSE 0
                    END +
                    CASE 
                        WHEN ST_DWithin(
                            la.position::geography,
                            bi.position::geography,
                            50  -- 50 meters
                        ) THEN 15 ELSE 0
                    END as match_score,
                    -- Calculate distance in meters
                    ST_Distance(
                        la.position::geography,
                        bi.position::geography
                    ) as distance_meters
                FROM public.local_apartments la
                CROSS JOIN building_info bi
                WHERE la.postcode = bi.postcode  -- Postcode filter first (fast)
                    AND ST_DWithin(
                        la.position::geography,
                        bi.position::geography,
                        100  -- 100m radius for initial filter
                    )
            )
            SELECT 
                id,
                full_address,
                unit_id,
                grunnkretsnavn,
                grunnkretsnummer,
                postcode,
                post_area,
                ST_AsText(position) as position_wkt,
                address_uuid,
                lon,
                lat,
                match_score,
                distance_meters
            FROM matched_addresses
            WHERE match_score >= 15  -- Minimum threshold (postcode + geometry)
            ORDER BY match_score DESC, distance_meters ASC
            LIMIT 100
        """
        
        street_name = building_parts.get('street_name', '') or ''
        
        try:
            cursor.execute(query, [
                building_position.wkt,
                postcode,
                street_name
            ])
        except Exception as e:
            logger.error(f"SQL query error: {e}")
            logger.error(f"Query: {query[:500]}...")
            logger.error(f"Params: postcode={postcode}, street_name={street_name}")
            raise
        
        # Check if cursor has description (query executed successfully)
        if not cursor.description:
            logger.warning("Query returned no columns (possibly no results)")
            return []
        
        columns = [col[0] for col in cursor.description]
        results = []
        
        for row in cursor.fetchall():
            result = dict(zip(columns, row))
            
            # Parse the local_apartments address
            parsed = parse_cadastral_address(result['full_address'])
            if parsed:
                result.update(parsed)
            
            # Check if unit_id matches any apartment number
            if apartment_numbers:
                normalized_unit = normalize_unit_id(result['unit_id'])
                result['matches_apartment'] = any(
                    normalize_unit_id(apt_num) == normalized_unit
                    for apt_num in apartment_numbers
                )
            else:
                result['matches_apartment'] = None
            
            results.append(result)
        
        return results


def find_apartments_for_local_address(
    local_full_address: str,
    local_postcode: str,
    local_position: Point,
    campaign_id: Optional[str] = None
) -> List[Dict]:
    """
    Find matching apartments/buildings for a local_apartments address.
    
    Reverse lookup: from local_apartments → apartment/building tables.
    
    Args:
        local_full_address: Full address from local_apartments
        local_postcode: Postcode from local_apartments
        local_position: Geometry point from local_apartments
        campaign_id: Optional campaign ID to filter buildings
        
    Returns:
        List of matching apartments with building info
    """
    with connection.cursor() as cursor:
        # Parse local address
        parsed = parse_cadastral_address(local_full_address)
        if not parsed:
            logger.warning(f"Could not parse local address: {local_full_address}")
            return []
        
        unit_id = parsed.get('unit_id')
        area = parsed.get('area')
        
        # Build query
        query = """
            WITH local_info AS (
                SELECT 
                    %s::geometry(Point, 4326) as position,
                    %s as postcode
            ),
            matched_buildings AS (
                SELECT 
                    b.id as building_id,
                    b.base_address,
                    b.position,
                    b.campaign_id,
                    ST_X(b.position) as lon,
                    ST_Y(b.position) as lat,
                    -- Calculate match score
                    CASE 
                        WHEN SPLIT_PART(TRIM(SPLIT_PART(b.base_address, ',', 2)), ' ', 1) = li.postcode 
                        THEN 10 ELSE 0
                    END +
                    CASE 
                        WHEN ST_DWithin(
                            b.position::geography,
                            li.position::geography,
                            50  -- 50 meters
                        ) THEN 15 ELSE 0
                    END as match_score,
                    -- Calculate distance
                    ST_Distance(
                        b.position::geography,
                        li.position::geography
                    ) as distance_meters
                FROM building b
                CROSS JOIN local_info li
                WHERE SPLIT_PART(TRIM(SPLIT_PART(b.base_address, ',', 2)), ' ', 1) = li.postcode
                    AND ST_DWithin(
                        b.position::geography,
                        li.position::geography,
                        100  -- 100m radius
                    )
        """
        
        params = [local_position.wkt, local_postcode]
        
        if campaign_id:
            query += " AND b.campaign_id = %s"
            params.append(campaign_id)
        
        query += """
            )
            SELECT 
                mb.building_id,
                mb.base_address,
                mb.position,
                mb.campaign_id,
                mb.lon,
                mb.lat,
                mb.match_score,
                mb.distance_meters,
                a.id as apartment_id,
                a.apartment_number,
                a.status
            FROM matched_buildings mb
            LEFT JOIN apartment a ON a.building_id = mb.building_id
            WHERE mb.match_score >= 15
            ORDER BY mb.match_score DESC, mb.distance_meters ASC
            LIMIT 50
        """
        
        cursor.execute(query, params)
        
        columns = [col[0] for col in cursor.description]
        results = []
        
        for row in cursor.fetchall():
            result = dict(zip(columns, row))
            
            # Check if apartment number matches unit_id
            if unit_id and result['apartment_number']:
                normalized_unit = normalize_unit_id(unit_id)
                normalized_apt = normalize_unit_id(result['apartment_number'])
                result['unit_matches'] = normalized_unit == normalized_apt
            else:
                result['unit_matches'] = None
            
            results.append(result)
        
        return results


def compare_geometries(
    building_position: Point,
    local_positions: List[Point],
    tolerance_meters: float = 50.0
) -> Dict:
    """
    Compare building geometry with local_apartments geometries.
    
    Args:
        building_position: Building geometry point
        local_positions: List of local_apartments geometry points
        tolerance_meters: Distance tolerance in meters
        
    Returns:
        dict with comparison results: matches, distances, average_distance, etc.
    """
    if not local_positions:
        return {
            'matches': [],
            'total_compared': 0,
            'within_tolerance': 0,
            'average_distance': None,
            'min_distance': None,
            'max_distance': None
        }
    
    with connection.cursor() as cursor:
        # Create temporary table with local positions
        cursor.execute("""
            CREATE TEMP TABLE temp_local_positions (
                id SERIAL,
                position GEOMETRY(Point, 4326)
            )
        """)
        
        for pos in local_positions:
            cursor.execute(
                "INSERT INTO temp_local_positions (position) VALUES (ST_GeomFromText(%s, 4326))",
                [pos.wkt]
            )
        
        # Calculate distances
        cursor.execute("""
            SELECT 
                tlp.id,
                ST_Distance(
                    %s::geography,
                    tlp.position::geography
                ) as distance_meters,
                CASE 
                    WHEN ST_DWithin(
                        %s::geography,
                        tlp.position::geography,
                        %s
                    ) THEN true ELSE false
                END as within_tolerance
            FROM temp_local_positions tlp
            ORDER BY distance_meters ASC
        """, [
            building_position.wkt,
            building_position.wkt,
            tolerance_meters
        ])
        
        matches = []
        distances = []
        
        for row in cursor.fetchall():
            idx, distance, within = row
            matches.append({
                'index': idx,
                'distance_meters': float(distance),
                'within_tolerance': within
            })
            distances.append(float(distance))
        
        # Cleanup
        cursor.execute("DROP TABLE temp_local_positions")
        
        return {
            'matches': matches,
            'total_compared': len(local_positions),
            'within_tolerance': sum(1 for m in matches if m['within_tolerance']),
            'average_distance': sum(distances) / len(distances) if distances else None,
            'min_distance': min(distances) if distances else None,
            'max_distance': max(distances) if distances else None,
            'tolerance_meters': tolerance_meters
        }


def get_building_local_apartments_mapping(
    building_id: str,
    include_geometry_comparison: bool = True
) -> Dict:
    """
    Get complete mapping between building/apartments and local_apartments.
    
    Args:
        building_id: Building UUID
        include_geometry_comparison: Whether to include detailed geometry comparison
        
    Returns:
        dict with building info, apartments, matched local_apartments, and geometry comparison
    """
    with connection.cursor() as cursor:
        # Get building info
        cursor.execute("""
            SELECT 
                b.id,
                b.base_address,
                b.position,
                b.campaign_id,
                COUNT(a.id) as apartment_count
            FROM building b
            LEFT JOIN apartment a ON a.building_id = b.id
            WHERE b.id = %s
            GROUP BY b.id, b.base_address, b.position, b.campaign_id
        """, [building_id])
        
        building_row = cursor.fetchone()
        if not building_row:
            return {'error': 'Building not found'}
        
        building_id_val, base_address, position_wkt, campaign_id, apartment_count = building_row
        
        # Convert position to Point
        building_position = Point.from_wkt(position_wkt, srid=4326)
        
        # Get apartments
        cursor.execute("""
            SELECT id, apartment_number, status
            FROM apartment
            WHERE building_id = %s
            ORDER BY apartment_number
        """, [building_id])
        
        apartments = [
            {'id': str(row[0]), 'apartment_number': row[1], 'status': row[2]}
            for row in cursor.fetchall()
        ]
        
        apartment_numbers = [apt['apartment_number'] for apt in apartments]
        
        # Find matching local_apartments
        local_matches = find_local_apartments_for_building(
            base_address,
            building_position,
            apartment_numbers
        )
        
        # Geometry comparison
        geometry_comparison = None
        if include_geometry_comparison and local_matches:
            local_positions = [
                Point.from_wkt(match['position_wkt'], srid=4326)
                for match in local_matches
                if match.get('position_wkt')
            ]
            
            geometry_comparison = compare_geometries(
                building_position,
                local_positions
            )
        
        return {
            'building': {
                'id': str(building_id_val),
                'base_address': base_address,
                'position': {
                    'lat': building_position.y,
                    'lon': building_position.x
                },
                'campaign_id': str(campaign_id) if campaign_id else None,
                'apartment_count': apartment_count
            },
            'apartments': apartments,
            'local_apartments_matches': local_matches,
            'geometry_comparison': geometry_comparison,
            'match_summary': {
                'total_matches': len(local_matches),
                'matched_apartments': sum(
                    1 for match in local_matches
                    if match.get('matches_apartment')
                ),
                'best_match_score': max(
                    (m.get('match_score', 0) for m in local_matches),
                    default=0
                )
            }
        }
