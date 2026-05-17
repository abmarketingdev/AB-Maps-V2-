"""
Tile MVT (Mapbox Vector Tile) views for efficient map rendering.
"""
import logging
import hashlib
from django.http import HttpResponse, HttpResponseBadRequest
from django.core.cache import cache
from django.db import connection

logger = logging.getLogger(__name__)
DATASET_VERSION = "v1"
MVT_EXTENT = 4096
BUFFER = 64
LAYER_NAME = "markers"
CLUSTER_Z = 16  # z=16 clustered, z<16 empty, z>=17 raw
CLUSTER_RADIUS_PX_DEFAULT = 10  # matches Leaflet style, prevents seams


def tile_mvt(request, z, x, y):
    """
    Generate Mapbox Vector Tiles for addresses.
    
    URL: GET /tiles/{z}/{x}/{y}.pbf
    
    Behavior:
    - z < 16: Empty tile (product rule)
    - z = 16: Micro-clusters (32x32 grid aggregation)
    - z >= 17: Raw address points
    
    Query params (optional):
    - manager: Filter by manager ID
    - employee: Filter by employee ID
    - campaign: Filter by campaign ID
    """
    logger.info(f"🗺️  TILE REQUEST: z={z}, x={x}, y={y}")
    logger.info(f"   Query params: manager={request.GET.get('manager')}, employee={request.GET.get('employee')}, campaign={request.GET.get('campaign')}")
    
    # Validate zoom level
    if z < 0 or z > 22:
        logger.warning(f"❌ Invalid zoom level: {z}")
        return HttpResponseBadRequest("Invalid zoom level")
    
    # Return empty tile for zoom < 16
    if z < 16:
        logger.info(f"📭 EMPTY TILE: z={z} < 16")
        resp = _mvt_response(b"")
        resp["X-Cache-Status"] = "EMPTY"
        resp["X-DB-Read"] = "none"  # No DB read needed (empty tile)
        return resp
    
    # Extract optional filters from query params
    manager_id = request.GET.get("manager")
    employee_id = request.GET.get("employee")
    campaign_id = request.GET.get("campaign")
    version = request.GET.get("v", "1")  # Optional version parameter
    
    # Optional cluster radius in pixels (for DPR adjustment or custom sizing)
    try:
        cluster_radius_px = int(request.GET.get("cluster_px", CLUSTER_RADIUS_PX_DEFAULT))
    except (ValueError, TypeError):
        cluster_radius_px = CLUSTER_RADIUS_PX_DEFAULT
    
    # Build cache key (include version if provided)
    cache_key = f"tiles:{DATASET_VERSION}:v{version}:{z}:{x}:{y}:m{manager_id or 'x'}:e{employee_id or 'x'}:c{campaign_id or 'x'}"
    logger.info(f"🔑 CACHE KEY: {cache_key}")
    
    # Check cache first
    cached_tile = cache.get(cache_key)
    if cached_tile is not None:
        logger.info(f"🎯 CACHE HIT: {len(cached_tile)} bytes")
        etag = hashlib.blake2b(cached_tile, digest_size=8).hexdigest()
        if request.META.get("HTTP_IF_NONE_MATCH") == etag:
            resp = HttpResponse(status=304)
            resp["ETag"] = etag
            resp["Cache-Control"] = "public, max-age=0, must-revalidate"
            resp["Access-Control-Allow-Origin"] = "*"
            # Debug headers
            resp["X-Cache-Status"] = "HIT"
            resp["X-Cache-Key"] = cache_key
            resp["X-DB-Read"] = "none"
            return resp
        resp = _mvt_response(cached_tile)
        # Add debug headers
        resp["ETag"] = etag
        resp["X-Cache-Status"] = "HIT"
        resp["X-Cache-Key"] = cache_key
        resp["X-DB-Read"] = "none"  # No DB read needed (from cache)
        return resp
    
    logger.info(f"💾 CACHE MISS: Generating new tile")
    
    # Generate tile based on zoom level
    if z == CLUSTER_Z:
        sql = _clustered_tile_sql_as_polygons()
        logger.info(f"🔗 CLUSTERED TILE (polygons): z={z}")
    else:
        sql = _raw_points_tile_sql_3857()
        logger.info(f"📍 RAW POINTS TILE (points): z={z}")
    
    # Execute query
    with connection.cursor() as cursor:
        logger.info(f"🔍 EXECUTING SQL with filters: manager={manager_id}, employee={employee_id}, campaign={campaign_id}")
        cursor.execute(sql, {
            "z": z,
            "x": x,
            "y": y,
            "extent": MVT_EXTENT,
            "buffer": BUFFER,
            "layer": LAYER_NAME,
            "manager_id": manager_id,
            "employee_id": employee_id,
            "campaign_id": campaign_id,
            "radius_px": cluster_radius_px,  # Only used by cluster SQL
        })
        row = cursor.fetchone()
        tile = bytes(row[0]) if row and row[0] else b""
    
    logger.info(f"📊 SQL RESULT: {len(tile)} bytes generated")
    
    # Cache the tile
    cache.set(cache_key, tile, timeout=300)  # 5 minutes
    logger.info(f"💾 CACHED: Stored {len(tile)} bytes with key {cache_key}")
    
    # ETag revalidation
    etag = hashlib.blake2b(tile, digest_size=8).hexdigest()
    if request.META.get("HTTP_IF_NONE_MATCH") == etag:
        resp = HttpResponse(status=304)
        resp["ETag"] = etag
        resp["Cache-Control"] = "public, max-age=0, must-revalidate"
        resp["Access-Control-Allow-Origin"] = "*"
        # Debug headers
        resp["X-Cache-Status"] = "MISS"
        resp["X-Cache-Key"] = cache_key
        resp["X-DB-Read"] = "primary"
        return resp
    
    resp = _mvt_response(tile)
    # Add debug headers
    resp["ETag"] = etag
    resp["X-Cache-Status"] = "MISS"
    resp["X-Cache-Key"] = cache_key
    resp["X-DB-Read"] = "primary"  # Read from primary database
    resp["X-Tile-Generated-At"] = __import__('django.utils.timezone', fromlist=['timezone']).now().isoformat()
    
    return resp


