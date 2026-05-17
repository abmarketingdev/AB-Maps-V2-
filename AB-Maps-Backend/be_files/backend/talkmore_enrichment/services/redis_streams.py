"""
Redis Streams service for talkmore_enrichment app.
Handles Redis Streams operations for the enrichment pipeline.
"""
import json
import logging
import time
import redis
from django.conf import settings

# #region agent log
# Debug logging disabled in production - use Django logging instead
def _debug_log(location, message, data=None, hypothesis_id=None):
    # Disabled in production - use logger.debug() instead
    pass
# #endregion

logger = logging.getLogger(__name__)

# Stream names
STREAM_JOB_INGEST = 'stream:job_ingest'
STREAM_ADDR_DISCOVERY = 'stream:addr_discovery'
STREAM_ADDR_ENRICH_1881 = 'stream:addr_enrich_1881'
STREAM_FINAL_WRITE = 'stream:final_write'

# Deadletter stream names
STREAM_DEADLETTER_JOB_INGEST = 'stream:deadletter:job_ingest'
STREAM_DEADLETTER_ADDR_DISCOVERY = 'stream:deadletter:addr_discovery'
STREAM_DEADLETTER_ADDR_ENRICH_1881 = 'stream:deadletter:addr_enrich_1881'
STREAM_DEADLETTER_FINAL_WRITE = 'stream:deadletter:final_write'

# Consumer groups
GROUP_DISCOVER = 'group:discover'
GROUP_ENRICH_1881 = 'group:enrich_1881'
GROUP_DATA247 = 'group:data247'
GROUP_WRITER = 'group:writer'


def get_redis_client():
    """Get Redis client instance."""
    redis_url = getattr(settings, 'REDIS_URL', 'redis://localhost:6379')
    return redis.from_url(redis_url, decode_responses=True)


def enqueue_job(job_id):
    """
    Enqueue a job to the job_ingest stream.
    
    Args:
        job_id: UUID of the EnrichmentJob
    """
    try:
        client = get_redis_client()
        message = {
            'job_id': str(job_id),
            'timestamp': str(int(time.time()))  # Current Unix timestamp
        }
        message_id = client.xadd(STREAM_JOB_INGEST, message)
        logger.info(f"Enqueued job {job_id} to {STREAM_JOB_INGEST} with message ID {message_id}")
        return message_id
    except Exception as e:
        logger.error(f"Error enqueueing job {job_id}: {e}")
        raise


def create_consumer_group(stream_name, group_name, start_id='0'):
    """
    Create a consumer group for a stream.
    
    Args:
        stream_name: Name of the stream
        group_name: Name of the consumer group
        start_id: Starting message ID (default '0' for all messages)
    
    Returns:
        True if created, False if already exists
    """
    try:
        client = get_redis_client()
        # Check if stream exists, create if not
        if not client.exists(stream_name):
            # Create stream with initial message (this will be skipped by workers)
            init_msg_id = client.xadd(stream_name, {'init': 'true'})
            logger.debug(f"Created stream {stream_name} with init message {init_msg_id}")
        
        try:
            client.xgroup_create(stream_name, group_name, id=start_id, mkstream=True)
            logger.info(f"Created consumer group {group_name} for stream {stream_name}")
            return True
        except redis.exceptions.ResponseError as e:
            if 'BUSYGROUP' in str(e):
                # Group already exists
                logger.debug(f"Consumer group {group_name} already exists for stream {stream_name}")
                return False
            raise
    except Exception as e:
        logger.error(f"Error creating consumer group {group_name} for stream {stream_name}: {e}")
        raise


def read_from_stream(stream_name, group_name, consumer_name, count=1, block=1000, include_pending=True):
    """
    Read messages from a stream using consumer group.
    Also attempts to claim pending messages that are idle.
    
    Args:
        stream_name: Name of the stream
        group_name: Name of the consumer group
        consumer_name: Name of the consumer
        count: Maximum number of messages to read (default 1)
        block: Block time in milliseconds (default 1000, 0 for no blocking)
        include_pending: If True, also try to claim pending messages (default True)
    
    Returns:
        List of messages: [(message_id, {field: value, ...}), ...]
    """
    try:
        client = get_redis_client()
        # Ensure consumer group exists
        create_consumer_group(stream_name, group_name)
        
        result = []
        
        # First, try to claim pending messages (worker crash recovery)
        if include_pending:
            try:
                claimed = claim_pending_messages(
                    stream_name, 
                    group_name, 
                    consumer_name, 
                    min_idle_time=60000,  # 1 minute
                    count=count
                )
                result.extend(claimed)
            except Exception as e:
                logger.debug(f"Error claiming pending messages: {e}")
        
        # Read new messages if we haven't reached count yet
        if len(result) < count:
            # #region agent log
            _debug_log('redis_streams.py:131', 'Reading new messages from stream', {
                'stream_name': stream_name,
                'group_name': group_name,
                'consumer_name': consumer_name,
                'count_needed': count - len(result),
                'block': block
            }, 'B')
            # #endregion
            
            messages = client.xreadgroup(
                group_name,
                consumer_name,
                {stream_name: '>'},  # '>' means read new messages
                count=count - len(result),
                block=block
            )
            
            # #region agent log
            _debug_log('redis_streams.py:143', 'xreadgroup result', {
                'messages_received': len(messages) if messages else 0,
                'messages': str(messages)[:500] if messages else None
            }, 'B')
            # #endregion
            
            if messages:
                # Parse messages: [(stream_name, [(id, {field: value}), ...]), ...]
                for stream, stream_messages in messages:
                    for message_id, fields in stream_messages:
                        # #region agent log
                        _debug_log('redis_streams.py:151', 'Parsing message', {
                            'message_id': message_id,
                            'fields_keys': list(fields.keys()) if fields else [],
                            'fields': dict(fields) if fields else {},
                            'has_job_id': 'job_id' in fields if fields else False
                        }, 'B')
                        # #endregion
                        result.append((message_id, fields))
        
        return result
    except Exception as e:
        logger.error(f"Error reading from stream {stream_name}: {e}")
        raise


