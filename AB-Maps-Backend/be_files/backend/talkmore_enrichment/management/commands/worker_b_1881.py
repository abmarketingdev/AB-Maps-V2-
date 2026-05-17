"""
Worker B: 1881 Enrichment
Enriches addresses with 1881 API data using fallback strategy.
"""
import json
import logging
import uuid
from django.core.management.base import BaseCommand
from talkmore_enrichment.services.redis_streams import (
    STREAM_ADDR_DISCOVERY,
    STREAM_ADDR_ENRICH_1881,
    GROUP_ENRICH_1881,
    read_from_stream,
    acknowledge_message,
    move_to_deadletter,
    create_consumer_group,
    get_delivery_count,
    should_move_to_deadletter
)
from talkmore_enrichment.services.api1881_client import (
    enrich_address_with_1881,
    API1881Error,
    API1881RateLimitError,
    API1881NotFoundError
)

logger = logging.getLogger(__name__)

MAX_RETRIES = 5


class Command(BaseCommand):
    help = 'Worker B: Enrich addresses with 1881 API'

    def add_arguments(self, parser):
        parser.add_argument(
            '--consumer-name',
            type=str,
            default=f'worker_b_{uuid.uuid4().hex[:8]}',
            help='Consumer name for Redis Streams (default: auto-generated)'
        )
        parser.add_argument(
            '--concurrency',
            type=int,
            default=10,
            help='Maximum concurrent API requests (default: 10)'
        )

    def handle(self, *args, **options):
        consumer_name = options['consumer_name']
        concurrency = options['concurrency']
        self.stdout.write(f'Starting Worker B (consumer: {consumer_name}, concurrency: {concurrency})')
        
        # Ensure consumer group exists
        try:
            create_consumer_group(STREAM_ADDR_DISCOVERY, GROUP_ENRICH_1881)
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'Error creating consumer group: {e}'))
        
        while True:
            try:
                # Read messages from stream
                messages = read_from_stream(
                    STREAM_ADDR_DISCOVERY,
                    GROUP_ENRICH_1881,
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
                        'has_addresses': 'addresses' in fields if fields else False
                    })
                    
                    try:
                        self._process_batch(message_id, fields, consumer_name)
                        # Acknowledge message only after successful processing
                        acknowledge_message(STREAM_ADDR_DISCOVERY, GROUP_ENRICH_1881, message_id)
                        self.stdout.write(self.style.SUCCESS(f'✅ Processed batch {fields.get("batch_number")}'))
                    except Exception as e:
                        logger.error(f"Error processing batch {fields.get('batch_number')}: {e}", exc_info=True)
                        # Handle retry logic with exponential backoff
                        delivery_count = get_delivery_count(STREAM_ADDR_DISCOVERY, GROUP_ENRICH_1881, message_id)
                        
                        if should_move_to_deadletter(STREAM_ADDR_DISCOVERY, GROUP_ENRICH_1881, message_id, MAX_RETRIES):
                            # Max retries reached - move to deadletter
                            try:
                                move_to_deadletter(
                                    STREAM_ADDR_DISCOVERY,
                                    message_id,
                                    f"Max retries ({MAX_RETRIES}) exceeded: {str(e)}",
                                    original_fields=fields,
                                    worker_name=consumer_name,
                                    retry_count=delivery_count
                                )
                                acknowledge_message(STREAM_ADDR_DISCOVERY, GROUP_ENRICH_1881, message_id)
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
                self.stdout.write(self.style.WARNING('\nShutting down Worker B...'))
                break
            except Exception as e:
                logger.error(f"Error in Worker B main loop: {e}", exc_info=True)
                self.stdout.write(self.style.ERROR(f'Error in main loop: {e}'))

    def _process_batch(self, message_id, fields, consumer_name):
        """Process a batch of addresses."""
        logger.debug(f'Entering _process_batch for message {message_id}', extra={
            'message_id': message_id,
            'job_id': fields.get('job_id') if fields else None,
            'is_init_message': fields.get('init') == 'true' if fields else False
        })
        
        job_id = fields.get('job_id')
        batch_number = fields.get('batch_number')
        addresses_json = fields.get('addresses')
        
        # Check if this is an initialization message (should be skipped)
        if fields.get('init') == 'true':
            logger.info(f"Skipping initialization message {message_id}")
            return  # Skip init messages
        
        if not job_id or not addresses_json:
            logger.debug(f'Missing job_id or addresses in message {message_id}', extra={
                'message_id': message_id,
                'has_job_id': bool(job_id),
                'has_addresses': bool(addresses_json)
            })
            
            raise ValueError("Missing job_id or addresses in message")
        
        # Parse addresses
        try:
            addresses = json.loads(addresses_json)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in addresses field: {e}")
        
        enriched_addresses = []
        
        # Process each address
        for addr in addresses:
            address_uuid = addr.get('address_uuid')
            full_address = addr.get('full_address', '')
            postcode = addr.get('postcode', '')
            municipality_code = addr.get('municipality_code', '')
            
            try:
                # Enrich with 1881 (includes fallback strategy)
                people = enrich_address_with_1881(
                    address_text=full_address,
                    postcode=postcode,
                    municipality_code=municipality_code
                )
                
                # Determine status
                if people:
                    status = 'done'
                else:
                    status = 'no_data'
                
                enriched_addr = {
                    'address_uuid': address_uuid,
                    'full_address': full_address,
                    'postcode': postcode,
                    'municipality_code': municipality_code,
                    'lon': addr.get('lon'),
                    'lat': addr.get('lat'),
                    'position_wkt': addr.get('position_wkt'),
                    'people': people,  # List of {name, phone_e164, carrier}
                    'status': status
                }
                
                enriched_addresses.append(enriched_addr)
                
                # Emit per-address message for real-time streaming (Option A)
                from talkmore_enrichment.services.redis_streams import get_redis_client
                client = get_redis_client()
                per_address_message = {
                    'job_id': str(job_id),
                    'batch_number': str(batch_number),
                    'address_index': str(len(enriched_addresses) - 1),  # Index in batch
                    'enriched_address': json.dumps(enriched_addr),  # Single address
                    'is_per_address': 'true'  # Flag to indicate per-address message
                }
                client.xadd(STREAM_ADDR_ENRICH_1881, per_address_message)
                
            except API1881RateLimitError:
                # Rate limited (429) - mark as failed but continue (will be retried at batch level)
                logger.warning(f"Rate limited for address {address_uuid}")
                enriched_addresses.append({
                    'address_uuid': address_uuid,
                    'full_address': full_address,
                    'postcode': postcode,
                    'municipality_code': municipality_code,
                    'lon': addr.get('lon'),
                    'lat': addr.get('lat'),
                    'position_wkt': addr.get('position_wkt'),
                    'people': [],
                    'status': 'failed'
                })
            except API1881NotFoundError:
                # 404 (not found) - treat as no_data, continue processing
                logger.debug(f"No 1881 data found for address {address_uuid}")
                enriched_addresses.append({
                    'address_uuid': address_uuid,
                    'full_address': full_address,
                    'postcode': postcode,
                    'municipality_code': municipality_code,
                    'lon': addr.get('lon'),
                    'lat': addr.get('lat'),
                    'position_wkt': addr.get('position_wkt'),
                    'people': [],
                    'status': 'no_data'
                })
            except API1881Error as e:
                # Other API errors (400, 5xx, timeouts) - mark as failed but continue
                # These will be retried at batch level with exponential backoff
                logger.error(f"1881 API error for address {address_uuid}: {e}")
                enriched_addresses.append({
                    'address_uuid': address_uuid,
                    'full_address': full_address,
                    'postcode': postcode,
                    'municipality_code': municipality_code,
                    'lon': addr.get('lon'),
                    'lat': addr.get('lat'),
                    'position_wkt': addr.get('position_wkt'),
                    'people': [],
                    'status': 'failed'
                })
            except Exception as e:
                # Unexpected error - mark as failed but continue (don't block pipeline)
                logger.error(f"Unexpected error enriching address {address_uuid}: {e}", exc_info=True)
                enriched_addresses.append({
                    'address_uuid': address_uuid,
                    'full_address': full_address,
                    'postcode': postcode,
                    'municipality_code': municipality_code,
                    'lon': addr.get('lon'),
                    'lat': addr.get('lat'),
                    'position_wkt': addr.get('position_wkt'),
                    'people': [],
                    'status': 'failed'
                })
        
        # Emit enriched batch to next stream
        from talkmore_enrichment.services.redis_streams import get_redis_client
        client = get_redis_client()
        enriched_message = {
            'job_id': str(job_id),
            'batch_number': str(batch_number),
            'enriched_addresses': json.dumps(enriched_addresses),
            'total_addresses': fields.get('total_addresses', str(len(enriched_addresses)))
        }
        client.xadd(STREAM_ADDR_ENRICH_1881, enriched_message)
        
        # Log summary
        success_count = sum(1 for a in enriched_addresses if a['status'] == 'done')
        no_data_count = sum(1 for a in enriched_addresses if a['status'] == 'no_data')
        failed_count = sum(1 for a in enriched_addresses if a['status'] == 'failed')
        
        self.stdout.write(
            f'Enriched batch {batch_number}: {success_count} success, '
            f'{no_data_count} no_data, {failed_count} failed'
        )
