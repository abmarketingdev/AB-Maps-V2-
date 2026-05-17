import json
import logging
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema, OpenApiExample, OpenApiParameter
from drf_spectacular.types import OpenApiTypes
from django.db import connection
from django.contrib.gis.geos import GEOSGeometry
from django.db.models import Count, Sum, Case, When, IntegerField

from .serializers import (
    PolygonDeleteRequestSerializer, 
    DeletionResultSerializer,
    PolygonSearchRequestSerializer,
    PolygonSearchResponseSerializer
)
from .services import PolygonDeletionService
from .permissions import ManagerOnlyPermission
from campaigns.models import Campaign

logger = logging.getLogger(__name__)


class PolygonDeleteView(APIView):
    """
    Delete all entities within a drawn polygon.
    
    Supports:
    - Addresses (visit logs)
    - Uploaded Addresses (CSV imports)
    - Areas (custom drawn regions)
    - Buildings (with apartments)
    
    Use dry_run=true to preview without deleting.
    """
    permission_classes = [ManagerOnlyPermission]
    
    @extend_schema(
        summary="Delete entities within polygon",
        description="Delete all addresses, areas, buildings, and uploaded addresses within a GeoJSON polygon boundary. Scoped to the campaign specified in X-Campaign-ID header.",
        request=PolygonDeleteRequestSerializer,
        responses={
            200: DeletionResultSerializer,
            400: "Bad Request - Invalid polygon or parameters",
            401: "Unauthorized",
            403: "Forbidden - Manager only",
            404: "Campaign not found",
            500: "Internal server error"
        },
        examples=[
            OpenApiExample(
                'Dry Run Example',
                value={
                    "polygon": {
                        "type": "Polygon",
                        "coordinates": [[[10.75, 59.91], [10.76, 59.91], [10.76, 59.92], [10.75, 59.92], [10.75, 59.91]]]
                    },
                    "dry_run": True
                },
                request_only=True
            ),
            OpenApiExample(
                'Full Delete Example',
                value={
                    "polygon": {
                        "type": "Polygon",
                        "coordinates": [[[10.75, 59.91], [10.76, 59.91], [10.76, 59.92], [10.75, 59.92], [10.75, 59.91]]]
                    },
                    "entity_types": ["addresses", "uploaded_addresses"],
                    "dry_run": False
                },
                request_only=True
            )
        ]
    )
    def post(self, request):
        # Validate request
        serializer = PolygonDeleteRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        # Get campaign ID from header
        campaign_id = request.headers.get('X-Campaign-ID')
        if not campaign_id:
            return Response(
                {'error': 'X-Campaign-ID header is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Handle JSON format in header
        if campaign_id.startswith('{'):
            try:
                campaign_id = json.loads(campaign_id).get('id')
            except json.JSONDecodeError:
                return Response(
                    {'error': 'Invalid X-Campaign-ID format'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Get validated data
        polygon = serializer.validated_data['polygon']
        entity_types = serializer.validated_data['entity_types']
        dry_run = serializer.validated_data['dry_run']
        include_partial = serializer.validated_data['include_partial_areas']
        
        try:
            # Initialize service
            service = PolygonDeletionService(polygon, campaign_id)
            
            # Get campaign info
            campaign = service.campaign
            
            # Base response
            response_data = {
                'success': True,
                'dry_run': dry_run,
                'campaign_id': str(campaign.id),
                'campaign_name': campaign.name,
                'polygon_area_km2': round(service.area_km2, 2)
            }
            
            if dry_run:
                # Preview only
                preview = service.preview(entity_types, include_partial)
                response_data.update(preview)
                response_data['warning'] = "This operation cannot be undone. Run with dry_run=false to execute."
            else:
                # Execute deletion
                result = service.execute(entity_types, include_partial)
                response_data.update(result)
            
            return Response(response_data, status=status.HTTP_200_OK)
            
        except ValueError as e:
            logger.error(f"Polygon deletion validation error: {e}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Campaign.DoesNotExist:
            return Response(
                {'error': 'Campaign not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Polygon deletion error: {e}", exc_info=True)
            return Response(
                {
                    'error': 'Internal server error during deletion',
                    'details': 'Transaction rolled back. No data was deleted.'
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class PolygonSearchView(APIView):
    """
    High-performance polygon search API.
    
    Searches for addresses within a drawn polygon and returns:
    - Summary statistics (houses, apartment buildings, total apartments)
    - List of all addresses with their details
    """
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        summary="Search addresses within polygon",
        description="Returns summary statistics (counts) for addresses within a GeoJSON polygon. "
                    "Uses optimized PostGIS spatial queries for high performance.",
        request=PolygonSearchRequestSerializer,
        responses={
            200: PolygonSearchResponseSerializer,
            400: "Bad Request - Invalid polygon format",
            401: "Unauthorized"
        },
        examples=[
            OpenApiExample(
                'Search Example',
                value={
                    "polygon": {
                        "type": "Polygon",
                        "coordinates": [[[10.75, 59.91], [10.76, 59.91], [10.76, 59.92], [10.75, 59.92], [10.75, 59.91]]]
                    }
                },
                request_only=True
            )
        ],
        tags=['Polygon Operations']
    )
    def post(self, request):
        """Search addresses within polygon."""
        # Validate request
        serializer = PolygonSearchRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        polygon_geojson = serializer.validated_data['polygon']
        
        try:
            # Convert GeoJSON to PostGIS geometry
            polygon_geom = GEOSGeometry(json.dumps(polygon_geojson))
            polygon_wkt = polygon_geom.wkt
            
            # Execute optimized single query to get both summary and results
            with connection.cursor() as cursor:
                # Single query that gets both summary stats and address list
                # Uses CTE (Common Table Expression) for efficiency
                cursor.execute("""
                    WITH polygon_filter AS (
                        SELECT ST_GeomFromText(%s, 4326) AS geom
                    ),
                    grouped_addresses AS (
                        SELECT
                            COALESCE(
                                la.address_uuid,
                                'coord_' || ROUND(ST_X(la.position)::numeric, 6) || '_' || ROUND(ST_Y(la.position)::numeric, 6)
                            ) AS address_uuid,
                            MIN(la.full_address) AS full_address,
                            MAX(la.postcode) AS postcode,
                            MAX(la.post_area) AS city,
                            ST_Centroid(ST_Collect(la.position)) AS geom,
                            jsonb_agg(
                                jsonb_build_object(
                                    'unit_id', la.unit_id,
                                    'unit_uuid', la.unit_uuid,
                                    'full_address', la.full_address
                                ) ORDER BY la.unit_id
                            ) FILTER (WHERE la.unit_id IS NOT NULL) AS units,
                            COUNT(la.unit_id) FILTER (WHERE la.unit_id IS NOT NULL) AS unit_count
                        FROM public.local_apartments la
                        CROSS JOIN polygon_filter pf
                        WHERE ST_Intersects(la.position, pf.geom)
                        GROUP BY COALESCE(
                            la.address_uuid,
                            'coord_' || ROUND(ST_X(la.position)::numeric, 6) || '_' || ROUND(ST_Y(la.position)::numeric, 6)
                        )
                    )
                    SELECT
                        -- Summary statistics only
                        COUNT(*) FILTER (WHERE unit_count = 0) AS total_houses,
                        COUNT(*) FILTER (WHERE unit_count > 0) AS total_apartment_buildings,
                        COALESCE(SUM(unit_count), 0) AS total_individual_apartments
                    FROM grouped_addresses
                """, [polygon_wkt])
                
                row = cursor.fetchone()
                
                # Extract summary statistics (convert to int for JSON serialization)
                total_houses = int(row[0] or 0)
                total_apartment_buildings = int(row[1] or 0)
                total_individual_apartments = int(row[2] or 0)
            
            # Build response (summary only)
            response_data = {
                'summary': {
                    'total_houses': total_houses,
                    'total_apartment_buildings': total_apartment_buildings,
                    'total_individual_apartments': total_individual_apartments
                }
            }
            
            return Response(response_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Polygon search error: {e}", exc_info=True)
            return Response(
                {'error': f'Error processing polygon search: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
