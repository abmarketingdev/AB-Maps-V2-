"""
Admin Areas MVT (Mapbox Vector Tile) views for Norwegian administrative boundaries.

Endpoints:
- GET /tiles/fylke/{z}/{x}/{y}.mvt - County boundaries (z 4-6)
- GET /tiles/kommune/{z}/{x}/{y}.mvt - Municipality boundaries (z 7-10)
- GET /tiles/grunnkrets/{z}/{x}/{y}.mvt - Basic district + demographics (z 11+)
- GET /tiles/grunnkrets/v{year}/{z}/{x}/{y}.mvt - Versioned grunnkrets tiles
"""
import logging
import hashlib
from django.http import HttpResponse, HttpResponseBadRequest
from django.core.cache import cache
from django.db import connection

logger = logging.getLogger(__name__)

# MVT parameters (Mapbox standard)
MVT_EXTENT = 4096
MVT_BUFFER = 128


def fylke_tile(request, z, x, y):
    """
    Generate Mapbox Vector Tiles for fylke (county) boundaries.
    
    URL: GET /tiles/fylke/{z}/{x}/{y}.mvt
    Zoom range: 4-6
    
    Phase 5: Caching Strategy
    - HTTP Cache: 7 days
    - Server-side cache: 1 hour (3600s)
    - ETag support for conditional requests
    """
    logger.info(f"🗺️  FYLKE TILE REQUEST: z={z}, x={x}, y={y}")
    
    # Zoom enforcement
    if z < 4 or z > 6:
        logger.info(f"📭 EMPTY TILE: z={z} outside range [4-6]")
        return _empty_tile_response()
    
    # Build cache key (Phase 5.4)
    cache_key = f"tiles:admin:fylke:{z}:{x}:{y}"
    logger.info(f"🔑 CACHE KEY: {cache_key}")
    
    # Check server-side cache first
    cached_tile = cache.get(cache_key)
    if cached_tile is not None:
        logger.info(f"🎯 CACHE HIT: {len(cached_tile)} bytes")
        return _cached_tile_response(cached_tile, cache_key, request)
    
    logger.info(f"💾 CACHE MISS: Generating new tile")
    
    # Generate tile
    tile_bytes = _generate_admin_mvt(z, x, y, level='fylke')
    
    # Cache empty tiles longer (Phase 5.4)
    cache_ttl = 86400 if len(tile_bytes) == 0 else 3600  # 24h for empty, 1h for warm
    cache.set(cache_key, tile_bytes, timeout=cache_ttl)
    logger.info(f"💾 CACHED: Stored {len(tile_bytes)} bytes with TTL {cache_ttl}s")
    
    # Return with cache headers and ETag
    return _tile_response_with_etag(tile_bytes, cache_key, request, cache_ttl=604800)


def kommune_tile(request, z, x, y):
    """
    Generate Mapbox Vector Tiles for kommune (municipality) boundaries.
    
    URL: GET /tiles/kommune/{z}/{x}/{y}.mvt
    Zoom range: 7-10
    Query params:
    - fylke: Filter by county code (e.g., ?fylke=11)
    
    Phase 5: Caching Strategy
    - HTTP Cache: 7 days
    - Server-side cache: 1 hour (3600s)
    - ETag support for conditional requests
    """
    logger.info(f"🗺️  KOMMUNE TILE REQUEST: z={z}, x={x}, y={y}")
    
    # Zoom enforcement
    if z < 7 or z > 10:
        logger.info(f"📭 EMPTY TILE: z={z} outside range [7-10]")
        return _empty_tile_response()
    
    # Optional filter
    fylke_code = request.GET.get('fylke')
    if fylke_code:
        logger.info(f"   Filter: fylke={fylke_code}")
    
    # Build cache key (Phase 5.4) - include filter in key
    filter_suffix = f":f{fylke_code}" if fylke_code else ""
    cache_key = f"tiles:admin:kommune:{z}:{x}:{y}{filter_suffix}"
    logger.info(f"🔑 CACHE KEY: {cache_key}")
    
    # Check server-side cache first
    cached_tile = cache.get(cache_key)
    if cached_tile is not None:
        logger.info(f"🎯 CACHE HIT: {len(cached_tile)} bytes")
        return _cached_tile_response(cached_tile, cache_key, request)
    
    logger.info(f"💾 CACHE MISS: Generating new tile")
    
    # Generate tile
    tile_bytes = _generate_admin_mvt(z, x, y, level='kommune', parent_filter=fylke_code)
    
    # Cache empty tiles longer (Phase 5.4)
    cache_ttl = 86400 if len(tile_bytes) == 0 else 3600  # 24h for empty, 1h for warm
    cache.set(cache_key, tile_bytes, timeout=cache_ttl)
    logger.info(f"💾 CACHED: Stored {len(tile_bytes)} bytes with TTL {cache_ttl}s")
    
    # Return with cache headers and ETag
    return _tile_response_with_etag(tile_bytes, cache_key, request, cache_ttl=604800)


