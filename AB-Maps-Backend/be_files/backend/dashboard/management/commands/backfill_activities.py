"""
Management command to backfill activities for existing addresses.
"""
from django.core.management.base import BaseCommand
from addresses.models import Address
from dashboard.models import Activity
from django.utils import timezone


class Command(BaseCommand):
    help = 'Backfill activities for existing addresses'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be created without actually creating',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        # Get all addresses that don't have corresponding activities
        addresses = Address.objects.all()
        
        if dry_run:
            self.stdout.write(f"Would create activities for {addresses.count()} addresses")
            return
        
        created_count = 0
        
        for address in addresses:
            # Check if activity already exists for this address
            existing_activity = Activity.objects.filter(
                activity_type='address_contact',
                metadata__address_id=str(address.id)
            ).first()
            
            if existing_activity:
                self.stdout.write(f"Activity already exists for address {address.id}")
                continue
            
            # Create activity for this address
            employee = address.employee
            manager = address.manager
            
            Activity.objects.create(
                employee=employee,
                manager=manager,
                campaign=address.campaign,
                activity_type='address_contact',
                description=f'Contacted address: {address.address_text}',
                metadata={
                    'address_id': str(address.id),
                    'address_text': address.address_text,
                    'status': address.status,
                    'position': {
                        'lat': address.position.y if address.position else None,
                        'lng': address.position.x if address.position else None,
                    } if address.position else None,
                    'tags': address.tags,
                    'recorded_at': address.recorded_at.isoformat(),
                    'campaign_name': address.campaign.name if address.campaign else None,
                    'campaign_id': str(address.campaign.id) if address.campaign else None,  # Campaign ID in metadata
                    'user_type': 'employee' if employee else 'manager',
                    'user_name': employee.name if employee else manager.name if manager else 'Unknown',
                }
            )
            
            created_count += 1
            self.stdout.write(f"Created activity for address {address.id}")
        
        self.stdout.write(
            self.style.SUCCESS(f'Successfully created {created_count} activities')
        ) 