"""
Serializers for the addresses app.
"""
from rest_framework import serializers
from rest_framework_gis.serializers import GeoFeatureModelSerializer
from users.serializers import EmployeeSerializer, ManagerSerializer
from .models import Address, NEI_SUBCATEGORY_CHOICES

_NEI_SUB_KEYS = {c[0] for c in NEI_SUBCATEGORY_CHOICES}


class CampaignSerializer(serializers.Serializer):
    """Simple serializer for Campaign model."""
    id = serializers.UUIDField()
    name = serializers.CharField()
    description = serializers.CharField(allow_blank=True, allow_null=True)


class AddressSerializer(serializers.ModelSerializer):
    """Serializer for Address model."""
    employee = EmployeeSerializer(read_only=True)
    manager = ManagerSerializer(read_only=True)
    campaign = CampaignSerializer(read_only=True)
    employee_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    manager_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    campaign_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    nei_subcategory_display = serializers.CharField(
        source='get_nei_subcategory_display', read_only=True, allow_null=True
    )
    status_color = serializers.SerializerMethodField()

    class Meta:
        model = Address
        fields = [
            'id', 'address_text', 'status', 'status_display', 'status_color',
            'nei_subcategory', 'nei_subcategory_display',
            'position', 'tags', 'recorded_at', 'campaign', 'campaign_id',
            'employee', 'employee_id', 'manager', 'manager_id', 'notes'
        ]
        read_only_fields = ['id', 'recorded_at']

    def get_status_color(self, obj):
        colors = {
            'ja': '#28a745',      # Green
            'ikke_hjemme': '#ffc107',  # Yellow
            'nei': '#dc3545',     # Red
            'folg_opp': '#007bff',  # Blue
        }
        return colors.get(obj.status, '#6c757d')

    def validate(self, attrs):
        employee_id = attrs.get('employee_id')
        manager_id = attrs.get('manager_id')
        if not employee_id and not manager_id:
            raise serializers.ValidationError('Either employee_id or manager_id must be provided.')
        if employee_id and manager_id:
            raise serializers.ValidationError('Cannot set both employee_id and manager_id.')

        inst = self.instance
        merged_status = attrs.get('status', inst.status if inst else None) or 'ja'
        if merged_status != 'nei':
            attrs['nei_subcategory'] = None
        elif 'nei_subcategory' in attrs:
            v = attrs['nei_subcategory']
            if v is not None and v not in _NEI_SUB_KEYS:
                raise serializers.ValidationError(
                    {'nei_subcategory': f'Must be one of: {", ".join(sorted(_NEI_SUB_KEYS))}'}
                )
        return attrs

    def create(self, validated_data):
        employee_id = validated_data.pop('employee_id', None)
        manager_id = validated_data.pop('manager_id', None)
        campaign_id = validated_data.pop('campaign_id', None)
        
        if employee_id:
            from users.models import Employee
            validated_data['employee'] = Employee.objects.get(id=employee_id)
        elif manager_id:
            from users.models import Manager
            validated_data['manager'] = Manager.objects.get(id=manager_id)
            
        if campaign_id:
            from campaigns.models import Campaign
            validated_data['campaign'] = Campaign.objects.get(id=campaign_id)
            
        return super().create(validated_data)


class CampaignLiteSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    description = serializers.CharField(allow_blank=True, allow_null=True)


class AddressNDJSONSerializer(serializers.ModelSerializer):
    employee = EmployeeSerializer(read_only=True)
    manager = ManagerSerializer(read_only=True)
    campaign = CampaignLiteSerializer(read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    nei_subcategory_display = serializers.CharField(
        source='get_nei_subcategory_display', read_only=True, allow_null=True
    )
    status_color = serializers.SerializerMethodField()

    class Meta:
        model = Address
        fields = [
            'id', 'address_text', 'status', 'status_display', 'status_color',
            'nei_subcategory', 'nei_subcategory_display',
            'position', 'tags', 'recorded_at', 'campaign', 'employee', 'manager', 'notes',
        ]
        read_only_fields = ['id', 'recorded_at']

    def get_status_color(self, obj):
        colors = {
            'ja': '#28a745',
            'ikke_hjemme': '#ffc107',
            'nei': '#dc3545',
            'folg_opp': '#007bff',
        }
        return colors.get(obj.status, '#6c757d')


class AddressGeoSerializer(GeoFeatureModelSerializer):
    """GeoJSON serializer for addresses with geometry."""
    class Meta:
        model = Address
        geo_field = 'position'
        fields = [
            'id', 'address_text', 'tags', 'recorded_at', 'notes'
        ] 