def grunnkrets_tile(request, z, x, y, year=None):
    """
    Generate Mapbox Vector Tiles for grunnkrets (basic district) boundaries with demographics.
    
    URL: GET /tiles/grunnkrets/{z}/{x}/{y}.mvt
         GET /tiles/grunnkrets/v{year}/{z}/{x}/{y}.mvt (versioned)
    Zoom range: 11+
    Query params:
    - kommune: Filter by municipality code (e.g., ?kommune=0301)
    - fylke: Filter by county code (e.g., ?fylke=03)
    
    Phase 5: Caching Strategy
    - HTTP Cache: 24 hours (unversioned) or 1 year immutable (versioned)
    - Server-side cache: 1 hour (3600s)
    - ETag support for conditional requests
    - Versioned URLs for cache busting (Phase 5.2)
    """
    logger.info(f"🗺️  GRUNNKRETS TILE REQUEST: z={z}, x={x}, y={y}, year={year}")
    
    # Zoom enforcement
    if z < 11:
        logger.info(f"📭 EMPTY TILE: z={z} outside range [11+]")
        return _empty_tile_response()
    
    # Optional filters
    kommune_code = request.GET.get('kommune')
    fylke_code = request.GET.get('fylke')
    if kommune_code:
        logger.info(f"   Filter: kommune={kommune_code}")
    if fylke_code:
        logger.info(f"   Filter: fylke={fylke_code}")
    
    # Build cache key (Phase 5.4) - include version and filters
    version_suffix = f":v{year}" if year else ""
    filter_suffix = ""
    if kommune_code:
        filter_suffix += f":k{kommune_code}"
    if fylke_code:
        filter_suffix += f":f{fylke_code}"
    cache_key = f"tiles:admin:grunnkrets{version_suffix}:{z}:{x}:{y}{filter_suffix}"
    logger.info(f"🔑 CACHE KEY: {cache_key}")
    
    # Check server-side cache first
    cached_tile = cache.get(cache_key)
    if cached_tile is not None:
        logger.info(f"🎯 CACHE HIT: {len(cached_tile)} bytes")
        return _cached_tile_response(cached_tile, cache_key, request)
    
    logger.info(f"💾 CACHE MISS: Generating new tile")
    
    # Generate tile
    tile_bytes = _generate_admin_mvt(
        z, x, y, 
        level='grunnkrets',
        parent_filter=kommune_code,
        grandparent_filter=fylke_code,
        include_demographics=True
    )
    
    # Cache empty tiles longer (Phase 5.4)
    cache_ttl = 86400 if len(tile_bytes) == 0 else 3600  # 24h for empty, 1h for warm
    cache.set(cache_key, tile_bytes, timeout=cache_ttl)
    logger.info(f"💾 CACHED: Stored {len(tile_bytes)} bytes with TTL {cache_ttl}s")
    
    # Return with cache headers and ETag (Phase 5.1)
    if year:
        # Versioned tiles: 1 year immutable (Phase 5.2)
        return _tile_response_with_etag(tile_bytes, cache_key, request, cache_ttl=31536000, immutable=True)
    else:
        # Unversioned tiles: 24 hours
        return _tile_response_with_etag(tile_bytes, cache_key, request, cache_ttl=86400)


def _generate_admin_mvt(z, x, y, level, parent_filter=None, grandparent_filter=None, include_demographics=False):
    """
    Generate MVT tile bytes for admin areas.
    
    Args:
        z: Zoom level
        x: Tile X coordinate
        y: Tile Y coordinate
        level: 'fylke', 'kommune', or 'grunnkrets'
        parent_filter: Optional parent code filter (kommune for grunnkrets, fylke for kommune)
        grandparent_filter: Optional grandparent code filter (fylke for grunnkrets)
        include_demographics: Whether to include demographic columns (grunnkrets only)
    
    Returns:
        bytes: MVT tile data
    """
    # Build SQL query
    sql = _build_admin_mvt_sql(level, parent_filter, grandparent_filter, include_demographics)
    
    # Execute query
    params = {
        'z': z,
        'x': x,
        'y': y,
        'extent': MVT_EXTENT,
        'buffer': MVT_BUFFER,
        'level': level,
        'layer_name': level,
    }
    
    # Only add filters if they are provided
    if parent_filter:
        params['parent_filter'] = parent_filter
    if grandparent_filter:
        params['grandparent_filter'] = grandparent_filter
    
    with connection.cursor() as cursor:
        cursor.execute(sql, params)
        row = cursor.fetchone()
        tile_bytes = bytes(row[0]) if row and row[0] else b""
    
    logger.info(f"📊 Generated {len(tile_bytes)} bytes for {level} tile")
    return tile_bytes


