"""
Worker C: Data247 Carrier Lookup
Fetches carrier information for phone numbers with dual caching.
"""
import json
import logging
import uuid
from collections import Counter
from django.core.management.base import BaseCommand
from talkmore_enrichment.services.redis_streams import (
    STREAM_ADDR_ENRICH_1881,
    STREAM_FINAL_WRITE,
    GROUP_DATA247,
    read_from_stream,
    acknowledge_message,
    move_to_deadletter,
    create_consumer_group,
    get_delivery_count,
    should_move_to_deadletter
)
from talkmore_enrichment.services.data247_client import (
    get_carriers_batch,
    Data247Error
)
from talkmore_enrichment.carrier_rules import address_show_marker_from_carrier_summary

logger = logging.getLogger(__name__)

MAX_RETRIES = 5


class Command(BaseCommand):
    help = 'Worker C: Fetch carrier information from Data247'

    def add_arguments(self, parser):
        parser.add_argument(
            '--consumer-name',
            type=str,
            default=f'worker_c_{uuid.uuid4().hex[:8]}',
            help='Consumer name for Redis Streams (default: auto-generated)'
        )
        parser.add_argument(
            '--concurrency',
            type=int,
            default=20,
            help='Maximum concurrent API requests (default: 20)'
        )

    def handle(self, *args, **options):
        consumer_name = options['consumer_name']
        concurrency = options['concurrency']
        self.stdout.write(f'Starting Worker C (consumer: {consumer_name}, concurrency: {concurrency})')
        
        # Ensure consumer group exists
        try:
            create_consumer_group(STREAM_ADDR_ENRICH_1881, GROUP_DATA247)
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'Error creating consumer group: {e}'))
        
        while True:
            try:
                # Read messages from stream
                messages = read_from_stream(
                    STREAM_ADDR_ENRICH_1881,
                    GROUP_DATA247,
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
                        'has_enriched_addresses': 'enriched_addresses' in fields if fields else False
                    })
                    
                    try:
                        self._process_batch(message_id, fields, consumer_name)
                        # Acknowledge message only after successful processing
                        acknowledge_message(STREAM_ADDR_ENRICH_1881, GROUP_DATA247, message_id)
                        self.stdout.write(self.style.SUCCESS(f'✅ Processed batch {fields.get("batch_number")}'))
                    except Exception as e:
                        logger.error(f"Error processing batch {fields.get('batch_number')}: {e}", exc_info=True)
                        # Handle retry logic with exponential backoff
                        delivery_count = get_delivery_count(STREAM_ADDR_ENRICH_1881, GROUP_DATA247, message_id)
                        
                        if should_move_to_deadletter(STREAM_ADDR_ENRICH_1881, GROUP_DATA247, message_id, MAX_RETRIES):
                            # Max retries reached - move to deadletter
                            try:
                                move_to_deadletter(
                                    STREAM_ADDR_ENRICH_1881,
                                    message_id,
                                    f"Max retries ({MAX_RETRIES}) exceeded: {str(e)}",
                                    original_fields=fields,
                                    worker_name=consumer_name,
                                    retry_count=delivery_count
                                )
                                acknowledge_message(STREAM_ADDR_ENRICH_1881, GROUP_DATA247, message_id)
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
                self.stdout.write(self.style.WARNING('\nShutting down Worker C...'))
                break
            except Exception as e:
                logger.error(f"Error in Worker C main loop: {e}", exc_info=True)
                self.stdout.write(self.style.ERROR(f'Error in main loop: {e}'))

    def _process_batch(self, message_id, fields, consumer_name):
        """Process a batch of enriched addresses or a single per-address message."""
        # Check if this is an initialization message (should be skipped)
        if fields.get('init') == 'true':
            logger.info(f"Skipping initialization message {message_id}")
            return  # Skip init messages
        
        job_id = fields.get('job_id')
        batch_number = fields.get('batch_number')
        is_per_address = fields.get('is_per_address') == 'true'
        
        # Handle per-address messages (real-time streaming)
        if is_per_address:
            enriched_address_json = fields.get('enriched_address')
            if not job_id or not enriched_address_json:
                raise ValueError("Missing job_id or enriched_address in per-address message")
            
            try:
                enriched_addr = json.loads(enriched_address_json)
            except json.JSONDecodeError as e:
                raise ValueError(f"Invalid JSON in enriched_address field: {e}")
            
            # Process single address immediately
            self._process_single_address(job_id, batch_number, enriched_addr, consumer_name)
            return
        
        # Handle batch messages (legacy/backward compatibility)
        enriched_addresses_json = fields.get('enriched_addresses')
        if not job_id or not enriched_addresses_json:
            raise ValueError("Missing job_id or enriched_addresses in message")
        
        # Parse enriched addresses
        try:
            enriched_addresses = json.loads(enriched_addresses_json)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in enriched_addresses field: {e}")
        
        # Collect all phone numbers for batch lookup (with deduplication)
        all_phones = []
        seen_phones = set()  # Deduplication: track phones we've already added
        phone_to_address_map = {}  # Map phone to list of (address_idx, people_idx)
        
        for addr_idx, addr in enumerate(enriched_addresses):
            people = addr.get('people', [])
            for people_idx, person in enumerate(people):
                phone_e164 = person.get('phone_e164')
                if phone_e164 and phone_e164 not in seen_phones:  # Only add if not seen
                    seen_phones.add(phone_e164)  # Mark as seen
                    all_phones.append(phone_e164)
                    if phone_e164 not in phone_to_address_map:
                        phone_to_address_map[phone_e164] = []
                    phone_to_address_map[phone_e164].append((addr_idx, people_idx))
        
        # Batch lookup carriers
        carriers_dict = {}
        if all_phones:
            try:
                carriers_dict = get_carriers_batch(all_phones)
            except Data247Error as e:
                logger.error(f"Data247 batch lookup error: {e}")
                # Continue with empty carriers_dict - will mark as Unknown
        
        # Attach carriers to people and aggregate
        final_addresses = []
        
        for addr in enriched_addresses:
            people = addr.get('people', [])
            carrier_counts = Counter()
            
            # Attach carriers to people
            for person in people:
                phone_e164 = person.get('phone_e164')
                if phone_e164:
                    carrier = carriers_dict.get(phone_e164) or 'Unknown'
                    person['carrier'] = carrier
                    carrier_counts[carrier] += 1
                else:
                    person['carrier'] = None
            
            # Create carrier_summary
            carrier_summary = dict(carrier_counts)
            
            # Mark only if EVERY carrier is allowed (Telenor, Talkmore, Unifon, Phonero).
            show_marker = address_show_marker_from_carrier_summary(carrier_summary)
            
            final_addresses.append({
                'address_uuid': addr.get('address_uuid'),
                'full_address': addr.get('full_address'),
                'postcode': addr.get('postcode'),
                'municipality_code': addr.get('municipality_code'),
                'lon': addr.get('lon'),
                'lat': addr.get('lat'),
                'position_wkt': addr.get('position_wkt'),
                'people': people,  # Now includes carrier field
                'carrier_summary': carrier_summary,
                'show_marker': show_marker,
                'status': addr.get('status', 'done')
            })
        
        # Emit final batch to writer stream
        from talkmore_enrichment.services.redis_streams import get_redis_client
        client = get_redis_client()
        final_message = {
            'job_id': str(job_id),
            'batch_number': str(batch_number),
            'final_addresses': json.dumps(final_addresses),
            'total_addresses': fields.get('total_addresses', str(len(final_addresses)))
        }
        client.xadd(STREAM_FINAL_WRITE, final_message)
        
        # Log summary
        show_marker_count = sum(1 for a in final_addresses if a['show_marker'])
        self.stdout.write(
            f'Processed batch {batch_number}: {len(final_addresses)} addresses, '
            f'{show_marker_count} with markers'
        )
    
    def _process_single_address(self, job_id, batch_number, enriched_addr, consumer_name):
        """Process a single enriched address for real-time streaming."""
        address_uuid = enriched_addr.get('address_uuid')
        
        # Collect phone numbers from this address
        all_phones = []
        phone_to_person_map = {}  # Map phone to person index
        
        people = enriched_addr.get('people', [])
        for people_idx, person in enumerate(people):
            phone_e164 = person.get('phone_e164')
            if phone_e164:
                all_phones.append(phone_e164)
                if phone_e164 not in phone_to_person_map:
                    phone_to_person_map[phone_e164] = []
                phone_to_person_map[phone_e164].append(people_idx)
        
        # Batch lookup carriers (even for single address, may have multiple phones)
        carriers_dict = {}
        if all_phones:
            try:
                carriers_dict = get_carriers_batch(all_phones)
            except Data247Error as e:
                logger.error(f"Data247 batch lookup error for address {address_uuid}: {e}")
                # Continue with empty carriers_dict - will mark as Unknown
        
        # Attach carriers to people
        from collections import Counter
        carrier_counts = Counter()
        
        for person in people:
            phone_e164 = person.get('phone_e164')
            if phone_e164:
                carrier = carriers_dict.get(phone_e164) or 'Unknown'
                person['carrier'] = carrier
                carrier_counts[carrier] += 1
            else:
                person['carrier'] = None
        
        # Create carrier_summary
        carrier_summary = dict(carrier_counts)
        
        show_marker = address_show_marker_from_carrier_summary(carrier_summary)
        
        final_addr = {
            'address_uuid': address_uuid,
            'full_address': enriched_addr.get('full_address'),
            'postcode': enriched_addr.get('postcode'),
            'municipality_code': enriched_addr.get('municipality_code'),
            'lon': enriched_addr.get('lon'),
            'lat': enriched_addr.get('lat'),
            'position_wkt': enriched_addr.get('position_wkt'),
            'people': people,  # Now includes carrier field
            'carrier_summary': carrier_summary,
            'show_marker': show_marker,
            'status': enriched_addr.get('status', 'done')
        }
        
        # Emit single address immediately to writer stream (real-time)
        from talkmore_enrichment.services.redis_streams import get_redis_client
        client = get_redis_client()
        per_address_message = {
            'job_id': str(job_id),
            'batch_number': str(batch_number),
            'final_address': json.dumps(final_addr),  # Single address
            'is_per_address': 'true'  # Flag to indicate per-address message
        }
        client.xadd(STREAM_FINAL_WRITE, per_address_message)
        
        logger.debug(f"Processed address {address_uuid}: {len(people)} people, show_marker={show_marker}")