def acknowledge_message(stream_name, group_name, message_id):
    """
    Acknowledge a message (XACK).
    
    Args:
        stream_name: Name of the stream
        group_name: Name of the consumer group
        message_id: Message ID to acknowledge
    """
    try:
        client = get_redis_client()
        acked = client.xack(stream_name, group_name, message_id)
        if acked:
            logger.debug(f"Acknowledged message {message_id} from {stream_name}")
        return acked
    except Exception as e:
        logger.error(f"Error acknowledging message {message_id} from {stream_name}: {e}")
        raise


def get_delivery_count(stream_name, group_name, message_id):
    """
    Get delivery count for a message from XPENDING.
    Redis Streams automatically tracks delivery_count.
    
    Args:
        stream_name: Stream name
        group_name: Consumer group name
        message_id: Message ID
    
    Returns:
        Delivery count (number of times message was delivered)
    """
    try:
        client = get_redis_client()
        pending = client.xpending_range(
            stream_name,
            group_name,
            min=message_id,
            max=message_id,
            count=1
        )
        if pending:
            # XPENDING returns: (message_id, consumer_name, idle_time_ms, delivery_count)
            return pending[0][3] if len(pending[0]) > 3 else 0
        return 0
    except Exception as e:
        logger.debug(f"Error getting delivery count for {message_id}: {e}")
        return 0


def should_move_to_deadletter(stream_name, group_name, message_id, max_retries=5):
    """
    Check if message should be moved to deadletter based on delivery count.
    
    Args:
        stream_name: Stream name
        group_name: Consumer group name
        message_id: Message ID
        max_retries: Maximum number of retries (default 5)
    
    Returns:
        True if should move to deadletter
    """
    delivery_count = get_delivery_count(stream_name, group_name, message_id)
    return delivery_count >= max_retries


def move_to_deadletter(stream_name, message_id, reason, original_fields=None, worker_name=None, retry_count=0):
    """
    Move a message to the deadletter stream.
    
    Args:
        stream_name: Original stream name
        message_id: Message ID to move
        reason: Reason for moving to deadletter
        original_fields: Original message fields (optional)
        worker_name: Name of worker that moved to deadletter (optional)
        retry_count: Number of retries attempted (optional)
    
    Returns:
        Message ID in deadletter stream
    """
    try:
        client = get_redis_client()
        
        # Determine deadletter stream name
        deadletter_stream = f"stream:deadletter:{stream_name.replace('stream:', '')}"
        
        # Prepare deadletter message
        deadletter_message = {
            'original_stream': stream_name,
            'original_message_id': message_id,
            'reason': reason,
            'retry_count': str(retry_count),
            'timestamp': str(int(time.time()))
        }
        
        if worker_name:
            deadletter_message['worker_name'] = worker_name
        
        # Add original fields if provided
        if original_fields:
            deadletter_message['original_fields'] = json.dumps(original_fields)
        
        # Add to deadletter stream
        deadletter_id = client.xadd(deadletter_stream, deadletter_message)
        logger.warning(
            f"Moved message {message_id} from {stream_name} to {deadletter_stream}: "
            f"{reason} (retries: {retry_count})"
        )
        
        # Acknowledge the original message to remove it from pending
        # Extract group name from stream name (heuristic)
        group_name = _get_group_name_for_stream(stream_name)
        if group_name:
            try:
                acknowledge_message(stream_name, group_name, message_id)
            except Exception as e:
                logger.debug(f"Could not acknowledge message {message_id}: {e}")
        
        return deadletter_id
    except Exception as e:
        logger.error(f"Error moving message {message_id} to deadletter: {e}")
        raise


def _get_group_name_for_stream(stream_name):
    """Get consumer group name for a stream (heuristic)."""
    stream_to_group = {
        STREAM_JOB_INGEST: GROUP_DISCOVER,
        STREAM_ADDR_DISCOVERY: GROUP_ENRICH_1881,
        STREAM_ADDR_ENRICH_1881: GROUP_DATA247,
        STREAM_FINAL_WRITE: GROUP_WRITER,
    }
    return stream_to_group.get(stream_name)


