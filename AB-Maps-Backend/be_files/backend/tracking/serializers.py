"""
Serializers for the tracking app.
"""
from rest_framework import serializers
from rest_framework_gis.serializers import GeoFeatureModelSerializer
from users.serializers import EmployeeSerializer, ManagerSerializer
from .models import LocationPing, SyncQueueItem, WorkSession


class LocationPingSerializer(serializers.ModelSerializer):
    """Serializer for LocationPing model."""
    employee = EmployeeSerializer(read_only=True)
    manager = ManagerSerializer(read_only=True)
    employee_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    manager_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    latitude = serializers.FloatField(write_only=True, required=False)
    longitude = serializers.FloatField(write_only=True, required=False)
    
    class Meta:
        model = LocationPing
        fields = [
            'id', 'device_id', 'timestamp', 'point', 'accuracy', 'speed', 'heading',
            'altitude', 'battery_level', 'is_moving', 'employee', 'employee_id',
            'manager', 'manager_id', 'latitude', 'longitude'
        ]
        read_only_fields = ['id', 'timestamp']
    
    def validate(self, attrs):
        """Validate location data and user assignment."""
        # Check that either employee or manager is set, but not both
        employee_id = attrs.get('employee_id')
        manager_id = attrs.get('manager_id')
        
        if employee_id and manager_id:
            raise serializers.ValidationError('Cannot set both employee_id and manager_id.')
        
        # Validate point data
        point = attrs.get('point')
        latitude = attrs.get('latitude')
        longitude = attrs.get('longitude')
        
        if not point and (latitude is None or longitude is None):
            raise serializers.ValidationError('Either point or latitude/longitude must be provided.')
        
        return attrs
    
    def create(self, validated_data):
        """Create LocationPing with proper point and user assignment."""
        from django.contrib.gis.geos import Point
        
        # Handle point creation from lat/lng
        latitude = validated_data.pop('latitude', None)
        longitude = validated_data.pop('longitude', None)
        
        if latitude is not None and longitude is not None:
            validated_data['point'] = Point(float(longitude), float(latitude))
        
        # Handle user assignment
        employee_id = validated_data.pop('employee_id', None)
        manager_id = validated_data.pop('manager_id', None)
        
        if employee_id:
            from users.models import Employee
            validated_data['employee'] = Employee.objects.get(id=employee_id)
        elif manager_id:
            from users.models import Manager
            validated_data['manager'] = Manager.objects.get(id=manager_id)
        
        return super().create(validated_data)


class LocationPingGeoSerializer(GeoFeatureModelSerializer):
    """GeoJSON serializer for LocationPing with geometry."""
    employee = EmployeeSerializer(read_only=True)
    manager = ManagerSerializer(read_only=True)
    
    class Meta:
        model = LocationPing
        geo_field = 'point'
        fields = [
            'id', 'device_id', 'timestamp', 'accuracy', 'speed', 'heading',
            'altitude', 'battery_level', 'is_moving', 'employee', 'manager'
        ]


class SyncQueueItemSerializer(serializers.ModelSerializer):
    """Serializer for SyncQueueItem model."""
    
    class Meta:
        model = SyncQueueItem
        fields = [
            'id', 'change', 'created_at', 'synced_at', 'is_synced',
            'retry_count', 'max_retries', 'error_message'
        ]
        read_only_fields = ['id', 'created_at', 'synced_at', 'retry_count', 'error_message']
    
    def validate_change(self, value):
        """Validate that change is a valid JSON object."""
        if not isinstance(value, dict):
            raise serializers.ValidationError('Change must be a JSON object.')
        return value


class WorkSessionSerializer(serializers.ModelSerializer):
    """Serializer for WorkSession — exposes the domain actor id (Employee.id
    or Manager.id), never the auth User id."""
    actor_kind = serializers.SerializerMethodField()
    actor_id = serializers.SerializerMethodField()
    duration_seconds = serializers.SerializerMethodField()

    class Meta:
        model = WorkSession
        fields = [
            'id', 'actor_kind', 'actor_id',
            'employee', 'manager',
            'started_at', 'ended_at', 'last_heartbeat_at',
            'source', 'duration_seconds',
        ]
        read_only_fields = fields

    def get_actor_kind(self, obj):
        return obj.actor_kind()

    def get_actor_id(self, obj):
        actor = obj.actor_id()
        return str(actor) if actor else None

    def get_duration_seconds(self, obj):
        return obj.duration_seconds() 