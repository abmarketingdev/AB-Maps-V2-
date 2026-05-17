"""
Views for the addresses app.
"""
import logging
import json
from rest_framework import viewsets, filters, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import StreamingHttpResponse
from django_filters.rest_framework import DjangoFilterBackend
from django.contrib.gis.geos import Point
from django.utils import timezone
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiExample
from .models import Address
from .serializers import (
    AddressSerializer,
    AddressGeoSerializer,
    AddressNDJSONSerializer,
)
from .permissions import AddressPermission

logger = logging.getLogger(__name__)


class AddressViewSet(viewsets.ModelViewSet):
    """ViewSet for Address model (merged)."""
    queryset = Address.objects.all()
    serializer_class = AddressSerializer
    permission_classes = [AddressPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'employee', 'manager', 'campaign', 'recorded_at']
    search_fields = ['address_text', 'notes', 'employee__name', 'manager__name', 'campaign__name']
    ordering_fields = ['recorded_at', 'status', 'address_text']
    ordering = ['-recorded_at']
    http_method_names = ['get', 'post', 'put', 'patch', 'delete']  # Explicitly allow all methods

    def get_queryset(self):
        """Filter addresses based on campaign ID from headers."""
        queryset = Address.objects.all()
        
        # Get campaign_id from headers
        campaign_id = self.request.headers.get('X-Campaign-ID')
        
        # Filter by campaign if campaign_id is provided
        if campaign_id:
            try:
                # Handle both UUID strings and JSON objects
                if campaign_id.startswith('{'):
                    # It's a JSON object, extract the ID
                    try:
                        campaign_data = json.loads(campaign_id)
                        campaign_id = campaign_data.get('id')
                        logger.info(f"Extracted campaign ID from JSON in addresses: {campaign_id}")
                    except json.JSONDecodeError:
                        logger.error(f"Invalid JSON in X-Campaign-ID header in addresses: {campaign_id}")
                        return Address.objects.none()
                
                if campaign_id:
                    # Filter addresses to only show those belonging to the current campaign
                    queryset = queryset.filter(campaign_id=campaign_id)
                    logger.info(f"Filtered addresses for campaign {campaign_id}: {queryset.count()} addresses found")
                else:
                    logger.warning("No campaign ID found in JSON object in addresses")
                    return Address.objects.none()
                    
            except Exception as e:
                logger.error(f"Error filtering addresses by campaign {campaign_id}: {e}")
                return Address.objects.none()
        else:
            logger.info("No X-Campaign-ID header provided in addresses, showing all addresses (legacy behavior)")
        
        return queryset

    def perform_create(self, serializer):
        user = self.request.user
        if hasattr(user, 'employee') and user.employee:
            serializer.save(employee=user.employee)
        elif hasattr(user, 'manager') and user.manager:
            serializer.save(manager=user.manager)
        else:
            raise PermissionDenied("User must be either employee or manager")
    
    def create(self, request, *args, **kwargs):
        """Override create to handle user assignment properly."""
        # Add user info to the data
        data = request.data.copy()
        user = request.user
        
        if hasattr(user, 'employee') and user.employee:
            data['employee_id'] = str(user.employee.id)
        elif hasattr(user, 'manager') and user.manager:
            data['manager_id'] = str(user.manager.id)
        else:
            return Response(
                {'error': 'User must be either employee or manager'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Use the modified data
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    # No custom throttling for bulk; rely on global settings (currently disabled for bulk)

    def list(self, request, *args, **kwargs):
        """List addresses with optional bulk streaming support.

        - Default: paginated (unchanged)
        - bulk=true: stream all matching items in one response
            - format=ndjson -> application/x-ndjson, one JSON object per line
            - format=json   -> application/json, standard envelope with results array streamed
        """
        bulk = request.query_params.get('bulk', '').lower() == 'true'
        if not bulk:
            return super().list(request, *args, **kwargs)

        # Build filtered queryset using existing mechanics
        queryset = self.filter_queryset(self.get_queryset())

        # Avoid N+1 for nested relations used by serializer
        queryset = queryset.select_related('campaign', 'employee', 'manager')

        # Remove default ordering to start streaming ASAP unless client explicitly requests ordering
        if not request.query_params.get('ordering'):
            queryset = queryset.order_by()

        # Decide bulk output format (avoid DRF's built-in format param to prevent 404)
        fmt = request.query_params.get('bulk_format', 'json').lower()

        # Serializer shortcut
        def serialize_instance(instance):
            if fmt == 'ndjson':
                data = AddressNDJSONSerializer(instance).data
            else:
                data = self.get_serializer(instance).data
            return json.dumps(data)

        if fmt == 'ndjson':
            def ndjson_stream():
                for obj in queryset.iterator(chunk_size=200):
                    yield serialize_instance(obj) + "\n"

            response = StreamingHttpResponse(ndjson_stream(), content_type='application/x-ndjson')
            response['Cache-Control'] = 'no-cache, no-transform'
            response['X-Accel-Buffering'] = 'no'
            return response

        # Default json envelope streamed
        # Count after filters (can be expensive; only do it for JSON envelope)
        total_count = queryset.count()
        def json_stream():
            yield '{"count": ' + str(total_count) + ', "next": null, "previous": null, "results":['
            first = True
            for obj in queryset.iterator(chunk_size=200):
                if not first:
                    yield ','
                first = False
                yield serialize_instance(obj)
            yield ']}'

        response = StreamingHttpResponse(json_stream(), content_type='application/json')
        response['Cache-Control'] = 'no-cache, no-transform'
        response['X-Accel-Buffering'] = 'no'
        response['X-Bulk-Items'] = str(total_count)
        return response

    @extend_schema(
        summary="Bulk create addresses",
        description="Create multiple addresses at once. Automatically assigns the current user as employee or manager.",
        request=AddressSerializer(many=True),
        responses={
            201: AddressSerializer(many=True),
            400: "Bad Request",
            403: "Forbidden"
        }
    )
    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        user = self.request.user
        for item in request.data:
            if hasattr(user, 'employee') and user.employee:
                item['employee_id'] = str(user.employee.id)
            elif hasattr(user, 'manager') and user.manager:
                item['manager_id'] = str(user.manager.id)
            else:
                return Response(
                    {'error': 'User must be either employee or manager'},
                    status=status.HTTP_403_FORBIDDEN
                )
        serializer = self.get_serializer(data=request.data, many=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @extend_schema(
        summary="Get addresses by user type",
        description="Filter addresses by user type (employee or manager).",
        parameters=[
            OpenApiParameter(
                name='user_type', 
                type=str, 
                description='User type to filter by: "employee" or "manager"',
                required=False,
                enum=['employee', 'manager']
            ),
        ],
        responses={
            200: AddressSerializer(many=True),
            400: "Bad Request"
        }
    )
    @action(detail=False, methods=['get'])
    def by_user_type(self, request):
        user_type = request.query_params.get('user_type', '').lower()
        if user_type == 'employee':
            queryset = self.queryset.filter(employee__isnull=False)
        elif user_type == 'manager':
            queryset = self.queryset.filter(manager__isnull=False)
        else:
            queryset = self.queryset
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @extend_schema(
        summary="Get addresses filtered by campaign",
        description="Returns all addresses for a specific campaign. If no campaign_id is provided, returns all addresses that have a campaign assigned.",
        parameters=[
            OpenApiParameter(
                name='campaign_id', 
                type=str, 
                description='Campaign ID to filter addresses by (preferred parameter). If not provided, returns all addresses with campaigns.',
                required=False
            ),
            OpenApiParameter(
                name='campaign', 
                type=str, 
                description='Campaign ID to filter addresses by (alternative parameter, same as campaign_id). For backward compatibility.',
                required=False
            ),
            OpenApiParameter(
                name='status', 
                type=str, 
                description='Filter by status: "ja", "ikke_hjemme", "nei", or "folg_opp"',
                required=False,
                enum=['ja', 'ikke_hjemme', 'nei', 'folg_opp']
            ),
            OpenApiParameter(
                name='employee', 
                type=str, 
                description='Filter by employee ID',
                required=False
            ),
            OpenApiParameter(
                name='manager', 
                type=str, 
                description='Filter by manager ID',
                required=False
            ),
            OpenApiParameter(
                name='recorded_at', 
                type=str, 
                description='Filter by recorded date (YYYY-MM-DD)',
                required=False
            ),
        ],
        responses={
            200: AddressSerializer(many=True),
            400: "Bad Request",
            401: "Unauthorized",
            403: "Forbidden"
        },
        examples=[
            OpenApiExample(
                'Success Response with Campaign ID',
                value=[
                    {
                        'id': '456e7890-e89b-12d3-a456-426614174001',
                        'address_text': '123 Main Street, Oslo',
                        'status': 'ja',
                        'status_display': 'Ja',
                        'status_color': '#28a745',
                        'position': None,
                        'tags': {},
                        'recorded_at': '2024-01-15T10:30:00Z',
                        'campaign': {
                            'id': '123e4567-e89b-12d3-a456-426614174000',
                            'name': 'Norsk folkehjelp',
                            'description': 'Campaign for Norwegian aid'
                        },
                        'employee': {
                            'id': '789e0123-e89b-12d3-a456-426614174002',
                            'name': 'John Doe',
                            'email': 'john@example.com'
                        },
                        'manager': None
                    }
                ],
                response_only=True
            )
        ]
    )
    @action(detail=False, methods=['get'])
    def by_campaign(self, request):
        """Get addresses filtered by campaign."""
        # Accept both 'campaign_id' and 'campaign' parameters for backward compatibility
        campaign_id_param = request.query_params.get('campaign_id')
        campaign_param = request.query_params.get('campaign')
        
        # Use campaign_id if provided, otherwise fall back to campaign
        campaign_id = campaign_id_param or campaign_param
        
        # Log warning if both parameters are provided
        if campaign_id_param and campaign_param:
            logger.warning(f"Both 'campaign_id' and 'campaign' parameters provided. Using 'campaign_id': {campaign_id_param}")
        
        # Start with the base queryset
        if campaign_id:
            queryset = self.queryset.filter(campaign_id=campaign_id)
        else:
            queryset = self.queryset.filter(campaign__isnull=False)
        
        # Apply DjangoFilterBackend filters (status, employee, manager, etc.)
        for backend in self.filter_backends:
            queryset = backend().filter_queryset(request, queryset, self)
        
        # Apply pagination
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
