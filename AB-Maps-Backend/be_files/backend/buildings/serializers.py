"""
Serializers for the buildings app.
"""
from rest_framework import serializers
from .models import Building


class BuildingSerializer(serializers.ModelSerializer):
    """Serializer for Building model."""
    
    created_by_name = serializers.CharField(source='created_by.name', read_only=True, allow_null=True)
    created_by_employee_name = serializers.CharField(source='created_by_employee.name', read_only=True, allow_null=True)
    campaign_name = serializers.CharField(source='campaign.name', read_only=True)
    
    class Meta:
        model = Building
        fields = [
            'id',
            'base_address',
            'position',
            'campaign',
            'campaign_name',
            'created_by',
            'created_by_name',
            'created_by_employee',
            'created_by_employee_name',
            'total_units',
            'visited_units',
            'status',
            'is_completed',
            'progress_percentage',
            'remaining_units',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'total_units',
            'visited_units',
            'status',
            'is_completed',
            'created_at',
            'updated_at',
        ]

