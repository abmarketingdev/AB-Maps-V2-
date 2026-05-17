"""
Models for the uploaded_addresses app.
"""
import uuid
from django.db import models
from django.contrib.gis.db import models as gis_models
from django.contrib.gis.geos import Point
from django.utils import timezone


class UploadedAddress(models.Model):
    """Model for storing uploaded addresses from CSV files."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    manager = models.ForeignKey(
        'users.Manager',
        on_delete=models.CASCADE,
        related_name='uploaded_addresses',
        help_text="Manager who uploaded this address"
    )
    campaign = models.ForeignKey(
        'campaigns.Campaign',
        on_delete=models.CASCADE,
        related_name='uploaded_addresses',
        help_text="Campaign this address belongs to"
    )
    address_text = models.CharField(
        max_length=255,
        help_text="Full address from CSV"
    )
    latitude = models.FloatField(
        null=True,
        blank=True,
        default=None,
        help_text="Geocoded latitude"
    )
    longitude = models.FloatField(
        null=True,
        blank=True,
        default=None,
        help_text="Geocoded longitude"
    )
    geom = gis_models.PointField(
        srid=4326,
        null=True,
        blank=True,
        help_text="Geocoded point geometry (from longitude/latitude)",
    )
    added_at = models.DateTimeField(
        auto_now_add=True,
        help_text="When the address was uploaded"
    )
    geocoded_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the address was successfully geocoded"
    )
    upload_batch_id = models.UUIDField(
        null=True,
        blank=True,
        help_text="Groups addresses from same upload batch"
    )
    batch_sequence = models.IntegerField(
        null=True,
        blank=True,
        help_text="Order within the batch (1, 2, 3...)"
    )
    batch_total = models.IntegerField(
        null=True,
        blank=True,
        help_text="Total addresses in this batch"
    )

    class Meta:
        db_table = 'uploaded_address'
        verbose_name = 'Uploaded Address'
        verbose_name_plural = 'Uploaded Addresses'
        indexes = [
            models.Index(fields=['campaign', 'manager']),
            models.Index(fields=['latitude', 'longitude']),
            models.Index(fields=['geocoded_at']),
            models.Index(fields=['upload_batch_id', 'batch_sequence'], name='upload_batch_idx'),
        ]

    def __str__(self):
        return f"{self.address_text} - {self.campaign.name}"

    @property
    def is_geocoded(self):
        """Check if the address has been successfully geocoded."""
        return self.latitude is not None and self.longitude is not None

    @property
    def coordinates(self):
        """Return coordinates as a tuple if geocoded."""
        if self.is_geocoded:
            return (self.latitude, self.longitude)
        return None

    def save(self, *args, **kwargs):
        """
        Keep geom in sync with longitude/latitude.
        """
        if self.longitude is not None and self.latitude is not None:
            self.geom = Point(self.longitude, self.latitude, srid=4326)
        else:
            self.geom = None
        super().save(*args, **kwargs)


class BatchStatus(models.Model):
    """
    Tracks the status of upload batches for cancellation support.
    Allows background processing to check if a batch has been cancelled.
    """
    BATCH_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
        ('failed', 'Failed'),
    ]
    
    batch_id = models.UUIDField(
        primary_key=True,
        help_text="Unique batch identifier"
    )
    manager = models.ForeignKey(
        'users.Manager',
        on_delete=models.CASCADE,
        related_name='batch_statuses',
        help_text="Manager who created this batch"
    )
    campaign = models.ForeignKey(
        'campaigns.Campaign',
        on_delete=models.CASCADE,
        related_name='batch_statuses',
        help_text="Campaign this batch belongs to"
    )
    status = models.CharField(
        max_length=20,
        choices=BATCH_STATUS_CHOICES,
        default='pending',
        help_text="Current status of the batch"
    )
    total_addresses = models.IntegerField(
        default=0,
        help_text="Total number of addresses in this batch"
    )
    processed_addresses = models.IntegerField(
        default=0,
        help_text="Number of addresses processed so far"
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="When the batch was created"
    )
    cancelled_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the batch was cancelled"
    )
    cancelled_by = models.ForeignKey(
        'users.Manager',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='cancelled_batches',
        help_text="Manager who cancelled this batch"
    )
    
    class Meta:
        db_table = 'batch_status'
        verbose_name = 'Batch Status'
        verbose_name_plural = 'Batch Statuses'
        indexes = [
            models.Index(fields=['batch_id', 'status']),
            models.Index(fields=['manager', 'status']),
            models.Index(fields=['campaign', 'status']),
        ]
    
    def __str__(self):
        return f"Batch {self.batch_id} - {self.status}"
    
    @property
    def progress_percentage(self):
        """Calculate progress percentage."""
        if self.total_addresses > 0:
            return round((self.processed_addresses / self.total_addresses) * 100, 2)
        return 0
    
    @property
    def is_cancelled(self):
        """Check if batch is cancelled."""
        return self.status == 'cancelled'
    
    @property
    def can_be_cancelled(self):
        """Check if batch can be cancelled (not already completed or cancelled)."""
        return self.status in ['pending', 'processing']
