"""
Serializers for polygon_operations app.
"""
from rest_framework import serializers
from .models import CacheMapSearch


class PolygonDeleteRequestSerializer(serializers.Serializer):
    """Serializer for polygon deletion request."""
    polygon = serializers.DictField(
        help_text="GeoJSON Polygon geometry"
    )
    entity_types = serializers.ListField(
        child=serializers.ChoiceField(choices=['addresses', 'uploaded_addresses', 'areas', 'buildings']),
        default=['addresses', 'uploaded_addresses', 'areas', 'buildings'],
        help_text="List of entity types to delete"
    )
    dry_run = serializers.BooleanField(
        default=True,
        help_text="If true, preview only without deleting"
    )
    include_partial_areas = serializers.BooleanField(
        default=False,
        help_text="If true, include areas that partially intersect the polygon"
    )
    
    def validate_polygon(self, value):
        """Validate GeoJSON polygon structure."""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Polygon must be a dictionary")
        
        if value.get('type') != 'Polygon':
            raise serializers.ValidationError("Geometry type must be 'Polygon'")
        
        if 'coordinates' not in value:
            raise serializers.ValidationError("Polygon must have 'coordinates' field")
        
        return value


class DeletionResultSerializer(serializers.Serializer):
    """Serializer for deletion result response."""
    success = serializers.BooleanField()
    dry_run = serializers.BooleanField()
    campaign_id = serializers.UUIDField()
    campaign_name = serializers.CharField()
    polygon_area_km2 = serializers.FloatField()


class PolygonSearchRequestSerializer(serializers.Serializer):
    """Serializer for polygon search request."""
    polygon = serializers.DictField(
        help_text="GeoJSON Polygon geometry"
    )
    
    def validate_polygon(self, value):
        """Validate GeoJSON polygon structure."""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Polygon must be a dictionary")
        
        if value.get('type') != 'Polygon':
            raise serializers.ValidationError("Geometry type must be 'Polygon'")
        
        if 'coordinates' not in value:
            raise serializers.ValidationError("Polygon must have 'coordinates' field")
        
        coords = value.get('coordinates')
        if not isinstance(coords, list) or len(coords) == 0:
            raise serializers.ValidationError("Coordinates must be a non-empty array")
        
        return value


class AddressResultSerializer(serializers.Serializer):
    """Serializer for individual address result."""
    address = serializers.CharField(help_text="Full address string")
    lat = serializers.FloatField(help_text="Latitude")
    lon = serializers.FloatField(help_text="Longitude")
    type = serializers.CharField(help_text="'House' or 'Apartment Building'")
    unit_count = serializers.IntegerField(help_text="Number of units (0 for houses)")
    units = serializers.ListField(
        child=serializers.DictField(),
        allow_null=True,
        help_text="Array of unit objects (null for houses)"
    )


class PolygonSearchSummarySerializer(serializers.Serializer):
    """Serializer for summary statistics."""
    total_houses = serializers.IntegerField(help_text="Number of single family homes")
    total_apartment_buildings = serializers.IntegerField(help_text="Number of apartment buildings")
    total_individual_apartments = serializers.IntegerField(help_text="Total number of individual apartments")


class PolygonSearchResponseSerializer(serializers.Serializer):
    """Serializer for polygon search response."""
    summary = PolygonSearchSummarySerializer(help_text="Summary statistics")
