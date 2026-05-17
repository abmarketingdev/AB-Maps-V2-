"""
Signals for the buildings app.

Handles:
1. Building counts update when Apartment STATUS changes (NOT on every save!)
2. Cache invalidation when Building data changes

CRITICAL PERFORMANCE NOTES:
- These signals do NOT fire during bulk-create (bulk_create handles counts)
- Building counts are updated ONCE per status change, not 100 times
- Cache invalidation happens when Building changes (status, counts)
"""
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.db import transaction
from .models import Building
import logging

logger = logging.getLogger(__name__)


# ============================================================================
# BUILDING → TILE CACHE INVALIDATION
# ============================================================================
# Cache is invalidated when Building changes (status, counts)
# NOT when individual apartments are created (that would kill bulk-create perf)

@receiver(post_save, sender=Building)
def invalidate_tiles_on_building_update(sender, instance, created, **kwargs):
    """
    Invalidate tile cache when a Building is created or updated.
    
    This signal fires when:
    1. New Building created (from bulk-create endpoint)
    2. Building counts/status updated (from apartment status change)
    
    Since tiles read from Building table, we invalidate here, not on Apartment.
    """
    if not instance.position:
        return
    
    # For updates, only invalidate if status or counts changed
    update_fields = kwargs.get('update_fields')
    if update_fields:
        important_fields = {'status', 'total_units', 'visited_units', 'is_completed'}
        if not important_fields.intersection(set(update_fields or [])):
            logger.debug(f"Building {instance.id} updated but no important fields changed, skipping invalidation")
            return
    
    action = "created" if created else "updated"
    logger.info(
        f"🏢 Building {action}: {instance.base_address} - invalidating tiles"
    )
    
    from tiles.tiles import invalidate_point_tiles
    
    lon, lat = instance.position.x, instance.position.y
    
    def invalidate_cache():
        logger.info(f"🗑️  INVALIDATING TILES for building at ({lon:.6f}, {lat:.6f})")
        invalidate_point_tiles(
            lon, lat,
            campaign_id=str(instance.campaign_id) if instance.campaign_id else None
        )
        logger.info(f"   ✅ Tile cache invalidated for building {instance.id}")
    
    transaction.on_commit(invalidate_cache)


@receiver(post_delete, sender=Building)
def invalidate_tiles_on_building_delete(sender, instance, **kwargs):
    """
    Invalidate tile cache when a Building is deleted.
    """
    if not instance.position:
        return
    
    logger.info(
        f"🏢 Building deleted: {instance.base_address} - invalidating tiles"
    )
    
    from tiles.tiles import invalidate_point_tiles
    
    lon, lat = instance.position.x, instance.position.y
    
    def invalidate_cache():
        logger.info(f"🗑️  INVALIDATING TILES for deleted building at ({lon:.6f}, {lat:.6f})")
        invalidate_point_tiles(
            lon, lat,
            campaign_id=str(instance.campaign_id) if instance.campaign_id else None
        )
    
    transaction.on_commit(invalidate_cache)


# ============================================================================
# HELPER FUNCTION FOR COUNT UPDATES
# ============================================================================
# Called by apartments/views.py when apartment status changes
# Called by apartments/signals.py when address is created/deleted
# NOT connected as a signal receiver (that would fire on every save!)

def update_building_counts(building_id):
    """
    Recalculate and update building counts.
    
    Called explicitly by:
    1. apartments/views.py (after bulk_create)
    2. apartments/views.py (when apartment status changes via PATCH)
    3. apartments/signals.py (when Address is created/deleted)
    
    This is NOT a signal receiver - it's called explicitly to avoid
    running 100 times during bulk-create.
    
    Returns:
        Building instance or None if not found
    """
    try:
        building = Building.objects.get(id=building_id)
        
        # Store old values for logging
        old_status = building.status
        old_visited = building.visited_units
        
        # Recalculate counts (this also saves the building)
        building.update_counts()
        
        # Only log if something changed
        if old_status != building.status or old_visited != building.visited_units:
            logger.info(
                f"🏢 Building {building.id} counts updated: "
                f"{building.visited_units}/{building.total_units} "
                f"({old_status} → {building.status})"
            )
        
        return building
    except Building.DoesNotExist:
        logger.warning(f"Building {building_id} not found for count update")
        return None


# ============================================================================
# NO APARTMENT SIGNALS HERE!
# ============================================================================
# We deliberately do NOT have @receiver(post_save, sender=Apartment) here.
# 
# Reason: During bulk-create, this would fire 100 times (once per apartment),
# causing 100 COUNT(*) queries. Instead, we call update_building_counts()
# ONCE at the end of bulk-create.
#
# When apartment status changes via PATCH, the view explicitly calls
# update_building_counts() after saving the apartment.
