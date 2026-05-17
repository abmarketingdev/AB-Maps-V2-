"""
Django management command to fake the initial migration if the table already exists.

This is useful for production deployments where the table was created manually.
"""
from django.core.management.base import BaseCommand
from django.db import connection
from django.core.management import call_command


class Command(BaseCommand):
    help = 'Fake initial migration if locked_areas table already exists'

    def handle(self, *args, **options):
        with connection.cursor() as cursor:
            # Check if table exists
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'locked_areas'
                );
            """)
            table_exists = cursor.fetchone()[0]
            
            # Check if migration is already applied
            cursor.execute("""
                SELECT COUNT(*) FROM django_migrations 
                WHERE app = 'locked_areas' AND name = '0001_initial';
            """)
            migration_applied = cursor.fetchone()[0] > 0
            
            if table_exists and not migration_applied:
                self.stdout.write(
                    self.style.WARNING(
                        '⚠️  locked_areas table exists but migration not applied - faking it...'
                    )
                )
                call_command('migrate', 'locked_areas', '0001_initial', '--fake', verbosity=0)
                self.stdout.write(
                    self.style.SUCCESS('✅ Faked initial migration')
                )
            elif table_exists:
                self.stdout.write(
                    self.style.SUCCESS('✅ locked_areas table exists and migration is applied')
                )
            else:
                self.stdout.write(
                    'ℹ️  locked_areas table does not exist - will create via migration'
                )

