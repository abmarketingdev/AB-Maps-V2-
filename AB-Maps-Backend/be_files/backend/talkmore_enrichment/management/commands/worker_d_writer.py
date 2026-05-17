"""
Worker D: Database Writer & WebSocket
Writes results to database and broadcasts WebSocket events.
"""
import json
import logging
import uuid
from django.core.management.base import BaseCommand
from django.db import connection
from django.contrib.gis.geos import Point
from django.utils import timezone
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from talkmore_enrichment.models import EnrichmentJob, EnrichedAddressResult
from talkmore_enrichment.services.redis_streams import (
    STREAM_FINAL_WRITE,
    GROUP_WRITER,
    read_from_stream,
    acknowledge_message,
    move_to_deadletter,
    create_consumer_group,
    get_delivery_count,
    should_move_to_deadletter
)

logger = logging.getLogger(__name__)

MAX_RETRIES = 5


class Command(BaseCommand):
    help = 'Worker D: Write results to database and broadcast WebSocket events'

    def add_arguments(self, parser):
        parser.add_argument(
            '--consumer-name',
            type=str,
            default=f'worker_d_{uuid.uuid4().hex[:8]}',
            help='Consumer name for Redis Streams (default: auto-generated)'
        )

    def handle(self, *args, **options):
        consumer_name = options['consumer_name']
        self.stdout.write(f'Starting Worker D (consumer: {consumer_name})')
        
        # Ensure consumer group exists
        try:
            create_consumer_group(STREAM_FINAL_WRITE, GROUP_WRITER)
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'Error creating consumer group: {e}'))
        
        # Get channel layer for WebSocket
        try:
            channel_layer = get_channel_layer()
        except Exception as e:
            logger.warning(f"Could not get channel layer: {e}. WebSocket broadcasting disabled.")
            channel_layer = None
        
        while True:
            try:
                # Read messages from stream
                messages = read_from_stream(
                    STREAM_FINAL_WRITE,
                    GROUP_WRITER,
                    consumer_name,
                    count=1,
                    block=5000  # Block for 5 seconds
                )
                
                if not messages:
                    continue
                
                for message_id, fields in messages:
                    logger.debug(f'Processing message {message_id} from stream', extra={
                        'message_id': message_id,
                        'has_job_id': 'job_id' in fields if fields else False,
                        'has_final_addresses': 'final_addresses' in fields if fields else False
                    })
                    
                    try:
                        self._process_batch(message_id, fields, consumer_name, channel_layer)
                        # Acknowledge message only after successful processing
                        acknowledge_message(STREAM_FINAL_WRITE, GROUP_WRITER, message_id)
                        self.stdout.write(self.style.SUCCESS(f'✅ Processed batch {fields.get("batch_number")}'))
                    except Exception as e:
                        logger.error(f"Error processing batch {fields.get('batch_number')}: {e}", exc_info=True)
                        # Handle retry logic with exponential backoff
                        delivery_count = get_delivery_count(STREAM_FINAL_WRITE, GROUP_WRITER, message_id)
                        
                        if should_move_to_deadletter(STREAM_FINAL_WRITE, GROUP_WRITER, message_id, MAX_RETRIES):
                            # Max retries reached - move to deadletter
                            try:
                                move_to_deadletter(
                                    STREAM_FINAL_WRITE,
                                    message_id,
                                    f"Max retries ({MAX_RETRIES}) exceeded: {str(e)}",
                                    original_fields=fields,
                                    worker_name=consumer_name,
                                    retry_count=delivery_count
                                )
                                acknowledge_message(STREAM_FINAL_WRITE, GROUP_WRITER, message_id)
                                self.stdout.write(
                                    self.style.ERROR(
                                        f'❌ Moved batch {fields.get("batch_number")} to deadletter after {delivery_count} retries'
                                    )
                                )
                            except Exception as dl_error:
                                logger.error(f"Error moving to deadletter: {dl_error}", exc_info=True)
                        else:
                            # Retry with exponential backoff (don't acknowledge - message stays pending)
                            backoff_seconds = 2 ** (delivery_count - 1) if delivery_count > 0 else 1
                            logger.warning(
                                f"Retrying batch {fields.get('batch_number')} in {backoff_seconds}s "
                                f"(delivery_count: {delivery_count}/{MAX_RETRIES})"
                            )
                            import time
                            time.sleep(backoff_seconds)
                            self.stdout.write(
                                self.style.WARNING(
                                    f'⚠️ Retrying batch {fields.get("batch_number")} (delivery_count: {delivery_count}/{MAX_RETRIES})'
                                )
                            )
                        
            except KeyboardInterrupt:
                self.stdout.write(self.style.WARNING('\nShutting down Worker D...'))
                break
            except Exception as e:
                logger.error(f"Error in Worker D main loop: {e}", exc_info=True)
                self.stdout.write(self.style.ERROR(f'Error in main loop: {e}'))

    def _process_batch(self, message_id, fields, consumer_name, channel_layer):
        """Process a batch of final addresses or a single per-address message."""
        # Check if this is an initialization message (should be skipped)
        if fields.get('init') == 'true':
            logger.info(f"Skipping initialization message {message_id}")
            return  # Skip init messages
        
        job_id = fields.get('job_id')
        batch_number = fields.get('batch_number')
        is_per_address = fields.get('is_per_address') == 'true'
        
        logger.info(f"🔵 Worker D: Received message - job_id={job_id}, batch={batch_number}, is_per_address={is_per_address}")
        
        try:
            job = EnrichmentJob.objects.get(id=job_id)
        except EnrichmentJob.DoesNotExist:
            raise ValueError(f"EnrichmentJob {job_id} not found")
        
        # Handle per-address messages (real-time streaming)
        if is_per_address:
            final_address_json = fields.get('final_address')
            if not job_id or not final_address_json:
                raise ValueError("Missing job_id or final_address in per-address message")
            
            try:
                final_addr = json.loads(final_address_json)
            except json.JSONDecodeError as e:
                raise ValueError(f"Invalid JSON in final_address field: {e}")
            
            address_uuid = final_addr.get('address_uuid')
            show_marker = final_addr.get('show_marker', False)
            logger.info(f"🟢 Worker D: Processing PER-ADDRESS message - address_uuid={address_uuid}, show_marker={show_marker}")
            
            # Process single address immediately
            try:
                self._upsert_address_result(job, final_addr, channel_layer)
            except Exception as e:
                logger.error(f"Error upserting address {address_uuid}: {e}", exc_info=True)
            
            # Update job counters and check completion (after each address for real-time updates)
            self._update_job_counters(job, channel_layer)
            return
        
        # Handle batch messages (legacy/backward compatibility)
        final_addresses_json = fields.get('final_addresses')
        if not job_id or not final_addresses_json:
            raise ValueError("Missing job_id or final_addresses in message")
        
        # Parse final addresses
        try:
            final_addresses = json.loads(final_addresses_json)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in final_addresses field: {e}")
        
        # Log batch processing start
        logger.info(f"🟡 Worker D: Processing BATCH {batch_number} with {len(final_addresses)} addresses for job {job_id}")
        
        # Process each address
        for idx, addr in enumerate(final_addresses):
            address_uuid = addr.get('address_uuid')
            show_marker = addr.get('show_marker', False)
            logger.info(f"🟢 Worker D: Processing address {idx+1}/{len(final_addresses)} - address_uuid={address_uuid}, show_marker={show_marker}")
            try:
                self._upsert_address_result(job, addr, channel_layer)
            except Exception as e:
                logger.error(f"Error upserting address {address_uuid}: {e}", exc_info=True)
                # Continue processing other addresses
        
        # Log batch completion
        logger.info(f"✅ Processed batch {batch_number}: {len(final_addresses)} addresses written for job {job_id}")
        
        # Update job counters and check completion
        self._update_job_counters(job, channel_layer)

    def _upsert_address_result(self, job, addr, channel_layer):
        """Upsert address result using idempotent SQL."""
        address_uuid = addr.get('address_uuid')
        if not address_uuid:
            return
        
        show_marker = addr.get('show_marker', False)
        carrier_summary = addr.get('carrier_summary', {})
        
        logger.info(f"📝 Worker D: Upserting address {address_uuid} for job {job.id} - show_marker={show_marker}, carrier_summary={carrier_summary}")
        
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
        
        logger.info(f"✅ Worker D: Upserted address {address_uuid} to database for job {job.id}")
        
        # Get current done_count from database (after upsert)
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT COUNT(*) 
                FROM talkmore_enriched_address_result
                WHERE job_id = %s
            """, [str(job.id)])
            done_count = cursor.fetchone()[0] or 0
        
        # Broadcast WebSocket event if show_marker is True
        logger.info(f"🔍 Worker D: Checking if should broadcast - show_marker={show_marker}, channel_layer={'exists' if channel_layer else 'None'}")
        
        if show_marker and channel_layer:
            logger.info(f"📡 Worker D: BROADCASTING feature.done for address {address_uuid} (show_marker=True, job_id={job.id}, done_count={done_count})")
            try:
                self._broadcast_feature_done(job.id, job.expected_count, done_count, addr, channel_layer)
                logger.info(f"✅ Worker D: Successfully broadcasted feature.done for address {address_uuid}")
            except Exception as e:
                logger.error(f"❌ Worker D: Error broadcasting WebSocket event for {address_uuid}: {e}", exc_info=True)
        elif not show_marker:
            logger.info(f"⏭️ Worker D: Skipping broadcast for address {address_uuid} (show_marker=False)")
        elif not channel_layer:
            logger.warning(f"⚠️ Worker D: Cannot broadcast - channel_layer is None for address {address_uuid}")

    def _broadcast_feature_done(self, job_id, expected_count, done_count, addr, channel_layer):
        """Broadcast feature.done WebSocket event."""
        group_name = f'talkmore_job_{job_id}'
        address_uuid = str(addr.get('address_uuid'))
        
        # Calculate progress percentage
        progress_percentage = 0.0
        if expected_count > 0:
            progress_percentage = round((done_count / expected_count) * 100, 2)
        
        event_data = {
            'type': 'feature.done',
            'address_uuid': address_uuid,
            'lat': float(addr.get('lat', 0)),
            'lon': float(addr.get('lon', 0)),
            'address_text': addr.get('full_address', ''),
            'carrier_summary': addr.get('carrier_summary', {}),
            'show_marker': addr.get('show_marker', False),
            'done_count': done_count,
            'expected_count': expected_count,
            'progress_percentage': progress_percentage
        }
        
        logger.info(f"📨 Worker D: Sending feature.done to channel group '{group_name}' for address {address_uuid} - done_count={done_count}/{expected_count} ({progress_percentage}%)")
        logger.debug(f"📨 Worker D: Event data: {event_data}")
        
        try:
            async_to_sync(channel_layer.group_send)(group_name, event_data)
            logger.info(f"✅ Worker D: Successfully sent feature.done to channel layer for address {address_uuid}, group={group_name}")
        except Exception as e:
            logger.error(f"❌ Worker D: Error sending feature.done to channel layer for address {address_uuid}: {e}", exc_info=True)

    def _update_job_counters(self, job, channel_layer):
        """Update job counters and check if job is complete."""
        # Count results by status using optimized query with index on job_id
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as success,
                    SUM(CASE WHEN status = 'no_data' THEN 1 ELSE 0 END) as no_data,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
                FROM talkmore_enriched_address_result
                WHERE job_id = %s
            """, [str(job.id)])
            
            row = cursor.fetchone()
            done_count = row[0] or 0
            success_count = row[1] or 0
            no_data_count = row[2] or 0
            failed_count = row[3] or 0
        
        # Update job
        job.done_count = done_count
        job.success_count = success_count
        job.no_data_count = no_data_count
        job.failed_count = failed_count
        
        # Check if job is complete
        if done_count >= job.expected_count and job.expected_count > 0:
            if job.status != 'done':
                job.status = 'done'
                job.finished_at = timezone.now()
                job.save()
                
                # Broadcast job.done event
                if channel_layer:
                    try:
                        self._broadcast_job_done(job, channel_layer)
                    except Exception as e:
                        logger.error(f"Error broadcasting job.done: {e}")
                
                self.stdout.write(
                    self.style.SUCCESS(
                        f'✅ Job {job.id} completed: {success_count} success, '
                        f'{no_data_count} no_data, {failed_count} failed'
                    )
                )
        else:
            job.status = 'writing'
            job.save()

    def _broadcast_job_done(self, job, channel_layer):
        """Broadcast job.done WebSocket event."""
        group_name = f'talkmore_job_{job.id}'
        event_data = {
            'type': 'job.done',
            'job_id': str(job.id),
            'total_addresses': job.expected_count,
            'success_count': job.success_count,
            'no_data_count': job.no_data_count,
            'failed_count': job.failed_count
        }
        
        logger.info(f"🏁 Worker D: Broadcasting job.done for job {job.id} - total={job.expected_count}, success={job.success_count}")
        
        try:
            async_to_sync(channel_layer.group_send)(group_name, event_data)
            logger.info(f"✅ Worker D: Successfully broadcasted job.done for job {job.id}")
        except Exception as e:
            logger.error(f"❌ Worker D: Error sending job.done WebSocket message for job {job.id}: {e}", exc_info=True)
