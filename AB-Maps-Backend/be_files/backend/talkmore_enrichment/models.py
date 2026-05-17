"""
Models for the talkmore_enrichment app.
"""
import uuid
from django.db import models
from django.contrib.gis.db import models as gis_models
from django.utils import timezone


class EnrichmentJob(models.Model):
    """Tracks one polygon job (1 area = 1 job_id)."""
    
    STATUS_CHOICES = [
        ('queued', 'Queued'),
        ('discovering', 'Discovering'),
        ('enriching_1881', 'Enriching 1881'),
        ('enriching_carrier', 'Enriching Carrier'),
        ('writing', 'Writing'),
        ('done', 'Done'),
        ('failed', 'Failed'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    area = models.OneToOneField(
        'areas.Area',
        on_delete=models.CASCADE,
        related_name='enrichment_job',  # Changed to singular since it's OneToOne
        help_text="Area associated with this enrichment job (1 area = 1 job)"
    )
    campaign = models.ForeignKey(
        'campaigns.Campaign',
        on_delete=models.CASCADE,
        related_name='enrichment_jobs',
        help_text="Campaign associated with this job"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='queued',
        help_text="Current status of the enrichment job"
    )
    expected_count = models.IntegerField(
        default=0,
        help_text="Total addresses inside polygon"
    )
    done_count = models.IntegerField(
        default=0,
        help_text="Addresses processed (including failed/no_data)"
    )
    success_count = models.IntegerField(
        default=0,
        help_text="Addresses with people+phones AND carrier matches"
    )
    no_data_count = models.IntegerField(
        default=0,
        help_text="Addresses with no 1881 data"
    )
    failed_count = models.IntegerField(
        default=0,
        help_text="Addresses that failed enrichment"
    )
    started_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When discovery started"
    )
    finished_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When job completed"
    )
    last_error = models.TextField(
        null=True,
        blank=True,
        help_text="Last error message if failed"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'talkmore_enrichment_job'
        verbose_name = 'Enrichment Job'
        verbose_name_plural = 'Enrichment Jobs'
        indexes = [
            models.Index(fields=['status'], name='enrichment_job_status_idx'),
        ]

    def __str__(self):
        return f"Job {self.id} - {self.area.name} ({self.status})"


class EnrichedAddressResult(models.Model):
    """Stores per-address final output. This is what frontend consumes."""
    
    STATUS_CHOICES = [
        ('done', 'Done'),
        ('no_data', 'No Data'),
        ('failed', 'Failed'),
    ]
    
    id = models.BigAutoField(primary_key=True)
    job = models.ForeignKey(
        EnrichmentJob,
        on_delete=models.CASCADE,
        related_name='address_results',
        db_column='job_id',
        help_text="Enrichment job this result belongs to"
    )
    address_uuid = models.UUIDField(
        help_text="Stable feature ID from local_apartments.address_uuid"
    )
    geom = gis_models.PointField(
        srid=4326,
        help_text="Copy from local_apartments.position"
    )
    address_text = models.TextField(
        help_text="Full address string"
    )
    municipality_code = models.CharField(
        max_length=20,
        null=True,
        blank=True,
        help_text="Municipality code"
    )
    postcode = models.CharField(
        max_length=10,
        null=True,
        blank=True,
        help_text="Postal code"
    )
    people = models.JSONField(
        default=list,
        help_text="List of {name, phone_e164, carrier} objects"
    )
    carrier_summary = models.JSONField(
        default=dict,
        help_text="Object like {'Talkmore': 1, 'Telenor': 2}"
    )
    show_marker = models.BooleanField(
        default=False,
        help_text="True if any Talkmore/Telenor carrier"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='done',
        help_text="Status of this address enrichment"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'talkmore_enriched_address_result'
        verbose_name = 'Enriched Address Result'
        verbose_name_plural = 'Enriched Address Results'
        constraints = [
            models.UniqueConstraint(
                fields=['job', 'address_uuid'],
                name='unique_job_address'
            )
        ]
        indexes = [
            models.Index(fields=['job', 'show_marker'], name='enriched_result_job_marker_idx'),
            models.Index(fields=['job', 'address_uuid'], name='enriched_result_job_uuid_idx'),
        ]

    def __str__(self):
        return f"{self.address_text} (Job: {self.job.id})"


class PhoneCarrierCache(models.Model):
    """Avoid repeated Data247 calls."""
    
    phone_e164 = models.CharField(
        max_length=20,
        primary_key=True,
        help_text="Normalized E.164 format"
    )
    carrier = models.CharField(
        max_length=100,
        help_text="Carrier name (e.g., 'Talkmore', 'Telenor')"
    )
    source = models.CharField(
        max_length=50,
        default='data247',
        help_text="Source of carrier data"
    )
    updated_at = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Optional TTL for cache invalidation"
    )

    class Meta:
        db_table = 'talkmore_phone_carrier_cache'
        verbose_name = 'Phone Carrier Cache'
        verbose_name_plural = 'Phone Carrier Caches'

    def __str__(self):
        return f"{self.phone_e164} -> {self.carrier}"