def get_pending_messages(stream_name, group_name, consumer_name=None, count=10):
    """
    Get pending messages for a consumer group.
    
    Args:
        stream_name: Name of the stream
        group_name: Name of the consumer group
        consumer_name: Optional consumer name filter
        count: Maximum number of pending messages to return
    
    Returns:
        List of pending messages: [(message_id, consumer_name, idle_time_ms, delivery_count, fields), ...]
    """
    try:
        client = get_redis_client()
        pending = client.xpending_range(
            stream_name,
            group_name,
            min='-',
            max='+',
            count=count,
            consumername=consumer_name
        )
        return pending
    except Exception as e:
        logger.error(f"Error getting pending messages from {stream_name}: {e}")
        raise


def claim_pending_messages(stream_name, group_name, consumer_name, min_idle_time=60000, count=10):
    """
    Claim pending messages that have been idle for too long (XAUTOCLAIM).
    This is used for worker crash recovery.
    
    Args:
        stream_name: Name of the stream
        group_name: Name of the consumer group
        consumer_name: Name of the consumer claiming messages
        min_idle_time: Minimum idle time in milliseconds (default 60000 = 1 minute)
        count: Maximum number of messages to claim
    
    Returns:
        List of claimed messages: [(message_id, {field: value}), ...]
    """
    try:
        client = get_redis_client()
        
        # Use XAUTOCLAIM (Redis 6.2+) if available, otherwise use XCLAIM
        try:
            # #region agent log
            _debug_log('redis_streams.py:340', 'Calling xautoclaim', {
                'stream_name': stream_name,
                'group_name': group_name,
                'consumer_name': consumer_name,
                'min_idle_time': min_idle_time,
                'count': count
            }, 'A')
            # #endregion
            
            # XAUTOCLAIM is more efficient
            # Fix: Use start_id='0-0' instead of start='0'
            result = client.xautoclaim(
                stream_name,
                group_name,
                consumer_name,
                min_idle_time,
                start_id='0-0',  # Fixed: use start_id parameter with '0-0' format
                count=count
            )
            
            # #region agent log
            _debug_log('redis_streams.py:352', 'xautoclaim result', {
                'result_type': type(result).__name__,
                'result_length': len(result) if result else 0,
                'result': str(result)[:200] if result else None
            }, 'A')
            # #endregion
            # XAUTOCLAIM returns (next_id, [(message_id, {fields}), ...])
            if result and len(result) >= 2:
                claimed_messages = result[1]
                parsed = []
                for message_id, fields in claimed_messages:
                    parsed.append((message_id, fields))
                if parsed:
                    logger.info(f"XAUTOCLAIM: Claimed {len(parsed)} messages from {stream_name}")
                return parsed
        except (AttributeError, TypeError, redis.exceptions.ResponseError) as e:
            # #region agent log
            _debug_log('redis_streams.py:357', 'xautoclaim exception', {
                'exception_type': type(e).__name__,
                'exception_message': str(e),
                'falling_back_to_xclaim': True
            }, 'A')
            # #endregion
            
            # Fallback to XCLAIM if XAUTOCLAIM not available or has wrong signature
            pending = get_pending_messages(stream_name, group_name, count=count)
            
            if not pending:
                return []
            
            # Filter messages that are idle long enough
            idle_message_ids = [
                msg[0] for msg in pending  # message_id is first element
                if msg[2] >= min_idle_time  # idle_time_ms is third element
            ]
            
            if not idle_message_ids:
                return []
            
            # Claim messages using XCLAIM
            claimed = client.xclaim(
                stream_name,
                group_name,
                consumer_name,
                min_idle_time,
                idle_message_ids
            )
            
            # Parse claimed messages
            result = []
            for message_id, fields in claimed.items():
                result.append((message_id, fields))
            
            if result:
                logger.info(f"XCLAIM: Claimed {len(result)} messages from {stream_name} for consumer {consumer_name}")
            
            return result
        
        return []
    except Exception as e:
        logger.error(f"Error claiming pending messages from {stream_name}: {e}")
        raise


def initialize_streams():
    """
    Initialize all streams and consumer groups.
    This should be called once during app startup or as a management command.
    """
    streams_and_groups = [
        (STREAM_JOB_INGEST, GROUP_DISCOVER),
        (STREAM_ADDR_DISCOVERY, GROUP_ENRICH_1881),
        (STREAM_ADDR_ENRICH_1881, GROUP_DATA247),
        (STREAM_FINAL_WRITE, GROUP_WRITER),
    ]
    
    for stream_name, group_name in streams_and_groups:
        try:
            create_consumer_group(stream_name, group_name)
        except Exception as e:
            logger.error(f"Error initializing stream {stream_name} with group {group_name}: {e}")
    
    logger.info("Initialized all Redis streams and consumer groups")
