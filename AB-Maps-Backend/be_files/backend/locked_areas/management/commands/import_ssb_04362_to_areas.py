"""
Django management command to import SSB table 04362 statistics into admin.areas.

Usage:
    python manage.py import_ssb_04362_to_areas --csv /path/to/file.csv --year 2025

This command imports population statistics from SSB table 04362 CSV export
and updates admin.areas rows where level='grunnkrets'.
"""

import csv
import os
from decimal import Decimal
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Import SSB table 04362 statistics from CSV into admin.areas'

    def add_arguments(self, parser):
        parser.add_argument(
            '--csv',
            type=str,
            required=True,
            help='Path to SSB CSV file'
        )
        parser.add_argument(
            '--year',
            type=int,
            required=True,
            help='Year of the statistics (e.g., 2025)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without actually doing it'
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=1000,
            help='Batch size for bulk updates (default: 1000)'
        )

    def handle(self, *args, **options):
        csv_path = options['csv']
        year = options['year']
        dry_run = options['dry_run']
        batch_size = options['batch_size']
        
        if not os.path.exists(csv_path):
            raise CommandError(f'CSV file not found: {csv_path}')
        
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No changes will be made'))
        
        try:
            # Parse CSV
            self.stdout.write(f'📊 Parsing CSV file: {csv_path}')
            parsed_data, csv_rows = self._parse_csv(csv_path, year)
            
            if not parsed_data:
                self.stdout.write(self.style.WARNING('⚠️  No data found in CSV'))
                return
            
            self.stdout.write(f'  ✓ Found {len(parsed_data)} unique grunnkretser')
            
            # Calculate derived statistics
            self.stdout.write('📈 Calculating derived statistics...')
            stats_data = self._calculate_statistics(parsed_data)
            
            # Update database
            self.stdout.write('💾 Updating admin.areas table...')
            result = self._update_database(stats_data, year, dry_run, batch_size, csv_rows)
            
            # Summary
            self.stdout.write('\n' + '='*60)
            self.stdout.write(self.style.SUCCESS('📊 IMPORT SUMMARY'))
            self.stdout.write('='*60)
            self.stdout.write(f'CSV rows read: {result["csv_rows"]}')
            self.stdout.write(f'Unique grunnkretser parsed: {result["unique_gk_codes"]}')
            self.stdout.write(f'Grunnkretser matched in DB: {result["matched"]}')
            self.stdout.write(f'Grunnkretser missing in DB: {result["missing"]}')
            self.stdout.write(f'Rows updated: {result["updated"]}')
            
            if result['errors']:
                self.stdout.write(self.style.ERROR(f'\nErrors encountered: {len(result["errors"])}'))
                for error in result['errors'][:10]:  # Show first 10 errors
                    self.stdout.write(self.style.ERROR(f'  - {error}'))
                if len(result['errors']) > 10:
                    self.stdout.write(self.style.ERROR(f'  ... and {len(result["errors"]) - 10} more'))
            else:
                self.stdout.write(self.style.SUCCESS('\n✅ Import completed successfully!'))
        
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Fatal error: {str(e)}'))
            logger.error('Fatal error in import_ssb_04362_to_areas', exc_info=True)
            raise

    def _parse_csv(self, csv_path, year):
        """Parse CSV file and extract grunnkrets data.
        
        Returns:
            tuple: (parsed_data dict, csv_rows count)
        """
        parsed_data = {}
        csv_rows = 0
        
        # Age group mappings
        age_groups = [
            ('0-5 years', '0_5'),
            ('6-15 years', '6_15'),
            ('16-19 years', '16_19'),
            ('20-24 years', '20_24'),
            ('25-29 years', '25_29'),
            ('30-49 years', '30_49'),
            ('50-59 years', '50_59'),
            ('60-66 years', '60_66'),
            ('67-69 years', '67_69'),
            ('70-79 years', '70_79'),
            ('80 years or older', '80p'),
        ]
        
        # Try different encodings - prioritize ISO-8859-1 for SSB files
        encodings = ['iso-8859-1', 'windows-1252', 'latin-1', 'utf-8-sig', 'utf-8']
        file_handle = None
        encoding_used = None
        
        for enc in encodings:
            try:
                # Test by reading a larger chunk of the file
                with open(csv_path, 'rb') as test_file:
                    test_data = test_file.read(10000)  # Read first 10KB
                    test_data.decode(enc)  # Try to decode
                # If successful, open for real
                file_handle = open(csv_path, 'r', encoding=enc)
                encoding_used = enc
                break
            except (UnicodeDecodeError, UnicodeError):
                if file_handle:
                    file_handle.close()
                continue
        
        if not file_handle:
            raise CommandError(f'Could not decode CSV file with any supported encoding: {encodings}')
        
        self.stdout.write(f'  ✓ Using encoding: {encoding_used}')
        
        with file_handle as f:
            # Read first line to check if it's metadata
            first_line = f.readline()
            if first_line.strip().startswith('"04362') or first_line.strip().startswith('04362'):
                self.stdout.write('  ✓ Skipping metadata header row')
                # Next line should be the actual headers - let DictReader handle it
                reader = csv.DictReader(f, delimiter=';')  # SSB files use semicolon
            else:
                # Not metadata, rewind and let DictReader read headers
                f.seek(0)
                # Try to detect delimiter
                sample = f.read(1024)
                f.seek(0)
                sniffer = csv.Sniffer()
                delimiter = sniffer.sniff(sample).delimiter
                self.stdout.write(f'  ✓ Detected delimiter: {repr(delimiter)}')
                reader = csv.DictReader(f, delimiter=delimiter)
            
            # Get delimiter from reader if not set
            if 'delimiter' not in locals():
                delimiter = ';'  # Default for SSB files
                self.stdout.write(f'  ✓ Using delimiter: {repr(delimiter)}')
            
            # Build column mapping
            column_map = {}
            for age_label, age_key in age_groups:
                column_name = f'Persons {year} {age_label}'
                # Try to find the column (case-insensitive)
                for col in reader.fieldnames:
                    if col.strip().lower() == column_name.lower():
                        column_map[age_key] = col
                        break
                if age_key not in column_map:
                    self.stdout.write(
                        self.style.WARNING(f'  ⚠️  Column not found: {column_name}')
                    )
            
            # Check for required columns
            if 'region' not in reader.fieldnames:
                raise CommandError('CSV missing required column: region')
            if 'gender' not in reader.fieldnames:
                raise CommandError('CSV missing required column: gender')
            
            # Parse rows
            for row in reader:
                csv_rows += 1
                
                region = row.get('region', '').strip()
                if not region:
                    continue
                
                # Extract gk_code (first token)
                gk_code = region.split()[0] if region else None
                if not gk_code or len(gk_code) != 8:
                    continue
                
                # Normalize gender
                gender_raw = row.get('gender', '').strip()
                if 'female' in gender_raw.lower():
                    gender = 'female'
                elif 'male' in gender_raw.lower():
                    gender = 'male'
                else:
                    continue
                
                # Initialize grunnkrets data if needed
                if gk_code not in parsed_data:
                    parsed_data[gk_code] = {
                        'female_bins': {key: 0 for key, _ in age_groups},
                        'male_bins': {key: 0 for key, _ in age_groups},
                    }
                
                # Extract age group values
                bins = parsed_data[gk_code][f'{gender}_bins']
                for age_label, age_key in age_groups:
                    col_name = column_map.get(age_key)
                    if col_name and col_name in row:
                        try:
                            value = int(float(row[col_name].replace(',', '').strip() or 0))
                            bins[age_key] = value
                        except (ValueError, TypeError):
                            bins[age_key] = 0
        
        return parsed_data, csv_rows

    def _calculate_statistics(self, parsed_data):
        """Calculate all derived statistics for each grunnkrets."""
        # Age group midpoints for mean age calculation
        midpoints = {
            '0_5': 2.5,
            '6_15': 10.5,
            '16_19': 17.5,
            '20_24': 22.0,
            '25_29': 27.0,
            '30_49': 39.5,
            '50_59': 54.5,
            '60_66': 63.0,
            '67_69': 68.0,
            '70_79': 74.5,
            '80p': 85.0,
        }
        
        stats_data = {}
        
        for gk_code, data in parsed_data.items():
            female_bins = data['female_bins']
            male_bins = data['male_bins']
            
            # Calculate totals
            female_total = sum(female_bins.values())
            male_total = sum(male_bins.values())
            population_total = female_total + male_total
            
            # Calculate combined bins (total per age group)
            total_bins = {
                key: female_bins[key] + male_bins[key]
                for key in female_bins.keys()
            }
            
            # Calculate aggregates
            pop_0_15 = total_bins['0_5'] + total_bins['6_15']
            pop_16_29 = total_bins['16_19'] + total_bins['20_24'] + total_bins['25_29']
            pop_30_66 = total_bins['30_49'] + total_bins['50_59'] + total_bins['60_66']
            pop_67_plus = total_bins['67_69'] + total_bins['70_79'] + total_bins['80p']
            
            donor_pool_adults = population_total - pop_0_15
            donor_pool_stable = pop_30_66
            donor_pool_seniors = pop_67_plus
            
            # Calculate shares (only if population_total > 0)
            if population_total > 0:
                female_share = Decimal(female_total) / Decimal(population_total)
                male_share = Decimal(male_total) / Decimal(population_total)
                share_30_66 = Decimal(pop_30_66) / Decimal(population_total)
                share_67_plus = Decimal(pop_67_plus) / Decimal(population_total)
            else:
                female_share = None
                male_share = None
                share_30_66 = None
                share_67_plus = None
            
            # Calculate mean age estimates
            if population_total > 0:
                weighted_sum_total = sum(
                    total_bins[key] * midpoints[key]
                    for key in midpoints.keys()  # Use midpoints keys, not total_bins keys
                )
                mean_age_est_total = weighted_sum_total / population_total
            else:
                mean_age_est_total = None
            
            if female_total > 0:
                weighted_sum_female = sum(
                    female_bins[key] * midpoints[key]
                    for key in midpoints.keys()  # Use midpoints keys
                )
                mean_age_est_female = weighted_sum_female / female_total
            else:
                mean_age_est_female = None
            
            if male_total > 0:
                weighted_sum_male = sum(
                    male_bins[key] * midpoints[key]
                    for key in midpoints.keys()  # Use midpoints keys
                )
                mean_age_est_male = weighted_sum_male / male_total
            else:
                mean_age_est_male = None
            
            stats_data[gk_code] = {
                # Raw bins
                'f_0_5': female_bins['0_5'],
                'f_6_15': female_bins['6_15'],
                'f_16_19': female_bins['16_19'],
                'f_20_24': female_bins['20_24'],
                'f_25_29': female_bins['25_29'],
                'f_30_49': female_bins['30_49'],
                'f_50_59': female_bins['50_59'],
                'f_60_66': female_bins['60_66'],
                'f_67_69': female_bins['67_69'],
                'f_70_79': female_bins['70_79'],
                'f_80p': female_bins['80p'],
                'm_0_5': male_bins['0_5'],
                'm_6_15': male_bins['6_15'],
                'm_16_19': male_bins['16_19'],
                'm_20_24': male_bins['20_24'],
                'm_25_29': male_bins['25_29'],
                'm_30_49': male_bins['30_49'],
                'm_50_59': male_bins['50_59'],
                'm_60_66': male_bins['60_66'],
                'm_67_69': male_bins['67_69'],
                'm_70_79': male_bins['70_79'],
                'm_80p': male_bins['80p'],
                # Totals
                'female_total': female_total,
                'male_total': male_total,
                'population_total': population_total,
                # Aggregates
                'pop_0_15': pop_0_15,
                'pop_16_29': pop_16_29,
                'pop_30_66': pop_30_66,
                'pop_67_plus': pop_67_plus,
                'donor_pool_adults': donor_pool_adults,
                'donor_pool_stable': donor_pool_stable,
                'donor_pool_seniors': donor_pool_seniors,
                # Shares
                'share_30_66': float(share_30_66) if share_30_66 is not None else None,
                'share_67_plus': float(share_67_plus) if share_67_plus is not None else None,
                'female_share': float(female_share) if female_share is not None else None,
                'male_share': float(male_share) if male_share is not None else None,
                # Mean age estimates
                'mean_age_est_total': mean_age_est_total,
                'mean_age_est_female': mean_age_est_female,
                'mean_age_est_male': mean_age_est_male,
            }
        
        return stats_data

    def _update_database(self, stats_data, year, dry_run, batch_size, csv_rows):
        """Update admin.areas table with calculated statistics."""
        gk_codes = list(stats_data.keys())
        
        if not gk_codes:
            return {
                'csv_rows': csv_rows,
                'unique_gk_codes': 0,
                'matched': 0,
                'missing': 0,
                'updated': 0,
                'errors': []
            }
        
        with connection.cursor() as cursor:
            # Fetch matching areas
            cursor.execute("""
                SELECT area_key, code
                FROM admin.areas
                WHERE level = 'grunnkrets' AND code = ANY(%s)
            """, [gk_codes])
            
            matched_areas = {row[1]: row[0] for row in cursor.fetchall()}
            matched_codes = set(matched_areas.keys())
            missing_codes = set(gk_codes) - matched_codes
            
            if missing_codes:
                self.stdout.write(
                    self.style.WARNING(
                        f'  ⚠️  {len(missing_codes)} grunnkretser not found in admin.areas'
                    )
                )
                for code in list(missing_codes)[:10]:
                    self.stdout.write(f'    - {code}')
                if len(missing_codes) > 10:
                    self.stdout.write(f'    ... and {len(missing_codes) - 10} more')
            
            if not matched_codes:
                self.stdout.write(self.style.WARNING('  ⚠️  No matching grunnkretser found'))
                return {
                    'csv_rows': csv_rows,
                    'unique_gk_codes': len(gk_codes),
                    'matched': 0,
                    'missing': len(missing_codes),
                    'updated': 0,
                    'errors': []
                }
            
            # Prepare updates
            updates = []
            for gk_code in matched_codes:
                stats = stats_data[gk_code]
                updates.append((gk_code, stats))
            
            # Bulk update in batches
            updated_count = 0
            errors = []
            
            if not dry_run:
                with transaction.atomic():
                    for i in range(0, len(updates), batch_size):
                        batch = updates[i:i + batch_size]
                        
                        for gk_code, stats in batch:
                            try:
                                cursor.execute("""
                                    UPDATE admin.areas
                                    SET
                                        f_0_5 = %s, f_6_15 = %s, f_16_19 = %s, f_20_24 = %s,
                                        f_25_29 = %s, f_30_49 = %s, f_50_59 = %s, f_60_66 = %s,
                                        f_67_69 = %s, f_70_79 = %s, f_80p = %s,
                                        m_0_5 = %s, m_6_15 = %s, m_16_19 = %s, m_20_24 = %s,
                                        m_25_29 = %s, m_30_49 = %s, m_50_59 = %s, m_60_66 = %s,
                                        m_67_69 = %s, m_70_79 = %s, m_80p = %s,
                                        female_total = %s, male_total = %s, population_total = %s,
                                        pop_0_15 = %s, pop_16_29 = %s, pop_30_66 = %s, pop_67_plus = %s,
                                        donor_pool_adults = %s, donor_pool_stable = %s, donor_pool_seniors = %s,
                                        share_30_66 = %s, share_67_plus = %s,
                                        female_share = %s, male_share = %s,
                                        mean_age_est_total = %s, mean_age_est_female = %s, mean_age_est_male = %s,
                                        stats_year = %s, stats_updated_at = %s
                                    WHERE level = 'grunnkrets' AND code = %s
                                """, [
                                    stats['f_0_5'], stats['f_6_15'], stats['f_16_19'], stats['f_20_24'],
                                    stats['f_25_29'], stats['f_30_49'], stats['f_50_59'], stats['f_60_66'],
                                    stats['f_67_69'], stats['f_70_79'], stats['f_80p'],
                                    stats['m_0_5'], stats['m_6_15'], stats['m_16_19'], stats['m_20_24'],
                                    stats['m_25_29'], stats['m_30_49'], stats['m_50_59'], stats['m_60_66'],
                                    stats['m_67_69'], stats['m_70_79'], stats['m_80p'],
                                    stats['female_total'], stats['male_total'], stats['population_total'],
                                    stats['pop_0_15'], stats['pop_16_29'], stats['pop_30_66'], stats['pop_67_plus'],
                                    stats['donor_pool_adults'], stats['donor_pool_stable'], stats['donor_pool_seniors'],
                                    stats['share_30_66'], stats['share_67_plus'],
                                    stats['female_share'], stats['male_share'],
                                    stats['mean_age_est_total'], stats['mean_age_est_female'], stats['mean_age_est_male'],
                                    year, timezone.now(),
                                    gk_code
                                ])
                                updated_count += 1
                            except Exception as e:
                                error_msg = f'Error updating {gk_code}: {str(e)}'
                                errors.append(error_msg)
                                logger.error(error_msg, exc_info=True)
                        
                        if (i + batch_size) % 1000 == 0:
                            self.stdout.write(f'  ✓ Updated {min(i + batch_size, len(updates))} / {len(updates)} rows...')
            else:
                updated_count = len(updates)
                self.stdout.write(f'  [DRY RUN] Would update {updated_count} rows')
            
            return {
                'csv_rows': csv_rows,
                'unique_gk_codes': len(gk_codes),
                'matched': len(matched_codes),
                'missing': len(missing_codes),
                'updated': updated_count,
                'errors': errors
            }

