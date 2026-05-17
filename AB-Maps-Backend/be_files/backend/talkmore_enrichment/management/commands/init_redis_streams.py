"""
Management command to initialize Redis Streams and consumer groups.
Run this once during deployment or when setting up the system.
"""
from django.core.management.base import BaseCommand
from talkmore_enrichment.services.redis_streams import initialize_streams


class Command(BaseCommand):
    help = 'Initialize Redis Streams and consumer groups for talkmore enrichment pipeline'

    def handle(self, *args, **options):
        self.stdout.write('Initializing Redis Streams and consumer groups...')
        try:
            initialize_streams()
            self.stdout.write(self.style.SUCCESS('✅ Successfully initialized all Redis streams and consumer groups'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Error initializing streams: {e}'))
            raise
