"""
Models for polygon_operations app.
"""
from django.contrib.gis.db import models as gis_models
from django.db import models


class CacheMapSearch(models.Model):
    """
    Unmanaged model for cache_map_search materialized view.
    
    This view aggregates local_apartments by address_uuid and calculates:
    - unit_count: Number of units (apartments) per building
    - If unit_count = 0: Single family home (house)
    - If unit_count > 0: Apartment building
    
    Note: This is an unmanaged model. The actual view should be created via SQL:
    
    CREATE MATERIALIZED VIEW cache_map_search AS
    SELECT
        COALESCE(address_uuid, 'coord_' || ROUND(ST_X(position)::numeric, 6) || '_' || ROUND(ST_Y(position)::numeric, 6)) AS address_uuid,
        MIN(full_address) AS full_address,
        MAX(postcode) AS postcode,
        MAX(post_area) AS city,
        ST_Centroid(ST_Collect(position)) AS geom,
        jsonb_agg(
            jsonb_build_object(
                'unit_id', unit_id,
                'unit_uuid', unit_uuid,
                'full_address', full_address
            ) ORDER BY unit_id
        ) FILTER (WHERE unit_id IS NOT NULL) AS units,
        COUNT(unit_id) FILTER (WHERE unit_id IS NOT NULL) AS unit_count
    FROM local_apartments
    GROUP BY COALESCE(address_uuid, 'coord_' || ROUND(ST_X(position)::numeric, 6) || '_' || ROUND(ST_Y(position)::numeric, 6));
    """
    
    class Meta:
        managed = False  # This is a materialized view, not a real table
        db_table = 'cache_map_search'
    
    # Primary key: address_uuid (or generated coordinate key)
    address_uuid = models.CharField(
        max_length=255,
        primary_key=True,
        help_text="Address UUID or generated coordinate key"
    )
    
    full_address = models.TextField(
        help_text="Full address string"
    )
    
    postcode = models.CharField(
        max_length=10,
        null=True,
        blank=True,
        help_text="Postal code"
    )
    
    city = models.TextField(
        null=True,
        blank=True,
        help_text="City/post area name"
    )
    
    geom = gis_models.PointField(
        srid=4326,
        help_text="Centroid point of the building"
    )
    
    units = models.JSONField(
        default=list,
        null=True,
        blank=True,
        help_text="Array of unit objects (only for apartment buildings)"
    )
    
    unit_count = models.IntegerField(
        default=0,
        help_text="Number of units. 0 = house, >0 = apartment building"
    )
