"""
Django signals for the addresses app.
"""
import logging
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.contrib.gis.geos import Point
from django.db import transaction
from django.core.cache import cache
from .models import Address
from tiles.tiles import invalidate_point_tiles

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Address)
def on_address_save(sender, instance: Address, **kwargs):
    """Invalidate tile cache when an address is saved/updated."""
    created = kwargs.get('created', False)
    action = "CREATED" if created else "UPDATED"
    
    logger.info(f"🔄 ADDRESS {action}: {instance.id} at {instance.position}")
    logger.info(f"   Address: {instance.address_text}")
    logger.info(f"   Manager: {instance.manager_id}, Campaign: {instance.campaign_id}")
    
    if instance.position and isinstance(instance.position, Point):
        lon, lat = instance.position.x, instance.position.y
        logger.info(f"   Coordinates: ({lon:.6f}, {lat:.6f})")
        
        # Show cache state BEFORE invalidation
        _debug_cache_state("BEFORE INVALIDATION", lon, lat, instance.campaign_id)
        
        # Invalidate tiles after transaction commits
        def invalidate_cache():
            logger.info(f"🗑️  INVALIDATING CACHE for address {instance.id}")
            invalidate_point_tiles(
                lon, lat,
                manager_id=instance.manager_id if instance.manager_id else None,
                employee_id=instance.employee.id if instance.employee else None,
                campaign_id=instance.campaign_id if instance.campaign_id else None
            )
            
            # Show cache state AFTER invalidation
            _debug_cache_state("AFTER INVALIDATION", lon, lat, instance.campaign_id)
        
        transaction.on_commit(invalidate_cache)
    else:
        logger.warning(f"⚠️  No position data for address {instance.id}")


@receiver(post_delete, sender=Address)
def on_address_delete(sender, instance: Address, **kwargs):
    """Invalidate tile cache when an address is deleted."""
    logger.info(f"🗑️  ADDRESS DELETED: {instance.id} at {instance.position}")
    logger.info(f"   Address: {instance.address_text}")
    logger.info(f"   Manager: {instance.manager_id}, Campaign: {instance.campaign_id}")
    
    if instance.position and isinstance(instance.position, Point):
        lon, lat = instance.position.x, instance.position.y
        logger.info(f"   Coordinates: ({lon:.6f}, {lat:.6f})")
        
        # Show cache state BEFORE invalidation
        _debug_cache_state("BEFORE DELETE INVALIDATION", lon, lat, instance.campaign_id)
        
        # Invalidate tiles after transaction commits
        def invalidate_cache():
            logger.info(f"🗑️  INVALIDATING CACHE for deleted address {instance.id}")
            invalidate_point_tiles(
                lon, lat,
                manager_id=instance.manager_id if instance.manager_id else None,
                employee_id=instance.employee.id if instance.employee else None,
                campaign_id=instance.campaign_id if instance.campaign_id else None
            )
            
            # Show cache state AFTER invalidation
            _debug_cache_state("AFTER DELETE INVALIDATION", lon, lat, instance.campaign_id)
        
        transaction.on_commit(invalidate_cache)
    else:
        logger.warning(f"⚠️  No position data for deleted address {instance.id}")


def _debug_cache_state(stage, lon, lat, campaign_id):
    """Debug helper to show Redis cache state for tiles around a point."""
    try:
        from tiles.tiles import lonlat_to_tile
        
        logger.info(f"🔍 CACHE STATE - {stage}")
        logger.info(f"   Point: ({lon:.6f}, {lat:.6f}), Campaign: {campaign_id}")
        
        # Check tiles for zoom levels 16-18
        for z in range(16, 19):
            x, y = lonlat_to_tile(lon, lat, z)
            
            # Check both campaign-specific and wildcard cache keys
            keys_to_check = [
                f"tiles:v1:{z}:{x}:{y}:m{None or 'x'}:e{None or 'x'}:c{campaign_id or 'x'}",
                f"tiles:v1:{z}:{x}:{y}:mx:ex:cx"  # wildcard key
            ]
            
            for key in keys_to_check:
                cached_value = cache.get(key)
                if cached_value is not None:
                    logger.info(f"   ✅ CACHED: {key} ({len(cached_value)} bytes)")
                else:
                    logger.info(f"   ❌ MISSING: {key}")
        
        # Show total cache keys
        try:
            from django_redis import get_redis_connection
            redis_conn = get_redis_connection("default")
            total_keys = len(redis_conn.keys("tiles:*"))
            logger.info(f"   📊 Total tile cache keys: {total_keys}")
        except Exception as e:
            logger.warning(f"   ⚠️  Could not count Redis keys: {e}")
            
    except Exception as e:
        logger.error(f"❌ Cache debug failed: {e}")


# ============================================================================
# TODO AUTO-CREATION SIGNAL
# ============================================================================

@receiver(post_save, sender=Address)
def auto_create_followup_todo(sender, instance: Address, created, **kwargs):
    """
    Auto-create TODO when address marked as 'folg_opp'.
    
    Triggers when:
    - Address status is changed to 'folg_opp'
    
    Creates TODO with:
    - Title: "Følg opp adresse"
    - Description: Address text + notes
    - Priority: HIGH (urgent)
    - Status: PENDING
    - User: Address owner (employee or manager)
    - Related address & campaign
    - Deadline: null (user decides)
    
    Edge cases handled:
    - No duplicate TODOs created
    - No TODO if no user (employee & manager both null)
    - No TODO if status is not folg_opp
    """
    # Import here to avoid circular imports
    from todos.models import Todo
    
    # Only trigger if status is folg_opp
    if instance.status != 'folg_opp':
        return
    
    logger.info(f"🔔 Address {instance.id} marked as 'folg_opp' - checking for TODO creation")
    
    # Check if TODO already exists for this address
    # (to prevent duplicates)
    existing_todo = Todo.objects.filter(
        related_address=instance,
        status__in=[Todo.Status.PENDING, Todo.Status.IN_PROGRESS]
    ).exists()
    
    if existing_todo:
        logger.info(f"   ⏭️  TODO already exists for address {instance.id}, skipping creation")
        return
    
    # Determine user (who owns this address)
    # Address has employee/manager FKs, but Todo needs User instance
    # User has OneToOne to employee/manager with related_name='user'
    user = None
    if instance.employee:
        try:
            user = instance.employee.user
        except Exception:
            pass
    elif instance.manager:
        try:
            user = instance.manager.user
        except Exception:
            pass
    
    if not user:
        logger.warning(f"   ⚠️  No user found for address {instance.id}, cannot create TODO")
        return
    
    # Build description
    description = f"{instance.address_text}"
    if instance.notes:
        description += f"\n\nNotater: {instance.notes}"
    
    # Create TODO
    try:
        todo = Todo.objects.create(
            user=user,
            title="Følg opp adresse",
            description=description,
            status=Todo.Status.PENDING,
            priority=Todo.Priority.HIGH,
            related_address=instance,
            related_campaign=instance.campaign,
            deadline=None  # User decides deadline
        )
        logger.info(f"   ✅ TODO created: {todo.id} for user {user.username}")
        logger.info(f"      Title: {todo.title}")
        logger.info(f"      Priority: {todo.get_priority_display()}")
        logger.info(f"      Related to: {instance.address_text}")
    except Exception as e:
        logger.error(f"   ❌ Failed to create TODO for address {instance.id}: {e}")
