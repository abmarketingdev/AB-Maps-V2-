"""
Views for talkmore_enrichment app.
"""
import logging
import json
import os
import time
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import connection
from django.contrib.gis.geos import Polygon
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiResponse
from drf_spectacular.types import OpenApiTypes
from .models import EnrichmentJob, EnrichedAddressResult
from .serializers import (
    EnrichmentJobStatusSerializer,
    EnrichedAddressResultSerializer,
    EnrichedAddressGeoJSONSerializer
)
from areas.models import Area, AreaEmployee
from campaigns.models import CampaignArea
from talkmore_enrichment.carrier_rules import address_show_marker_from_carrier_summary

logger = logging.getLogger(__name__)

# #region agent log
# Debug logging disabled in production - use Django logging instead
def _debug_log(location, message, data=None, hypothesis_id=None):
    # Disabled in production - use logger.debug() instead
    pass
# #endregion


class JobStatusView(APIView):
    """Get job status."""
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        summary="Get enrichment job status",
        description="Returns the current status and progress of an enrichment job.",
        responses={
            200: EnrichmentJobStatusSerializer,
            404: OpenApiResponse(description="Job not found")
        },
        tags=['Talkmore Enrichment']
    )
    def get(self, request, job_id):
        """Get job status."""
        try:
            # Use select_related for ForeignKey optimization
            job = EnrichmentJob.objects.select_related('area', 'campaign').get(id=job_id)
        except EnrichmentJob.DoesNotExist:
            return Response(
                {'error': 'Job not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        serializer = EnrichmentJobStatusSerializer(job)
        return Response(serializer.data)


class JobResultsView(APIView):
    """Get job results as GeoJSON."""
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        summary="Get enrichment job results",
        description="Returns enriched address results as GeoJSON FeatureCollection. "
                    "Only returns addresses with show_marker=True. "
                    "Optionally filter by bbox (bounding box).",
        parameters=[
            OpenApiParameter(
                name='bbox',
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                required=False,
                description='Bounding box: west,south,east,north (comma-separated)'
            )
        ],
        responses={
            200: OpenApiResponse(
                description="GeoJSON FeatureCollection",
                response={
                    'type': 'object',
                    'properties': {
                        'type': {'type': 'string', 'example': 'FeatureCollection'},
                        'features': {'type': 'array'}
                    }
                }
            ),
            404: OpenApiResponse(description="Job not found")
        },
        tags=['Talkmore Enrichment']
    )
    def get(self, request, job_id):
        """Get job results as GeoJSON."""
        try:
            # Use select_related for ForeignKey optimization
            job = EnrichmentJob.objects.select_related('area', 'campaign').get(id=job_id)
        except EnrichmentJob.DoesNotExist:
            return Response(
                {'error': 'Job not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get bbox parameter if provided
        bbox_str = request.query_params.get('bbox')
        bbox = None
        if bbox_str:
            try:
                bbox_parts = [float(x.strip()) for x in bbox_str.split(',')]
                if len(bbox_parts) != 4:
                    return Response(
                        {'error': 'bbox must have 4 values: west,south,east,north'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                west, south, east, north = bbox_parts
                # Create polygon from bbox
                bbox = Polygon.from_bbox((west, south, east, north))
                bbox.srid = 4326
            except ValueError:
                return Response(
                    {'error': 'Invalid bbox format. Expected: west,south,east,north'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Query results with show_marker=True only
        # Use select_related for job ForeignKey (already filtered by job, but good practice)
        queryset = EnrichedAddressResult.objects.filter(
            job=job,
            show_marker=True
        ).select_related('job')
        
        # Apply bbox filter if provided (uses GIST index on geom)
        if bbox:
            queryset = queryset.filter(geom__intersects=bbox)
        
        # Serialize to GeoJSON; drop rows that fail strict carrier rules (stale DB rows)
        features = []
        for result in queryset.iterator(chunk_size=1000):
            if not address_show_marker_from_carrier_summary(result.carrier_summary or {}):
                continue
            serializer = EnrichedAddressGeoJSONSerializer(result)
            features.append(serializer.data)
        
        return Response({
            'type': 'FeatureCollection',
            'features': features
        })


class AddressDetailView(APIView):
    """Get detailed information for a specific address."""
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        summary="Get enriched address details",
        description="Returns full details for a specific enriched address result.",
        responses={
            200: EnrichedAddressResultSerializer,
            404: OpenApiResponse(description="Address not found")
        },
        tags=['Talkmore Enrichment']
    )
    def get(self, request, job_id, address_uuid):
        """Get address details."""
        try:
            # Use select_related for ForeignKey optimization
            job = EnrichmentJob.objects.select_related('area', 'campaign').get(id=job_id)
        except EnrichmentJob.DoesNotExist:
            return Response(
                {'error': 'Job not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        try:
            # Use select_related for job ForeignKey (uses index on job_id, address_uuid)
            result = EnrichedAddressResult.objects.select_related('job').get(
                job=job,
                address_uuid=address_uuid
            )
        except EnrichedAddressResult.DoesNotExist:
            return Response(
                {'error': 'Address result not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        serializer = EnrichedAddressResultSerializer(result)
        return Response(serializer.data)


class AreaResultsView(APIView):
    """
    Get enrichment results for a specific Area.
    
    This endpoint allows employees to fetch all enrichment results
    for an area by area_id, without needing to know the job_id.
    """
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        summary="Get enrichment results by area",
        description="Returns enriched address results as GeoJSON FeatureCollection for a specific area. "
                    "By default, only returns addresses with show_marker=True (target carriers). "
                    "Use include_all=true to return all results. "
                    "Optionally filter by bbox (bounding box). "
                    "Requires user to have access to the area.",
        parameters=[
            OpenApiParameter(
                name='bbox',
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                required=False,
                description='Bounding box: west,south,east,north (comma-separated)'
            ),
            OpenApiParameter(
                name='include_all',
                type=OpenApiTypes.BOOL,
                location=OpenApiParameter.QUERY,
                required=False,
                description='If true, return all results including those without target carriers (show_marker=false). Default: false (only returns show_marker=true)'
            )
        ],
        responses={
            200: OpenApiResponse(
                description="GeoJSON FeatureCollection",
                response={
                    'type': 'object',
                    'properties': {
                        'type': {'type': 'string', 'example': 'FeatureCollection'},
                        'features': {'type': 'array'}
                    }
                }
            ),
            404: OpenApiResponse(description="Area not found or no enrichment job"),
            403: OpenApiResponse(description="Access denied to this area"),
            400: OpenApiResponse(description="Invalid bbox format")
        },
        tags=['Talkmore Enrichment']
    )
    def get(self, request, area_id):
        """
        Get enrichment results for an area.
        
        Only returns addresses where EVERY carrier is Telenor, Talkmore, Unifon, or Phonero.
        Mixed addresses (e.g. OneCall, Ice) are excluded.
        
        Query params:
        - bbox (optional): west,south,east,north
        - include_all (optional): If true, return all results including those without target carriers. Default: false (only returns show_marker=true)
        """
        # #region agent log
        _debug_log('views.py:222', 'AreaResultsView.get called', {
            'area_id': str(area_id),
            'user_id': request.user.id if request.user.is_authenticated else None,
            'user_is_superuser': request.user.is_superuser if request.user.is_authenticated else False
        }, 'A')
        # #endregion
        
        # Step 1: Get Area and check permissions
        try:
            area = Area.objects.select_related('enrichment_job').get(id=area_id)
            # #region agent log
            _debug_log('views.py:231', 'Area found', {
                'area_id': str(area.id),
                'area_name': area.name,
                'has_enrichment_job': hasattr(area, 'enrichment_job'),
                'enrichment_job_id': str(area.enrichment_job.id) if hasattr(area, 'enrichment_job') else None
            }, 'A')
            # #endregion
        except Area.DoesNotExist:
            # #region agent log
            _debug_log('views.py:233', 'Area not found', {'area_id': str(area_id)}, 'A')
            # #endregion
            return Response(
                {'error': 'Area not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Step 2: Check user has access to this area
        has_access = self.has_area_access(request.user, area)
        # #region agent log
        _debug_log('views.py:239', 'Area access check', {
            'user_id': request.user.id,
            'has_access': has_access,
            'user_is_superuser': request.user.is_superuser,
            'area_created_by_id': area.created_by.id if area.created_by else None,
            'area_manager_id': area.manager.id if area.manager else None
        }, 'B')
        # #endregion
        
        if not has_access:
            return Response(
                {'error': 'Access denied to this area'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Step 3: Check if enrichment job exists
        try:
            job = area.enrichment_job
            # #region agent log
            _debug_log('views.py:247', 'EnrichmentJob found', {
                'job_id': str(job.id),
                'job_status': job.status,
                'job_expected_count': job.expected_count,
                'job_done_count': job.done_count,
                'job_success_count': job.success_count
            }, 'C')
            # #endregion
        except EnrichmentJob.DoesNotExist:
            # #region agent log
            _debug_log('views.py:249', 'EnrichmentJob not found', {
                'area_id': str(area.id),
                'area_has_enrichment_job_attr': hasattr(area, 'enrichment_job')
            }, 'C')
            # #endregion
            return Response(
                {
                    'error': 'No enrichment job found for this area',
                    'message': 'This area may not be associated with a Talkmore campaign, or the job was not created.'
                },
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Step 4: Parse bbox if provided
        bbox_str = request.query_params.get('bbox')
        bbox = None
        if bbox_str:
            try:
                bbox_parts = [float(x.strip()) for x in bbox_str.split(',')]
                if len(bbox_parts) != 4:
                    return Response(
                        {'error': 'bbox must have 4 values: west,south,east,north'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                west, south, east, north = bbox_parts
                # Create polygon from bbox
                bbox = Polygon.from_bbox((west, south, east, north))
                bbox.srid = 4326
            except ValueError:
                return Response(
                    {'error': 'Invalid bbox format. Expected: west,south,east,north'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Step 5: Query results
        # Check if user wants all results (for debugging/testing)
        include_all = request.query_params.get('include_all', 'false').lower() == 'true'
        
        queryset = EnrichedAddressResult.objects.filter(
            job=job
        ).select_related('job')
        
        # Only filter by show_marker if not including all results
        if not include_all:
            queryset = queryset.filter(show_marker=True)  # Only target carriers
        
        # #region agent log
        total_count = queryset.count()
        _debug_log('views.py:279', 'Query results before bbox', {
            'job_id': str(job.id),
            'total_results': total_count,
            'include_all': include_all,
            'filtered_by_show_marker': not include_all,
            'bbox_provided': bbox is not None
        }, 'D')
        # #endregion
        
        # Apply bbox filter if provided (uses GIST index on geom)
        if bbox:
            queryset = queryset.filter(geom__intersects=bbox)
            # #region agent log
            bbox_count = queryset.count()
            _debug_log('views.py:286', 'Query results after bbox', {
                'bbox_count': bbox_count,
                'bbox': str(bbox)
            }, 'D')
            # #endregion
        
        # Step 6: Serialize to GeoJSON
        # Use iterator() for large result sets to reduce memory usage
        features = []
        feature_count = 0
        filtered_count = 0
        for result in queryset.iterator(chunk_size=1000):
            if not address_show_marker_from_carrier_summary(result.carrier_summary or {}):
                filtered_count += 1
                continue
            
            serializer = EnrichedAddressGeoJSONSerializer(result)
            features.append(serializer.data)
            feature_count += 1
        
        # #region agent log
        _debug_log('views.py:295', 'Serialization complete', {
            'feature_count': feature_count,
            'features_returned': len(features),
            'filtered_out_count': filtered_count
        }, 'E')
        # #endregion
        
        return Response({
            'type': 'FeatureCollection',
            'features': features
        })
    
    def has_area_access(self, user, area):
        """Check if user has access to the area."""
        if user.is_superuser:
            return True
        
        if hasattr(user, 'manager') and user.manager:
            # Manager can access if:
            # - They created it
            # - They manage it
            # - They are assigned to it
            # - OR the area belongs to a campaign (managers can see all campaigns)
            if (
                area.created_by == user.manager or
                area.manager == user.manager or
                AreaEmployee.objects.filter(area=area, manager=user.manager).exists()
            ):
                return True
            
            # Check if area belongs to a campaign (managers can access all campaigns)
            if CampaignArea.objects.filter(area=area).exists():
                return True
            
            return False
        
        if hasattr(user, 'employee') and user.employee:
            # Employee can only access if assigned
            return AreaEmployee.objects.filter(
                area=area,
                employee=user.employee
            ).exists()
        
        return False