def _build_admin_mvt_sql(level, parent_filter, grandparent_filter, include_demographics):
    """
    Build SQL query for MVT generation following Phase 3 & 4 specifications.
    
    Uses PostGIS MVT functions:
    - ST_TileEnvelope: Get tile bounds in 3857
    - ST_AsMVTGeom: Transform and clip geometry for tile
    - ST_AsMVT: Generate MVT binary
    
    Parameters:
    - extent: 4096 (Mapbox standard)
    - buffer: 128 (prevents seams/cracks between tiles)
    - clip: true (clip geometries to tile bounds)
    
    Phase 4: Properties per Level (minimal for small tile sizes):
    
    Fylke (z 4-6):
    - area_key, code, name, area_km2, num_polygons
    - NO demographics (counties don't have SSB 04362 data)
    
    Kommune (z 7-10):
    - area_key, code, name, parent_code, area_km2, num_polygons
    - NO demographics (can add aggregated stats later if needed)
    
    Grunnkrets (z 11+):
    - area_key, code, name, parent_code, parent_parent_code
    - Demographics: population_total, donor_pool_stable, pop_67_plus,
      share_30_66, share_67_plus, mean_age_est_total
    
    Returns SQL template with placeholders for parameters.
    """
    # Base properties for all levels (Phase 4 specification)
    base_properties = """
        area_key,
        code,
        name,
        area_km2,
        num_polygons"""
    
    # Level-specific properties (Phase 4 specification)
    if level == 'kommune':
        # Kommune: base + parent_code (fylke code via parent_parent_code)
        properties = base_properties + """,
        parent_code"""
    elif level == 'grunnkrets':
        # Grunnkrets: base + hierarchical codes + demographics
        properties = base_properties + """,
        parent_code,
        parent_parent_code"""
        # Demographics only for grunnkrets (Phase 4 specification)
        if include_demographics:
            properties += """,
        population_total,
        donor_pool_stable,
        pop_67_plus,
        share_30_66,
        share_67_plus,
        mean_age_est_total,
        (COALESCE(f_50_59, 0) + COALESCE(m_50_59, 0) + 
         COALESCE(f_60_66, 0) + COALESCE(m_60_66, 0) + 
         COALESCE(f_67_69, 0) + COALESCE(m_67_69, 0) + 
         (COALESCE(f_70_79, 0) + COALESCE(m_70_79, 0)) * 0.6)::INTEGER AS pop_50_75,
        CASE 
            WHEN population_total > 0 THEN 
                ROUND(((COALESCE(f_50_59, 0) + COALESCE(m_50_59, 0) + 
                        COALESCE(f_60_66, 0) + COALESCE(m_60_66, 0) + 
                        COALESCE(f_67_69, 0) + COALESCE(m_67_69, 0) + 
                        (COALESCE(f_70_79, 0) + COALESCE(m_70_79, 0)) * 0.6)::NUMERIC / 
                       population_total::NUMERIC), 4)
            ELSE 0.0
        END AS share_50_75"""
    else:  # fylke
        # Fylke: base properties only (no demographics, no parent codes)
        properties = base_properties
    
    # Build filter conditions - use NULL-safe approach from plan
    # This allows filters to be NULL without breaking the query
    filter_conditions = "a.level = %(level)s"
    
    # Add parent filter if provided
    if parent_filter is not None:
        if level == 'grunnkrets':
            # For grunnkrets, parent_code is kommune code
            filter_conditions += " AND a.parent_code = %(parent_filter)s"
        elif level == 'kommune':
            # For kommune, parent_parent_code is fylke code (not parent_code!)
            filter_conditions += " AND a.parent_parent_code = %(parent_filter)s"
    
    # Add grandparent filter if provided (only for grunnkrets)
    if grandparent_filter is not None and level == 'grunnkrets':
        filter_conditions += " AND a.parent_parent_code = %(grandparent_filter)s"
    
    sql = f"""
    WITH bounds AS (
        SELECT ST_TileEnvelope(%(z)s, %(x)s, %(y)s) AS geom
    ),
    mvtgeom AS (
        SELECT
            {properties},
            ST_AsMVTGeom(
                a.geom_3857,
                bounds.geom,
                %(extent)s,  -- 4096 (Mapbox standard)
                %(buffer)s,  -- 128 (prevents seams/cracks)
                true         -- clip geometries to tile bounds
            ) AS geom
        FROM admin.areas a, bounds
        WHERE {filter_conditions}
          AND a.geom_3857 IS NOT NULL
          AND ST_Intersects(a.geom_3857, bounds.geom)
    )
    SELECT ST_AsMVT(mvtgeom, %(layer_name)s, %(extent)s, 'geom')
    FROM mvtgeom
    WHERE geom IS NOT NULL;
    """
    
    return sql


