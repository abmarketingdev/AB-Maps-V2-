"""
Models for the tracking app - live location tracking functionality.
"""
import uuid
from django.db import models
from django.contrib.gis.db import models as gis_models
from django.utils import timezone


class LocationPing(models.Model):
    """
    Location ping model for tracking employee/device locations in real-time.
    
    This model stores GPS coordinates and metadata for live tracking.
    PointField is used for efficient geospatial queries and PostGIS integration.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    device_id = models.CharField(
        max_length=100,
        help_text="Unique identifier for the device sending location data"
    )
    timestamp = models.DateTimeField(auto_now_add=True)
    point = gis_models.PointField(
        srid=4326,
        help_text="GPS coordinates (latitude, longitude) in WGS84 format"
    )
    accuracy = models.FloatField(
        null=True, 
        blank=True,
        help_text="GPS accuracy in meters (optional)"
    )
    employee = models.ForeignKey(
        'users.Employee',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='location_pings',
        help_text="Associated employee (optional, can be null for anonymous tracking)"
    )
    manager = models.ForeignKey(
        'users.Manager',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='location_pings',
        help_text="Associated manager (optional, can be null for anonymous tracking)"
    )
    speed = models.FloatField(
        null=True,
        blank=True,
        help_text="Speed in meters per second (optional)"
    )
    heading = models.FloatField(
        null=True,
        blank=True,
        help_text="Heading in degrees (0-360, optional)"
    )
    altitude = models.FloatField(
        null=True,
        blank=True,
        help_text="Altitude in meters (optional)"
    )
    battery_level = models.FloatField(
        null=True,
        blank=True,
        help_text="Battery level percentage (optional)"
    )
    is_moving = models.BooleanField(
        default=False,
        help_text="Whether the device is currently moving"
    )

    class Meta:
        db_table = 'location_ping'
        verbose_name = 'Location Ping'
        verbose_name_plural = 'Location Pings'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['device_id', '-timestamp']),
            models.Index(fields=['employee', '-timestamp']),
            models.Index(fields=['manager', '-timestamp']),
            models.Index(fields=['timestamp']),
        ]

    def __str__(self):
        return f"{self.device_id} - {self.timestamp}"


class SyncQueueItem(models.Model):
    """
    Offline sync queue for storing changes when offline.
    
    This model stores JSON data representing changes made offline
    that need to be synchronized when connection is restored.
    """
    id = models.BigAutoField(primary_key=True)
    change = models.JSONField(
        help_text="JSON data representing the offline change"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    synced_at = models.DateTimeField(null=True, blank=True)
    is_synced = models.BooleanField(default=False)
    retry_count = models.IntegerField(default=0)
    max_retries = models.IntegerField(default=3)
    error_message = models.TextField(blank=True)

    class Meta:
        db_table = 'tracking_sync_queue_item'
        verbose_name = 'Tracking Sync Queue Item'
        verbose_name_plural = 'Tracking Sync Queue Items'
        ordering = ['created_at']

    def __str__(self):
        return f"Sync Item {self.id} - {self.created_at}"


class WorkSession(models.Model):
    """
    Working-time session for employees and managers.

    A session opens when an actor's WebSocket connects and closes on disconnect
    (or when the reaper closes it after a heartbeat timeout). Total working
    time for a day = sum of session durations intersecting that day.

    Exactly one of `employee` / `manager` must be set, enforced by CheckConstraint.
    """
    SOURCE_CHOICES = [
        ('websocket', 'WebSocket'),
        ('manual', 'Manual'),
        ('reaper_closed', 'Reaper Closed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(
        'users.Employee',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='work_sessions',
    )
    manager = models.ForeignKey(
        'users.Manager',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='work_sessions',
    )
    started_at = models.DateTimeField(default=timezone.now)
    ended_at = models.DateTimeField(null=True, blank=True)
    last_heartbeat_at = models.DateTimeField(default=timezone.now)
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='websocket')

    class Meta:
        db_table = 'work_session'
        verbose_name = 'Work Session'
        verbose_name_plural = 'Work Sessions'
        constraints = [
            models.CheckConstraint(
                name='work_session_exactly_one_actor',
                check=(
                    models.Q(employee__isnull=False, manager__isnull=True) |
                    models.Q(employee__isnull=True, manager__isnull=False)
                ),
            ),
        ]
        indexes = [
            models.Index(fields=['employee', '-started_at']),
            models.Index(fields=['manager', '-started_at']),
            models.Index(
                fields=['employee'],
                condition=models.Q(ended_at__isnull=True, employee__isnull=False),
                name='ws_emp_open_idx',
            ),
            models.Index(
                fields=['manager'],
                condition=models.Q(ended_at__isnull=True, manager__isnull=False),
                name='ws_mgr_open_idx',
            ),
            models.Index(fields=['last_heartbeat_at']),
        ]

    def actor_kind(self) -> str:
        return 'employee' if self.employee_id else 'manager'

    def actor_id(self):
        return self.employee_id or self.manager_id

    def duration_seconds(self) -> int:
        end = self.ended_at or timezone.now()
        return max(0, int((end - self.started_at).total_seconds()))

    def __str__(self):
        kind = self.actor_kind()
        return f"WorkSession[{kind}={self.actor_id()}] {self.started_at} → {self.ended_at or 'open'}"
