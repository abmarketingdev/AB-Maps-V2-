"""
Models for the buildings app.

The Building model represents a physical building that contains apartments.
It serves as the parent entity for the Apartment model and is the source
of truth for vector tile markers (one marker per building).

Key Innovation: All statistics (total_units, visited_units) are pre-calculated
and stored, making tile queries O(1) instead of O(n).
"""
import uuid
from django.db import models
from django.contrib.gis.db import models as gis_models


class Building(models.Model):
    """
    Represents a physical building that contains apartments.
    
    This is the parent entity for apartments and serves as the
    source of truth for vector tile markers.
    
    The key innovation is that all statistics (total_units, visited_units)
    are pre-calculated and stored, making tile queries O(1) instead of O(n).
    """
    STATUS_CHOICES = [
        ('unvisited', 'Unvisited'),     # Grey marker - no visits yet
        ('in_progress', 'In Progress'), # Yellow marker - some visited
        ('completed', 'Completed'),     # Blue marker - all visited
    ]
    
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    
    # Identification
    base_address = models.CharField(
        max_length=500,
        db_index=True,
        help_text="Base address without apartment number, e.g. 'Hausmanns gate 19A, 0182 Oslo'"
    )
    
    # Geometry - CRITICAL for MVT generation
    position = gis_models.PointField(
        srid=4326,
        help_text="Geographic location of the building (from first address)"
    )
    
    # Campaign context
    campaign = models.ForeignKey(
        'campaigns.Campaign',
        on_delete=models.CASCADE,
        related_name='buildings',
        help_text="Campaign this building belongs to"
    )
    
    # Manager who discovered/created this building
    created_by = models.ForeignKey(
        'users.Manager',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_buildings',
        help_text="Manager who first discovered this building"
    )
    
    # Employee who discovered/created this building (if not a manager)
    created_by_employee = models.ForeignKey(
        'users.Employee',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_buildings',
        help_text="Employee who first discovered this building (if not created by manager)"
    )
    
    # ========================================
    # DENORMALIZED COUNTS (The "Speed Layer")
    # ========================================
    # These are updated reactively via signals
    # whenever apartments are created/updated/deleted
    
    total_units = models.IntegerField(
        default=0,
        help_text="Total number of apartments in this building"
    )
    
    visited_units = models.IntegerField(
        default=0,
        help_text="Number of apartments that have been visited (status not null)"
    )
    
    # Computed status for quick filtering
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='unvisited',
        db_index=True,
        help_text="Computed status: unvisited (grey), in_progress (yellow), completed (blue)"
    )
    
    # Quick boolean flag for completed buildings
    is_completed = models.BooleanField(
        default=False,
        db_index=True,
        help_text="True when all apartments have been visited"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'building'
        verbose_name = 'Building'
        verbose_name_plural = 'Buildings'
        
        # CRITICAL: Unique per campaign
        unique_together = [('base_address', 'campaign')]
        
        # Indexes for performance
        indexes = [
            models.Index(fields=['campaign', 'status'], name='idx_bldg_campaign_status'),
            models.Index(fields=['is_completed'], name='idx_bldg_completed'),
            models.Index(fields=['created_by'], name='idx_bldg_created_by'),
            models.Index(fields=['created_by_employee'], name='idx_bldg_created_by_emp'),
        ]
        
        ordering = ['base_address']
    
    def __str__(self):
        return f"{self.base_address} ({self.visited_units}/{self.total_units})"
    
    def update_counts(self):
        """
        Recalculate and update the denormalized counts.
        Called by signals when apartments change.
        """
        self.total_units = self.apartments.count()
        self.visited_units = self.apartments.filter(status__isnull=False).count()
        
        # Update status based on counts
        if self.total_units == 0:
            self.status = 'unvisited'
            self.is_completed = False
        elif self.visited_units == 0:
            self.status = 'unvisited'
            self.is_completed = False
        elif self.visited_units >= self.total_units:
            self.status = 'completed'
            self.is_completed = True
        else:
            self.status = 'in_progress'
            self.is_completed = False
        
        self.save(update_fields=['total_units', 'visited_units', 'status', 'is_completed', 'updated_at'])
    
    @property
    def progress_percentage(self):
        """Return visit progress as percentage."""
        if self.total_units == 0:
            return 0
        return round((self.visited_units / self.total_units) * 100, 1)
    
    @property
    def remaining_units(self):
        """Return count of unvisited apartments."""
        return max(0, self.total_units - self.visited_units)
