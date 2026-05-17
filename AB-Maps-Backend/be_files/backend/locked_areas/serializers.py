"""
Serializers for the locked_areas app.
"""
from rest_framework import serializers
from .models import LockedArea, AreaType


class AdminAreaSerializer(serializers.Serializer):
    """Serializer for admin.areas view data."""
    area_key = serializers.CharField()
    level = serializers.CharField()
    code = serializers.CharField()
    name = serializers.CharField()
    parent_code = serializers.CharField(allow_null=True)
    parent_parent_code = serializers.CharField(allow_null=True)
    area_km2 = serializers.FloatField()
    num_polygons = serializers.IntegerField()
    is_locked = serializers.BooleanField(required=False)


class LockedAreaSerializer(serializers.ModelSerializer):
    """Serializer for LockedArea model."""
    area_level = serializers.ReadOnlyField()
    locked_by_name = serializers.SerializerMethodField()
    campaign_name = serializers.SerializerMethodField()
    children_count = serializers.SerializerMethodField()
    parent_areas = serializers.SerializerMethodField()

    class Meta:
        model = LockedArea
        fields = [
            'id', 'campaign', 'area_key', 'area_type', 'area_code', 
            'area_name', 'county_code', 'municipality_code', 'area_level',
            'locked_at', 'locked_by', 'locked_by_name', 'campaign_name',
            'is_active', 'children_count', 'parent_areas', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'locked_at', 'created_at', 'updated_at']

    def get_locked_by_name(self, obj):
        """Get the name of the user who locked the area."""
        if obj.locked_by:
            if hasattr(obj.locked_by, 'employee') and obj.locked_by.employee:
                return obj.locked_by.employee.name
            elif hasattr(obj.locked_by, 'manager') and obj.locked_by.manager:
                return obj.locked_by.manager.name
            return f"{obj.locked_by.first_name} {obj.locked_by.last_name}".strip() or obj.locked_by.username
        return None

    def get_campaign_name(self, obj):
        """Get the campaign name."""
        return obj.campaign.name if obj.campaign else None

    def get_children_count(self, obj):
        """Get the count of child areas."""
        return obj.get_children_areas().count()

    def get_parent_areas(self, obj):
        """Get parent areas information."""
        parent_areas = obj.get_parent_areas()
        return [
            {
                'area_key': parent.area_key,
                'area_name': parent.area_name,
                'area_type': parent.area_type
            }
            for parent in parent_areas
        ]


class LockedAreaCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating locked areas."""
    area_keys = serializers.ListField(
        child=serializers.CharField(),
        write_only=True,
        help_text="List of area keys to lock (e.g., ['fylke:03', 'kommune:0301'])"
    )

    class Meta:
        model = LockedArea
        fields = ['campaign', 'area_keys']

    def validate_area_keys(self, value):
        """Validate that area keys exist in admin.areas."""
        from django.db import connection
        
        if not value:
            raise serializers.ValidationError("area_keys cannot be empty")
        
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT area_key FROM admin.areas 
                WHERE area_key = ANY(%s)
            """, [value])
            existing_keys = [row[0] for row in cursor.fetchall()]
        
        invalid_keys = set(value) - set(existing_keys)
        if invalid_keys:
            raise serializers.ValidationError(
                f"Invalid area keys: {', '.join(invalid_keys)}"
            )
        return value

    def validate_campaign(self, value):
        """Validate that the campaign exists and user has access."""
        if not value:
            raise serializers.ValidationError("Campaign is required")
        return value

    def create(self, validated_data):
        """Create locked areas using the bulk_lock_areas method."""
        area_keys = validated_data.pop('area_keys')
        campaign = validated_data['campaign']
        user = self.context['request'].user
        
        locked_areas = LockedArea.bulk_lock_areas(campaign, area_keys, user)
        
        if not locked_areas:
            raise serializers.ValidationError("No new areas were locked. They may already be locked.")
        
        return locked_areas


class LockedAreaUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating locked areas."""
    
    class Meta:
        model = LockedArea
        fields = ['is_active']
    
    def update(self, instance, validated_data):
        """Update the locked area."""
        instance.is_active = validated_data.get('is_active', instance.is_active)
        instance.save()
        return instance


class HierarchicalAreaSerializer(serializers.Serializer):
    """Serializer for hierarchical area view."""
    area_key = serializers.CharField()
    level = serializers.CharField()
    code = serializers.CharField()
    name = serializers.CharField()
    parent_key = serializers.CharField(allow_null=True)
    depth = serializers.IntegerField()
    is_locked = serializers.BooleanField()
    locked_at = serializers.DateTimeField(allow_null=True)
    locked_by_name = serializers.CharField(allow_null=True)
    area_km2 = serializers.FloatField(required=False)
    num_polygons = serializers.IntegerField(required=False)


class BulkLockSerializer(serializers.Serializer):
    """Serializer for bulk lock operations."""
    area_keys = serializers.ListField(
        child=serializers.CharField(),
        help_text="List of area keys to lock/unlock"
    )

    def validate_area_keys(self, value):
        """Validate area keys."""
        if not value:
            raise serializers.ValidationError("area_keys cannot be empty")
        
        # Check for duplicates
        if len(value) != len(set(value)):
            raise serializers.ValidationError("Duplicate area keys are not allowed")
        
        return value


class AreaFilterSerializer(serializers.Serializer):
    """Serializer for filtering areas."""
    level = serializers.ChoiceField(
        choices=AreaType.choices,
        required=False,
        help_text="Filter by area level"
    )
    county_code = serializers.CharField(
        max_length=2,
        required=False,
        help_text="Filter by county code"
    )
    municipality_code = serializers.CharField(
        max_length=4,
        required=False,
        help_text="Filter by municipality code"
    )
    search = serializers.CharField(
        required=False,
        help_text="Search in area names"
    )
    locked_only = serializers.BooleanField(
        required=False,
        default=False,
        help_text="Show only locked areas"
    )


class HierarchicalAreaStructureSerializer(serializers.Serializer):
    """Serializer for the simplified hierarchical area structure."""
    name = serializers.CharField()
    area_key = serializers.CharField()
    code = serializers.CharField()
    area_km2 = serializers.FloatField()
    num_polygons = serializers.IntegerField()
    kommuner = serializers.DictField(required=False, allow_null=True)
    grunnkretser = serializers.DictField(required=False, allow_null=True)


class LockedAreaMapSerializer(serializers.Serializer):
    """Serializer for locked areas with map geometry and locking details."""
    
    # Area identification
    id = serializers.UUIDField()
    area_key = serializers.CharField()
    area_type = serializers.CharField()
    area_code = serializers.CharField()
    area_name = serializers.CharField()
    area_km2 = serializers.FloatField()
    num_polygons = serializers.IntegerField()
    
    # Geometry (optional based on include_geometry parameter)
    polygon_geometry = serializers.SerializerMethodField()
    
    # Locking information
    locked_at = serializers.DateTimeField()
    locked_by = serializers.SerializerMethodField()
    
    # Campaign information
    campaign = serializers.SerializerMethodField()
    
    def get_polygon_geometry(self, obj):
        """Return polygon geometry based on include_geometry parameter."""
        request = self.context.get('request')
        if request and request.query_params.get('include_geometry', 'true').lower() == 'false':
            return None
        
        # Convert PostGIS geometry to GeoJSON
        if obj.get('geom_geojson'):
            import json
            try:
                return json.loads(obj['geom_geojson'])
            except json.JSONDecodeError:
                return None
        return None
    
    def get_locked_by(self, obj):
        """Return detailed user information who locked the area."""
        return {
            'id': obj.get('locked_by_id'),
            'username': obj.get('username'),
            'name': obj.get('locked_by_name'),
            'user_type': obj.get('user_type'),
            'profile': {
                'id': obj.get('profile_id'),
                'name': obj.get('profile_name'),
                'email': obj.get('profile_email')
            }
        }
    
    def get_campaign(self, obj):
        """Return campaign information."""
        return {
            'id': obj.get('campaign_id'),
            'name': obj.get('campaign_name')
        }


class LockedAreaAgeStatsSerializer(serializers.Serializer):
    """Serializer for locked area age statistics response."""
    id = serializers.UUIDField()
    area_type = serializers.CharField()
    area_code = serializers.CharField()
    area_name = serializers.CharField()
    mean_age = serializers.DecimalField(
        max_digits=5,
        decimal_places=1,
        allow_null=True,
        required=False
    )
    median_age = serializers.DecimalField(
        max_digits=5,
        decimal_places=1,
        allow_null=True,
        required=False
    )
    cached = serializers.BooleanField(help_text="True if stats were from DB cache, False if freshly fetched")