def _mvt_response(blob: bytes):
    """Create HTTP response for MVT data."""
    resp = HttpResponse(blob, content_type="application/x-protobuf")
    resp["Cache-Control"] = "public, max-age=0, must-revalidate"
    resp["Access-Control-Allow-Origin"] = "*"  # Allow cross-origin for tiles
    return resp


def _raw_points_tile_sql_3857():
    """
    SQL query for raw points (z >= 17).
    
    NEW ARCHITECTURE: Uses UNION ALL of three separate layers:
    1. BUILDINGS - Yellow/Blue/Grey markers (from building table with pre-calculated stats)
    2. HOUSES - Green/Red markers (from address table, WHERE building_id IS NULL)
    3. UPLOADED - Uploaded addresses (from uploaded_address table)
    
    This is MUCH simpler than the old ST_SnapToGrid approach because:
    - Building stats (total_units, visited_units) are pre-calculated
    - No need for complex COUNT(*) aggregations at query time
    - "Ghost Buster" logic: building_id IS NULL prevents duplicate markers
    """
    return """
    WITH b AS (
      SELECT ST_TileEnvelope(%(z)s, %(x)s, %(y)s) AS env3857
    ),
    env4326 AS (
      SELECT ST_Transform(env3857, 4326) AS env4326 FROM b
    ),
    
    -- ========================================
    -- LAYER 1: BUILDINGS (Yellow/Blue/Grey)
    -- ========================================
    -- Pre-calculated stats from building table
    -- These are apartment buildings with denormalized counts
    buildings_layer AS (
      SELECT
        bldg.id::text AS id,
        FALSE AS cluster,
        bldg.total_units AS point_count,
        bldg.base_address AS address_text,
        bldg.status AS status,  -- 'unvisited', 'in_progress', 'completed'
        '{}'::text AS tags,
        'building'::text AS source_table,
        bldg.visited_units,
        bldg.total_units,
        bldg.total_units - bldg.visited_units AS remaining_units,
        'building'::text AS marker_type,
        -- Color mapping for frontend
        CASE bldg.status
          WHEN 'completed' THEN 'blue'
          WHEN 'in_progress' THEN 'yellow'
          ELSE 'grey'
        END AS marker_color,
        -- Creator information
        COALESCE(mgr.name, emp.name) AS creator_name,
        CASE 
          WHEN bldg.created_by_id IS NOT NULL THEN 'manager'
          WHEN bldg.created_by_employee_id IS NOT NULL THEN 'employee'
          ELSE NULL
        END AS creator_type,
        bldg.position AS pos4326
      FROM building bldg
      LEFT JOIN manager mgr ON bldg.created_by_id = mgr.id
      LEFT JOIN employee emp ON bldg.created_by_employee_id = emp.id
      CROSS JOIN env4326 e
      WHERE (%(campaign_id)s IS NULL OR bldg.campaign_id::text = %(campaign_id)s)
        AND bldg.position && e.env4326
    ),
    
    -- ========================================
    -- LAYER 2: STANDALONE HOUSES (Green/Red)
    -- ========================================
    -- Addresses that are NOT part of a building (building_id IS NULL)
    -- This is the "Ghost Buster" logic that prevents duplicate markers!
    houses_layer AS (
      SELECT
        a.id::text AS id,
        FALSE AS cluster,
        1 AS point_count,
        a.address_text AS address_text,
        a.status AS status,
        a.tags::text AS tags,
        'address'::text AS source_table,
        1 AS visited_units,
        1 AS total_units,
        0 AS remaining_units,
        'house'::text AS marker_type,
        -- Color mapping for frontend
        CASE a.status
          WHEN 'ja' THEN 'green'
          WHEN 'nei' THEN 'red'
          WHEN 'ikke_hjemme' THEN 'orange'
          WHEN 'folg_opp' THEN 'purple'
          ELSE 'grey'
        END AS marker_color,
        -- Creator information
        COALESCE(mgr.name, emp.name) AS creator_name,
        CASE 
          WHEN a.manager_id IS NOT NULL THEN 'manager'
          WHEN a.employee_id IS NOT NULL THEN 'employee'
          ELSE NULL
        END AS creator_type,
        a.position AS pos4326
      FROM address a
      LEFT JOIN manager mgr ON a.manager_id = mgr.id
      LEFT JOIN employee emp ON a.employee_id = emp.id
      CROSS JOIN env4326 e
      WHERE (%(campaign_id)s IS NULL OR a.campaign_id::text = %(campaign_id)s)
        AND (%(manager_id)s IS NULL OR a.manager_id::text = %(manager_id)s)
        AND (%(employee_id)s IS NULL OR a.employee_id::text = %(employee_id)s)
        AND a.position && e.env4326
        AND a.building_id IS NULL  -- ← THE GHOST BUSTER: Exclude addresses that belong to buildings
    ),
    
    -- ========================================
    -- LAYER 3: UPLOADED ADDRESSES
    -- ========================================
    -- Addresses uploaded via CSV/bulk upload that haven't been visited yet
    uploaded_layer AS (
      SELECT
        ua.id::text AS id,
        FALSE AS cluster,
        1 AS point_count,
        ua.address_text AS address_text,
        'uploaded'::text AS status,
        '{}'::text AS tags,
        'uploaded_address'::text AS source_table,
        0 AS visited_units,
        1 AS total_units,
        1 AS remaining_units,
        'uploaded'::text AS marker_type,
        'grey'::text AS marker_color,
        NULL::text AS creator_name,
        NULL::text AS creator_type,
        ua.geom AS pos4326
      FROM uploaded_address ua, env4326 e
      WHERE ua.geom IS NOT NULL
        AND (%(campaign_id)s IS NULL OR ua.campaign_id::text = %(campaign_id)s)
        AND (%(manager_id)s IS NULL OR ua.manager_id::text = %(manager_id)s)
        AND ua.geom && e.env4326
    ),
    
    -- ========================================
    -- COMBINE ALL LAYERS
    -- ========================================
    combined AS (
      SELECT * FROM buildings_layer
      UNION ALL
      SELECT * FROM houses_layer
      UNION ALL
      SELECT * FROM uploaded_layer
    ),
    
    -- ========================================
    -- GENERATE MVT
    -- ========================================
    mvtgeom AS (
      SELECT
        id,
        cluster,
        point_count,
        address_text,
        status,
        tags,
        source_table,
        visited_units,
        total_units,
        remaining_units,
        marker_type,
        marker_color,
        creator_name,
        creator_type,
        ST_AsMVTGeom(
          ST_Transform(pos4326, 3857),
          (SELECT env3857 FROM b),
          %(extent)s, %(buffer)s, true
        ) AS geom
      FROM combined
    )
    
    SELECT ST_AsMVT(mvtgeom, %(layer)s, %(extent)s, 'geom')
    FROM mvtgeom
    WHERE geom IS NOT NULL;
    """