def _mvt_response(blob: bytes):
    """Create HTTP response for MVT data."""
    resp = HttpResponse(blob, content_type='application/vnd.mapbox-vector-tile')
    resp['Access-Control-Allow-Origin'] = '*'  # Allow cross-origin for tiles
    return resp


def _empty_tile_response():
    """
    Return empty tile response (204 No Content).
    
    Phase 5.4: Cache empty tiles for 24 hours to avoid repeated DB queries.
    """
    cache_key = "tiles:admin:empty"
    cached = cache.get(cache_key)
    if cached is None:
        # Cache empty response for 24 hours
        cache.set(cache_key, b"", timeout=86400)
    
    resp = HttpResponse(status=204)
    resp['Access-Control-Allow-Origin'] = '*'
    resp['Cache-Control'] = 'public, max-age=86400'  # 24 hours
    return resp


def _cached_tile_response(tile_bytes: bytes, cache_key: str, request):
    """
    Return cached tile with ETag support (Phase 5.3).
    
    Handles If-None-Match header for 304 Not Modified responses.
    """
    # Compute ETag (Phase 5.3)
    etag = hashlib.blake2b(tile_bytes, digest_size=8).hexdigest()
    
    # Check If-None-Match header (Phase 5.3)
    if_none_match = request.META.get("HTTP_IF_NONE_MATCH")
    if if_none_match == etag:
        logger.info(f"📋 304 NOT MODIFIED: ETag match")
        resp = HttpResponse(status=304)
        resp['ETag'] = etag
        resp['Cache-Control'] = 'public, max-age=0, must-revalidate'
        resp['Access-Control-Allow-Origin'] = '*'
        resp['X-Cache-Status'] = 'HIT'
        resp['X-Cache-Key'] = cache_key
        return resp
    
    # Return cached tile with ETag
    resp = _mvt_response(tile_bytes)
    resp['ETag'] = etag
    resp['X-Cache-Status'] = 'HIT'
    resp['X-Cache-Key'] = cache_key
    return resp


def _tile_response_with_etag(tile_bytes: bytes, cache_key: str, request, cache_ttl: int, immutable: bool = False):
    """
    Return tile response with ETag and cache headers (Phase 5.1, 5.3).
    
    Args:
        tile_bytes: MVT tile data
        cache_key: Cache key for debugging
        request: Django request object
        cache_ttl: HTTP cache max-age in seconds
        immutable: Whether to mark as immutable (for versioned tiles)
    """
    # Compute ETag (Phase 5.3)
    etag = hashlib.blake2b(tile_bytes, digest_size=8).hexdigest()
    
    # Check If-None-Match header (Phase 5.3)
    if_none_match = request.META.get("HTTP_IF_NONE_MATCH")
    if if_none_match == etag:
        logger.info(f"📋 304 NOT MODIFIED: ETag match")
        resp = HttpResponse(status=304)
        resp['ETag'] = etag
        resp['Cache-Control'] = 'public, max-age=0, must-revalidate'
        resp['Access-Control-Allow-Origin'] = '*'
        resp['X-Cache-Status'] = 'MISS'
        resp['X-Cache-Key'] = cache_key
        return resp
    
    # Build Cache-Control header (Phase 5.1)
    cache_control = f'public, max-age={cache_ttl}'
    if immutable:
        cache_control += ', immutable'
    
    # Return tile with ETag and cache headers
    resp = _mvt_response(tile_bytes)
    resp['ETag'] = etag
    resp['Cache-Control'] = cache_control
    resp['X-Cache-Status'] = 'MISS'
    resp['X-Cache-Key'] = cache_key
    return resp

