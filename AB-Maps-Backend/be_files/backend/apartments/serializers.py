"""
Serializers for the apartments app.
"""
from rest_framework import serializers
from .models import Apartment
from addresses.models import Address, NEI_SUBCATEGORY_CHOICES
from campaigns.models import Campaign

_NEI_SUB_KEYS = [c[0] for c in NEI_SUBCATEGORY_CHOICES]


class ApartmentSerializer(serializers.ModelSerializer):
    """
    Main serializer for Apartment model.
    Used for list, retrieve, and update operations.
    
    NEW: Includes building_id for the new Building-centric architecture.
    """
    # Building info (NEW - preferred)
    building_id = serializers.UUIDField(source='building.id', read_only=True, allow_null=True)
    building_base_address = serializers.CharField(source='building.base_address', read_only=True, allow_null=True)
    building_status = serializers.CharField(source='building.status', read_only=True, allow_null=True)
    
    # Legacy fields (kept for backwards compatibility)
    address_id = serializers.UUIDField(source='address.id', read_only=True, allow_null=True)
    campaign_id = serializers.SerializerMethodField()
    
    is_visited = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Apartment
        fields = [
            'id',
            'building_id',
            'building_base_address',
            'building_status',
            'base_address',  # DEPRECATED - use building_base_address
            'apartment_number',
            'status',
            'nei_subcategory',
            'address_id',
            'campaign_id',
            'is_visited',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'is_visited']
    
    def get_campaign_id(self, obj):
        """Get campaign_id from building or fallback to deprecated field."""
        if obj.building and obj.building.campaign_id:
            return obj.building.campaign_id
        return obj.campaign_id if obj.campaign_id else None
    
    def validate_status(self, value):
        """Validate that status is one of the allowed choices."""
        if value is not None and value not in ['ja', 'nei', 'ikke_hjemme', 'folg_opp']:
            raise serializers.ValidationError(
                f"Invalid status. Must be one of: ja, nei, ikke_hjemme, folg_opp"
            )
        return value


class ApartmentDetailSerializer(ApartmentSerializer):
    """
    Detailed serializer with expanded relationships.
    Used for retrieve operations that need full details.
    """
    visit_info = serializers.SerializerMethodField()
    building_info = serializers.SerializerMethodField()
    
    class Meta(ApartmentSerializer.Meta):
        fields = ApartmentSerializer.Meta.fields + ['visit_info', 'building_info']
    
    def get_visit_info(self, obj):
        """Return detailed visit information."""
        return obj.visit_info
    
    def get_building_info(self, obj):
        """Return building information if available."""
        if not obj.building:
            return None
        return {
            'id': str(obj.building.id),
            'base_address': obj.building.base_address,
            'total_units': obj.building.total_units,
            'visited_units': obj.building.visited_units,
            'status': obj.building.status,
            'is_completed': obj.building.is_completed,
        }


class ApartmentUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for updating apartment status and address link.
    Used for PATCH operations.
    
    NEW: Accepts optional 'notes' field that will be saved to the Address record.
    When status is nei, optional nei_subcategory (mirrored on Apartment and Address).
    """
    address_id = serializers.UUIDField(required=False, allow_null=True)
    notes = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        max_length=2000,
        help_text="Optional notes to attach to the visit record (Address)"
    )
    nei_subcategory = serializers.ChoiceField(
        choices=_NEI_SUB_KEYS,
        required=False,
        allow_null=True,
        help_text="Required context when status is nei (optional)",
    )
    
    class Meta:
        model = Apartment
        fields = ['status', 'address_id', 'notes', 'nei_subcategory']
    
    def validate_address_id(self, value):
        """Validate that address exists if provided."""
        if value is not None:
            try:
                Address.objects.get(id=value)
            except Address.DoesNotExist:
                raise serializers.ValidationError(
                    f"Address with id {value} does not exist"
                )
        return value
    
    def validate(self, attrs):
        inst = self.instance
        new_status = attrs.get('status', inst.status if inst else None)
        if attrs.get('nei_subcategory') is not None and new_status != 'nei':
            raise serializers.ValidationError(
                {'nei_subcategory': 'nei_subcategory is only allowed when status is nei.'}
            )
        return attrs
    
    def update(self, instance, validated_data):
        """Update apartment with validated data."""
        validated_data.pop('notes', None)
        nei_provided = 'nei_subcategory' in validated_data
        nei_sub = validated_data.pop('nei_subcategory', None) if nei_provided else None

        if 'address_id' in validated_data:
            address_id = validated_data.pop('address_id')
            if address_id is None:
                instance.address = None
            else:
                instance.address = Address.objects.get(id=address_id)

        if 'status' in validated_data:
            instance.status = validated_data.pop('status')
            if instance.status != 'nei':
                instance.nei_subcategory = None
            elif nei_provided:
                instance.nei_subcategory = nei_sub
            else:
                instance.nei_subcategory = None
        elif nei_provided:
            if instance.status != 'nei':
                raise serializers.ValidationError(
                    {'nei_subcategory': 'Cannot set nei_subcategory unless status is nei.'}
                )
            instance.nei_subcategory = nei_sub

        instance.save()
        return instance


class PositionSerializer(serializers.Serializer):
    """Serializer for geographic position (lat/lon)."""
    lat = serializers.FloatField(
        required=True,
        min_value=-90,
        max_value=90,
        help_text="Latitude"
    )
    lon = serializers.FloatField(
        required=True,
        min_value=-180,
        max_value=180,
        help_text="Longitude"
    )


class ApartmentBulkCreateSerializer(serializers.Serializer):
    """
    Serializer for bulk creating apartments for a building.
    
    Validates input for bulk-create endpoint and ensures
    data is in correct format.
    
    NEW: Now requires position (lat/lon) for creating Building.
    """
    base_address = serializers.CharField(
        required=True,
        max_length=500,
        help_text="Base address without apartment number"
    )
    apartment_numbers = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=True,
        min_length=1,
        max_length=500,  # Prevent abuse
        help_text="List of apartment numbers to create"
    )
    campaign_id = serializers.UUIDField(
        required=True,  # Now required (Building needs campaign)
        help_text="Campaign to associate building with"
    )
    position = PositionSerializer(
        required=True,
        help_text="Geographic position of the building (lat/lon)"
    )
    
    def validate_base_address(self, value):
        """Validate base address format."""
        if not value or not value.strip():
            raise serializers.ValidationError("Base address cannot be empty")
        return value.strip()
    
    def validate_apartment_numbers(self, value):
        """Validate apartment numbers list."""
        if not value:
            raise serializers.ValidationError("Must provide at least one apartment number")
        
        # Remove duplicates while preserving order
        seen = set()
        unique_numbers = []
        for num in value:
            num_clean = num.strip()
            if num_clean and num_clean not in seen:
                seen.add(num_clean)
                unique_numbers.append(num_clean)
        
        if not unique_numbers:
            raise serializers.ValidationError("No valid apartment numbers provided")
        
        return unique_numbers
    
    def validate_campaign_id(self, value):
        """Validate that campaign exists."""
        if value is None:
            raise serializers.ValidationError("campaign_id is required")
        try:
            Campaign.objects.get(id=value)
        except Campaign.DoesNotExist:
            raise serializers.ValidationError(
                f"Campaign with id {value} does not exist"
            )
        return value


class ApartmentBulkCreateResponseSerializer(serializers.Serializer):
    """
    Serializer for bulk-create response.
    Returns statistics about the operation.
    """
    created = serializers.IntegerField(help_text="Number of apartments created")
    skipped = serializers.IntegerField(help_text="Number of apartments skipped (already exist)")
    total = serializers.IntegerField(help_text="Total number of apartments processed")
    building_id = serializers.UUIDField(help_text="ID of the building created/updated")
    building_created = serializers.BooleanField(help_text="True if building was newly created")
    errors = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        help_text="List of errors encountered"
    )
    message = serializers.CharField(help_text="Summary message")


class ApartmentSummarySerializer(serializers.Serializer):
    """
    Serializer for apartment summary statistics.
    Used by the summary endpoint.
    
    NEW: Includes building_id and building_status.
    """
    # Building info (NEW)
    building_id = serializers.UUIDField(
        allow_null=True,
        required=False,
        help_text="Building UUID (if queried by building_id)"
    )
    building_status = serializers.CharField(
        allow_null=True,
        required=False,
        help_text="Building status: unvisited, in_progress, completed"
    )
    is_completed = serializers.BooleanField(
        required=False,
        help_text="True if all apartments have been visited"
    )
    
    # Address info
    base_address = serializers.CharField(help_text="Base address")
    
    # Statistics
    total_apartments = serializers.IntegerField(help_text="Total number of apartments")
    visited = serializers.IntegerField(help_text="Number of visited apartments")
    unvisited = serializers.IntegerField(help_text="Number of unvisited apartments")
    status_breakdown = serializers.DictField(
        child=serializers.IntegerField(),
        help_text="Count of apartments by status"
    )
    last_visited_at = serializers.DateTimeField(
        allow_null=True,
        help_text="Timestamp of most recent visit"
    )
    campaign_id = serializers.UUIDField(
        allow_null=True,
        required=False,
        help_text="Campaign ID"
    )


class ApartmentListQuerySerializer(serializers.Serializer):
    """
    Serializer for validating list query parameters.
    
    NEW: Supports building_id (preferred) alongside base_address (legacy).
    """
    building_id = serializers.UUIDField(
        required=False,
        help_text="Filter by building UUID (preferred)"
    )
    base_address = serializers.CharField(
        required=False,
        help_text="Filter by base address (legacy - use building_id instead)"
    )
    campaign = serializers.UUIDField(
        required=False,
        allow_null=True,
        help_text="Filter by campaign ID"
    )
    status = serializers.ChoiceField(
        choices=['ja', 'nei', 'ikke_hjemme', 'folg_opp', 'unvisited'],
        required=False,
        help_text="Filter by status (use 'unvisited' for null status)"
    )
    ordering = serializers.ChoiceField(
        choices=['apartment_number', '-apartment_number', 'created_at', '-created_at', 'updated_at', '-updated_at'],
        required=False,
        default='apartment_number',
        help_text="Sort order"
    )

