"""
Views for the apartments app.
"""
import logging
import json
import re
import unicodedata
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter
from django.db import transaction, IntegrityError, connection
from django.db.models import Count, Q, Max
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiResponse
from drf_spectacular.types import OpenApiTypes

from .models import Apartment
from .serializers import (
    ApartmentSerializer,
    ApartmentDetailSerializer,
    ApartmentUpdateSerializer,
    ApartmentBulkCreateSerializer,
    ApartmentBulkCreateResponseSerializer,
    ApartmentSummarySerializer,
)

logger = logging.getLogger(__name__)


class ApartmentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing apartments.
    
    Provides endpoints for:
    - Listing apartments (with filtering)
    - Retrieving single apartment
    - Updating apartment status
    - Bulk creating apartments
    - Getting summary statistics
    
    NEW: Supports filtering by building_id (preferred) or base_address (legacy)
    """
    queryset = Apartment.objects.all()
    serializer_class = ApartmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['building', 'campaign']  # building_id is the new standard
    ordering_fields = ['apartment_number', 'created_at', 'updated_at']
    ordering = ['apartment_number']
    
    def get_queryset(self):
        """
        Filter apartments based on query parameters and campaign header.
        
        Supports filtering by:
        - building_id: UUID of the building (NEW - preferred, ignores campaign filter)
        - base_address: Exact match (LEGACY - for backwards compatibility)
        - campaign: UUID from query param or X-Campaign-ID header
        - status: Including 'unvisited' for null status
        
        IMPORTANT: When building_id is provided, campaign filter is SKIPPED because:
        - building_id uniquely identifies the building
        - The building's campaign is inherent to it
        - Users should see ALL apartments for a specific building
        """
        queryset = Apartment.objects.all()
        user = self.request.user
        
        # NEW: Check if building_id is provided FIRST
        # When building_id is specified, we return ALL apartments for that building
        # regardless of campaign header (the building already belongs to a campaign)
        building_id = self.request.query_params.get('building_id')
        if building_id:
            queryset = queryset.filter(building_id=building_id)
            logger.info(f"Filtered apartments by building_id: {building_id} (campaign filter skipped)")
        else:
            # Only apply campaign filter when building_id is NOT provided
            # Get campaign_id from header or query param
            campaign_id = (
                self.request.query_params.get('campaign') or 
                self.request.headers.get('X-Campaign-ID')
            )
            
            if campaign_id:
                # Handle JSON format in header
                if campaign_id.startswith('{'):
                    try:
                        campaign_data = json.loads(campaign_id)
                        campaign_id = campaign_data.get('id')
                    except json.JSONDecodeError:
                        logger.error(f"Invalid JSON in campaign_id: {campaign_id}")
                
                if campaign_id:
                    queryset = queryset.filter(building__campaign_id=campaign_id)
                    logger.info(f"Filtered apartments by campaign: {campaign_id}")
        
        # LEGACY: Filter by base_address (for backwards compatibility)
        base_address = self.request.query_params.get('base_address')
        if base_address and not building_id:  # Only use if building_id not provided
            queryset = queryset.filter(building__base_address=base_address)
            logger.info(f"Filtered apartments by base_address: {base_address}")
        
        # Handle special 'unvisited' status filter
        status_filter = self.request.query_params.get('status')
        if status_filter == 'unvisited':
            queryset = queryset.filter(status__isnull=True)
        elif status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Permission filtering (optional - restrict based on user type)
        # For now, authenticated users can see apartments in their campaigns
        # This can be tightened based on requirements
        
        return queryset.select_related('address', 'building', 'building__campaign')
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == 'retrieve':
            return ApartmentDetailSerializer
        elif self.action in ['update', 'partial_update']:
            return ApartmentUpdateSerializer
        elif self.action == 'bulk_create':
            return ApartmentBulkCreateSerializer
        return ApartmentSerializer
    
    def list(self, request, *args, **kwargs):
        """
        List apartments with optional pagination.
        
        If building_id is provided in query params, returns ALL apartments
        for that building without pagination.
        Otherwise, uses default pagination (20 per page).
        
        NEW: For Talkmore campaign buildings, includes carrier_status for each apartment:
        - 'telenor_talkmore_available': ONLY Telenor/Talkmore carriers (no others)
        - 'business_carrier': Unifon or Phonero (business subscription) found
        - 'other_carriers': Other carriers found (not matching either rule)
        - 'not_enriched': No enriched data found for this apartment
        
        FALLBACK: If no apartments found by building_id, tries base_address lookup
        (for legacy apartments that were created before Building model existed)
        """
        # Check if building_id is provided
        building_id = request.query_params.get('building_id')
        
        if building_id:
            # Disable pagination when filtering by building_id
            # Return all apartments for the building
            queryset = self.filter_queryset(self.get_queryset())
            
            # FALLBACK: If no apartments found by building_id, try base_address
            # This handles legacy apartments created before Building model
            if queryset.count() == 0:
                from buildings.models import Building
                try:
                    building = Building.objects.get(id=building_id)
                    # Try to find apartments by base_address (legacy lookup)
                    legacy_queryset = Apartment.objects.filter(
                        base_address=building.base_address,
                        building_id__isnull=True  # Only legacy apartments
                    )
                    if legacy_queryset.exists():
                        logger.info(
                            f"Found {legacy_queryset.count()} legacy apartments by base_address "
                            f"for building {building_id}"
                        )
                        queryset = legacy_queryset
                except Building.DoesNotExist:
                    logger.warning(f"Building {building_id} not found for fallback lookup")
            
            serializer = self.get_serializer(queryset, many=True)
            
            # Get carrier status for all apartments in this building (Talkmore only)
            from apartments.talkmore_matcher import get_carrier_status_for_building
            carrier_info = get_carrier_status_for_building(building_id)
            
            # Add carrier_status to each apartment in the response
            results = serializer.data
            if carrier_info.get('is_talkmore_campaign'):
                apartment_statuses = carrier_info.get('apartment_statuses', {})
                for apt in results:
                    apt_id = str(apt.get('id', ''))
                    apt['carrier_status'] = apartment_statuses.get(apt_id, 'not_enriched')
            else:
                # Not a Talkmore campaign - carrier_status is null/not applicable
                for apt in results:
                    apt['carrier_status'] = None
            
            return Response({
                'count': queryset.count(),
                'results': results,
                'carrier_info': {
                    'is_talkmore_campaign': carrier_info.get('is_talkmore_campaign', False),
                    'enriched_count': carrier_info.get('enriched_count', 0),
                    # Include apartments_count from raw query for debugging
                    'apartments_count': carrier_info.get('apartments_count', 0)
                }
            })
        else:
            # Use default pagination for other queries
            return super().list(request, *args, **kwargs)
    
    @extend_schema(
        summary="Bulk create apartments for a building",
        description=(
            "Create a Building and its apartments in one request. "
            "This endpoint is idempotent - existing buildings/apartments will be reused. "
            "Use this after calling Geonorge API to register all apartments for a building.\n\n"
            "NEW: Now creates Building record first, then links apartments to it."
        ),
        request=ApartmentBulkCreateSerializer,
        responses={
            201: ApartmentBulkCreateResponseSerializer,
            400: OpenApiResponse(description="Invalid request data"),
        },
    )
    @action(detail=False, methods=['post'], url_path='bulk-create')
    def bulk_create(self, request):
        """
        Bulk create Building and apartments.
        
        This endpoint:
        1. Creates or gets existing Building record
        2. Creates apartments linked to the Building
        3. Updates Building counts ONCE at the end
        
        This is idempotent - calling multiple times won't create duplicates.
        
        Request body:
        {
            "base_address": "Hausmanns gate 19A, 0182 Oslo",
            "apartment_numbers": ["1", "2", "3", ..., "100"],
            "campaign_id": "uuid",
            "position": {"lat": 59.91, "lon": 10.75}
        }
        
        Response:
        {
            "created": 95,
            "skipped": 5,
            "total": 100,
            "building_id": "uuid",
            "building_created": true,
            "message": "Successfully created 95 apartments in building X"
        }
        """
        serializer = ApartmentBulkCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        base_address = serializer.validated_data['base_address']
        apartment_numbers = serializer.validated_data['apartment_numbers']
        campaign_id = serializer.validated_data['campaign_id']
        position_data = serializer.validated_data['position']
        
        logger.info(
            f"Bulk creating {len(apartment_numbers)} apartments for: {base_address}"
        )
        
        created = 0
        skipped = 0
        errors = []
        building = None
        building_created = False
        
        # Use transaction for atomicity
        try:
            with transaction.atomic():
                # Import here to avoid circular imports
                from buildings.models import Building
                from django.contrib.gis.geos import Point
                
                # Step 1: Get or create Building
                # Determine creator based on current user
                user = request.user
                building_defaults = {
                    'position': Point(position_data['lon'], position_data['lat']),
                    'total_units': len(apartment_numbers),
                    'visited_units': 0,
                    'status': 'unvisited',
                    'is_completed': False,
                }
                
                # Set creator based on user type
                if hasattr(user, 'manager') and user.manager:
                    building_defaults['created_by_id'] = user.manager.id
                elif hasattr(user, 'employee') and user.employee:
                    building_defaults['created_by_employee_id'] = user.employee.id
                
                building, building_created = Building.objects.get_or_create(
                    base_address=base_address,
                    campaign_id=campaign_id,
                    defaults=building_defaults
                )
                
                if building_created:
                    logger.info(f"Created new building: {building.id} ({base_address})")
                else:
                    logger.info(f"Using existing building: {building.id}")
                
                # Step 2: Create apartments linked to building
                for apartment_number in apartment_numbers:
                    try:
                        # Use get_or_create for idempotency
                        apartment, was_created = Apartment.objects.get_or_create(
                            building=building,
                            apartment_number=apartment_number,
                            defaults={
                                'status': None,
                                'address': None,
                                # Deprecated fields (for backwards compatibility)
                                'base_address': base_address,
                                'campaign_id': campaign_id,
                            }
                        )
                        
                        if was_created:
                            created += 1
                            logger.debug(f"Created apartment: {apartment_number}")
                        else:
                            skipped += 1
                            logger.debug(f"Skipped existing apartment: {apartment_number}")
                    
                    except IntegrityError as e:
                        # Unique constraint violation - skip
                        skipped += 1
                        logger.warning(
                            f"IntegrityError for apartment {apartment_number}: {e}"
                        )
                    except Exception as e:
                        # Other errors - log but continue
                        errors.append({
                            'apartment_number': apartment_number,
                            'error': str(e)
                        })
                        logger.error(
                            f"Error creating apartment {apartment_number}: {e}"
                        )
                
                # Step 3: Update building counts ONCE at the end
                # This is the key optimization - not 100 times during loop!
                building.update_counts()
                logger.info(
                    f"Building {building.id} counts updated: "
                    f"{building.visited_units}/{building.total_units} ({building.status})"
                )
                
        except Exception as e:
            logger.error(f"Transaction failed during bulk create: {e}")
            return Response(
                {'error': f'Bulk create failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        total = len(apartment_numbers)
        message = f"Successfully created {created} apartments in building {building.id}"
        
        if skipped > 0:
            message += f", skipped {skipped} existing"
        
        if errors:
            message += f", encountered {len(errors)} errors"
        
        response_data = {
            'created': created,
            'skipped': skipped,
            'total': total,
            'building_id': str(building.id),
            'building_created': building_created,
            'message': message
        }
        
        if errors:
            response_data['errors'] = errors
        
        logger.info(
            f"Bulk create complete: {created} created, {skipped} skipped, "
            f"building={building.id} (new={building_created})"
        )
        
        return Response(response_data, status=status.HTTP_201_CREATED)
    
    @extend_schema(
        summary="Get apartment summary for a building",
        description=(
            "Get statistical summary of apartments for a building, "
            "including total count, visited/unvisited breakdown, and status distribution.\n\n"
            "NEW: Supports building_id (preferred) or base_address (legacy)."
        ),
        responses={
            200: ApartmentSummarySerializer,
            400: OpenApiResponse(description="Missing required parameters"),
        },
        parameters=[
            OpenApiParameter(
                name='building_id',
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                description='Building UUID (preferred)',
                required=False
            ),
            OpenApiParameter(
                name='base_address',
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description='Base address (legacy - use building_id instead)',
                required=False
            ),
            OpenApiParameter(
                name='campaign',
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                description='Campaign UUID (optional)',
                required=False
            ),
        ]
    )
    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        """
        Get summary statistics for apartments in a building.
        
        Query parameters:
        - building_id (preferred): Building UUID to get summary for
        - base_address (legacy): Base address to get summary for
        - campaign (optional): Filter by campaign (only needed with base_address)
        
        Response:
        {
            "building_id": "uuid",
            "base_address": "Hausmanns gate 19A, 0182 Oslo",
            "total_apartments": 100,
            "visited": 5,
            "unvisited": 95,
            "status_breakdown": {
                "ja": 3,
                "nei": 1,
                "ikke_hjemme": 1,
                "folg_opp": 0,
                "unvisited": 95
            },
            "last_visited_at": "2025-11-20T14:30:00Z"
        }
        """
        building_id = request.query_params.get('building_id')
        base_address = request.query_params.get('base_address')
        campaign_id = request.query_params.get('campaign')
        
        # Require either building_id or base_address
        if not building_id and not base_address:
            return Response(
                {'error': 'Either building_id or base_address parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Build queryset
        building = None
        if building_id:
            # NEW: Filter by building_id directly
            from buildings.models import Building
            try:
                building = Building.objects.get(id=building_id)
                queryset = Apartment.objects.filter(building_id=building_id)
                base_address = building.base_address  # For response
                campaign_id = str(building.campaign_id) if building.campaign_id else None
            except Building.DoesNotExist:
                return Response(
                    {'error': f'Building with id {building_id} not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
        else:
            # LEGACY: Filter by base_address
            queryset = Apartment.objects.filter(building__base_address=base_address)
            if campaign_id:
                queryset = queryset.filter(building__campaign_id=campaign_id)
        
        # Calculate statistics
        total_apartments = queryset.count()
        
        if total_apartments == 0:
            response_data = {
                'base_address': base_address,
                'total_apartments': 0,
                'visited': 0,
                'unvisited': 0,
                'status_breakdown': {'unvisited': 0},
                'last_visited_at': None,
            }
            if building_id:
                response_data['building_id'] = building_id
            if campaign_id:
                response_data['campaign_id'] = campaign_id
            return Response(response_data, status=status.HTTP_200_OK)
        
        visited = queryset.filter(status__isnull=False).count()
        unvisited = queryset.filter(status__isnull=True).count()
        
        # Status breakdown
        status_counts = queryset.values('status').annotate(
            count=Count('id')
        ).order_by('status')
        
        status_breakdown = {}
        for item in status_counts:
            if item['status'] is None:
                status_breakdown['unvisited'] = item['count']
            else:
                status_breakdown[item['status']] = item['count']
        
        # Last visited timestamp
        last_visited = queryset.filter(
            status__isnull=False
        ).aggregate(
            last_visit=Max('updated_at')
        )['last_visit']
        
        response_data = {
            'base_address': base_address,
            'total_apartments': total_apartments,
            'visited': visited,
            'unvisited': unvisited,
            'status_breakdown': status_breakdown,
            'last_visited_at': last_visited,
        }
        
        if building_id:
            response_data['building_id'] = building_id
        if campaign_id:
            response_data['campaign_id'] = campaign_id
        
        # Add building status if available
        if building:
            response_data['building_status'] = building.status
            response_data['is_completed'] = building.is_completed
        
        logger.info(
            f"Summary for {base_address}: {total_apartments} total, "
            f"{visited} visited, {unvisited} unvisited"
        )
        
        return Response(response_data, status=status.HTTP_200_OK)
    
    def create(self, request, *args, **kwargs):
        """
        Create is not allowed - use bulk-create instead.
        
        This prevents accidental single-apartment creation and ensures
        all apartments go through the bulk-create workflow.
        """
        return Response(
            {
                'error': 'Single apartment creation is not allowed. Use bulk-create endpoint instead.',
                'hint': 'POST /api/apartments/bulk-create/ with base_address and apartment_numbers'
            },
            status=status.HTTP_405_METHOD_NOT_ALLOWED
        )
    
    def update(self, request, *args, **kwargs):
        """
        Update apartment (typically to change status).
        
        When status changes:
        1. Update the apartment
        2. Create Address record (visit log)
        3. Link Address to Building (Ghost Buster)
        4. Link Address to Apartment
        5. Update building counts (triggers tile cache invalidation)
        
        This is when visits are recorded - user marks apartment as visited.
        """
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        # Store old status to check if it changed
        old_status = instance.status
        building = instance.building
        
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        
        # Reload instance to get updated status
        instance.refresh_from_db()
        new_status = instance.status
        
        # Check if status changed from null/different to a valid status
        if old_status != new_status and new_status is not None and building:
            logger.info(
                f"Apartment {instance.id} status changed: {old_status} → {new_status}"
            )
            
            # Step 1: Create Address record (visit log)
            try:
                from addresses.models import Address
                from django.contrib.gis.geos import Point
                
                # Build address text with apartment number
                address_text = f"{building.base_address}, leilighet {instance.apartment_number}"
                
                # Get current user info
                user = request.user
                employee = getattr(user, 'employee', None)
                manager = getattr(user, 'manager', None)
                
                # Get notes from request data (if provided)
                notes = request.data.get('notes', None)
                if notes:
                    notes = notes.strip() if isinstance(notes, str) else None
                    if not notes:  # Empty string after strip
                        notes = None
                
                # Create Address record
                address = Address.objects.create(
                    address_text=address_text,
                    status=new_status,
                    nei_subcategory=(
                        instance.nei_subcategory
                        if new_status == 'nei'
                        else None
                    ),
                    position=building.position,
                    campaign_id=building.campaign_id,
                    building=building,  # Ghost Buster link
                    employee=employee,
                    manager=manager if not employee else None,
                    notes=notes,  # Include notes if provided
                )
                
                # Step 2: Link Address to Apartment
                instance.address = address
                instance.save(update_fields=['address', 'updated_at'])
                
                logger.info(
                    f"✅ Created Address {address.id} for apartment {instance.apartment_number} "
                    f"(status: {new_status})"
                )
                
            except Exception as e:
                logger.error(
                    f"❌ Failed to create Address for apartment {instance.id}: {e}",
                    exc_info=True
                )
            
            # Step 3: Update building counts
            from buildings.signals import update_building_counts
            update_building_counts(building.id)
        
        if getattr(instance, '_prefetched_objects_cache', None):
            instance._prefetched_objects_cache = {}
        
        return Response(serializer.data)
    
    def destroy(self, request, *args, **kwargs):
        """
        Delete apartment record.
        
        This is allowed for cleanup purposes but should be used carefully.
        After deletion, building counts are updated.
        """
        instance = self.get_object()
        building_id = instance.building_id
        
        logger.warning(
            f"Deleting apartment: {instance.base_address}, {instance.apartment_number}"
        )
        
        response = super().destroy(request, *args, **kwargs)
        
        # Update building counts after deletion
        if building_id:
            from buildings.signals import update_building_counts
            update_building_counts(building_id)
        
        return response


def normalize_address_string(address_string: str) -> str:
    """
    Normalize address string to match database format.
    
    Handles:
    - Different apostrophe types (curly, straight, etc.)
    - Unicode normalization (NFD to NFC)
    - Norwegian characters (æ, ø, å)
    - Extra whitespace
    
    Args:
        address_string: Raw address string from API request
        
    Returns:
        Normalized address string
    """
    if not address_string:
        return ""
    
    # Unicode normalize (NFD -> NFC) to handle composed characters
    normalized = unicodedata.normalize('NFC', address_string)
    
    # Replace various apostrophe/quotation mark types with standard apostrophe
    # Common apostrophe/quotation characters:
    # U+0027: ' (straight apostrophe - standard)
    # U+2018: ' (left single quotation mark)
    # U+2019: ' (right single quotation mark - curly apostrophe)
    # U+201A: ‚ (single low-9 quotation mark)
    # U+201B: ‛ (single high-reversed-9 quotation mark)
    # U+2032: ′ (prime)
    apostrophe_replacements = {
        '\u2018': "'",  # Left single quotation mark
        '\u2019': "'",  # Right single quotation mark (curly apostrophe)
        '\u201A': "'",  # Single low-9 quotation mark
        '\u201B': "'",  # Single high-reversed-9 quotation mark
        '\u2032': "'",  # Prime
    }
    
    for old_char, new_char in apostrophe_replacements.items():
        normalized = normalized.replace(old_char, new_char)
    
    # Normalize whitespace
    normalized = ' '.join(normalized.split())
    
    return normalized.strip()


def parse_address_for_query(address_string: str):
    """
    Parse address string into components.
    
    Supports two formats:
    1. "Street Name Number[Letter], Postcode City" (e.g., "Hammerfestgata 2D, 0565 Oslo")
    2. "Street Name, Postcode City" (e.g., "Hausmanns gate, 0183 Oslo") - house number optional
    
    Normalizes the address string first to handle Unicode variations.
    
    Returns:
        dict with keys: street_name, house_number (optional), house_letter (optional), postcode
        Returns None if address format is invalid
    """
    # Normalize the address string first
    normalized_address = normalize_address_string(address_string)
    
    # Pattern 1: "Street Name Number[Letter], Postcode City"
    # Example: "Hammerfestgata 2D, 0565 Oslo"
    pattern_with_number = r'^(.+?)\s+(\d+)([A-Za-z]?),\s*(\d{4})\s+(.+)$'
    match = re.match(pattern_with_number, normalized_address)
    
    if match:
        street_name = match.group(1).strip()
        house_number = int(match.group(2))
        house_letter = match.group(3).strip().upper() if match.group(3) else None
        postcode = match.group(4).strip()
        
        return {
            'street_name': street_name,
            'house_number': house_number,
            'house_letter': house_letter,
            'postcode': postcode
        }
    
    # Pattern 2: "Street Name, Postcode City" (without house number)
    # Example: "Hausmanns gate, 0183 Oslo"
    pattern_without_number = r'^(.+?),\s*(\d{4})\s+(.+)$'
    match = re.match(pattern_without_number, normalized_address)
    
    if match:
        street_name = match.group(1).strip()
        postcode = match.group(2).strip()
        
        # Check if street_name ends with a number (might be misparsed)
        # If it does, try to extract it
        street_match = re.match(r'^(.+?)\s+(\d+)([A-Za-z]?)$', street_name)
        if street_match:
            # Actually has a house number, use pattern 1 logic
            street_name = street_match.group(1).strip()
            house_number = int(street_match.group(2))
            house_letter = street_match.group(3).strip().upper() if street_match.group(3) else None
            
            return {
                'street_name': street_name,
                'house_number': house_number,
                'house_letter': house_letter,
                'postcode': postcode
            }
        
        # No house number found
        return {
            'street_name': street_name,
            'house_number': None,
            'house_letter': None,
            'postcode': postcode
        }
    
    # No pattern matched
    return None


class LocalApartmentsLookupView(APIView):
    """
    API endpoint to lookup apartments from local_apartments table.
    
    Takes an address string and returns all apartments for that building.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    @extend_schema(
        summary="Lookup apartments from local_apartments",
        description=(
            "Query the local_apartments table to find all apartments for a given address. "
            "Address format: 'Street Name Number[Letter], Postcode City' "
            "Example: 'Hammerfestgata 2D, 0565 Oslo'"
        ),
        parameters=[
            OpenApiParameter(
                name='address',
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                required=True,
                description='Address string in format: "Street Name Number[Letter], Postcode City"'
            ),
            OpenApiParameter(
                name='campaign_id',
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                required=False,
                description='Campaign ID (optional, for response)'
            ),
            OpenApiParameter(
                name='created_by_id',
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                required=False,
                description='Created by ID (optional, for response)'
            ),
        ],
        responses={
            200: {
                "type": "object",
                "properties": {
                    "base_address": {"type": "string"},
                    "apartment_numbers": {
                        "type": "array",
                        "items": {"type": "string"}
                    },
                    "campaign_id": {"type": "string", "format": "uuid", "nullable": True},
                    "position": {
                        "type": "object",
                        "properties": {
                            "lat": {"type": "number"},
                            "lon": {"type": "number"}
                        }
                    },
                    "created_by_id": {"type": "string", "format": "uuid", "nullable": True}
                }
            },
            400: OpenApiResponse(description="Invalid address format"),
            404: OpenApiResponse(description="Address not found"),
        },
        tags=['Apartments']
    )
    def get(self, request):
        """
        Lookup apartments for a given address.
        
        Query parameters:
        - address: Address string (required)
        - campaign_id: Campaign ID (optional)
        - created_by_id: Created by ID (optional)
        """
        address_string = request.query_params.get('address')
        if not address_string:
            return Response(
                {'error': 'address parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Normalize the address string to handle Unicode variations
        normalized_address = normalize_address_string(address_string)
        logger.debug(f"Original address: {address_string}")
        logger.debug(f"Normalized address: {normalized_address}")
        
        # Parse address (using normalized version)
        address_parts = parse_address_for_query(normalized_address)
        if not address_parts:
            return Response(
                {'error': f'Invalid address format. Expected: "Street Name Number[Letter], Postcode City" or "Street Name, Postcode City". Got: "{normalized_address}"'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        street_name = address_parts['street_name']
        house_number = address_parts.get('house_number')
        house_letter = address_parts.get('house_letter')
        postcode = address_parts['postcode']
        
        # House number is required for apartment lookup
        if house_number is None:
            return Response(
                {'error': f'House number is required. Address format: "Street Name Number[Letter], Postcode City". Got: "{normalized_address}"'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        logger.info(
            f"Looking up apartments for: {street_name} {house_number}{house_letter or ''}, {postcode}"
        )
        
        # Query local_apartments table
        with connection.cursor() as cursor:
            # Build query with optional house_letter
            if house_letter:
                query = """
                    SELECT 
                        address_uuid,
                        unit_id,
                        full_address,
                        position
                    FROM public.local_apartments 
                    WHERE street_name ILIKE %s
                    AND house_number = %s
                    AND house_letter = %s
                    AND postcode = %s
                    ORDER BY unit_id NULLS LAST
                """
                params = [f'%{street_name}%', house_number, house_letter, postcode]
            else:
                query = """
                    SELECT 
                        address_uuid,
                        unit_id,
                        full_address,
                        position
                    FROM public.local_apartments 
                    WHERE street_name ILIKE %s
                    AND house_number = %s
                    AND (house_letter IS NULL OR house_letter = '')
                    AND postcode = %s
                    ORDER BY unit_id NULLS LAST
                """
                params = [f'%{street_name}%', house_number, postcode]
            
            # Log query for debugging
            logger.debug(f"Executing query with params: {params}")
            
            try:
                cursor.execute(query, params)
                rows = cursor.fetchall()
                logger.info(f"Query returned {len(rows)} rows")
            except Exception as e:
                logger.error(f"Database query error: {e}", exc_info=True)
                return Response(
                    {'error': f'Database query failed: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
            if not rows:
                # Log the actual query parameters for debugging
                logger.warning(
                    f"No records found for address: {normalized_address} "
                    f"(street_name: {street_name}, house_number: {house_number}, "
                    f"house_letter: {house_letter}, postcode: {postcode})"
                )
                return Response(
                    {'error': f'Address not found in database: {normalized_address}'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Extract data
            apartment_numbers = []
            base_address = None
            address_uuid = None
            
            for row in rows:
                addr_uuid, unit_id, full_address, position = row
                
                # Store address_uuid from first row
                if not address_uuid:
                    address_uuid = addr_uuid
                
                # Get base address from first record
                if not base_address:
                    # Extract base address (remove unit_id suffix if present)
                    base_address = full_address
                    if unit_id and full_address.endswith(f'-{unit_id}'):
                        base_address = full_address[:-len(f'-{unit_id}')]
                
                # Collect apartment numbers (only if unit_id exists)
                if unit_id:
                    apartment_numbers.append(unit_id)
            
            # Calculate building center from all positions
            building_center = None
            if address_uuid:
                cursor.execute("""
                    SELECT ST_Y(ST_Centroid(ST_Collect(position))) as lat, 
                           ST_X(ST_Centroid(ST_Collect(position))) as lon
                    FROM public.local_apartments 
                    WHERE address_uuid = %s
                """, [address_uuid])
                coords = cursor.fetchone()
                if coords and coords[0] is not None and coords[1] is not None:
                    building_center = {'lat': float(coords[0]), 'lon': float(coords[1])}
            
            # Build response - return even if no apartments (standalone house)
            response_data = {
                'base_address': base_address or address_string,
                'apartment_numbers': sorted(apartment_numbers),
                'position': building_center or {'lat': None, 'lon': None}
            }
            
            # Add optional fields from query params
            campaign_id = request.query_params.get('campaign_id')
            if campaign_id:
                response_data['campaign_id'] = campaign_id
            
            created_by_id = request.query_params.get('created_by_id')
            if created_by_id:
                response_data['created_by_id'] = created_by_id
            
            logger.info(
                f"Found {len(apartment_numbers)} apartments for {base_address}"
            )
            
            return Response(response_data, status=status.HTTP_200_OK)


class BuildingLocalApartmentsMatchView(APIView):
    """
    API endpoint to find matching local_apartments for a building.
    
    Bidirectional lookup: Building → local_apartments
    """
    permission_classes = [permissions.IsAuthenticated]
    
    @extend_schema(
        summary="Find local_apartments matches for a building",
        description=(
            "Find matching addresses in local_apartments table for a given building. "
            "Uses geometry proximity, postcode matching, and address parsing. "
            "Returns matched local_apartments with match scores and geometry comparison."
        ),
        parameters=[
            OpenApiParameter(
                name='building_id',
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                required=True,
                description='Building UUID to find matches for'
            ),
            OpenApiParameter(
                name='include_geometry',
                type=OpenApiTypes.BOOL,
                location=OpenApiParameter.QUERY,
                required=False,
                description='Include detailed geometry comparison (default: true)'
            ),
        ],
        responses={
            200: OpenApiResponse(description="Matching local_apartments found"),
            404: OpenApiResponse(description="Building not found"),
        },
        tags=['Apartments']
    )
    def get(self, request):
        """
        Find local_apartments matches for a building.
        
        Query parameters:
        - building_id: Building UUID (required)
        - include_geometry: Include geometry comparison (optional, default: true)
        """
        from .local_apartments_matcher import get_building_local_apartments_mapping
        
        building_id = request.query_params.get('building_id')
        if not building_id:
            return Response(
                {'error': 'building_id parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        include_geometry = request.query_params.get('include_geometry', 'true').lower() == 'true'
        
        try:
            result = get_building_local_apartments_mapping(
                building_id,
                include_geometry_comparison=include_geometry
            )
            
            if 'error' in result:
                return Response(
                    result,
                    status=status.HTTP_404_NOT_FOUND
                )
            
            return Response(result, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error finding local_apartments matches: {e}", exc_info=True)
            return Response(
                {'error': f'Error finding matches: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class LocalApartmentsBuildingMatchView(APIView):
    """
    API endpoint to find matching buildings/apartments for a local_apartments address.
    
    Reverse lookup: local_apartments → Building/Apartment
    """
    permission_classes = [permissions.IsAuthenticated]
    
    @extend_schema(
        summary="Find building/apartment matches for local_apartments address",
        description=(
            "Find matching buildings and apartments for a given local_apartments address. "
            "Uses geometry proximity, postcode matching, and unit ID comparison."
        ),
        parameters=[
            OpenApiParameter(
                name='full_address',
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                required=True,
                description='Full address from local_apartments (e.g., "Haukland, 24/4-H0102")'
            ),
            OpenApiParameter(
                name='postcode',
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                required=True,
                description='Postcode (e.g., "4460")'
            ),
            OpenApiParameter(
                name='lat',
                type=OpenApiTypes.FLOAT,
                location=OpenApiParameter.QUERY,
                required=True,
                description='Latitude of the address'
            ),
            OpenApiParameter(
                name='lon',
                type=OpenApiTypes.FLOAT,
                location=OpenApiParameter.QUERY,
                required=True,
                description='Longitude of the address'
            ),
            OpenApiParameter(
                name='campaign_id',
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                required=False,
                description='Optional campaign ID to filter buildings'
            ),
        ],
        responses={
            200: OpenApiResponse(description="Matching buildings/apartments found"),
            400: OpenApiResponse(description="Invalid parameters"),
        },
        tags=['Apartments']
    )
    def get(self, request):
        """
        Find building/apartment matches for a local_apartments address.
        
        Query parameters:
        - full_address: Full address from local_apartments (required)
        - postcode: Postcode (required)
        - lat: Latitude (required)
        - lon: Longitude (required)
        - campaign_id: Optional campaign ID filter
        """
        from .local_apartments_matcher import find_apartments_for_local_address
        from django.contrib.gis.geos import Point
        
        full_address = request.query_params.get('full_address')
        postcode = request.query_params.get('postcode')
        lat = request.query_params.get('lat')
        lon = request.query_params.get('lon')
        campaign_id = request.query_params.get('campaign_id')
        
        if not all([full_address, postcode, lat, lon]):
            return Response(
                {'error': 'full_address, postcode, lat, and lon parameters are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            lat_float = float(lat)
            lon_float = float(lon)
            local_position = Point(lon_float, lat_float, srid=4326)
        except (ValueError, TypeError) as e:
            return Response(
                {'error': f'Invalid lat/lon values: {e}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            results = find_apartments_for_local_address(
                full_address,
                postcode,
                local_position,
                campaign_id
            )
            
            return Response({
                'local_address': {
                    'full_address': full_address,
                    'postcode': postcode,
                    'position': {'lat': lat_float, 'lon': lon_float}
                },
                'matches': results,
                'total_matches': len(results)
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error finding building matches: {e}", exc_info=True)
            return Response(
                {'error': f'Error finding matches: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class GeometryComparisonView(APIView):
    """
    API endpoint to compare geometries between building and local_apartments.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    @extend_schema(
        summary="Compare building geometry with local_apartments geometries",
        description=(
            "Compare a building's geometry with multiple local_apartments geometries. "
            "Returns distance measurements and match statistics."
        ),
        request={
            'type': 'object',
            'properties': {
                'building_id': {'type': 'string', 'format': 'uuid'},
                'local_address_ids': {
                    'type': 'array',
                    'items': {'type': 'integer'},
                    'description': 'List of local_apartments IDs to compare'
                },
                'tolerance_meters': {
                    'type': 'number',
                    'default': 50,
                    'description': 'Distance tolerance in meters'
                }
            },
            'required': ['building_id', 'local_address_ids']
        },
        responses={
            200: OpenApiResponse(description="Geometry comparison results"),
            400: OpenApiResponse(description="Invalid request"),
        },
        tags=['Apartments']
    )
    def post(self, request):
        """
        Compare building geometry with local_apartments geometries.
        
        Request body:
        {
            "building_id": "uuid",
            "local_address_ids": [1, 2, 3],
            "tolerance_meters": 50
        }
        """
        from .local_apartments_matcher import compare_geometries
        from django.contrib.gis.geos import Point
        from django.db import connection
        
        building_id = request.data.get('building_id')
        local_address_ids = request.data.get('local_address_ids', [])
        tolerance_meters = float(request.data.get('tolerance_meters', 50))
        
        if not building_id:
            return Response(
                {'error': 'building_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not local_address_ids:
            return Response(
                {'error': 'local_address_ids is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Get building position
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT position
                    FROM building
                    WHERE id = %s
                """, [building_id])
                
                building_row = cursor.fetchone()
                if not building_row:
                    return Response(
                        {'error': 'Building not found'},
                        status=status.HTTP_404_NOT_FOUND
                    )
                
                building_position = Point.from_wkt(building_row[0], srid=4326)
            
            # Get local_apartments positions
            with connection.cursor() as cursor:
                placeholders = ','.join(['%s'] * len(local_address_ids))
                cursor.execute(f"""
                    SELECT position
                    FROM public.local_apartments
                    WHERE id IN ({placeholders})
                """, local_address_ids)
                
                local_positions = [
                    Point.from_wkt(row[0], srid=4326)
                    for row in cursor.fetchall()
                ]
            
            # Compare geometries
            comparison = compare_geometries(
                building_position,
                local_positions,
                tolerance_meters
            )
            
            return Response({
                'building_id': building_id,
                'local_address_ids': local_address_ids,
                'comparison': comparison
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error comparing geometries: {e}", exc_info=True)
            return Response(
                {'error': f'Error comparing geometries: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
