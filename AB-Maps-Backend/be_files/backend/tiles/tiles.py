"""
Tile utilities for cache invalidation and coordinate conversion.
"""
import logging
import math
from django.core.cache import cache

logger = logging.getLogger(__name__)
DATASET_VERSION = "v1"


def lonlat_to_tile(lon, lat, z):
    """Convert longitude/latitude to tile coordinates at given zoom level."""
    lat_rad = math.radians(lat)
    n = 2 ** z
    x = int((lon + 180.0) / 360.0 * n)
    y = int((1.0 - math.log(math.tan(lat_rad) + (1 / math.cos(lat_rad))) / math.pi) / 2.0 * n)
    return x, y


def neighbor_tiles(x, y, z, n=1):
    """
    Generate neighboring tiles in a square grid around the center tile.
    
    Args:
        x: Center tile X coordinate
        y: Center tile Y coordinate
        z: Zoom level
        n: Ring size (n=1 gives 3x3 grid, n=2 gives 5x5, etc.)
    
    Yields:
        (x, y) tuples for center tile and all neighbors in the ring
    
    Notes:
        - X wraps around (tiles repeat horizontally)
        - Y is clamped to valid range [0, 2^z - 1] (no wrapping vertically)
        - This ensures we invalidate tiles where features might appear due to:
          * Buffer zones (points near edges render in neighbors)
          * Clustering effects at z=16
          * Simplification and placement algorithms
    """
    dim = 1 << z  # 2 pow z, this is a bitwise operator that shifts 1 to the left by z bits so z is the zoom level
    
    for dx in range(-n, n + 1):
        for dy in range(-n, n + 1):
            # X wraps around (horizontal tiling)
            xx = (x + dx) % dim
            
            # Y is clamped (no vertical wrapping)
            yy = y + dy
            
            # Only yield valid Y coordinates
            if 0 <= yy < dim:
                yield xx, yy


def invalidate_point_tiles(lon, lat, zmin=16, zmax=18, manager_id=None, employee_id=None, campaign_id=None):
    """
    Invalidate cache for tiles covering a specific point across multiple zoom levels.
    
    Now invalidates a 3x3 grid (center + 8 neighbors) at each zoom level to handle:
    - Buffer zones (points near tile edges render in adjacent tiles)
    - Clustering at z=16 (cluster membership can cross tile boundaries)
    - Simplification/placement (features can shift to neighbor tiles)
    
    Args:
        lon: Longitude of the point
        lat: Latitude of the point
        zmin: Minimum zoom level to invalidate (default: 16)
        zmax: Maximum zoom level to invalidate (default: 18)
        manager_id: Optional manager ID for tenant-specific cache keys
        employee_id: Optional employee ID for tenant-specific cache keys
        campaign_id: Optional campaign ID for tenant-specific cache keys
    """
    logger.info(f"🎯 INVALIDATING TILES for point ({lon:.6f}, {lat:.6f})")
    logger.info(f"   Filters: manager={manager_id}, employee={employee_id}, campaign={campaign_id}")
    logger.info(f"   Zoom range: {zmin}-{zmax}")
    
    keys = []
    tiles_info = []
    center_tiles_info = []
    
    # Common filter combinations - all possible cache key variants
    filter_combos = [
        # Wildcard key (no filters) - most common from frontend
        ("mx", "ex", "cx"),
        # Campaign-only filter
        ("mx", "ex", f"c{campaign_id or 'x'}"),
        # Manager-only filter  
        (f"m{manager_id or 'x'}", "ex", "cx"),
        # Manager + Campaign filter
        (f"m{manager_id or 'x'}", "ex", f"c{campaign_id or 'x'}"),
        # Employee-only filter (if employee exists)
        ("mx", f"e{employee_id or 'x'}", "cx"),
        # Employee + Campaign filter
        ("mx", f"e{employee_id or 'x'}", f"c{campaign_id or 'x'}"),
        # All filters combined
        (f"m{manager_id or 'x'}", f"e{employee_id or 'x'}", f"c{campaign_id or 'x'}"),
    ]
    
    for z in range(zmin, zmax + 1):
        # Get center tile coordinates
        cx, cy = lonlat_to_tile(lon, lat, z)
        center_tiles_info.append(f"z{z}/{cx}/{cy}")
        
        # Generate keys for center + 8 neighbors (3x3 grid)
        neighbor_count = 0
        for nx, ny in neighbor_tiles(cx, cy, z, n=1):
            neighbor_count += 1
            tiles_info.append(f"z{z}/{nx}/{ny}")
            
            # Generate all cache key variants for this tile
            for m, e, c in filter_combos:
                # Old format (without version)
                key = f"tiles:{DATASET_VERSION}:{z}:{nx}:{ny}:{m}:{e}:{c}"
                if key not in keys:
                    keys.append(key)
                
                # New format with version numbers
                for v in ["1", "2", "3"]:
                    key = f"tiles:{DATASET_VERSION}:v{v}:{z}:{nx}:{ny}:{m}:{e}:{c}"
                    if key not in keys:
                        keys.append(key)
        
        logger.info(f"   z{z}: Center tile ({cx},{cy}) + {neighbor_count - 1} neighbors = {neighbor_count} tiles")
    
    logger.info(f"   Center tiles: {', '.join(center_tiles_info)}")
    logger.info(f"   Total tiles to check: {len(set(tiles_info))} (including neighbors)")
    logger.info(f"   Cache key variants to check: {len(keys)}")
    
    # Check which keys actually exist before deletion
    existing_keys = []
    for key in keys:
        if cache.get(key) is not None:
            existing_keys.append(key)
    
    logger.info(f"   Found {len(existing_keys)} cached keys to delete")
    
    if keys:
        deleted_count = cache.delete_many(keys)
        logger.info(f"✅ INVALIDATION COMPLETE: {deleted_count} keys deleted out of {len(keys)} checked")
        
        # Verify deletion worked
        still_cached = []
        for key in existing_keys:
            if cache.get(key) is not None:
                still_cached.append(key)
        
        if still_cached:
            logger.error(f"❌ DELETION FAILED: {len(still_cached)} keys still cached")
            for key in still_cached[:5]:  # Show first 5 failures
                logger.error(f"   Still cached: {key}")
        else:
            logger.info(f"✅ DELETION VERIFIED: All {len(existing_keys)} existing keys successfully removed")
    else:
        logger.warning("⚠️  No keys to invalidate")
