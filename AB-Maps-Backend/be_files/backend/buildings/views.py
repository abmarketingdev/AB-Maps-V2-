"""
Views for the buildings app.
"""
import logging
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, OpenApiResponse
from django.db import transaction

from .models import Building
from .serializers import BuildingSerializer
from .permissions import IsBuildingCreator

logger = logging.getLogger(__name__)


class BuildingViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing buildings.
    
    Provides endpoints for:
    - Listing buildings
    - Retrieving single building
    - Deleting building (only by creator)
    
    IMPORTANT: Only the creator (manager or employee) can delete their own building.
    """
    queryset = Building.objects.all()
    serializer_class = BuildingSerializer
    permission_classes = [permissions.IsAuthenticated, IsBuildingCreator]
    
    def get_queryset(self):
        """Filter buildings based on query parameters."""
        queryset = Building.objects.select_related('campaign', 'created_by', 'created_by_employee')
        
        # Filter by campaign if provided
        campaign_id = self.request.query_params.get('campaign')
        if campaign_id:
            queryset = queryset.filter(campaign_id=campaign_id)
        
        # Filter by status if provided
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Filter by creator (for listing own buildings)
        user = self.request.user
        if hasattr(user, 'manager') and user.manager:
            if self.request.query_params.get('my_buildings') == 'true':
                queryset = queryset.filter(created_by_id=user.manager.id)
        elif hasattr(user, 'employee') and user.employee:
            if self.request.query_params.get('my_buildings') == 'true':
                queryset = queryset.filter(created_by_employee_id=user.employee.id)
        
        return queryset
    
    @extend_schema(
        summary="Delete a building",
        description=(
            "Hard delete a building and all its apartments and addresses.\n\n"
            "**IMPORTANT:**\n"
            "- Only the creator (manager or employee) can delete their own building\n"
            "- This will DELETE all apartments in the building\n"
            "- This will DELETE all addresses (visit records) linked to the building\n"
            "- This prevents 'zombie addresses' from appearing as standalone houses on the map\n"
            "- This action is PERMANENT and cannot be undone\n"
        ),
        responses={
            204: OpenApiResponse(description="Building deleted successfully"),
            403: OpenApiResponse(description="Permission denied - not the creator"),
            404: OpenApiResponse(description="Building not found"),
        }
    )
    def destroy(self, request, *args, **kwargs):
        """
        Delete a building.
        
        Only the creator (manager or employee) can delete their own building.
        This will explicitly delete:
        1. All apartments in the building
        2. All addresses (visit records) linked to the building
        
        IMPORTANT: We explicitly delete apartments and addresses because:
        - Django's CASCADE may not work if database constraint is missing
        - Addresses with building_id=NULL become "zombie addresses" (standalone houses on map)
        - When a building is deleted, its visit records (addresses) should also be deleted
        """
        instance = self.get_object()
        
        # Permission check is handled by IsBuildingCreator permission class
        # If we reach here, the user has permission
        
        building_id = instance.id
        base_address = instance.base_address
        apartment_count = instance.apartments.count()
        address_count = instance.addresses.count()
        
        logger.warning(
            f"🗑️ User {request.user.id} deleting building {building_id}: "
            f"{base_address} ({apartment_count} apartments, {address_count} addresses)"
        )
        
        try:
            with transaction.atomic():
                # Import models here to avoid circular imports
                from apartments.models import Apartment
                from addresses.models import Address
                
                # Step 1: Delete all apartments for this building
                # Django's CASCADE may not work if database constraint is missing
                deleted_apartments = 0
                if apartment_count > 0:
                    deleted_apartments = Apartment.objects.filter(building_id=building_id).delete()[0]
                    logger.info(
                        f"🗑️ Deleted {deleted_apartments} apartments for building {building_id}"
                    )
                
                # Step 2: DELETE all addresses linked to this building
                # This prevents "zombie addresses" (addresses with building_id=NULL) from
                # appearing as standalone houses on the map after building deletion
                deleted_addresses = 0
                if address_count > 0:
                    deleted_addresses = Address.objects.filter(building_id=building_id).delete()[0]
                    logger.info(
                        f"🗑️ Deleted {deleted_addresses} addresses for building {building_id}"
                    )
                
                # Step 3: Delete the building itself
                instance.delete()
                
                logger.info(
                    f"✅ Building {building_id} deleted successfully. "
                    f"Removed {deleted_apartments} apartments and {deleted_addresses} addresses."
                )
                
                return Response(
                    {
                        'message': f'Building "{base_address}" deleted successfully',
                        'deleted_apartments': deleted_apartments,
                        'deleted_addresses': deleted_addresses
                    },
                    status=status.HTTP_204_NO_CONTENT
                )
        
        except Exception as e:
            logger.error(f"❌ Error deleting building {building_id}: {e}", exc_info=True)
            return Response(
                {'error': f'Failed to delete building: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
