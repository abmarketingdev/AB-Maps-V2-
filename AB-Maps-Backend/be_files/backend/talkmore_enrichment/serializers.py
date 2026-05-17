"""
Serializers for talkmore_enrichment app.
"""
from rest_framework import serializers
from .models import EnrichmentJob, EnrichedAddressResult


class EnrichmentJobSerializer(serializers.ModelSerializer):
    """Full job details serializer."""
    
    progress_percentage = serializers.SerializerMethodField()
    area_name = serializers.CharField(source='area.name', read_only=True)
    campaign_name = serializers.CharField(source='campaign.name', read_only=True)
    
    class Meta:
        model = EnrichmentJob
        fields = [
            'id',
            'area',
            'area_name',
            'campaign',
            'campaign_name',
            'status',
            'expected_count',
            'done_count',
            'success_count',
            'no_data_count',
            'failed_count',
            'progress_percentage',
            'started_at',
            'finished_at',
            'last_error',
            'created_at',
            'updated_at'
        ]
        read_only_fields = [
            'id',
            'created_at',
            'updated_at'
        ]
    
    def get_progress_percentage(self, obj):
        """Calculate progress percentage."""
        if obj.expected_count == 0:
            return 100.0 if obj.status == 'done' else 0.0
        return round((obj.done_count / obj.expected_count) * 100, 2)


class EnrichmentJobStatusSerializer(serializers.ModelSerializer):
    """Lightweight status-only serializer."""
    
    progress_percentage = serializers.SerializerMethodField()
    
    class Meta:
        model = EnrichmentJob
        fields = [
            'id',
            'status',
            'expected_count',
            'done_count',
            'success_count',
            'no_data_count',
            'failed_count',
            'progress_percentage',
            'started_at',
            'finished_at',
            'last_error',
            'created_at'
        ]
        read_only_fields = fields
    
    def get_progress_percentage(self, obj):
        """Calculate progress percentage."""
        if obj.expected_count == 0:
            return 100.0 if obj.status == 'done' else 0.0
        return round((obj.done_count / obj.expected_count) * 100, 2)


class EnrichedAddressResultSerializer(serializers.ModelSerializer):
    """Full result details serializer."""
    
    position = serializers.SerializerMethodField()
    
    class Meta:
        model = EnrichedAddressResult
        fields = [
            'id',
            'job',
            'address_uuid',
            'position',
            'address_text',
            'municipality_code',
            'postcode',
            'people',
            'carrier_summary',
            'show_marker',
            'status',
            'created_at',
            'updated_at'
        ]
        read_only_fields = fields
    
    def get_position(self, obj):
        """Return position as GeoJSON coordinates."""
        if obj.geom:
            return {
                'type': 'Point',
                'coordinates': [obj.geom.x, obj.geom.y]
            }
        return None


class EnrichedAddressGeoJSONSerializer(serializers.Serializer):
    """GeoJSON format serializer for map display."""
    
    type = serializers.CharField(default='Feature', read_only=True)
    id = serializers.UUIDField(source='address_uuid', read_only=True)
    geometry = serializers.SerializerMethodField()
    properties = serializers.SerializerMethodField()
    
    def get_geometry(self, obj):
        """Return GeoJSON geometry."""
        if obj.geom:
            return {
                'type': 'Point',
                'coordinates': [obj.geom.x, obj.geom.y]
            }
        return None
    
    def get_properties(self, obj):
        """Return GeoJSON properties."""
        return {
            'address_text': obj.address_text,
            'carrier_summary': obj.carrier_summary,
            'people': obj.people
        }
