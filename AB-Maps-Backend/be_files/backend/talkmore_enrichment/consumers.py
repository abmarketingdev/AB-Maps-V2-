"""
WebSocket consumers for talkmore_enrichment app.
Provides real-time updates for enrichment job progress.
"""
import json
import asyncio
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from channels.exceptions import StopConsumer
from websockets.exceptions import ConnectionClosedError
from django.utils import timezone
from .models import EnrichmentJob

logger = logging.getLogger(__name__)


class TalkmoreJobConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time enrichment job updates.
    
    Handles:
    - feature.done events (address enrichment completed)
    - job.done events (job fully completed)
    - Job status updates
    """
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.user = None
        self.job_id = None
        self.group_name = None
        self.ping_task = None
        self.connection_id = None

    async def connect(self):
        """Handle WebSocket connection."""
        # Get user from scope (set by middleware)
        self.user = self.scope.get('user')
        
        # Check authentication
        if not self.user or not getattr(self.user, 'is_authenticated', True):
            logger.warning("WebSocket connection rejected - user not authenticated")
            await self.close(code=4001)  # Unauthorized
            return
        
        # Get job_id from URL path
        self.job_id = self.scope.get('url_route', {}).get('kwargs', {}).get('job_id')
        if not self.job_id:
            logger.warning("WebSocket connection rejected - no job_id in URL")
            await self.close(code=4000)  # Bad request
            return
        
        # Verify job exists and user has access
        job_exists = await self.verify_job_access()
        if not job_exists:
            logger.warning(f"WebSocket connection rejected - job {self.job_id} not found or access denied")
            await self.close(code=4003)  # Forbidden
            return
        
        # Set up group name
        self.group_name = f'talkmore_job_{self.job_id}'
        
        # Join the room group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        
        # Generate unique connection ID
        self.connection_id = f"{self.user.id}_{int(timezone.now().timestamp() * 1000)}"
        
        # Accept the connection
        await self.accept()
        
        # Send initial job status
        await self.send_initial_status()
        
        # Start periodic ping to keep connection alive
        self.ping_task = asyncio.create_task(self.periodic_ping())
        
        logger.info(f"WebSocket connected for job {self.job_id}, user {self.user.id}")

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        # Cancel ping task if running
        if self.ping_task and not self.ping_task.done():
            self.ping_task.cancel()
            try:
                await self.ping_task
            except asyncio.CancelledError:
                pass
        
        # Leave the room group
        if self.group_name:
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )
        
        logger.info(f"WebSocket disconnected for job {self.job_id}, close_code: {close_code}")

    @database_sync_to_async
    def verify_job_access(self):
        """Verify that the job exists and user has access to it."""
        try:
            job = EnrichmentJob.objects.get(id=self.job_id)
            # For now, allow any authenticated user to access any job
            # You can add more specific permission checks here if needed
            return True
        except EnrichmentJob.DoesNotExist:
            return False

    async def receive(self, text_data):
        """Handle incoming WebSocket messages."""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'ping':
                await self.handle_ping(data)
            elif message_type == 'pong':
                await self.handle_pong(data)
            elif message_type == 'get_status':
                await self.handle_get_status(data)
            else:
                await self.send_error(f"Unknown message type: {message_type}")
                
        except json.JSONDecodeError:
            await self.send_error("Invalid JSON format")
        except Exception as e:
            logger.error(f"Error processing WebSocket message: {e}", exc_info=True)
            await self.send_error(f"Error processing message: {str(e)}")

    async def handle_ping(self, data):
        """Handle ping message from client."""
        await self.send(json.dumps({
            'type': 'pong',
            'timestamp': timezone.now().isoformat()
        }))

    async def handle_pong(self, data):
        """Handle pong message from client."""
        # No response needed for pong
        pass

    async def handle_get_status(self, data):
        """Handle status request from client."""
        job_status = await self.get_job_status()
        await self.send(json.dumps({
            'type': 'job_status',
            'status': job_status,
            'timestamp': timezone.now().isoformat()
        }))

    @database_sync_to_async
    def get_job_status(self):
        """Get current job status."""
        try:
            job = EnrichmentJob.objects.get(id=self.job_id)
            progress_percentage = 0.0
            if job.expected_count > 0:
                progress_percentage = round((job.done_count / job.expected_count) * 100, 2)
            
            return {
                'job_id': str(job.id),
                'status': job.status,
                'expected_count': job.expected_count,
                'done_count': job.done_count,
                'success_count': job.success_count,
                'no_data_count': job.no_data_count,
                'failed_count': job.failed_count,
                'progress_percentage': progress_percentage,
                'started_at': job.started_at.isoformat() if job.started_at else None,
                'finished_at': job.finished_at.isoformat() if job.finished_at else None
            }
        except EnrichmentJob.DoesNotExist:
            return None

    async def send_initial_status(self):
        """Send initial job status to client."""
        job_status = await self.get_job_status()
        if job_status:
            try:
                await self.send(json.dumps({
                    'type': 'initial_status',
                    'job': job_status,
                    'timestamp': timezone.now().isoformat()
                }))
            except ConnectionClosedError:
                logger.warning("WebSocket connection closed before initial status could be sent")
                raise StopConsumer()
        else:
            await self.send_error("Job not found")
            await self.close(code=4003)

    async def send_error(self, message):
        """Send error message to client."""
        try:
            await self.send(json.dumps({
                'type': 'error',
                'message': message,
                'timestamp': timezone.now().isoformat()
            }))
        except ConnectionClosedError:
            logger.warning("WebSocket connection closed before error could be sent")
            raise StopConsumer()

    async def periodic_ping(self):
        """Send periodic pings to keep connection alive."""
        try:
            while True:
                await asyncio.sleep(60)  # Send ping every 60 seconds
                await self.send(json.dumps({
                    'type': 'ping',
                    'timestamp': timezone.now().isoformat(),
                    'connection_id': self.connection_id
                }))
        except asyncio.CancelledError:
            # Task was cancelled, exit gracefully
            pass
        except Exception as e:
            logger.error(f"Error in periodic ping: {e}")

    # Event handlers for messages from channel layer (sent by Worker D)
    
    async def feature_done(self, event):
        """
        Handle feature.done event from Worker D.
        This is called when an address enrichment is completed.
        """
        address_uuid = event.get('address_uuid')
        show_marker = event.get('show_marker', False)
        
        logger.info(f"🎯 Consumer: Received feature.done event from channel layer - address_uuid={address_uuid}, show_marker={show_marker}, job_id={self.job_id}")
        
        try:
            # Only send if show_marker is True (frontend will ignore if False)
            if event.get('show_marker', False):
                done_count = event.get('done_count', 0)
                expected_count = event.get('expected_count', 0)
                progress_percentage = event.get('progress_percentage', 0.0)
                
                logger.info(f"📤 Consumer: Sending feature.done to WebSocket client - address_uuid={address_uuid}, job_id={self.job_id}, done_count={done_count}/{expected_count} ({progress_percentage}%)")
                
                message = json.dumps({
                    'type': 'feature.done',
                    'address_uuid': event.get('address_uuid'),
                    'lat': event.get('lat'),
                    'lon': event.get('lon'),
                    'address_text': event.get('address_text'),
                    'carrier_summary': event.get('carrier_summary', {}),
                    'show_marker': event.get('show_marker', False),
                    'done_count': done_count,
                    'expected_count': expected_count,
                    'progress_percentage': progress_percentage,
                    'timestamp': timezone.now().isoformat()
                })
                
                await self.send(message)
                logger.info(f"✅ Consumer: Successfully sent feature.done to client - address_uuid={address_uuid}, job_id={self.job_id}")
            else:
                logger.info(f"⏭️ Consumer: Skipping feature.done (show_marker=False) - address_uuid={address_uuid}, job_id={self.job_id}")
                
        except ConnectionClosedError:
            logger.warning(f"⚠️ Consumer: WebSocket connection closed before feature.done could be sent - address_uuid={address_uuid}, job_id={self.job_id}")
            raise StopConsumer()
        except Exception as e:
            logger.error(f"❌ Consumer: Error sending feature.done event - address_uuid={address_uuid}, job_id={self.job_id}, error={e}", exc_info=True)

    async def job_done(self, event):
        """
        Handle job.done event from Worker D.
        This is called when the entire job is completed.
        """
        try:
            await self.send(json.dumps({
                'type': 'job.done',
                'job_id': event.get('job_id'),
                'total_addresses': event.get('total_addresses', 0),
                'success_count': event.get('success_count', 0),
                'no_data_count': event.get('no_data_count', 0),
                'failed_count': event.get('failed_count', 0),
                'timestamp': timezone.now().isoformat()
            }))
            logger.info(f"Sent job.done event for job {event.get('job_id')}")
        except ConnectionClosedError:
            logger.warning("WebSocket connection closed before job.done could be sent")
            raise StopConsumer()
        except Exception as e:
            logger.error(f"Error sending job.done event: {e}", exc_info=True)
