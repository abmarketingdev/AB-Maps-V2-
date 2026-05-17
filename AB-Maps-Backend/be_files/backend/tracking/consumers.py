"""
WebSocket consumers for real-time tracking functionality.
"""
import json
import asyncio
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import datetime, timedelta
from .models import LocationPing, WorkSession
from users.models import Employee, Manager
from areas.models import Area
from django.contrib.gis.geos import Point
from django.core.exceptions import ObjectDoesNotExist
from channels.exceptions import StopConsumer
from websockets.exceptions import ConnectionClosedError
from areas.models import AreaEmployee

User = get_user_model()


# ---------------------------------------------------------------------------
# WorkSession helpers (shared by all consumers)
# These are wrapped with database_sync_to_async at module level so the three
# consumers can call them without duplicating ORM code.
# ---------------------------------------------------------------------------

def _db_open_work_session(actor_kind, actor_obj):
    """Return id of the currently-open WorkSession for this actor, creating
    one if none exists. actor_kind is 'employee' or 'manager'."""
    if not actor_obj:
        return None
    filters = {'employee': actor_obj} if actor_kind == 'employee' else {'manager': actor_obj}
    existing = WorkSession.objects.filter(ended_at__isnull=True, **filters).first()
    if existing:
        return existing.id
    ws = WorkSession.objects.create(source='websocket', **filters)
    return ws.id


def _db_touch_work_session(work_session_id):
    if not work_session_id:
        return
    WorkSession.objects.filter(
        id=work_session_id, ended_at__isnull=True
    ).update(last_heartbeat_at=timezone.now())


def _db_close_work_session(work_session_id):
    if not work_session_id:
        return
    WorkSession.objects.filter(
        id=work_session_id, ended_at__isnull=True
    ).update(ended_at=timezone.now())


open_work_session_async = database_sync_to_async(_db_open_work_session)
touch_work_session_async = database_sync_to_async(_db_touch_work_session)
close_work_session_async = database_sync_to_async(_db_close_work_session)


class LocationTrackingConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time location tracking.
    
    Handles:
    - Employee location updates
    - Manager location monitoring
    - Real-time status updates
    - Area-based filtering
    """
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.user = None
        self.user_type = None
        self.user_id = None
        self.room_name = None
        self.room_group_name = None
        self.last_ping_time = None
        self.is_online = False
        self.ping_task = None
        self.connection_id = None
        # WorkSession state — populated in setup_user_room / connect
        self._actor_kind = None
        self._actor_obj = None
        self.work_session_id = None

    async def connect(self):
        """Handle WebSocket connection."""
        # Get user from scope (set by middleware)
        self.user = self.scope.get('user')
        
        print(f"WebSocket connect attempt - User ID: {getattr(self.user, 'id', 'None')}, Authenticated: {getattr(self.user, 'is_authenticated', False) if self.user else False}")
        
        # Check if user exists and is authenticated
        if not self.user:
            print("WebSocket connection rejected - No user found")
            await self.close(code=4001)  # Unauthorized
            return
        
        # For database users, we consider them authenticated if they exist
        # since they passed JWT validation in middleware
        if not getattr(self.user, 'is_authenticated', True):
            print(f"WebSocket connection rejected - User not authenticated: {getattr(self.user, 'id', 'None')}")
            await self.close(code=4001)  # Unauthorized
            return
        
        # Generate unique connection ID
        self.connection_id = f"{self.user.id}_{int(timezone.now().timestamp() * 1000)}"
        
        # Determine user type and set up room
        await self.setup_user_room()
        
        # Join the room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        # Mark user as online
        await self.mark_user_online()

        # Open WorkSession (guarded — never block the existing flow)
        try:
            if self._actor_obj is not None:
                self.work_session_id = await open_work_session_async(
                    self._actor_kind, self._actor_obj
                )
        except Exception as e:
            print(f"[WorkSession] open failed for user {getattr(self.user, 'id', None)}: {e}")

        # Accept the connection
        await self.accept()

        # Send initial status
        await self.send_initial_status()
        
        # Start periodic ping to keep connection alive
        self.ping_task = asyncio.create_task(self.periodic_ping())

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        # Cancel ping task if running
        if self.ping_task and not self.ping_task.done():
            self.ping_task.cancel()
            try:
                await self.ping_task
            except asyncio.CancelledError:
                pass
        
        if self.user and self.is_online:
            await self.mark_user_offline()

        # Close WorkSession (guarded)
        try:
            await close_work_session_async(self.work_session_id)
        except Exception as e:
            print(f"[WorkSession] close failed: {e}")

        # Leave the room group
        if self.room_group_name:
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

    async def periodic_ping(self):
        """Send periodic pings to keep connection alive."""
        try:
            while True:
                await asyncio.sleep(60)  # Send ping every 60 seconds
                if self.is_online:
                    await self.send(json.dumps({
                        'type': 'ping',
                        'timestamp': timezone.now().isoformat(),
                        'connection_id': self.connection_id
                    }))
        except asyncio.CancelledError:
            # Task was cancelled, exit gracefully
            pass
        except Exception as e:
            print(f"Error in periodic ping: {e}")

    async def receive(self, text_data):
        """Handle incoming WebSocket messages."""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'location_update':
                await self.handle_location_update(data)
            elif message_type == 'status_update':
                await self.handle_status_update(data)
            elif message_type == 'ping':
                await self.handle_ping(data)
            elif message_type == 'pong':
                await self.handle_pong(data)
            elif message_type == 'area_request':
                await self.handle_area_request(data)
            elif message_type == 'employee_request':
                await self.handle_employee_request(data)
            elif message_type == 'request_location':
                await self.handle_request_location(data)
            else:
                await self.send_error(f"Unknown message type: {message_type}")
                
        except json.JSONDecodeError:
            await self.send_error("Invalid JSON format")
        except Exception as e:
            await self.send_error(f"Error processing message: {str(e)}")

    @database_sync_to_async
    def setup_user_room(self):
        """Set up user-specific room for WebSocket communication."""
        if hasattr(self.user, 'employee') and self.user.employee:
            self.user_type = 'employee'
            self.user_id = str(self.user.employee.id)
            self.room_name = f"employee_{self.user.employee.id}"
            self.room_group_name = f"employee_{self.user.employee.id}"
            self._actor_kind = 'employee'
            self._actor_obj = self.user.employee
        elif hasattr(self.user, 'manager') and self.user.manager:
            self.user_type = 'manager'
            self.user_id = str(self.user.manager.id)
            self.room_name = f"manager_{self.user.manager.id}"
            self.room_group_name = f"manager_{self.user.manager.id}"
            self._actor_kind = 'manager'
            self._actor_obj = self.user.manager
        else:
            self.user_type = 'admin'
            self.user_id = str(self.user.id)
            self.room_name = f"admin_{self.user.id}"
            self.room_group_name = f"admin_{self.user.id}"
            # admin with no employee/manager row → not tracked
            self._actor_kind = None
            self._actor_obj = None

    @database_sync_to_async
    def mark_user_online(self):
        """Mark user as online and update last seen."""
        self.is_online = True
        self.last_ping_time = timezone.now()
        
        if self.user_type == 'employee':
            employee = self.user.employee
            employee.last_seen = timezone.now()
            employee.is_online = True
            employee.save(update_fields=['last_seen', 'is_online'])
            print(f"Employee {employee.name} marked as online")
        elif self.user_type == 'manager':
            manager = self.user.manager
            manager.last_seen = timezone.now()
            manager.is_online = True
            manager.save(update_fields=['last_seen', 'is_online'])

    @database_sync_to_async
    def mark_user_offline(self):
        """Mark user as offline."""
        self.is_online = False
        
        if self.user_type == 'employee':
            employee = self.user.employee
            employee.is_online = False
            employee.save(update_fields=['is_online'])
        elif self.user_type == 'manager':
            manager = self.user.manager
            manager.is_online = False
            manager.save(update_fields=['is_online'])

    async def handle_location_update(self, data):
        """Handle location update from client."""
        try:
            latitude = data.get('latitude')
            longitude = data.get('longitude')
            accuracy = data.get('accuracy')
            device_id = data.get('device_id', f"{self.user_type}_{self.user_id}")
            
            if not latitude or not longitude:
                await self.send_error("Latitude and longitude are required")
                return
            
            # Save location ping
            location_ping = await self.save_location_ping(
                latitude, longitude, accuracy, device_id
            )

            # Touch WorkSession (location update = activity)
            try:
                await touch_work_session_async(self.work_session_id)
            except Exception:
                pass

            # Broadcast to relevant managers
            await self.broadcast_location_to_managers(location_ping)
            
            # Send confirmation
            await self.send(json.dumps({
                'type': 'location_confirmed',
                'timestamp': location_ping['timestamp'],
                'id': location_ping['id']
            }))
            
        except Exception as e:
            await self.send_error(f"Error updating location: {str(e)}")

    @database_sync_to_async
    def save_location_ping(self, latitude, longitude, accuracy, device_id):
        """Save location ping to database."""
        point = Point(float(longitude), float(latitude))
        
        location_ping = LocationPing.objects.create(
            device_id=device_id,
            point=point,
            accuracy=accuracy,
            employee=self.user.employee if self.user_type == 'employee' else None,
            manager=self.user.manager if self.user_type == 'manager' else None
        )
        
        return {
            'id': str(location_ping.id),
            'timestamp': location_ping.timestamp.isoformat(),
            'latitude': latitude,
            'longitude': longitude,
            'accuracy': accuracy
        }

    async def broadcast_location_to_managers(self, location_data):
        """Broadcast location update to ALL managers and superusers."""
        print(f"DEBUG: broadcast_location_to_managers called - now broadcasts to ALL managers and superusers")
        print(f"DEBUG: user_type = {self.user_type}")
        print(f"DEBUG: user_id = {self.user_id}")
        print(f"DEBUG: user = {self.user}")
        
        if self.user_type != 'employee':
            print(f"DEBUG: Not broadcasting - user_type is {self.user_type}, not 'employee'")
            return
        
        # Broadcast to ALL managers using a single group
        print(f"DEBUG: Broadcasting to 'all_managers' group")
        await self.channel_layer.group_send(
            "all_managers",
            {
                'type': 'location_update',
                'employee_id': self.user_id,
                'employee_name': self.user.employee.name,
                'location': location_data
            }
        )
        
        # Also broadcast to superusers group
        print(f"DEBUG: Broadcasting to 'superusers' group")
        await self.channel_layer.group_send(
            "superusers",
            {
                'type': 'location_update',
                'employee_id': self.user_id,
                'employee_name': self.user.employee.name,
                'location': location_data
            }
        )
        print(f"DEBUG: Sent location update to 'all_managers' and 'superusers' groups")

    @database_sync_to_async
    def get_managers_for_employee(self):
        """Get ALL manager IDs - employees now broadcast to all managers."""
        print(f"DEBUG: get_managers_for_employee called - now returns ALL managers")
        
        # Get ALL managers in the system
        all_managers = Manager.objects.all().values_list('id', flat=True)
        
        result = [str(manager_id) for manager_id in all_managers]
        print(f"DEBUG: Found ALL managers: {result}")
        return result

    async def handle_status_update(self, data):
        """Handle status update from client."""
        try:
            status = data.get('status')
            if not status:
                await self.send_error("Status is required")
                return
            
            # Update user status
            await self.update_user_status(status)
            
            # Broadcast status update
            await self.broadcast_status_update(status)
            
            # Send confirmation
            await self.send(json.dumps({
                'type': 'status_confirmed',
                'status': status,
                'timestamp': timezone.now().isoformat()
            }))
            
        except Exception as e:
            await self.send_error(f"Error updating status: {str(e)}")

    @database_sync_to_async
    def update_user_status(self, status):
        """Update user status in database."""
        if self.user_type == 'employee':
            employee = self.user.employee
            employee.status = status
            employee.save(update_fields=['status'])
        elif self.user_type == 'manager':
            manager = self.user.manager
            manager.status = status
            manager.save(update_fields=['status'])

    async def broadcast_status_update(self, status):
        """Broadcast status update to ALL managers and superusers."""
        if self.user_type == 'employee':
            # Broadcast to ALL managers using a single group
            print(f"DEBUG: Broadcasting status update to 'all_managers' group")
            await self.channel_layer.group_send(
                "all_managers",
                {
                    'type': 'status_update',
                    'employee_id': self.user_id,
                    'employee_name': self.user.employee.name,
                    'status': status
                }
            )
            
            # Also broadcast to superusers group
            print(f"DEBUG: Broadcasting status update to 'superusers' group")
            await self.channel_layer.group_send(
                "superusers",
                {
                    'type': 'status_update',
                    'employee_id': self.user_id,
                    'employee_name': self.user.employee.name,
                    'status': status
                }
            )
            print(f"DEBUG: Sent status update to 'all_managers' and 'superusers' groups")

    async def handle_ping(self, data):
        """Handle ping message from client."""
        self.last_ping_time = timezone.now()
        try:
            await touch_work_session_async(self.work_session_id)
        except Exception:
            pass
        await self.send(json.dumps({
            'type': 'pong',
            'timestamp': self.last_ping_time.isoformat()
        }))

    async def handle_pong(self, data):
        """Handle pong message from client."""
        # Update last ping time when we receive pong
        self.last_ping_time = timezone.now()
        try:
            await touch_work_session_async(self.work_session_id)
        except Exception:
            pass
        # No need to send anything back for pong

    async def handle_area_request(self, data):
        """Handle area data request."""
        try:
            area_id = data.get('area_id')
            if not area_id:
                await self.send_error("Area ID is required")
                return
            
            area_data = await self.get_area_data(area_id)
            await self.send(json.dumps({
                'type': 'area_data',
                'area': area_data
            }))
            
        except Exception as e:
            await self.send_error(f"Error getting area data: {str(e)}")

    @database_sync_to_async
    def get_area_data(self, area_id):
        """Get area data from database."""
        try:
            area = Area.objects.get(id=area_id)
            return {
                'id': str(area.id),
                'name': area.name,
                'status': area.status,
                'color': area.color
            }
        except Area.DoesNotExist:
            return None

    async def handle_employee_request(self, data):
        """Handle employee data request."""
        try:
            employee_id = data.get('employee_id')
            if not employee_id:
                await self.send_error("Employee ID is required")
                return
            
            employee_data = await self.get_employee_data(employee_id)
            await self.send(json.dumps({
                'type': 'employee_data',
                'employee': employee_data
            }))
            
        except Exception as e:
            await self.send_error(f"Error getting employee data: {str(e)}")

    async def handle_request_location(self, data):
        """Handle location request from manager."""
        if self.user_type != 'employee':
            await self.send_error("Only employees can handle location requests")
            return
        
        try:
            # Get current location and send it immediately
            current_location = await self.get_current_location()
            if current_location:
                await self.send(json.dumps({
                    'type': 'location_update',
                    'latitude': current_location['latitude'],
                    'longitude': current_location['longitude'],
                    'accuracy': current_location['accuracy'],
                    'device_id': f"employee_{self.user_id}",
                    'timestamp': current_location['timestamp']
                }))
            else:
                await self.send_error("No current location available")
                
        except Exception as e:
            await self.send_error(f"Error getting current location: {str(e)}")

    @database_sync_to_async
    def get_current_location(self):
        """Get current location from database or return None if not available."""
        try:
            # Get the most recent location for this employee
            latest_location = LocationPing.objects.filter(
                employee=self.user.employee
            ).order_by('-timestamp').first()
            
            if latest_location:
                return {
                    'latitude': latest_location.point.y,
                    'longitude': latest_location.point.x,
                    'accuracy': latest_location.accuracy,
                    'timestamp': latest_location.timestamp.isoformat()
                }
            return None
        except Exception as e:
            print(f"Error getting current location: {e}")
            return None

    @database_sync_to_async
    def get_employee_data(self, employee_id):
        """Get employee data from database."""
        try:
            employee = Employee.objects.get(id=employee_id)
            return {
                'id': str(employee.id),
                'name': employee.name,
                'status': employee.status,
                'is_online': employee.is_online,
                'last_seen': employee.last_seen.isoformat() if employee.last_seen else None
            }
        except Employee.DoesNotExist:
            return None

    async def send_initial_status(self):
        """Send initial status to client."""
        user_data = await self.get_user_data()
        try:
            await self.send(json.dumps({
                'type': 'initial_status',
                'user': user_data,
                'timestamp': timezone.now().isoformat()
            }))
        except ConnectionClosedError:
            print("WebSocket connection closed before data could be sent.")
            raise StopConsumer()

    @database_sync_to_async
    def get_user_data(self):
        """Get user data for initial status."""
        if self.user_type == 'employee':
            employee = self.user.employee
            return {
                'id': str(employee.id),
                'name': employee.name,
                'type': 'employee',
                'status': employee.status,
                'is_online': employee.is_online,
                'last_seen': employee.last_seen.isoformat() if employee.last_seen else None
            }
        elif self.user_type == 'manager':
            manager = self.user.manager
            return {
                'id': str(manager.id),
                'name': manager.name,
                'type': 'manager',
                'status': manager.status,
                'is_online': manager.is_online,
                'last_seen': manager.last_seen.isoformat() if manager.last_seen else None
            }
        else:
            return {
                'id': str(self.user.id),
                'username': self.user.username,
                'type': 'admin'
            }

    async def send_error(self, message):
        """Send error message to client."""
        try:
            await self.send(json.dumps({
                'type': 'error',
                'message': message,
                'timestamp': timezone.now().isoformat()
            }))
        except ConnectionClosedError:
            print("WebSocket connection closed before data could be sent.")
            raise StopConsumer()

    async def location_update(self, event):
        """Handle location update event from channel layer."""
        try:
            await self.send(json.dumps({
                'type': 'location_update',
                'employee_id': event['employee_id'],
                'employee_name': event['employee_name'],
                'location': event['location']
            }))
        except ConnectionClosedError:
            print("WebSocket connection closed before data could be sent.")
            raise StopConsumer()

    async def status_update(self, event):
        """Handle status update event from channel layer."""
        try:
            await self.send(json.dumps({
                'type': 'status_update',
                'employee_id': event['employee_id'],
                'employee_name': event['employee_name'],
                'status': event['status']
            }))
        except ConnectionClosedError:
            print("WebSocket connection closed before data could be sent.")
            raise StopConsumer()

    async def request_location(self, event):
        """Handle location request event from channel layer."""
        try:
            await self.send(json.dumps({
                'type': 'request_location',
                'requested_by': event['requested_by'],
                'timestamp': event['timestamp']
            }))
        except ConnectionClosedError:
            print("WebSocket connection closed before data could be sent.")
            raise StopConsumer()


class ManagerDashboardConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for manager dashboard.
    
    Provides real-time updates for managers including:
    - Employee locations
    - Area updates
    - Status changes
    """
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.user = None
        self.manager = None
        self.room_group_name = None
        self.ping_task = None
        self.connection_id = None
        self.work_session_id = None

    async def connect(self):
        """Handle WebSocket connection."""
        self.user = self.scope.get('user')

        if not self.user or not getattr(self.user, 'is_authenticated', True):
            await self.close(code=4001)
            return

        # Check if user is a manager using database_sync_to_async
        manager = await self.get_user_manager()
        if not manager:
            await self.close(code=4003)  # Forbidden - not a manager
            return

        self.manager = manager
        # Join the general "all_managers" group instead of individual manager groups
        self.room_group_name = "all_managers"

        # Join the room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        # Generate unique connection ID
        self.connection_id = f"{self.user.id}_{int(timezone.now().timestamp() * 1000)}"

        # Open WorkSession for this manager (guarded)
        try:
            self.work_session_id = await open_work_session_async('manager', self.manager)
        except Exception as e:
            print(f"[WorkSession] manager-dashboard open failed for manager {getattr(self.manager, 'id', None)}: {e}")

        # Accept the connection
        await self.accept()

        # Send initial dashboard data
        await self.send_dashboard_data()

        # Start periodic ping to keep connection alive
        self.ping_task = asyncio.create_task(self.periodic_ping())

    @database_sync_to_async
    def get_user_manager(self):
        """Get the manager object for the user."""
        try:
            return self.user.manager
        except:
            return None

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        # Cancel ping task if running
        if self.ping_task and not self.ping_task.done():
            self.ping_task.cancel()
            try:
                await self.ping_task
            except asyncio.CancelledError:
                pass

        # Close WorkSession (guarded)
        try:
            await close_work_session_async(self.work_session_id)
        except Exception as e:
            print(f"[WorkSession] manager-dashboard close failed: {e}")

        if self.room_group_name:
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

    async def receive(self, text_data):
        """Handle incoming WebSocket messages."""
        # Any client message = activity; touch the session.
        try:
            await touch_work_session_async(self.work_session_id)
        except Exception:
            pass
        try:
            data = json.loads(text_data)
            message_type = data.get('type')

            if message_type == 'get_employees':
                await self.handle_get_employees(data)
            elif message_type == 'get_areas':
                await self.handle_get_areas(data)
            elif message_type == 'area_update':
                await self.handle_area_update(data)
            elif message_type == 'employee_request':
                await self.handle_employee_request(data)
            else:
                await self.send_error(f"Unknown message type: {message_type}")
                
        except json.JSONDecodeError:
            await self.send_error("Invalid JSON format")
        except Exception as e:
            await self.send_error(f"Error processing message: {str(e)}")

    async def send_dashboard_data(self):
        """Send initial dashboard data to manager."""
        dashboard_data = await self.get_dashboard_data()
        try:
            await self.send(json.dumps({
                'type': 'dashboard_data',
                'data': dashboard_data,
                'timestamp': timezone.now().isoformat()
            }))
        except ConnectionClosedError:
            print("WebSocket connection closed before data could be sent.")
            raise StopConsumer()

    @database_sync_to_async
    def get_dashboard_data(self):
        """Get dashboard data for manager - now shows ALL employees."""
        
        # Get ALL employees in the system (not just area-assigned ones)
        all_employees = Employee.objects.all()
        
        # Get areas created by this manager
        areas = Area.objects.filter(created_by=self.manager)
        
        # Get recent location pings for ALL employees (not just area-assigned ones)
        recent_locations = LocationPing.objects.filter(
            employee__isnull=False,
            timestamp__gte=timezone.now() - timedelta(hours=1)
        ).select_related('employee')
        
        areas_data = []
        for area in areas:
            # Count employees directly assigned to the area
            employee_count = area.employees.count()
            
            areas_data.append({
                'id': str(area.id),
                'name': area.name,
                'status': area.status,
                'color': area.color,
                'employee_count': employee_count
            })
        
        return {
            'employees': [
                {
                    'id': str(emp.id),
                    'name': emp.name,
                    'status': emp.status,
                    'is_online': emp.is_online,
                    'last_seen': emp.last_seen.isoformat() if emp.last_seen else None
                }
                for emp in all_employees
            ],
            'areas': areas_data,
            'recent_locations': [
                {
                    'id': str(loc.id),
                    'employee_id': str(loc.employee.id),
                    'employee_name': loc.employee.name,
                    'latitude': loc.point.y,
                    'longitude': loc.point.x,
                    'timestamp': loc.timestamp.isoformat(),
                    'accuracy': loc.accuracy
                }
                for loc in recent_locations
            ]
        }

    async def handle_get_employees(self, data):
        """Handle employee data request."""
        employees_data = await self.get_employees_data()
        try:
            await self.send(json.dumps({
                'type': 'employees_data',
                'employees': employees_data
            }))
        except ConnectionClosedError:
            print("WebSocket connection closed before data could be sent.")
            raise StopConsumer()

    @database_sync_to_async
    def get_employees_data(self):
        """Get ALL employees data for manager (not just area-assigned ones)."""
        # Get ALL employees in the system
        all_employees = Employee.objects.all()
        return [
            {
                'id': str(emp.id),
                'name': emp.name,
                'status': emp.status,
                'is_online': emp.is_online,
                'last_seen': emp.last_seen.isoformat() if emp.last_seen else None,
                'email': emp.email
            }
            for emp in all_employees
        ]

    async def handle_get_areas(self, data):
        """Handle areas data request."""
        areas_data = await self.get_areas_data()
        try:
            await self.send(json.dumps({
                'type': 'areas_data',
                'areas': areas_data
            }))
        except ConnectionClosedError:
            print("WebSocket connection closed before data could be sent.")
            raise StopConsumer()

    @database_sync_to_async
    def get_areas_data(self):
        """Get areas data for manager."""
        
        areas = Area.objects.filter(created_by=self.manager)
        areas_data = []
        
        for area in areas:
            # Count employees directly assigned to the area
            employee_count = area.employees.count()
            
            areas_data.append({
                'id': str(area.id),
                'name': area.name,
                'status': area.status,
                'color': area.color,
                'employee_count': employee_count,
                'created_at': area.created_at.isoformat()
            })
        
        return areas_data

    async def handle_area_update(self, data):
        """Handle area update request."""
        area_id = data.get('area_id')
        if not area_id:
            await self.send_error("Area ID is required")
            return
        
        # Broadcast area update to all managers and superusers
        try:
            await self.channel_layer.group_send(
                'all_managers',
                {
                    'type': 'area_update',
                    'area_id': area_id,
                    'data': data.get('data', {})
                }
            )
            
            # Also broadcast to superusers
            await self.channel_layer.group_send(
                'superusers',
                {
                    'type': 'area_update',
                    'area_id': area_id,
                    'data': data.get('data', {})
                }
            )
        except ConnectionClosedError:
            print("WebSocket connection closed before data could be sent.")
            raise StopConsumer()

    async def handle_employee_request(self, data):
        """Handle specific employee data request."""
        employee_id = data.get('employee_id')
        if not employee_id:
            await self.send_error("Employee ID is required")
            return
        
        employee_data = await self.get_specific_employee_data(employee_id)
        
        # Also request the employee to send their current location
        await self.request_employee_location(employee_id)
        
        try:
            await self.send(json.dumps({
                'type': 'employee_data',
                'employee': employee_data
            }))
        except ConnectionClosedError:
            print("WebSocket connection closed before data could be sent.")
            raise StopConsumer()

    async def request_employee_location(self, employee_id):
        """Request employee to send their current location."""
        try:
            # Send a message to the employee's WebSocket to request current location
            await self.channel_layer.group_send(
                f"employee_{employee_id}",
                {
                    'type': 'request_location',
                    'requested_by': str(self.manager.id),
                    'timestamp': timezone.now().isoformat()
                }
            )
            
            # Also notify all managers about this location request
            await self.channel_layer.group_send(
                'all_managers',
                {
                    'type': 'location_request',
                    'employee_id': employee_id,
                    'requested_by': str(self.manager.id),
                    'timestamp': timezone.now().isoformat()
                }
            )
            
            # Also notify superusers
            await self.channel_layer.group_send(
                'superusers',
                {
                    'type': 'location_request',
                    'employee_id': employee_id,
                    'requested_by': str(self.manager.id),
                    'timestamp': timezone.now().isoformat()
                }
            )
            
            print(f"Requested location from employee {employee_id} and notified all managers/superusers")
        except Exception as e:
            print(f"Error requesting location from employee {employee_id}: {e}")

    @database_sync_to_async
    def get_specific_employee_data(self, employee_id):
        """Get specific employee data - now accessible for ALL employees."""
        try:
            # Get ANY employee (no more area restrictions)
            employee = Employee.objects.get(id=employee_id)
            
            # Get recent location history
            recent_locations = LocationPing.objects.filter(
                employee=employee,
                timestamp__gte=timezone.now() - timedelta(hours=24)
            ).order_by('-timestamp')[:50]
            
            return {
                'id': str(employee.id),
                'name': employee.name,
                'status': employee.status,
                'is_online': employee.is_online,
                'last_seen': employee.last_seen.isoformat() if employee.last_seen else None,
                'email': employee.email,
                'recent_locations': [
                    {
                        'id': str(loc.id),
                        'latitude': loc.point.y,
                        'longitude': loc.point.x,
                        'timestamp': loc.timestamp.isoformat(),
                        'accuracy': loc.accuracy,
                        'speed': loc.speed,
                        'heading': loc.heading
                    }
                    for loc in recent_locations
                ]
            }
        except Employee.DoesNotExist:
            return None

    async def send_error(self, message):
        """Send error message to client."""
        try:
            await self.send(json.dumps({
                'type': 'error',
                'message': message,
                'timestamp': timezone.now().isoformat()
            }))
        except ConnectionClosedError:
            print("WebSocket connection closed before data could be sent.")
            raise StopConsumer()

    async def location_update(self, event):
        """Handle location update event."""
        try:
            await self.send(json.dumps({
                'type': 'location_update',
                'employee_id': event['employee_id'],
                'employee_name': event['employee_name'],
                'location': event['location']
            }))
        except ConnectionClosedError:
            print("WebSocket connection closed before data could be sent.")
            raise StopConsumer()

    async def status_update(self, event):
        """Handle status update event."""
        try:
            await self.send(json.dumps({
                'type': 'status_update',
                'employee_id': event['employee_id'],
                'employee_name': event['employee_name'],
                'status': event['status']
            }))
        except ConnectionClosedError:
            print("WebSocket connection closed before data could be sent.")
            raise StopConsumer()

    async def area_update(self, event):
        """Handle area update event."""
        try:
            await self.send(json.dumps({
                'type': 'area_update',
                'area_id': event['area_id'],
                'data': event['data']
            }))
        except ConnectionClosedError:
            print("WebSocket connection closed before data could be sent.")
            raise StopConsumer()

    async def location_request(self, event):
        """Handle location request event."""
        try:
            await self.send(json.dumps({
                'type': 'location_request',
                'employee_id': event['employee_id'],
                'requested_by': event['requested_by'],
                'timestamp': event['timestamp']
            }))
        except ConnectionClosedError:
            print("WebSocket connection closed before data could be sent.")
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
                # Server confirmed connection alive → touch session
                try:
                    await touch_work_session_async(self.work_session_id)
                except Exception:
                    pass
        except asyncio.CancelledError:
            # Task was cancelled, exit gracefully
            pass
        except Exception as e:
            print(f"Error in periodic ping: {e}")

    def cleanup_stale_online_statuses(self):
        """Clean up stale online statuses for users not seen in the last 30 minutes."""
        try:
            cutoff_time = timezone.now() - timedelta(minutes=30)
            
            # Mark stale employees as offline
            stale_employees = Employee.objects.filter(
                is_online=True,
                last_seen__lt=cutoff_time
            )
            if stale_employees.exists():
                stale_employees.update(is_online=False)
                print(f"Marked {stale_employees.count()} stale employees as offline")
            
            # Mark stale managers as offline
            stale_managers = Manager.objects.filter(
                is_online=True,
                last_seen__lt=cutoff_time
            )
            if stale_managers.exists():
                stale_managers.update(is_online=False)
                print(f"Marked {stale_managers.count()} stale managers as offline")
                
        except Exception as e:
            print(f"Error cleaning up stale online statuses: {e}")


class SuperUserConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for superusers.
    
    Provides real-time updates for superusers including:
    - All employee locations
    - All status changes
    - All area updates
    """
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.user = None
        self.room_group_name = None
        self.ping_task = None
        self.connection_id = None
        self.work_session_id = None
        self._manager_obj = None

    async def connect(self):
        """Handle WebSocket connection."""
        self.user = self.scope.get('user')

        if not self.user or not getattr(self.user, 'is_authenticated', True):
            await self.close(code=4001)
            return

        # Check if user is a superuser
        if not self.user.is_superuser:
            await self.close(code=4003)  # Forbidden - not a superuser
            return

        # Resolve the Manager row (superusers live in the Manager table via User.manager)
        self._manager_obj = await self._get_user_manager()

        # Join the superusers group
        self.room_group_name = "superusers"

        # Join the room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        # Generate unique connection ID
        self.connection_id = f"{self.user.id}_{int(timezone.now().timestamp() * 1000)}"

        # Open WorkSession for this superuser's manager record (guarded)
        if self._manager_obj is not None:
            try:
                self.work_session_id = await open_work_session_async('manager', self._manager_obj)
            except Exception as e:
                print(f"[WorkSession] superuser open failed for manager {getattr(self._manager_obj, 'id', None)}: {e}")
        else:
            print(f"[WorkSession] superuser user={self.user.id} has no Manager row — skipping session tracking")

        # Accept the connection
        await self.accept()

        # Send initial superuser dashboard data
        await self.send_superuser_dashboard_data()

        # Start periodic ping to keep connection alive
        self.ping_task = asyncio.create_task(self.periodic_ping())

    @database_sync_to_async
    def _get_user_manager(self):
        try:
            return self.user.manager
        except Exception:
            return None

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        # Cancel ping task if running
        if self.ping_task and not self.ping_task.done():
            self.ping_task.cancel()
            try:
                await self.ping_task
            except asyncio.CancelledError:
                pass

        # Close WorkSession (guarded)
        try:
            await close_work_session_async(self.work_session_id)
        except Exception as e:
            print(f"[WorkSession] superuser close failed: {e}")

        if self.room_group_name:
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

    async def receive(self, text_data):
        """Handle incoming WebSocket messages."""
        # Any client message = activity
        try:
            await touch_work_session_async(self.work_session_id)
        except Exception:
            pass
        try:
            data = json.loads(text_data)
            message_type = data.get('type')

            if message_type == 'get_all_employees':
                await self.handle_get_all_employees(data)
            elif message_type == 'get_all_areas':
                await self.handle_get_all_areas(data)
            else:
                await self.send_error(f"Unknown message type: {message_type}")
                
        except json.JSONDecodeError:
            await self.send_error("Invalid JSON format")
        except Exception as e:
            await self.send_error(f"Error processing message: {str(e)}")

    async def send_superuser_dashboard_data(self):
        """Send initial superuser dashboard data."""
        dashboard_data = await self.get_superuser_dashboard_data()
        try:
            await self.send(json.dumps({
                'type': 'superuser_dashboard_data',
                'data': dashboard_data,
                'timestamp': timezone.now().isoformat()
            }))
        except ConnectionClosedError:
            print("WebSocket connection closed before data could be sent.")
            raise StopConsumer()

    @database_sync_to_async
    def get_superuser_dashboard_data(self):
        """Get superuser dashboard data - shows ALL system data."""
        
        # Get ALL employees in the system
        all_employees = Employee.objects.all()
        
        # Get ALL areas in the system
        all_areas = Area.objects.all()
        
        # Get recent location pings for ALL employees
        recent_locations = LocationPing.objects.filter(
            employee__isnull=False,
            timestamp__gte=timezone.now() - timedelta(hours=1)
        ).select_related('employee')
        
        # Get ALL managers
        all_managers = Manager.objects.all()
        
        areas_data = []
        for area in all_areas:
            # Count employees directly assigned to the area
            employee_count = area.employees.count()
            
            areas_data.append({
                'id': str(area.id),
                'name': area.name,
                'status': area.status,
                'color': area.color,
                'employee_count': employee_count,
                'created_by': str(area.created_by.id) if area.created_by else None,
                'manager': str(area.manager.id) if area.manager else None
            })
        
        return {
            'employees': [
                {
                    'id': str(emp.id),
                    'name': emp.name,
                    'status': emp.status,
                    'is_online': emp.is_online,
                    'last_seen': emp.last_seen.isoformat() if emp.last_seen else None,
                    'email': emp.email
                }
                for emp in all_employees
            ],
            'managers': [
                {
                    'id': str(mgr.id),
                    'name': mgr.name,
                    'status': mgr.status,
                    'is_online': mgr.is_online,
                    'last_seen': mgr.last_seen.isoformat() if mgr.last_seen else None,
                    'email': mgr.email
                }
                for mgr in all_managers
            ],
            'areas': areas_data,
            'recent_locations': [
                {
                    'id': str(loc.id),
                    'employee_id': str(loc.employee.id),
                    'employee_name': loc.employee.name,
                    'latitude': loc.point.y,
                    'longitude': loc.point.x,
                    'timestamp': loc.timestamp.isoformat(),
                    'accuracy': loc.accuracy
                }
                for loc in recent_locations
            ]
        }

    async def handle_get_all_employees(self, data):
        """Handle request for all employees data."""
        employees_data = await self.get_all_employees_data()
        try:
            await self.send(json.dumps({
                'type': 'all_employees_data',
                'employees': employees_data
            }))
        except ConnectionClosedError:
            print("WebSocket connection closed before data could be sent.")
            raise StopConsumer()

    @database_sync_to_async
    def get_all_employees_data(self):
        """Get ALL employees data for superuser."""
        all_employees = Employee.objects.all()
        return [
            {
                'id': str(emp.id),
                'name': emp.name,
                'status': emp.status,
                'is_online': emp.is_online,
                'last_seen': emp.last_seen.isoformat() if emp.last_seen else None,
                'email': emp.email
            }
            for emp in all_employees
        ]

    async def handle_get_all_areas(self, data):
        """Handle request for all areas data."""
        areas_data = await self.get_all_areas_data()
        try:
            await self.send(json.dumps({
                'type': 'all_areas_data',
                'areas': areas_data
            }))
        except ConnectionClosedError:
            print("WebSocket connection closed before data could be sent.")
            raise StopConsumer()

    @database_sync_to_async
    def get_all_areas_data(self):
        """Get ALL areas data for superuser."""
        all_areas = Area.objects.all()
        areas_data = []
        
        for area in all_areas:
            # Count employees directly assigned to the area
            employee_count = area.employees.count()
            
            areas_data.append({
                'id': str(area.id),
                'name': area.name,
                'status': area.status,
                'color': area.color,
                'employee_count': employee_count,
                'created_at': area.created_at.isoformat(),
                'created_by': str(area.created_by.id) if area.created_by else None,
                'manager': str(area.manager.id) if area.manager else None
            })
        
        return areas_data

    async def send_error(self, message):
        """Send error message to client."""
        try:
            await self.send(json.dumps({
                'type': 'error',
                'message': message,
                'timestamp': timezone.now().isoformat()
            }))
        except ConnectionClosedError:
            print("WebSocket connection closed before data could be sent.")
            raise StopConsumer()

    async def location_update(self, event):
        """Handle location update event."""
        try:
            await self.send(json.dumps({
                'type': 'location_update',
                'employee_id': event['employee_id'],
                'employee_name': event['employee_name'],
                'location': event['location']
            }))
        except ConnectionClosedError:
            print("WebSocket connection closed before data could be sent.")
            raise StopConsumer()

    async def status_update(self, event):
        """Handle status update event."""
        try:
            await self.send(json.dumps({
                'type': 'status_update',
                'employee_id': event['employee_id'],
                'employee_name': event['employee_name'],
                'status': event['status']
            }))
        except ConnectionClosedError:
            print("WebSocket connection closed before data could be sent.")
            raise StopConsumer()

    async def area_update(self, event):
        """Handle area update event."""
        try:
            await self.send(json.dumps({
                'type': 'area_update',
                'area_id': event['area_id'],
                'data': event['data']
            }))
        except ConnectionClosedError:
            print("WebSocket connection closed before data could be sent.")
            raise StopConsumer()

    async def location_request(self, event):
        """Handle location request event."""
        try:
            await self.send(json.dumps({
                'type': 'location_request',
                'employee_id': event['employee_id'],
                'requested_by': event['requested_by'],
                'timestamp': event['timestamp']
            }))
        except ConnectionClosedError:
            print("WebSocket connection closed before data could be sent.")
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
                try:
                    await touch_work_session_async(self.work_session_id)
                except Exception:
                    pass
        except asyncio.CancelledError:
            # Task was cancelled, exit gracefully
            pass
        except Exception as e:
            print(f"Error in periodic ping: {e}")