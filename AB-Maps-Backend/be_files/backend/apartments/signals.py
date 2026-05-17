"""
Signals for the apartments app.

SIMPLIFIED after Building refactor:
- Address → Apartment sync (when visit happens)
- Cache invalidation REMOVED (moved to buildings/signals.py)

IMPORTANT:
- Building is created in bulk-create endpoint, NOT here
- These signals handle the VISIT flow (when user marks an apartment)
- Building counts are updated via buildings.signals.update_building_counts()
"""
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.db import transaction
from addresses.models import Address
from .models import Apartment
from .utils import parse_address_text
import logging

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Address)
def update_apartment_on_address_save(sender, instance: Address, created, **kwargs):
    """
    When an Address is created with apartment number (visit happens):
    1. Find existing Apartment (should already exist from bulk-create)
    2. Update Apartment status
    3. Link Address to Building (Ghost Buster)
    4. Update Building counts
    
    NOTE: This does NOT create Buildings/Apartments - bulk-create does that!
    This signal handles the VISIT flow after apartments already exist.
    
    IMPORTANT: If the Address was created via Apartment.update() (PATCH /api/apartments/),
    it will already have building_id set. In that case, we skip processing to avoid
    double-processing.
    
    Flow:
    - bulk-create creates Building + Apartments (all with status=NULL)
    - User visits apartment → this signal fires
    - Apartment.status updated, Address linked, Building counts updated
    """
    if not created:
        logger.debug(f"Address {instance.id} updated, skipping apartment sync")
        return
    
    # IMPORTANT: If building is already set, this Address was created via
    # the Apartment.update() endpoint. Skip to avoid double-processing.
    if instance.building_id:
        logger.debug(
            f"Address {instance.id} already linked to building {instance.building_id} "
            f"(created via Apartment update)"
        )
        return
    
    # Parse address to extract base and apartment number
    base_address, apartment_number = parse_address_text(instance.address_text)
    
    if not apartment_number:
        # This is a standalone house (no apartment number)
        # No building link needed - it appears in MVT "houses" layer
        logger.debug(f"Address {instance.id} has no apartment number (standalone house)")
        return
    
    if not instance.campaign_id:
        logger.warning(f"Address {instance.id} has no campaign, skipping apartment sync")
        return
    
    logger.info(f"📝 Visit recorded for: {base_address}, {apartment_number}")
    
    try:
        with transaction.atomic():
            # Import here to avoid circular imports
            from buildings.models import Building
            from buildings.signals import update_building_counts
            
            # Try to find existing Building (from bulk-create)
            building = Building.objects.filter(
                base_address=base_address,
                campaign_id=instance.campaign_id
            ).first()
            
            if not building:
                # Edge case: Visit happened before bulk-create (shouldn't normally happen)
                # Create building + apartment on-the-fly
                logger.warning(
                    f"⚠️ Building not found for {base_address} - creating on-the-fly"
                )
                building_data = {
                    'base_address': base_address,
                    'campaign_id': instance.campaign_id,
                    'position': instance.position,
                    'total_units': 1,
                    'visited_units': 1,
                    'status': 'in_progress',
                }
                # Set creator based on who created the address
                if instance.manager_id:
                    building_data['created_by_id'] = instance.manager_id
                elif instance.employee_id:
                    building_data['created_by_employee_id'] = instance.employee_id
                
                building = Building.objects.create(**building_data)
            
            # Find or create apartment
            apt_nei = (
                instance.nei_subcategory if instance.status == 'nei' else None
            )
            apartment, apt_created = Apartment.objects.get_or_create(
                building=building,
                apartment_number=apartment_number,
                defaults={
                    'status': instance.status,
                    'nei_subcategory': apt_nei,
                    'address': instance,
                }
            )
            
            if apt_created:
                logger.info(f"✅ Created apartment on-the-fly: {apartment_number}")
            else:
                # Update existing apartment status
                old_status = apartment.status
                apartment.status = instance.status
                apartment.nei_subcategory = apt_nei
                apartment.address = instance
                apartment.save(
                    update_fields=[
                        'status', 'nei_subcategory', 'address', 'updated_at'
                    ]
                )
                logger.info(
                    f"✅ Updated apartment status: {apartment_number} "
                    f"({old_status} → {instance.status})"
                )
            
            # Link Address to Building (THE GHOST BUSTER)
            # This prevents the address from appearing in the "houses" MVT layer
            instance.building = building
            instance.save(update_fields=['building'])
            
            # Update building counts (this triggers tile cache invalidation)
            update_building_counts(building.id)
            
            logger.info(f"✅ Address {instance.id} linked to building {building.id}")
    
    except Exception as e:
        logger.error(f"❌ Failed to sync apartment for address {instance.id}: {e}", exc_info=True)


@receiver(post_delete, sender=Address)
def unlink_apartment_on_address_delete(sender, instance: Address, **kwargs):
    """
    When an Address is deleted:
    - Find linked apartment
    - Unlink address (set to NULL)
    - Keep status as historical record
    - Update building counts
    
    Args:
        sender: The Address model class
        instance: The Address instance being deleted
        **kwargs: Additional keyword arguments
    """
    # Parse address to extract base and apartment number
    base_address, apartment_number = parse_address_text(instance.address_text)
    
    if not apartment_number:
        # No apartment number, nothing to do
        logger.debug(
            f"Deleted address {instance.id} had no apartment number, skipping"
        )
        return
    
    logger.info(
        f"🗑️ Unlinking apartment for deleted address {instance.id}: "
        f"{base_address}, {apartment_number}"
    )
    
    try:
        # Find apartment linked to this address
        apartment = Apartment.objects.filter(
            building__base_address=base_address,
            building__campaign_id=instance.campaign_id,
            apartment_number=apartment_number,
            address=instance
        ).first()
        
        if apartment:
            building_id = apartment.building_id
            
            # Unlink address but keep status (historical record)
            apartment.address = None
            # Note: We keep the status to show it was visited historically
            # If you want to reset status, uncomment the next line:
            # apartment.status = None
            apartment.save(update_fields=['address', 'updated_at'])
            
            logger.info(
                f"✅ Unlinked apartment {apartment.id} from deleted address "
                f"(kept status: {apartment.status})"
            )
            
            # Update building counts
            if building_id:
                from buildings.signals import update_building_counts
                update_building_counts(building_id)
        else:
            logger.warning(
                f"⚠️ No apartment found for deleted address {instance.id} "
                f"({base_address}, {apartment_number})"
            )
    
    except Exception as e:
        logger.error(
            f"❌ Failed to unlink apartment for deleted address {instance.id}: {e}",
            exc_info=True
        )


@receiver(post_save, sender=Address)
def log_address_apartment_sync(sender, instance: Address, created, **kwargs):
    """
    Additional logging for debugging apartment sync issues.
    This can be disabled in production if not needed.
    """
    if created and kwargs.get('raw', False):
        # Skip during fixtures/loaddata
        return
    
    if created:
        base, apt = parse_address_text(instance.address_text)
        if apt:
            logger.debug(
                f"🔍 Address-Apartment sync triggered: "
                f"address_id={instance.id}, "
                f"base='{base}', "
                f"apt='{apt}', "
                f"status={instance.status}, "
                f"campaign={instance.campaign_id}"
            )


# ============================================================================
# CACHE INVALIDATION SIGNALS - REMOVED
# ============================================================================
# These have been moved to buildings/signals.py
# Cache invalidation now happens at Building level, not Apartment level
#
# Why? Because during bulk-create, we would have invalidated cache 100 times
# (once per apartment). Now we invalidate ONCE when the Building is updated.
