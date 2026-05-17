"""
Signals for the dashboard app.
"""
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from addresses.models import Address
from .models import Activity


@receiver(post_save, sender=Address)
def create_address_activity(sender, instance, created, **kwargs):
    """
    Create an Activity record when a new Address is created.
    """
    if created:  # Only create activity for new addresses, not updates
        # Determine the user type and get the appropriate user
        employee = instance.employee
        manager = instance.manager
        
        # Create activity record
        Activity.objects.create(
            employee=employee,
            manager=manager,
            campaign=instance.campaign,  # Campaign is properly set
            activity_type='address_contact',
            description=f'Contacted address: {instance.address_text}',
            metadata={
                'address_id': str(instance.id),
                'address_text': instance.address_text,
                'status': instance.status,
                'position': {
                    'lat': instance.position.y if instance.position else None,
                    'lng': instance.position.x if instance.position else None,
                } if instance.position else None,
                'tags': instance.tags,
                'recorded_at': instance.recorded_at.isoformat(),
                'campaign_name': instance.campaign.name if instance.campaign else None,
                'campaign_id': str(instance.campaign.id) if instance.campaign else None,  # Campaign ID in metadata
                'user_type': 'employee' if employee else 'manager',
                'user_name': employee.name if employee else manager.name if manager else 'Unknown',
            }
        )


@receiver(post_save, sender=Address)
def update_address_activity(sender, instance, created, **kwargs):
    """
    Create an Activity record when an Address status is updated.
    """
    if not created:  # Only for updates, not new addresses
        # Check if status changed
        if instance.tracker.has_changed('status'):
            old_status = instance.tracker.previous('status')
            new_status = instance.status
            
            employee = instance.employee
            manager = instance.manager
            
            Activity.objects.create(
                employee=employee,
                manager=manager,
                campaign=instance.campaign,
                activity_type='status_change',
                description=f'Status changed from {old_status} to {new_status} for {instance.address_text}',
                metadata={
                    'address_id': str(instance.id),
                    'address_text': instance.address_text,
                    'old_status': old_status,
                    'new_status': new_status,
                    'position': {
                        'lat': instance.position.y if instance.position else None,
                        'lng': instance.position.x if instance.position else None,
                    } if instance.position else None,
                    'campaign_name': instance.campaign.name if instance.campaign else None,
                    'user_type': 'employee' if employee else 'manager',
                    'user_name': employee.name if employee else manager.name if manager else 'Unknown',
                }
            )


@receiver(post_delete, sender=Address)
def delete_address_activity(sender, instance, **kwargs):
    """
    Delete Activity records when an Address is deleted.
    """
    # Delete all activities related to this address
    Activity.objects.filter(
        metadata__address_id=str(instance.id)
    ).delete()