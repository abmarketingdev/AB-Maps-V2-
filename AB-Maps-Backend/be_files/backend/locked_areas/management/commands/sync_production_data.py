"""
Django management command to sync data to production database from local machine.

Usage:
    python manage.py sync_production_data \
        --prod-host HOST \
        --prod-db DB \
        --prod-user USER \
        --prod-password PASSWORD \
        [--sync-counties] \
        [--populate-geom3857] \
        [--import-ssb CSV_FILE --year YEAR]

This command connects to production database and performs data synchronization.
"""
import os
import psycopg2
from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.conf import settings


class Command(BaseCommand):
    help = 'Sync data to production database from local machine'

    def add_arguments(self, parser):
        parser.add_argument(
            '--prod-connection-string',
            type=str,
            help='Production database connection string (postgresql://user:pass@host:port/db)'
        )
        parser.add_argument(
            '--prod-host',
            type=str,
            help='Production database host'
        )
        parser.add_argument(
            '--prod-db',
            type=str,
            help='Production database name'
        )
        parser.add_argument(
            '--prod-user',
            type=str,
            help='Production database user'
        )
        parser.add_argument(
            '--prod-password',
            type=str,
            help='Production database password'
        )
        parser.add_argument(
            '--prod-port',
            type=int,
            default=5432,
            help='Production database port (default: 5432)'
        )
        parser.add_argument(
            '--sync-counties',
            action='store_true',
            help='Sync counties to admin.areas'
        )
        parser.add_argument(
            '--populate-geom3857',
            action='store_true',
            help='Populate geom_3857 column'
        )
        parser.add_argument(
            '--import-ssb',
            type=str,
            help='Path to SSB CSV file to import'
        )
        parser.add_argument(
            '--year',
            type=int,
            help='Year for SSB import (required if --import-ssb is used)'
        )

    def handle(self, *args, **options):
        # Parse connection parameters
        conn_string = options.get('prod_connection_string')
        
        if conn_string:
            from urllib.parse import urlparse
            parsed = urlparse(conn_string)
            prod_host = parsed.hostname
            prod_db = parsed.path.lstrip('/')
            prod_user = parsed.username
            prod_password = parsed.password
            prod_port = parsed.port or 5432
        else:
            prod_host = options.get('prod_host')
            prod_db = options.get('prod_db')
            prod_user = options.get('prod_user')
            prod_password = options.get('prod_password')
            prod_port = options.get('prod_port', 5432)
            
            if not all([prod_host, prod_db, prod_user, prod_password]):
                self.stdout.write(self.style.ERROR(
                    '❌ Either --prod-connection-string or all of --prod-host, '
                    '--prod-db, --prod-user, --prod-password must be provided'
                ))
                return

        self.stdout.write('='*70)
        self.stdout.write('PRODUCTION DATA SYNC')
        self.stdout.write('='*70)
        self.stdout.write(f'Connecting to: {prod_host}:{prod_port}/{prod_db} as {prod_user}\n')

        # Connect to production
        try:
            prod_conn = psycopg2.connect(
                host=prod_host,
                database=prod_db,
                user=prod_user,
                password=prod_password,
                port=prod_port,
                connect_timeout=10
            )
            self.stdout.write(self.style.SUCCESS('✅ Connected to production database\n'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Failed to connect: {e}'))
            return

        try:
            # Sync counties
            if options.get('sync_counties'):
                self.stdout.write('\n📊 Syncing counties to admin.areas...')
                self._sync_counties(prod_conn)
            
            # Populate geom_3857
            if options.get('populate_geom3857'):
                self.stdout.write('\n🗺️  Populating geom_3857 column...')
                self._populate_geom3857(prod_conn)
            
            # Import SSB data
            if options.get('import_ssb'):
                csv_path = options['import_ssb']
                year = options.get('year')
                if not year:
                    self.stdout.write(self.style.ERROR('❌ --year is required when using --import-ssb'))
                    return
                self.stdout.write(f'\n📈 Importing SSB data from {csv_path}...')
                self._import_ssb(prod_conn, csv_path, year)
            
            if not any([options.get('sync_counties'), options.get('populate_geom3857'), options.get('import_ssb')]):
                self.stdout.write(self.style.WARNING(
                    '\n⚠️  No operations specified. Use --sync-counties, --populate-geom3857, or --import-ssb'
                ))
            
            self.stdout.write('\n' + '='*70)
            self.stdout.write(self.style.SUCCESS('✅ Sync complete'))
            self.stdout.write('='*70)
            
        finally:
            prod_conn.close()

    def _sync_counties(self, conn):
        """Sync counties to admin.areas using SQL."""
        with conn.cursor() as cursor:
            # Check if counties exist
            cursor.execute("SELECT COUNT(*) FROM admin.county")
            county_count = cursor.fetchone()[0]
            
            if county_count == 0:
                self.stdout.write(self.style.WARNING('  ⚠️  No counties found in admin.county'))
                return
            
            self.stdout.write(f'  Found {county_count} counties')
            
            # Insert/update fylke rows
            cursor.execute("""
                INSERT INTO admin.areas (
                    area_key, level, code, name, parent_code, parent_parent_code,
                    geom, area_km2, num_polygons, created_at, updated_at
                )
                SELECT
                    'fylke:' || county_code as area_key,
                    'fylke' as level,
                    county_code as code,
                    county_name as name,
                    NULL as parent_code,
                    NULL as parent_parent_code,
                    geom,
                    ST_Area(geom::geography) / 1000000.0 as area_km2,
                    ST_NumGeometries(geom) as num_polygons,
                    created_at,
                    updated_at
                FROM admin.county
                ON CONFLICT (area_key) DO UPDATE SET
                    name = EXCLUDED.name,
                    geom = EXCLUDED.geom,
                    area_km2 = EXCLUDED.area_km2,
                    num_polygons = EXCLUDED.num_polygons,
                    updated_at = NOW()
            """)
            
            updated_count = cursor.rowcount
            conn.commit()
            
            self.stdout.write(self.style.SUCCESS(f'  ✅ Synced {updated_count} fylke rows'))

    def _populate_geom3857(self, conn):
        """Populate geom_3857 column."""
        with conn.cursor() as cursor:
            # Check how many need updating
            cursor.execute("""
                SELECT COUNT(*) 
                FROM admin.areas 
                WHERE geom IS NOT NULL AND geom_3857 IS NULL
            """)
            count = cursor.fetchone()[0]
            
            if count == 0:
                self.stdout.write('  ✅ All rows already have geom_3857')
                return
            
            self.stdout.write(f'  Updating {count} rows...')
            
            # Populate
            cursor.execute("""
                UPDATE admin.areas 
                SET geom_3857 = ST_Transform(geom, 3857)
                WHERE geom IS NOT NULL AND geom_3857 IS NULL
            """)
            
            updated = cursor.rowcount
            conn.commit()
            
            self.stdout.write(self.style.SUCCESS(f'  ✅ Updated {updated} rows with geom_3857'))

    def _import_ssb(self, conn, csv_path, year):
        """Import SSB data directly to production database."""
        import csv
        import os
        import sys
        from datetime import datetime
        from decimal import Decimal
        
        if not os.path.exists(csv_path):
            self.stdout.write(self.style.ERROR(f'  ❌ CSV file not found: {csv_path}'))
            return
        
        self.stdout.write(f'  Reading CSV: {csv_path}')
        
        try:
            # Use the existing import command but with production connection
            # We'll call it as a subprocess with production DB env vars
            # Or better: import and reuse the logic
            
            # For now, let's use a simpler approach: call the command with production DB
            self.stdout.write(self.style.WARNING(
                f'  ⚠️  SSB import requires Django ORM access.\n'
                f'     Please run this command on production server:\n'
                f'     python manage.py import_ssb_04362_to_areas --csv {csv_path} --year {year}\n\n'
                f'     Or use the sync script with production DB connection string.'
            ))
            
            # Alternative: We could use psycopg2 to directly insert, but it's complex
            # The best approach is to use the existing command on production
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'  ❌ Error: {e}'))
            import traceback
            self.stdout.write(traceback.format_exc())
    
    def _update_areas_in_db(self, conn, stats_data, year):
        """Update admin.areas with SSB statistics."""
        from psycopg2.extras import execute_batch
        
        with conn.cursor() as cursor:
            # Get all matching area keys
            gk_codes = list(stats_data.keys())
            
            # Fetch existing areas
            cursor.execute("""
                SELECT area_key, code
                FROM admin.areas
                WHERE level = 'grunnkrets' AND code = ANY(%s)
            """, (gk_codes,))
            
            existing_areas = {row[1]: row[0] for row in cursor.fetchall()}
            
            matched = len(existing_areas)
            missing = len(gk_codes) - matched
            
            if missing > 0:
                self.stdout.write(self.style.WARNING(f'  ⚠️  {missing} grunnkretser not found in database'))
            
            if matched == 0:
                self.stdout.write(self.style.WARNING('  ⚠️  No matching grunnkretser found'))
                return
            
            self.stdout.write(f'  Updating {matched} grunnkretser...')
            
            # Prepare update data
            update_fields = [
                'f_0_5', 'f_6_15', 'f_16_19', 'f_20_24', 'f_25_29', 'f_30_49', 
                'f_50_59', 'f_60_66', 'f_67_69', 'f_70_79', 'f_80p',
                'm_0_5', 'm_6_15', 'm_16_19', 'm_20_24', 'm_25_29', 'm_30_49',
                'm_50_59', 'm_60_66', 'm_67_69', 'm_70_79', 'm_80p',
                'female_total', 'male_total', 'population_total',
                'pop_0_15', 'pop_16_29', 'pop_30_66', 'pop_67_plus',
                'donor_pool_adults', 'donor_pool_stable', 'donor_pool_seniors',
                'share_30_66', 'share_67_plus', 'female_share', 'male_share',
                'mean_age_est_total', 'mean_age_est_female', 'mean_age_est_male',
                'stats_year', 'stats_updated_at'
            ]
            
            # Build update queries
            updates = []
            for gk_code, stats in stats_data.items():
                if gk_code not in existing_areas:
                    continue
                
                # Build SET clause
                set_clause = ', '.join([f"{field} = %s" for field in update_fields])
                values = [stats.get(field) for field in update_fields]
                values.append(gk_code)  # for WHERE clause
                
                updates.append((set_clause, values))
            
            # Execute batch updates
            batch_size = 500
            updated_count = 0
            
            for i in range(0, len(updates), batch_size):
                batch = updates[i:i + batch_size]
                
                for set_clause, values in batch:
                    query = f"""
                        UPDATE admin.areas
                        SET {set_clause}
                        WHERE level = 'grunnkrets' AND code = %s
                    """
                    cursor.execute(query, values)
                    updated_count += cursor.rowcount
                
                conn.commit()
            
            self.stdout.write(self.style.SUCCESS(f'  ✅ Updated {updated_count} grunnkretser with SSB statistics'))

