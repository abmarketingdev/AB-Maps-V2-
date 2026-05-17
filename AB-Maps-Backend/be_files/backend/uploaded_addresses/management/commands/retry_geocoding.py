"""
Django management command to retry geocoding for failed addresses.
"""
from django.core.management.base import BaseCommand
from uploaded_addresses.tasks import retry_failed_geocoding


class Command(BaseCommand):
    help = 'Retry geocoding for addresses that failed to geocode'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without actually doing it',
        )

    def handle(self, *args, **options):
        if options['dry_run']:
            self.stdout.write(
                self.style.WARNING('DRY RUN MODE - No changes will be made')
            )
            
            # Count ungeocoded addresses
            from uploaded_addresses.models import UploadedAddress
            ungeocoded_count = UploadedAddress.objects.filter(
                latitude__isnull=True,
                longitude__isnull=True
            ).count()
            
            self.stdout.write(
                f'Would retry geocoding for {ungeocoded_count} addresses'
            )
            return

        self.stdout.write('Starting geocoding retry...')
        
        result = retry_failed_geocoding()
        
        if result['status'] == 'success':
            self.stdout.write(
                self.style.SUCCESS(
                    f"✅ Retry completed successfully!\n"
                    f"   Total addresses: {result['total_addresses']}\n"
                    f"   Success: {result['success_count']}\n"
                    f"   Failed: {result['failed_count']}"
                )
            )
        else:
            self.stdout.write(
                self.style.ERROR(f"❌ Retry failed: {result.get('error', 'Unknown error')}")
            ) 