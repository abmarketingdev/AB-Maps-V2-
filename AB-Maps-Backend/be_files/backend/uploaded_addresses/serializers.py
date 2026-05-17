"""
Serializers for the uploaded_addresses app.
"""
from rest_framework import serializers
from .models import UploadedAddress
from users.serializers import ManagerSerializer
from campaigns.serializers import CampaignSerializer


class UploadedAddressSerializer(serializers.ModelSerializer):
    """Serializer for UploadedAddress model."""
    manager = ManagerSerializer(read_only=True)
    campaign = CampaignSerializer(read_only=True)
    is_geocoded = serializers.ReadOnlyField()
    coordinates = serializers.ReadOnlyField()

    class Meta:
        model = UploadedAddress
        fields = [
            'id', 'manager', 'campaign', 'address_text', 'latitude', 
            'longitude', 'added_at', 'geocoded_at', 'is_geocoded', 'coordinates'
        ]
        read_only_fields = ['id', 'manager', 'added_at', 'geocoded_at', 'is_geocoded', 'coordinates']


class CampaignLiteSerializer(serializers.Serializer):
    """Lightweight campaign representation for NDJSON streaming."""
    id = serializers.UUIDField()
    name = serializers.CharField()
    description = serializers.CharField(allow_blank=True, allow_null=True)


class UploadedAddressNDJSONSerializer(serializers.ModelSerializer):
    """Compact serializer for faster NDJSON streaming."""
    manager = ManagerSerializer(read_only=True)
    campaign = CampaignLiteSerializer(read_only=True)
    is_geocoded = serializers.ReadOnlyField()
    coordinates = serializers.ReadOnlyField()

    class Meta:
        model = UploadedAddress
        fields = [
            'id', 'manager', 'campaign', 'address_text', 'latitude',
            'longitude', 'added_at', 'geocoded_at', 'is_geocoded', 'coordinates'
        ]
        read_only_fields = ['id', 'manager', 'added_at', 'geocoded_at', 'is_geocoded', 'coordinates']


class UploadedAddressCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating UploadedAddress records."""
    campaign_id = serializers.UUIDField(write_only=True)

    class Meta:
        model = UploadedAddress
        fields = ['address_text', 'campaign_id']
        read_only_fields = ['id', 'manager', 'added_at', 'geocoded_at']

    def validate_address_text(self, value):
        """Validate that address_text is not empty."""
        if not value or not value.strip():
            raise serializers.ValidationError("Address text cannot be empty.")
        return value.strip()

    def create(self, validated_data):
        """Create UploadedAddress with manager from request user."""
        campaign_id = validated_data.pop('campaign_id')
        
        # Get the manager from the request user
        user = self.context['request'].user
        if not hasattr(user, 'manager') or not user.manager:
            raise serializers.ValidationError("Only managers can upload addresses.")
        
        # Get the campaign
        from campaigns.models import Campaign
        try:
            campaign = Campaign.objects.get(id=campaign_id)
        except Campaign.DoesNotExist:
            raise serializers.ValidationError(f"Campaign with ID {campaign_id} does not exist.")
        
        return UploadedAddress.objects.create(
            manager=user.manager,
            campaign=campaign,
            **validated_data
        )


class CSVUploadSerializer(serializers.Serializer):
    """Serializer for CSV/Excel file upload."""
    file = serializers.FileField(
        help_text="CSV or Excel file (.csv, .xlsx) containing Norwegian addresses with columns: Gate/vei 2, Postnummer, Poststed"
    )
    campaign_id = serializers.UUIDField(
        help_text="ID of the campaign to associate with uploaded addresses."
    )
    batch_id = serializers.UUIDField(
        help_text="Batch ID obtained from /generate-batch-id/ endpoint for progress tracking."
    )

    def validate_file(self, value):
        """Validate the uploaded file."""
        if not value.name.lower().endswith(('.csv', '.xlsx')):
            raise serializers.ValidationError("File must be a CSV (.csv) or Excel (.xlsx) file.")
        
        if value.size == 0:
            raise serializers.ValidationError("File cannot be empty.")
        
        # Check file size (limit to 10MB)
        if value.size > 10 * 1024 * 1024:
            raise serializers.ValidationError("File size must be less than 10MB.")
        
        return value

    def validate_campaign_id(self, value):
        """Validate that the campaign exists."""
        from campaigns.models import Campaign
        try:
            Campaign.objects.get(id=value)
        except Campaign.DoesNotExist:
            raise serializers.ValidationError(f"Campaign with ID {value} does not exist.")
        return value


class UpdateAddressTextSerializer(serializers.Serializer):
    """Serializer for updating address_text and triggering re-geocoding."""
    address_text = serializers.CharField(
        max_length=500,
        help_text="New address text to update and re-geocode"
    )

    def validate_address_text(self, value):
        """Validate that address_text is not empty."""
        if not value or not value.strip():
            raise serializers.ValidationError("Address text cannot be empty.")
        return value.strip() 