def _clustered_tile_sql_as_polygons():
    """
    SQL query for clustered points as polygons (z = 16) - prevents seams across tiles.
    
    NEW ARCHITECTURE: Uses same 3-layer approach as raw tiles:
    1. BUILDINGS - From building table (pre-calculated, no grouping needed!)
    2. HOUSES - From address table WHERE building_id IS NULL
    3. UPLOADED - From uploaded_address table
    
    This is simpler than before because buildings are already distinct entities.
    """
    return """
    WITH b AS (
      SELECT ST_TileEnvelope(%(z)s, %(x)s, %(y)s) AS env3857
    ),
    -- World bounds in EPSG:3857 (Web Mercator)
    world AS (
      SELECT
        -20037508.342789244::double precision AS minx,
        -20037508.342789244::double precision AS miny
    ),
    -- meters-per-pixel and cell size: 256 px tile / 32 = 8 px per cell
    mpp AS (
      SELECT (ST_XMax(env3857) - ST_XMin(env3857)) / 256.0 AS mpp FROM b
    ),
    cell AS (
      SELECT (SELECT mpp FROM mpp) * 8.0 AS cell_m
    ),
    -- Expand query window so clusters near edges "see" points across seams
    qenv AS (
      SELECT ST_Expand(env3857, (SELECT cell_m FROM cell) * 2
                                + (SELECT mpp FROM mpp) * %(radius_px)s) AS env_q
      FROM b
    ),
    env4326 AS (
      SELECT ST_Transform((SELECT env_q FROM qenv), 4326) AS env4326
    ),
    
    -- ========================================
    -- LAYER 1: BUILDINGS (already distinct entities)
    -- ========================================
    buildings_points AS (
      SELECT
        bldg.position AS pos4326,
        bldg.total_units AS weight  -- Weight by apartment count for cluster size
      FROM building bldg, env4326 e
      WHERE (%(campaign_id)s IS NULL OR bldg.campaign_id::text = %(campaign_id)s)
        AND bldg.position && e.env4326
    ),
    
    -- ========================================
    -- LAYER 2: STANDALONE HOUSES (Ghost Buster applied)
    -- ========================================
    houses_points AS (
      SELECT
        a.position AS pos4326,
        1 AS weight
      FROM address a, env4326 e
      WHERE (%(campaign_id)s IS NULL OR a.campaign_id::text = %(campaign_id)s)
        AND (%(manager_id)s IS NULL OR a.manager_id::text = %(manager_id)s)
        AND (%(employee_id)s IS NULL OR a.employee_id::text = %(employee_id)s)
        AND a.position && e.env4326
        AND a.building_id IS NULL  -- ← Ghost Buster
    ),
    
    -- ========================================
    -- LAYER 3: UPLOADED ADDRESSES
    -- ========================================
    uploaded_points AS (
      SELECT
        ua.geom AS pos4326,
        1 AS weight
      FROM uploaded_address ua, env4326 e
      WHERE ua.geom IS NOT NULL
        AND (%(campaign_id)s IS NULL OR ua.campaign_id::text = %(campaign_id)s)
        AND (%(manager_id)s IS NULL OR ua.manager_id::text = %(manager_id)s)
        AND ua.geom && e.env4326
    ),
    
    -- ========================================
    -- COMBINE ALL POINTS
    -- ========================================
    combined AS (
      SELECT pos4326, weight FROM buildings_points
      UNION ALL
      SELECT pos4326, weight FROM houses_points
      UNION ALL
      SELECT pos4326, weight FROM uploaded_points
    ),
    
    filtered AS (
      SELECT 
        ST_Transform(pos4326, 3857) AS p3857,
        weight
      FROM combined
      WHERE ST_Intersects(
        ST_Transform(pos4326, 3857),
        (SELECT env_q FROM qenv)
      )
    ),
    -- GLOBAL grid (anchored at world minx/miny), not tile-relative
    grid AS (
      SELECT
        FLOOR( (ST_X(p3857) - w.minx) / (SELECT cell_m FROM cell) )::bigint AS gx,
        FLOOR( (ST_Y(p3857) - w.miny) / (SELECT cell_m FROM cell) )::bigint AS gy,
        p3857,
        weight
      FROM filtered f CROSS JOIN world w
    ),
    clusters AS (
      SELECT
        gx, gy,
        SUM(weight)::int AS point_count,  -- Sum weights (apartment counts)
        ST_Centroid(ST_Collect(p3857)) AS centroid_3857
      FROM grid
      GROUP BY gx, gy
    ),
    circles AS (
      SELECT
        TRUE AS cluster,
        point_count,
        ST_Buffer(centroid_3857, (SELECT mpp FROM mpp) * %(radius_px)s) AS circle_3857
      FROM clusters
    ),
    -- Optional: keep only circles that intersect the real tile (plus a small pad)
    keep AS (
      SELECT c.*
      FROM circles c, b
      WHERE ST_Intersects(c.circle_3857, ST_Expand(b.env3857, (SELECT mpp FROM mpp) * %(radius_px)s))
    ),
    mvtgeom AS (
      SELECT
        NULL::text AS id,
        cluster,
        point_count,
        NULL::text AS address_text,
        NULL::text AS status,
        NULL::text AS tags,
        NULL::text AS source_table,
        NULL::int AS visited_units,
        NULL::int AS total_units,
        NULL::int AS remaining_units,
        'cluster'::text AS marker_type,
        NULL::text AS marker_color,
        ST_AsMVTGeom(
          circle_3857,
          (SELECT env3857 FROM b),
          %(extent)s, %(buffer)s, true
        ) AS geom
      FROM keep
    )
    SELECT ST_AsMVT(mvtgeom, %(layer)s, %(extent)s, 'geom')
    FROM mvtgeom
    WHERE geom IS NOT NULL;
    """
