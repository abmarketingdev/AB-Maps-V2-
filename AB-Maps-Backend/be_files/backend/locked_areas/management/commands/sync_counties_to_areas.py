"""
Django management command to sync counties from admin.county to admin.areas.

Usage:
    python manage.py sync_counties_to_areas

This command ensures every county row exists in admin.areas as a level='fylke' entry.
It inserts missing fylke rows and updates existing fylke rows if already present.
"""

from django.core.management.base import BaseCommand
from django.db import connection, transaction
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Sync counties from admin.county to admin.areas as fylke entries'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without actually doing it'
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No changes will be made'))
        
        try:
            with connection.cursor() as cursor:
                # Check if admin.areas is a table or view
                cursor.execute("""
                    SELECT table_type 
                    FROM information_schema.tables 
                    WHERE table_schema = 'admin' 
                    AND table_name = 'areas'
                """)
                result = cursor.fetchone()
                
                if not result:
                    self.stdout.write(
                        self.style.ERROR('❌ admin.areas table/view does not exist')
                    )
                    return
                
                is_view = result[0] == 'VIEW'
                
                if is_view:
                    self.stdout.write(
                        self.style.WARNING(
                            '⚠️  admin.areas is a VIEW. Converting to TABLE for sync operations...'
                        )
                    )
                    # Convert view to table
                    if not dry_run:
                        self._convert_view_to_table(cursor)
                    else:
                        self.stdout.write(
                            self.style.WARNING(
                                '[DRY RUN] Would convert admin.areas VIEW to TABLE'
                            )
                        )
                        return
                
                # Ensure admin.areas table has required columns and indexes
                self._ensure_table_structure(cursor, dry_run)
                
                # Fetch all counties from admin.county
                cursor.execute("""
                    SELECT 
                        county_code,
                        county_name,
                        geom,
                        created_at,
                        updated_at
                    FROM admin.county
                    ORDER BY county_code
                """)
                counties = cursor.fetchall()
                
                total_counties = len(counties)
                self.stdout.write(f'📊 Found {total_counties} counties to sync')
                
                if total_counties == 0:
                    self.stdout.write(self.style.WARNING('⚠️  No counties found in admin.county'))
                    return
                
                # Process counties - prepare data first
                processed_counties = []
                errors = []
                
                for county_code, county_name, geom, created_at, updated_at in counties:
                    try:
                        # Ensure county_code is 2 digits (pad with leading zero if needed)
                        county_code = str(county_code).strip()
                        if len(county_code) == 1:
                            county_code = '0' + county_code
                        elif len(county_code) != 2:
                            self.stdout.write(
                                self.style.WARNING(
                                    f'⚠️  Skipping county with invalid code: {county_code}'
                                )
                            )
                            continue
                        
                        area_key = f'fylke:{county_code}'
                        
                        # Calculate num_polygons and area_km2
                        cursor.execute("""
                            SELECT 
                                ST_NumGeometries(%s::geometry) as num_polygons,
                                ST_Area(%s::geography) / 1000000.0 as area_km2,
                                ST_SRID(%s::geometry) as srid
                        """, [geom, geom, geom])
                        
                        calc_result = cursor.fetchone()
                        num_polygons = calc_result[0] if calc_result[0] else 1
                        area_km2 = calc_result[1] if calc_result[1] else 0.0
                        srid = calc_result[2] if calc_result[2] else 4326
                        
                        # Ensure SRID is 4326 if not set
                        if srid != 4326:
                            cursor.execute("""
                                SELECT ST_SetSRID(%s::geometry, 4326)
                            """, [geom])
                            geom = cursor.fetchone()[0]
                        
                        processed_counties.append({
                            'area_key': area_key,
                            'county_code': county_code,
                            'county_name': county_name,
                            'geom': geom,
                            'area_km2': area_km2,
                            'num_polygons': num_polygons,
                            'created_at': created_at or timezone.now(),
                            'updated_at': updated_at or timezone.now()
                        })
                    
                    except Exception as e:
                        error_msg = f'Error processing county {county_code} ({county_name}): {str(e)}'
                        errors.append(error_msg)
                        logger.error(error_msg, exc_info=True)
                        self.stdout.write(self.style.ERROR(f'  ✗ {error_msg}'))
                
                # Check which counties already exist
                if processed_counties:
                    area_keys = [c['area_key'] for c in processed_counties]
                    county_codes = [c['county_code'] for c in processed_counties]
                    
                    cursor.execute("""
                        SELECT area_key, code
                        FROM admin.areas
                        WHERE area_key = ANY(%s) 
                           OR (level = 'fylke' AND code = ANY(%s))
                    """, [area_keys, county_codes])
                    
                    existing_rows = cursor.fetchall()
                    existing_keys = {row[0] for row in existing_rows if row[0]}
                    existing_codes = {row[1] for row in existing_rows if row[1]}
                    
                    # Separate into inserts and updates
                    to_insert = []
                    to_update = []
                    
                    for county in processed_counties:
                        exists = (
                            county['area_key'] in existing_keys or 
                            county['county_code'] in existing_codes
                        )
                        if exists:
                            to_update.append(county)
                        else:
                            to_insert.append(county)
                
                # Perform bulk operations
                inserted_count = 0
                updated_count = 0
                
                with transaction.atomic():
                    # Bulk insert new counties
                    if to_insert and not dry_run:
                        # Check if unique constraint exists for ON CONFLICT
                        cursor.execute("""
                            SELECT EXISTS (
                                SELECT 1
                                FROM information_schema.table_constraints
                                WHERE table_schema = 'admin'
                                AND table_name = 'areas'
                                AND constraint_type = 'UNIQUE'
                                AND constraint_name LIKE '%area_key%'
                            )
                        """)
                        has_unique_constraint = cursor.fetchone()[0]
                        
                        insert_values = []
                        for county in to_insert:
                            insert_values.append((
                                county['area_key'],
                                'fylke',
                                county['county_code'],
                                county['county_name'],
                                None,  # parent_code
                                None,  # parent_parent_code
                                county['geom'],
                                county['area_km2'],
                                county['num_polygons'],
                                county['created_at'],
                                county['updated_at']
                            ))
                        
                        if has_unique_constraint:
                            # Use executemany for bulk insert with ON CONFLICT
                            cursor.executemany("""
                                INSERT INTO admin.areas (
                                    area_key, level, code, name, parent_code, parent_parent_code,
                                    geom, area_km2, num_polygons, created_at, updated_at
                                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                                ON CONFLICT (area_key) DO UPDATE SET
                                    level = EXCLUDED.level,
                                    code = EXCLUDED.code,
                                    name = EXCLUDED.name,
                                    parent_code = EXCLUDED.parent_code,
                                    parent_parent_code = EXCLUDED.parent_parent_code,
                                    geom = EXCLUDED.geom,
                                    area_km2 = EXCLUDED.area_km2,
                                    num_polygons = EXCLUDED.num_polygons,
                                    updated_at = EXCLUDED.updated_at
                            """, insert_values)
                        else:
                            # Fallback: insert one by one with error handling
                            for county in to_insert:
                                try:
                                    cursor.execute("""
                                        INSERT INTO admin.areas (
                                            area_key, level, code, name, parent_code, parent_parent_code,
                                            geom, area_km2, num_polygons, created_at, updated_at
                                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                                    """, (
                                        county['area_key'],
                                        'fylke',
                                        county['county_code'],
                                        county['county_name'],
                                        None,
                                        None,
                                        county['geom'],
                                        county['area_km2'],
                                        county['num_polygons'],
                                        county['created_at'],
                                        county['updated_at']
                                    ))
                                except Exception as e:
                                    # If insert fails (e.g., duplicate), try update instead
                                    cursor.execute("""
                                        UPDATE admin.areas
                                        SET 
                                            level = 'fylke',
                                            code = %s,
                                            name = %s,
                                            parent_code = NULL,
                                            parent_parent_code = NULL,
                                            geom = %s,
                                            area_km2 = %s,
                                            num_polygons = %s,
                                            updated_at = %s
                                        WHERE area_key = %s OR (level = 'fylke' AND code = %s)
                                    """, [
                                        county['county_code'],
                                        county['county_name'],
                                        county['geom'],
                                        county['area_km2'],
                                        county['num_polygons'],
                                        county['updated_at'],
                                        county['area_key'],
                                        county['county_code']
                                    ])
                        
                        inserted_count = len(to_insert)
                        for county in to_insert:
                            self.stdout.write(
                                f'  + Inserted: {county["county_name"]} ({county["county_code"]}) - '
                                f'Area: {county["area_km2"]:.2f} km², Polygons: {county["num_polygons"]}'
                            )
                    
                    elif to_insert and dry_run:
                        inserted_count = len(to_insert)
                        for county in to_insert:
                            self.stdout.write(
                                f'  [DRY RUN] Would insert: {county["county_name"]} ({county["county_code"]}) - '
                                f'Area: {county["area_km2"]:.2f} km², Polygons: {county["num_polygons"]}'
                            )
                    
                    # Bulk update existing counties
                    if to_update and not dry_run:
                        for county in to_update:
                            cursor.execute("""
                                UPDATE admin.areas
                                SET 
                                    area_key = %s,
                                    level = 'fylke',
                                    code = %s,
                                    name = %s,
                                    parent_code = NULL,
                                    parent_parent_code = NULL,
                                    geom = %s,
                                    area_km2 = %s,
                                    num_polygons = %s,
                                    updated_at = %s
                                WHERE area_key = %s OR (level = 'fylke' AND code = %s)
                            """, [
                                county['area_key'],
                                county['county_code'],
                                county['county_name'],
                                county['geom'],
                                county['area_km2'],
                                county['num_polygons'],
                                county['updated_at'],
                                county['area_key'],
                                county['county_code']
                            ])
                        
                        updated_count = len(to_update)
                        for county in to_update:
                            self.stdout.write(
                                f'  ✓ Updated: {county["county_name"]} ({county["county_code"]}) - '
                                f'Area: {county["area_km2"]:.2f} km², Polygons: {county["num_polygons"]}'
                            )
                    
                    elif to_update and dry_run:
                        updated_count = len(to_update)
                        for county in to_update:
                            self.stdout.write(
                                f'  [DRY RUN] Would update: {county["county_name"]} ({county["county_code"]}) - '
                                f'Area: {county["area_km2"]:.2f} km², Polygons: {county["num_polygons"]}'
                            )
                    
                    if dry_run:
                        self.stdout.write(self.style.WARNING('\n🔍 DRY RUN - No changes committed'))
                        transaction.set_rollback(True)
                    # Transaction will auto-commit when exiting the atomic block
                
                # Summary
                self.stdout.write('\n' + '='*60)
                self.stdout.write(self.style.SUCCESS('📊 SYNC SUMMARY'))
                self.stdout.write('='*60)
                self.stdout.write(f'Total counties scanned: {total_counties}')
                self.stdout.write(f'Inserted: {inserted_count}')
                self.stdout.write(f'Updated: {updated_count}')
                
                if errors:
                    self.stdout.write(self.style.ERROR(f'\nErrors encountered: {len(errors)}'))
                    for error in errors:
                        self.stdout.write(self.style.ERROR(f'  - {error}'))
                else:
                    self.stdout.write(self.style.SUCCESS('\n✅ All counties synced successfully!'))
        
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Fatal error: {str(e)}'))
            logger.error('Fatal error in sync_counties_to_areas', exc_info=True)
            raise

    def _ensure_table_structure(self, cursor, dry_run):
        """Ensure admin.areas table has required structure."""
        if dry_run:
            return
        
        try:
            # Check if unique constraint on area_key exists
            cursor.execute("""
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.table_constraints
                    WHERE table_schema = 'admin'
                    AND table_name = 'areas'
                    AND constraint_type = 'UNIQUE'
                    AND constraint_name LIKE '%area_key%'
                )
            """)
            has_unique = cursor.fetchone()[0]
            
            if not has_unique:
                self.stdout.write('Creating unique constraint on area_key...')
                cursor.execute("""
                    ALTER TABLE admin.areas
                    ADD CONSTRAINT admin_areas_area_key_unique UNIQUE (area_key)
                """)
                self.stdout.write(self.style.SUCCESS('  ✓ Unique constraint created'))
            
            # Check if index on (level, code) exists
            cursor.execute("""
                SELECT EXISTS (
                    SELECT 1
                    FROM pg_indexes
                    WHERE schemaname = 'admin'
                    AND tablename = 'areas'
                    AND indexname LIKE '%level_code%'
                )
            """)
            has_index = cursor.fetchone()[0]
            
            if not has_index:
                self.stdout.write('Creating index on (level, code)...')
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_admin_areas_level_code 
                    ON admin.areas (level, code)
                """)
                self.stdout.write(self.style.SUCCESS('  ✓ Index created'))
        
        except Exception as e:
            # If constraints/indexes already exist or table structure differs, that's okay
            self.stdout.write(
                self.style.WARNING(f'  ⚠️  Could not ensure table structure: {str(e)}')
            )

    def _convert_view_to_table(self, cursor):
        """Convert admin.areas VIEW to TABLE if it exists as a view."""
        try:
            # Drop the view
            cursor.execute("DROP VIEW IF EXISTS admin.areas CASCADE;")
            self.stdout.write('  ✓ Dropped admin.areas VIEW')
            
            # Create the table with the same structure
            cursor.execute("""
                CREATE TABLE admin.areas (
                    area_key VARCHAR(255) PRIMARY KEY,
                    level VARCHAR(20) NOT NULL,
                    code VARCHAR(50) NOT NULL,
                    name TEXT NOT NULL,
                    parent_code VARCHAR(50),
                    parent_parent_code VARCHAR(50),
                    geom GEOMETRY(MultiPolygon, 4326),
                    area_km2 NUMERIC(12, 6),
                    num_polygons INTEGER,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            """)
            self.stdout.write('  ✓ Created admin.areas TABLE')
            
            # Create indexes
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_admin_areas_level 
                ON admin.areas (level);
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_admin_areas_level_code 
                ON admin.areas (level, code);
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_admin_areas_geom 
                ON admin.areas USING GIST(geom);
            """)
            self.stdout.write('  ✓ Created indexes on admin.areas')
            
            # Populate table from source tables
            self.stdout.write('  📊 Populating table from source data...')
            
            # Insert counties
            cursor.execute("""
                INSERT INTO admin.areas (
                    area_key, level, code, name, parent_code, parent_parent_code,
                    geom, area_km2, num_polygons, created_at, updated_at
                )
                SELECT 
                    'fylke:' || county_code AS area_key,
                    'fylke' AS level,
                    county_code AS code,
                    county_name AS name,
                    NULL AS parent_code,
                    NULL AS parent_parent_code,
                    geom,
                    ST_Area(geom::geography) / 1000000.0 AS area_km2,
                    ST_NumGeometries(geom) AS num_polygons,
                    created_at,
                    updated_at
                FROM admin.county
                WHERE geom IS NOT NULL
                ON CONFLICT (area_key) DO NOTHING;
            """)
            county_count = cursor.rowcount
            self.stdout.write(f'    ✓ Inserted {county_count} counties')
            
            # Insert municipalities
            cursor.execute("""
                INSERT INTO admin.areas (
                    area_key, level, code, name, parent_code, parent_parent_code,
                    geom, area_km2, num_polygons, created_at, updated_at
                )
                SELECT 
                    'kommune:' || municipality_code AS area_key,
                    'kommune' AS level,
                    municipality_code AS code,
                    municipality_name AS name,
                    municipality_code AS parent_code,
                    SUBSTRING(municipality_code, 1, 2) AS parent_parent_code,
                    geom,
                    ST_Area(geom::geography) / 1000000.0 AS area_km2,
                    ST_NumGeometries(geom) AS num_polygons,
                    created_at,
                    updated_at
                FROM admin.municipality
                WHERE geom IS NOT NULL
                ON CONFLICT (area_key) DO NOTHING;
            """)
            municipality_count = cursor.rowcount
            self.stdout.write(f'    ✓ Inserted {municipality_count} municipalities')
            
            # Insert basic districts
            cursor.execute("""
                INSERT INTO admin.areas (
                    area_key, level, code, name, parent_code, parent_parent_code,
                    geom, area_km2, num_polygons, created_at, updated_at
                )
                SELECT 
                    'grunnkrets:' || gk_code AS area_key,
                    'grunnkrets' AS level,
                    gk_code AS code,
                    gk_name AS name,
                    SUBSTRING(gk_code, 1, 4) AS parent_code,
                    SUBSTRING(gk_code, 1, 2) AS parent_parent_code,
                    geom,
                    ST_Area(geom::geography) / 1000000.0 AS area_km2,
                    ST_NumGeometries(geom) AS num_polygons,
                    created_at,
                    updated_at
                FROM admin.basic_district
                WHERE geom IS NOT NULL
                ON CONFLICT (area_key) DO NOTHING;
            """)
            grunnkrets_count = cursor.rowcount
            self.stdout.write(f'    ✓ Inserted {grunnkrets_count} basic districts')
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'  ✅ Converted VIEW to TABLE with {county_count + municipality_count + grunnkrets_count} total rows'
                )
            )
        
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'  ❌ Failed to convert VIEW to TABLE: {str(e)}')
            )
            raise

