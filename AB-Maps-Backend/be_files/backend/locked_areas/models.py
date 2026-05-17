"""
Models for the locked_areas app.
"""
import uuid
from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class AreaType(models.TextChoices):
    """Choices for area types."""
    FYLKE = 'fylke', 'Fylke (County)'
    KOMMUNE = 'kommune', 'Kommune (Municipality)'
    GRUNNKRETS = 'grunnkrets', 'Grunnkrets (Basic District)'


class LockedArea(models.Model):
    """Model for locked administrative areas in campaigns."""
    
    # Primary key
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Campaign relationship
    campaign = models.ForeignKey(
        'campaigns.Campaign', 
        on_delete=models.CASCADE,
        related_name='locked_areas',
        db_column='campaign_id'
    )
    
    # Area identification
    area_key = models.CharField(
        max_length=50, 
        help_text="e.g., 'fylke:03', 'kommune:0301', 'grunnkrets:03010101'"
    )
    area_type = models.CharField(
        max_length=20, 
        choices=AreaType.choices,
        help_text="Administrative level"
    )
    area_code = models.CharField(
        max_length=10,
        help_text="Administrative code (2, 4, or 8 digits)"
    )
    area_name = models.CharField(
        max_length=255,
        help_text="Administrative area name"
    )
    
    # Hierarchical relationships for efficient queries
    county_code = models.CharField(
        max_length=2, 
        blank=True, 
        null=True,
        help_text="County code for hierarchical queries"
    )
    municipality_code = models.CharField(
        max_length=4, 
        blank=True, 
        null=True,
        help_text="Municipality code for hierarchical queries"
    )
    
    # Locking information
    locked_at = models.DateTimeField(auto_now_add=True)
    locked_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True,
        related_name='locked_areas',
        db_column='locked_by_id'
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Soft delete flag - false means unlocked"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # SSB Age Statistics (only used for fylke and kommune)
    mean_age = models.DecimalField(
        max_digits=5,
        decimal_places=1,
        null=True,
        blank=True,
        help_text="Average age for the area from SSB (only for fylke/kommune)"
    )
    median_age = models.DecimalField(
        max_digits=5,
        decimal_places=1,
        null=True,
        blank=True,
        help_text="Median age for the area from SSB (only for fylke/kommune)"
    )
    stats_year = models.IntegerField(
        null=True,
        blank=True,
        help_text="Year the statistics are from (e.g., 2025)"
    )
    stats_updated_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the stats were last fetched/updated from SSB"
    )

    class Meta:
        db_table = 'locked_areas'
        unique_together = ['campaign', 'area_key']
        indexes = [
            models.Index(fields=['campaign', 'area_type']),
            models.Index(fields=['county_code']),
            models.Index(fields=['municipality_code']),
            models.Index(fields=['is_active']),
            models.Index(fields=['area_key']),
        ]
        verbose_name = 'Locked Area'
        verbose_name_plural = 'Locked Areas'

    def __str__(self):
        return f"{self.area_name} ({self.area_type}) - Campaign {self.campaign.name}"

    @property
    def area_level(self):
        """Return human-readable area level."""
        return dict(AreaType.choices)[self.area_type]

    def get_children_areas(self):
        """Get child areas if this is a county or municipality."""
        if self.area_type == AreaType.FYLKE:
            return LockedArea.objects.filter(
                campaign=self.campaign,
                county_code=self.area_code,
                is_active=True
            )
        elif self.area_type == AreaType.KOMMUNE:
            return LockedArea.objects.filter(
                campaign=self.campaign,
                municipality_code=self.area_code,
                is_active=True
            )
        return LockedArea.objects.none()

    def get_parent_areas(self):
        """Get parent areas if this is a municipality or grunnkrets."""
        if self.area_type == AreaType.KOMMUNE:
            return LockedArea.objects.filter(
                campaign=self.campaign,
                area_code=self.county_code,
                area_type=AreaType.FYLKE,
                is_active=True
            )
        elif self.area_type == AreaType.GRUNNKRETS:
            return LockedArea.objects.filter(
                campaign=self.campaign,
                area_code=self.municipality_code,
                area_type=AreaType.KOMMUNE,
                is_active=True
            )
        return LockedArea.objects.none()

    @classmethod
    def get_available_areas(cls, campaign_id, level=None, county_code=None, municipality_code=None):
        """
        Get available areas from admin.areas that are not locked for the campaign.
        
        Args:
            campaign_id: Campaign ID to check for locked areas
            level: Filter by area level (fylke, kommune, grunnkrets)
            county_code: Filter by county code
            municipality_code: Filter by municipality code
            
        Returns:
            QuerySet of available areas
        """
        from django.db import connection
        
        with connection.cursor() as cursor:
            query = """
                SELECT a.*, 
                       CASE WHEN la.id IS NOT NULL THEN true ELSE false END as is_locked
                FROM admin.areas a
                LEFT JOIN locked_areas la ON a.area_key = la.area_key 
                    AND la.campaign_id = %s AND la.is_active = true
                WHERE 1=1
            """
            params = [campaign_id]
            
            if level:
                query += " AND a.level = %s"
                params.append(level)
            
            if county_code:
                query += " AND a.parent_parent_code = %s"
                params.append(county_code)
            
            if municipality_code:
                query += " AND a.parent_code = %s"
                params.append(municipality_code)
            
            query += " ORDER BY a.level, a.name"
            
            cursor.execute(query, params)
            columns = [col[0] for col in cursor.description]
            return [dict(zip(columns, row)) for row in cursor.fetchall()]

    @classmethod
    def bulk_lock_areas(cls, campaign, area_keys, user):
        """
        Bulk lock multiple areas for a campaign.
        
        Args:
            campaign: Campaign instance
            area_keys: List of area keys to lock
            user: User who is locking the areas
            
        Returns:
            List of created LockedArea instances
        """
        from django.db import connection
        
        # Get area details from admin.areas
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT area_key, level, code, name, parent_code, parent_parent_code
                FROM admin.areas 
                WHERE area_key = ANY(%s)
            """, [area_keys])
            area_data = cursor.fetchall()
        
        locked_areas = []
        for area_key, level, code, name, parent_code, parent_parent_code in area_data:
            # Check if already locked (active)
            existing_active = cls.objects.filter(
                campaign=campaign,
                area_key=area_key,
                is_active=True
            ).first()
            
            if existing_active:
                continue  # Already locked, skip
            
            # Check if there's an inactive record (soft-deleted) and reactivate it
            existing_inactive = cls.objects.filter(
                campaign=campaign,
                area_key=area_key,
                is_active=False
            ).first()
            
            if existing_inactive:
                # Reactivate the existing record
                existing_inactive.is_active = True
                existing_inactive.locked_by = user
                existing_inactive.area_type = level
                existing_inactive.area_code = code
                existing_inactive.area_name = name
                existing_inactive.county_code = parent_parent_code
                existing_inactive.municipality_code = parent_code if level == 'grunnkrets' else code
                existing_inactive.save()
                locked_areas.append(existing_inactive)
            else:
                # Create new lock record
                locked_area = cls.objects.create(
                    campaign=campaign,
                    area_key=area_key,
                    area_type=level,
                    area_code=code,
                    area_name=name,
                    county_code=parent_parent_code,
                    municipality_code=parent_code if level == 'grunnkrets' else code,
                    locked_by=user
                )
                locked_areas.append(locked_area)
        
        return locked_areas

    @classmethod
    def bulk_unlock_areas(cls, campaign, area_keys):
        """
        Bulk unlock multiple areas for a campaign.
        
        Args:
            campaign: Campaign instance
            area_keys: List of area keys to unlock
            
        Returns:
            Number of areas unlocked
        """
        return cls.objects.filter(
            campaign=campaign,
            area_key__in=area_keys,
            is_active=True
        ).update(is_active=False)