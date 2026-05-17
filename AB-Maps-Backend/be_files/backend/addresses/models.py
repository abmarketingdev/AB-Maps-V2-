"""
Models for the addresses app.

The Address model represents a visit log entry. It records when a user
visits an address and what the outcome was.

Hierarchy: Building (parent) → Apartment (child) → Address (visit log)

Key Field: building - If set, this address is part of a building and should
NOT appear as a standalone marker in the MVT layer (the "Ghost Buster").
"""
import uuid
from django.db import models
from django.contrib.gis.db import models as gis_models
from model_utils import FieldTracker


# Sub-reasons when status is "nei" (API values + Norwegian labels)
NEI_SUBCATEGORY_CHOICES = [
    ('ikke_interessert', 'Ikke interessert'),
    ('darlig_erfaring', 'Dårlig erfaring'),
    ('bindingstid', 'Bindingstid'),
    ('bedrift', 'Bedrift'),
    ('pris', 'Pris'),
    ('eksisterende_kunde', 'Eksisterende kunde'),
]


class Address(models.Model):
    """
    Merged Address model for AB Maps.
    
    Represents a visit to an address. If the address is part of a building
    (has an apartment number), it will be linked to a Building via the
    building FK, preventing duplicate markers on the map.
    """
    STATUS_CHOICES = [
        ('ja', 'Ja'),
        ('ikke_hjemme', 'Ikke hjemme'),
        ('nei', 'Nei'),
        ('folg_opp', 'Følg opp'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    address_text = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ja')
    nei_subcategory = models.CharField(
        max_length=40,
        choices=NEI_SUBCATEGORY_CHOICES,
        null=True,
        blank=True,
        help_text='When status is nei: reason for decline (optional)',
    )
    position = gis_models.PointField(srid=4326, null=True, blank=True)
    tags = models.JSONField(default=dict, blank=True)
    recorded_at = models.DateTimeField(auto_now_add=True)
    
    # ========================================
    # NEW: Link to Building (The "Ghost Buster")
    # ========================================
    # If set, this address belongs to a building and should NOT
    # appear as a standalone marker in the MVT layer.
    # This prevents duplicate markers when addresses are part of buildings.
    building = models.ForeignKey(
        'buildings.Building',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_index=True,
        related_name='addresses',
        help_text="If set, this address is part of a building (not a standalone house)"
    )
    
    campaign = models.ForeignKey(
        'campaigns.Campaign',
        on_delete=models.CASCADE,
        related_name='addresses',
        null=True,
        blank=True,
        help_text="Campaign this address belongs to"
    )
    employee = models.ForeignKey(
        'users.Employee',
        on_delete=models.CASCADE,
        related_name='addresses',
        null=True,
        blank=True,
        help_text="Employee who created the address"
    )
    manager = models.ForeignKey(
        'users.Manager',
        on_delete=models.CASCADE,
        related_name='addresses',
        null=True,
        blank=True,
        help_text="Manager who created the address"
    )
    notes = models.TextField(
        blank=True,
        null=True,
        max_length=2000,
        help_text="User notes about this address (e.g., visit details, follow-up actions)"
    )

    class Meta:
        db_table = 'address'
        verbose_name = 'Address'
        verbose_name_plural = 'Addresses'
        
        indexes = [
            models.Index(fields=['building'], name='idx_addr_building'),
        ]

    def __str__(self):
        return f"{self.address_text} - {self.status}"
    
    # Field tracker to detect changes
    tracker = FieldTracker(fields=['status'])
    
    @property
    def is_building_address(self):
        """Check if this address is part of a building."""
        return self.building_id is not None
    
    @property
    def is_standalone_house(self):
        """Check if this address is a standalone house (not part of a building)."""
        return self.building_id is None
