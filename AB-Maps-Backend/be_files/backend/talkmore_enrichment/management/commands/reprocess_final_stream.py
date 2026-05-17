"""
Management command to re-process final_write stream messages for a job.
Fixes the address_uuid issue by looking up correct unit_uuid from local_apartments.
"""
import json
import logging
from django.core.management.base import BaseCommand
from django.db import connection
from django.contrib.gis.geos import Point
from talkmore_enrichment.models import EnrichmentJob
from talkmore_enrichment.services.redis_streams import (
    STREAM_FINAL_WRITE,
    get_redis_client
)

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Re-process final_write stream messages for a job, fixing address_uuid to use unit_uuid'

    def add_arguments(self, parser):
        parser.add_argument(
            'job_id',
            type=str,
            help='Job ID to re-process'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be processed without writing to database'
        )

    def handle(self, *args, **options):
        job_id = options['job_id']
        dry_run = options['dry_run']
        
        # Get job
        try:
            job = EnrichmentJob.objects.get(id=job_id)
        except EnrichmentJob.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'Job {job_id} not found'))
            return
        
        self.stdout.write(f'Re-processing final_write stream for job {job_id}')
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No database writes'))
        
        # Get Redis client
        client = get_redis_client()
        
        # Read all messages from final_write stream
        messages = client.xrange(STREAM_FINAL_WRITE, '-', '+')
        
        # Filter messages for this job_id
        job_messages = []
        for msg_id, fields in messages:
            if fields.get('job_id') == job_id:
                job_messages.append((msg_id, fields))
        
        self.stdout.write(f'Found {len(job_messages)} messages for job {job_id}')
        
        if not job_messages:
            self.stdout.write(self.style.WARNING('No messages found in stream for this job'))
            return
        
        # Process messages
        total_addresses = 0
        processed_addresses = 0
        skipped_addresses = 0
        errors = 0
        
        for msg_id, fields in job_messages:
            # Skip init messages
            if fields.get('init') == 'true':
                continue
            
            # Handle batch messages
            if 'final_addresses' in fields:
                try:
                    addresses = json.loads(fields['final_addresses'])
                    total_addresses += len(addresses)
                    
                    for addr in addresses:
                        if self._process_address(job, addr, dry_run):
                            processed_addresses += 1
                        else:
                            skipped_addresses += 1
                except json.JSONDecodeError as e:
                    self.stdout.write(self.style.ERROR(f'Invalid JSON in message {msg_id}: {e}'))
                    errors += 1
            
            # Handle per-address messages
            elif 'final_address' in fields and fields.get('is_per_address') == 'true':
                try:
                    addr = json.loads(fields['final_address'])
                    total_addresses += 1
                    
                    if self._process_address(job, addr, dry_run):
                        processed_addresses += 1
                    else:
                        skipped_addresses += 1
                except json.JSONDecodeError as e:
                    self.stdout.write(self.style.ERROR(f'Invalid JSON in message {msg_id}: {e}'))
                    errors += 1
        
        # Summary
        self.stdout.write(self.style.SUCCESS('\n' + '='*60))
        self.stdout.write(self.style.SUCCESS('Processing Summary:'))
        self.stdout.write(f'  Total addresses found: {total_addresses}')
        self.stdout.write(f'  Successfully processed: {processed_addresses}')
        self.stdout.write(f'  Skipped (no unit_uuid found): {skipped_addresses}')
        self.stdout.write(f'  Errors: {errors}')
        self.stdout.write(self.style.SUCCESS('='*60))

    def _process_address(self, job, addr, dry_run):
        """Process a single address, looking up correct unit_uuid."""
        full_address = addr.get('full_address', '')
        old_address_uuid = addr.get('address_uuid')
        
        if not full_address or not old_address_uuid:
            return False
        
        # Look up correct unit_uuid from local_apartments
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT COALESCE(unit_uuid, address_uuid) AS unique_id
                FROM public.local_apartments
                WHERE full_address = %s
                LIMIT 1
            """, [full_address])
            
            row = cursor.fetchone()
            if not row:
                self.stdout.write(
                    self.style.WARNING(
                        f'  ⚠️  No match found in local_apartments for: {full_address}'
                    )
                )
                return False
            
            correct_uuid = str(row[0])
        
        # If UUID is already correct, skip
        if correct_uuid == old_address_uuid:
            if not dry_run:
                # Still write to ensure data is in DB
                self._upsert_address(job, addr, correct_uuid)
            return True
        
        # Update address_uuid in the address data
        addr['address_uuid'] = correct_uuid
        
        if dry_run:
            self.stdout.write(
                f'  Would update: {full_address}\n'
                f'    Old UUID: {old_address_uuid}\n'
                f'    New UUID: {correct_uuid}'
            )
        else:
            # Write to database
            self._upsert_address(job, addr, correct_uuid)
            self.stdout.write(
                f'  ✅ Updated: {full_address} (UUID: {old_address_uuid} → {correct_uuid})'
            )
        
        return True

    def _upsert_address(self, job, addr, address_uuid):
        """Upsert address to database (same logic as worker_d_writer)."""
        # Parse position from WKT
        position_wkt = addr.get('position_wkt')
        if position_wkt:
            try:
                geom = Point.from_wkt(position_wkt, srid=4326)
            except Exception:
                # Fallback to lon/lat
                lon = addr.get('lon')
                lat = addr.get('lat')
                if lon and lat:
                    geom = Point(lon, lat, srid=4326)
                else:
                    logger.warning(f"No valid position for address {address_uuid}")
                    return
        else:
            lon = addr.get('lon')
            lat = addr.get('lat')
            if lon and lat:
                geom = Point(lon, lat, srid=4326)
            else:
                logger.warning(f"No valid position for address {address_uuid}")
                return
        
        # Prepare data
        people = addr.get('people', [])
        carrier_summary = addr.get('carrier_summary', {})
        show_marker = addr.get('show_marker', False)
        status = addr.get('status', 'done')
        
        # Upsert using raw SQL for idempotency
        with connection.cursor() as cursor:
            cursor.execute("""
                INSERT INTO talkmore_enriched_address_result 
                (job_id, address_uuid, geom, address_text, municipality_code, postcode, 
                 people, carrier_summary, show_marker, status, created_at, updated_at)
                VALUES (%s, %s, ST_GeomFromText(%s, 4326), %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
                ON CONFLICT (job_id, address_uuid) 
                DO UPDATE SET 
                    people = EXCLUDED.people,
                    carrier_summary = EXCLUDED.carrier_summary,
                    show_marker = EXCLUDED.show_marker,
                    status = EXCLUDED.status,
                    updated_at = NOW()
            """, [
                str(job.id),
                str(address_uuid),
                geom.wkt,  # Use WKT for PostGIS
                addr.get('full_address', ''),
                addr.get('municipality_code') or None,
                addr.get('postcode') or None,
                json.dumps(people),
                json.dumps(carrier_summary),
                show_marker,
                status
            ])
