"""
Models for the apartments app.

The Apartment model represents individual units within a Building.
It tracks which apartments exist and their visit status.

Hierarchy: Building (parent) → Apartment (child) → Address (visit log)
"""
import uuid
from django.db import models

from addresses.models import NEI_SUBCATEGORY_CHOICES


class Apartment(models.Model):
    """
    Catalogue of apartments for each building.
    Tracks which apartments exist and their visit status.
    
    This model serves as a persistent catalogue of all apartments in a building,
    allowing the system to track which apartments have been visited and which
    remain unvisited, without requiring repeated external API calls.
    """
    STATUS_CHOICES = [
        ('ja', 'Ja'),
        ('nei', 'Nei'),
        ('ikke_hjemme', 'Ikke hjemme'),
        ('folg_opp', 'Følg opp'),
    ]
    
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    
    # ========================================
    # NEW: Link to parent Building
    # ========================================
    building = models.ForeignKey(
        'buildings.Building',
        on_delete=models.CASCADE,
        related_name='apartments',
        null=True,  # Nullable for migration - will be required after backfill
        blank=True,
        help_text="Building this apartment belongs to"
    )
    
    # DEPRECATED: Will be removed after migration
    # Kept temporarily for data migration
    base_address = models.TextField(
        null=True,
        blank=True,
        help_text="DEPRECATED - Use building.base_address instead"
    )
    
    # Apartment identification
    apartment_number = models.CharField(
        max_length=50,
        help_text="Apartment/unit number, e.g. '1', '2A', 'H0102'"
    )
    
    # Visit status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        null=True,
        blank=True,
        help_text="NULL if never visited, otherwise matches address status"
    )
    nei_subcategory = models.CharField(
        max_length=40,
        choices=NEI_SUBCATEGORY_CHOICES,
        null=True,
        blank=True,
        help_text="When status is nei: mirrored from visit; kept after address unlink",
    )
    
    # Link to address record (when visited)
    address = models.ForeignKey(
        'addresses.Address',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='apartment_record',
        help_text="Address record created when this apartment was visited"
    )
    
    # DEPRECATED: Will use building.campaign after migration
    campaign = models.ForeignKey(
        'campaigns.Campaign',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='apartments',
        help_text="DEPRECATED - Use building.campaign instead"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'apartment'
        verbose_name = 'Apartment'
        verbose_name_plural = 'Apartments'
        
        # UPDATED: Unique per building (not base_address)
        # This allows same address to exist in multiple campaigns
        # Each building has its own set of apartments
        unique_together = [('building', 'apartment_number')]
        
        # Indexes for performance
        indexes = [
            models.Index(fields=['base_address'], name='idx_apt_base_addr'),
            models.Index(fields=['campaign', 'base_address'], name='idx_apt_campaign_base'),
            models.Index(fields=['status'], name='idx_apt_status'),
            models.Index(fields=['building'], name='idx_apt_building'),  # NEW
        ]
        
        # Default ordering
        ordering = ['base_address', 'apartment_number']
    
    def __str__(self):
        """String representation showing visit status and apartment info."""
        visited = "✓" if self.status else "○"
        # Use building.base_address if available, fallback to base_address
        address = self.building.base_address if self.building else self.base_address
        return f"{visited} {address}, {self.apartment_number}"
    
    def save(self, *args, **kwargs):
        """
        Override save to normalize apartment number before saving.
        Ensures consistency in apartment number format.
        
        NOTE: Building counts are NOT updated here!
        Building counts should be updated explicitly by:
        - apartments/views.py (after bulk_create)
        - apartments/views.py (when status changes via PATCH)
        - apartments/signals.py (when Address is created/deleted)
        
        This prevents 100 COUNT(*) queries during bulk-create.
        """
        if self.apartment_number:
            self.apartment_number = self.normalize_apartment_number(
                self.apartment_number
            )
        super().save(*args, **kwargs)
    
    @staticmethod
    def normalize_apartment_number(number):
        """
        Normalize apartment numbers for consistency.
        
        Normalization rules:
        - Remove spaces and hyphens
        - Convert to uppercase
        - Remove leading zeros (except if only zeros)
        
        Examples:
          "01" → "1"
          "2a" → "2A"
          "H-0102" → "H0102"
          " 3 B " → "3B"
          "000" → "0"
        
        Args:
            number (str): The apartment number to normalize
            
        Returns:
            str: Normalized apartment number
        """
        if not number:
            return number
        
        # Remove spaces and hyphens
        normalized = str(number).strip().replace(' ', '').replace('-', '')
        
        # Uppercase
        normalized = normalized.upper()
        
        # Remove leading zeros (but keep if only zeros)
        normalized = normalized.lstrip('0') or '0'
        
        return normalized
    
    @property
    def is_visited(self):
        """Check if this apartment has been visited."""
        return self.status is not None
    
    @property
    def visit_info(self):
        """Get formatted visit information."""
        if self.is_visited:
            return {
                'visited': True,
                'status': self.status,
                'nei_subcategory': self.nei_subcategory,
                'address_id': str(self.address_id) if self.address_id else None,
                'visited_at': self.updated_at.isoformat() if self.updated_at else None
            }
        return {
            'visited': False,
            'status': None,
            'nei_subcategory': None,
            'address_id': None,
            'visited_at': None
        }
    
    @property
    def effective_base_address(self):
        """Get the base address from building or fallback to deprecated field."""
        if self.building:
            return self.building.base_address
        return self.base_address
    
    @property
    def effective_campaign(self):
        """Get the campaign from building or fallback to deprecated field."""
        if self.building:
            return self.building.campaign
        return self.campaign

    def find_local_apartments_match(self):
        """
        Find matching local_apartments record for this apartment.
        
        Returns:
            dict with matching local_apartments data or None if not found
        """
        if not self.building:
            return None
        
        from .local_apartments_matcher import find_local_apartments_for_building
        
        matches = find_local_apartments_for_building(
            self.building.base_address,
            self.building.position,
            [self.apartment_number]
        )
        
        # Find the best match for this specific apartment
        for match in matches:
            if match.get('matches_apartment'):
                return match
        
        # Return best match even if unit doesn't match exactly
        return matches[0] if matches else None