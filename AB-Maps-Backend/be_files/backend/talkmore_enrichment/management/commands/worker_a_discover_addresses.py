"""
Worker A: Address Discovery
Discovers addresses within polygon using PostGIS ST_Intersects.
"""
import json
import logging
import uuid
from django.core.management.base import BaseCommand
from django.db import connection
from django.utils import timezone
from talkmore_enrichment.models import EnrichmentJob
from talkmore_enrichment.services.redis_streams import (
    STREAM_JOB_INGEST,
    STREAM_ADDR_DISCOVERY,
    GROUP_DISCOVER,
    read_from_stream,
    acknowledge_message,
    move_to_deadletter,
    create_consumer_group,
    get_delivery_count,
    should_move_to_deadletter
)

logger = logging.getLogger(__name__)

BATCH_SIZE = 15  # Addresses per batch (reduced for better real-time updates)
MAX_RETRIES = 5


class Command(BaseCommand):
    help = 'Worker A: Discover addresses from official table using PostGIS ST_Intersects'

    def add_arguments(self, parser):
        parser.add_argument(
            '--consumer-name',
            type=str,
            default=f'worker_a_{uuid.uuid4().hex[:8]}',
            help='Consumer name for Redis Streams (default: auto-generated)'
        )

    def handle(self, *args, **options):
        consumer_name = options['consumer_name']
        self.stdout.write(f'Starting Worker A (consumer: {consumer_name})')
        
        # Ensure consumer group exists
        try:
            create_consumer_group(STREAM_JOB_INGEST, GROUP_DISCOVER)
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'Error creating consumer group: {e}'))
        
        while True:
            try:
                # Read messages from stream
                messages = read_from_stream(
                    STREAM_JOB_INGEST,
                    GROUP_DISCOVER,
                    consumer_name,
                    count=1,
                    block=5000  # Block for 5 seconds
                )
                
                if not messages:
                    continue
                
                for message_id, fields in messages:
                    # Log using Django logger instead of debug file
                    logger.debug(f'Processing message {message_id} from stream', extra={
                        'message_id': message_id,
                        'fields_keys': list(fields.keys()) if fields else [],
                        'has_job_id': 'job_id' in fields if fields else False
                    })
                    
                    try:
                        self._process_job(message_id, fields, consumer_name)
                        # Acknowledge message only after successful processing
                        acknowledge_message(STREAM_JOB_INGEST, GROUP_DISCOVER, message_id)
                        self.stdout.write(self.style.SUCCESS(f'✅ Processed job {fields.get("job_id")}'))
                    except Exception as e:
                        logger.error(f"Error processing job {fields.get('job_id')}: {e}", exc_info=True)
                        # Handle retry logic with exponential backoff
                        delivery_count = get_delivery_count(STREAM_JOB_INGEST, GROUP_DISCOVER, message_id)
                        
                        if should_move_to_deadletter(STREAM_JOB_INGEST, GROUP_DISCOVER, message_id, MAX_RETRIES):
                            # Max retries reached - move to deadletter
                            try:
                                move_to_deadletter(
                                    STREAM_JOB_INGEST,
                                    message_id,
                                    f"Max retries ({MAX_RETRIES}) exceeded: {str(e)}",
                                    original_fields=fields,
                                    worker_name=consumer_name,
                                    retry_count=delivery_count
                                )
                                # Acknowledge to remove from pending
                                acknowledge_message(STREAM_JOB_INGEST, GROUP_DISCOVER, message_id)
                                self.stdout.write(
                                    self.style.ERROR(
                                        f'❌ Moved job {fields.get("job_id")} to deadletter after {delivery_count} retries'
                                    )
                                )
                            except Exception as dl_error:
                                logger.error(f"Error moving to deadletter: {dl_error}", exc_info=True)
                        else:
                            # Retry with exponential backoff (don't acknowledge - message stays pending)
                            backoff_seconds = 2 ** (delivery_count - 1) if delivery_count > 0 else 1  # 1s, 2s, 4s, 8s, 16s
                            logger.warning(
                                f"Retrying job {fields.get('job_id')} in {backoff_seconds}s "
                                f"(delivery_count: {delivery_count}/{MAX_RETRIES})"
                            )
                            import time
                            time.sleep(backoff_seconds)
                            self.stdout.write(
                                self.style.WARNING(
                                    f'⚠️ Retrying job {fields.get("job_id")} (delivery_count: {delivery_count}/{MAX_RETRIES})'
                                )
                            )
                        
            except KeyboardInterrupt:
                self.stdout.write(self.style.WARNING('\nShutting down Worker A...'))
                break
            except Exception as e:
                logger.error(f"Error in Worker A main loop: {e}", exc_info=True)
                self.stdout.write(self.style.ERROR(f'Error in main loop: {e}'))

    def _process_job(self, message_id, fields, consumer_name):
        """Process a single job."""
        logger.debug(f'Entering _process_job for message {message_id}', extra={
            'message_id': message_id,
            'job_id': fields.get('job_id') if fields else None
        })
        
        job_id = fields.get('job_id')
        if not job_id:
            logger.debug(f'Missing job_id in message {message_id}, checking if init message', extra={
                'message_id': message_id,
                'is_init_message': fields.get('init') == 'true' if fields else False
            })
            
            # Check if this is an initialization message (should be skipped)
            if fields.get('init') == 'true':
                logger.info(f"Skipping initialization message {message_id}")
                return  # Skip init messages
            
            raise ValueError("Missing job_id in message")
        
        try:
            # Use select_related to optimize ForeignKey lookups
            job = EnrichmentJob.objects.select_related('area', 'campaign').get(id=job_id)
        except EnrichmentJob.DoesNotExist:
            raise ValueError(f"EnrichmentJob {job_id} not found")
        
        # Update status to discovering
        job.status = 'discovering'
        job.started_at = timezone.now()
        job.save(update_fields=['status', 'started_at'])  # Only update changed fields
        
        # Get polygon from Area (already loaded via select_related)
        area = job.area
        if not area.polygon_geometry:
            raise ValueError(f"Area {area.id} has no polygon_geometry")
        
        # Convert polygon to WKT for SQL query
        polygon_wkt = area.polygon_geometry.wkt
        
        # Count addresses first
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT COUNT(*) 
                FROM public.local_apartments 
                WHERE ST_Intersects(position, ST_GeomFromText(%s, 4326))
            """, [polygon_wkt])
            count = cursor.fetchone()[0]
        
        self.stdout.write(f'Found {count} addresses in polygon for job {job_id}')
        
        # If zero addresses, mark job as done
        if count == 0:
            job.expected_count = 0
            job.done_count = 0
            job.status = 'done'
            job.finished_at = timezone.now()
            job.save()
            self.stdout.write(f'Job {job_id} completed (no addresses found)')
            return
        
        # Update expected_count
        job.expected_count = count
        job.status = 'enriching_1881'  # Next stage
        job.save()
        
        # Query addresses in batches
        offset = 0
        batch_number = 0
        
        while offset < count:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT 
                        COALESCE(unit_uuid, address_uuid) AS unique_id,
                        full_address,
                        postcode,
                        post_area,
                        municipality_code,
                        ST_X(position) AS lon,
                        ST_Y(position) AS lat,
                        ST_AsText(position) AS position_wkt
                    FROM public.local_apartments
                    WHERE ST_Intersects(position, ST_GeomFromText(%s, 4326))
                    ORDER BY COALESCE(unit_uuid, address_uuid)
                    LIMIT %s OFFSET %s
                """, [polygon_wkt, BATCH_SIZE, offset])
                
                rows = cursor.fetchall()
                if not rows:
                    break
                
                # Prepare batch data
                batch_addresses = []
                for row in rows:
                    batch_addresses.append({
                        'address_uuid': str(row[0]),  # This is now unit_uuid or address_uuid (unique per apartment)
                        'full_address': row[1] or '',
                        'postcode': row[2] or '',
                        'post_area': row[3] or '',
                        'municipality_code': row[4] or '',
                        'lon': float(row[5]),
                        'lat': float(row[6]),
                        'position_wkt': row[7]
                    })
                
                # Emit batch to addr_discovery stream
                from talkmore_enrichment.services.redis_streams import get_redis_client
                client = get_redis_client()
                batch_message = {
                    'job_id': str(job_id),
                    'batch_number': str(batch_number),
                    'addresses': json.dumps(batch_addresses),
                    'total_addresses': str(count),
                    'batch_size': str(len(batch_addresses))
                }
                client.xadd(STREAM_ADDR_DISCOVERY, batch_message)
                
                self.stdout.write(
                    f'Emitted batch {batch_number} with {len(batch_addresses)} addresses '
                    f'({offset + len(batch_addresses)}/{count})'
                )
                
                offset += len(batch_addresses)
                batch_number += 1
        
        self.stdout.write(f'✅ Completed discovery for job {job_id}: {count} addresses in {batch_number} batches')
