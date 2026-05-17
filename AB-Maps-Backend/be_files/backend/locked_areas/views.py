"""
Views for the locked_areas app.
"""
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.db import connection
from django.db.models import Q
from django.shortcuts import get_object_or_404
from .models import LockedArea, AreaType
from .serializers import (
    AdminAreaSerializer, 
    LockedAreaSerializer, 
    LockedAreaCreateSerializer,
    LockedAreaUpdateSerializer,
    HierarchicalAreaSerializer,
    BulkLockSerializer,
    AreaFilterSerializer,
    HierarchicalAreaStructureSerializer,
    LockedAreaMapSerializer,
    LockedAreaAgeStatsSerializer
)
from .ssb_utils import fetch_ssb_13536_stats, validate_region_code
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)


class AdminAreasListView(generics.ListAPIView):
    """Get all available administrative areas with no pagination."""
    permission_classes = [IsAuthenticated]
    serializer_class = AdminAreaSerializer
    pagination_class = None  # No pagination as requested

    def get_queryset(self):
        """Get areas from admin.areas view with optional filtering."""
        level = self.request.query_params.get('level')
        county_code = self.request.query_params.get('county_code')
        municipality_code = self.request.query_params.get('municipality_code')
        search = self.request.query_params.get('search')
        locked_only = self.request.query_params.get('locked_only', 'false').lower() == 'true'
        
        with connection.cursor() as cursor:
            query = "SELECT * FROM admin.areas WHERE 1=1"
            params = []
            
            if level:
                query += " AND level = %s"
                params.append(level)
            
            if county_code:
                query += " AND parent_parent_code = %s"
                params.append(county_code)
            
            if municipality_code:
                query += " AND parent_code = %s"
                params.append(municipality_code)
            
            if search:
                query += " AND name ILIKE %s"
                params.append(f"%{search}%")
            
            query += " ORDER BY level, name"
            
            cursor.execute(query, params)
            columns = [col[0] for col in cursor.description]
            return [dict(zip(columns, row)) for row in cursor.fetchall()]


class LockedAreasListView(generics.ListCreateAPIView):
    """List and create locked areas for a campaign with no pagination."""
    permission_classes = [IsAuthenticated]
    pagination_class = None  # No pagination as requested
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return LockedAreaCreateSerializer
        return LockedAreaSerializer

    def get_queryset(self):
        """Get locked areas for a specific campaign."""
        campaign_id = self.kwargs.get('campaign_id')
        return LockedArea.objects.filter(
            campaign_id=campaign_id,
            is_active=True
        ).select_related('campaign', 'locked_by', 'locked_by__employee', 'locked_by__manager')

    def perform_create(self, serializer):
        """Create locked areas."""
        serializer.save()


class LockedAreaDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a locked area."""
    permission_classes = [IsAuthenticated]
    serializer_class = LockedAreaUpdateSerializer

    def get_queryset(self):
        """Get locked area for a specific campaign."""
        campaign_id = self.kwargs.get('campaign_id')
        return LockedArea.objects.filter(
            campaign_id=campaign_id,
            is_active=True
        ).select_related('campaign', 'locked_by', 'locked_by__employee', 'locked_by__manager')

    def perform_destroy(self, instance):
        """Soft delete by setting is_active=False."""
        instance.is_active = False
        instance.save()

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return LockedAreaUpdateSerializer
        return LockedAreaSerializer


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def hierarchical_areas(request, campaign_id):
    """Get hierarchical view of areas (counties -> municipalities -> grunnkretser) with no pagination."""
    with connection.cursor() as cursor:
        cursor.execute("""
            WITH RECURSIVE area_hierarchy AS (
                -- Get all counties
                SELECT 
                    area_key, level, code, name, 
                    NULL as parent_key, 0 as depth,
                    area_km2, num_polygons
                FROM admin.areas 
                WHERE level = 'fylke'
                
                UNION ALL
                
                -- Get municipalities under counties
                SELECT 
                    a.area_key, a.level, a.code, a.name,
                    ah.area_key as parent_key, 1 as depth,
                    a.area_km2, a.num_polygons
                FROM admin.areas a
                JOIN area_hierarchy ah ON a.parent_parent_code = ah.code
                WHERE a.level = 'kommune'
                
                UNION ALL
                
                -- Get grunnkretser under municipalities
                SELECT 
                    a.area_key, a.level, a.code, a.name,
                    ah.area_key as parent_key, 2 as depth,
                    a.area_km2, a.num_polygons
                FROM admin.areas a
                JOIN area_hierarchy ah ON a.parent_code = ah.code
                WHERE a.level = 'grunnkrets'
            )
            SELECT 
                ah.*,
                CASE WHEN la.id IS NOT NULL THEN true ELSE false END as is_locked,
                la.locked_at,
                COALESCE(
                    e.name,
                    m.name,
                    u.first_name || ' ' || u.last_name,
                    u.username
                ) as locked_by_name
            FROM area_hierarchy ah
            LEFT JOIN locked_areas la ON ah.area_key = la.area_key 
                AND la.campaign_id = %s AND la.is_active = true
            LEFT JOIN auth_user u ON la.locked_by_id = u.id
            LEFT JOIN employee e ON u.employee_id = e.id
            LEFT JOIN manager m ON u.manager_id = m.id
            ORDER BY ah.depth, ah.name
        """, [campaign_id])
        
        columns = [col[0] for col in cursor.description]
        return Response([dict(zip(columns, row)) for row in cursor.fetchall()])


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bulk_lock_areas(request, campaign_id):
    """Bulk lock multiple areas with no pagination restrictions."""
    serializer = BulkLockSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    area_keys = serializer.validated_data['area_keys']
    
    # Validate campaign exists
    from campaigns.models import Campaign
    try:
        campaign = Campaign.objects.get(id=campaign_id)
    except Campaign.DoesNotExist:
        return Response(
            {'error': 'Campaign not found'}, 
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Lock areas
    locked_areas = LockedArea.bulk_lock_areas(campaign, area_keys, request.user)
    
    if not locked_areas:
        return Response(
            {'message': 'No new areas were locked. They may already be locked.'},
            status=status.HTTP_200_OK
        )
    
    return Response(
        LockedAreaSerializer(locked_areas, many=True).data,
        status=status.HTTP_201_CREATED
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bulk_unlock_areas(request, campaign_id):
    """Bulk unlock multiple areas."""
    serializer = BulkLockSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    area_keys = serializer.validated_data['area_keys']
    
    # Validate campaign exists
    from campaigns.models import Campaign
    try:
        campaign = Campaign.objects.get(id=campaign_id)
    except Campaign.DoesNotExist:
        return Response(
            {'error': 'Campaign not found'}, 
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Unlock areas
    updated_count = LockedArea.bulk_unlock_areas(campaign, area_keys)
    
    return Response({
        'message': f'Unlocked {updated_count} areas',
        'unlocked_count': updated_count
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def available_areas(request, campaign_id):
    """Get available areas (not locked) for a campaign with no pagination."""
    level = request.query_params.get('level')
    county_code = request.query_params.get('county_code')
    municipality_code = request.query_params.get('municipality_code')
    search = request.query_params.get('search')
    
    # Get available areas using the model method
    available_areas = LockedArea.get_available_areas(
        campaign_id=campaign_id,
        level=level,
        county_code=county_code,
        municipality_code=municipality_code
    )
    
    # Apply search filter if provided
    if search:
        available_areas = [
            area for area in available_areas 
            if search.lower() in area['name'].lower()
        ]
    
    return Response(available_areas)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def area_statistics(request, campaign_id):
    """Get statistics about locked areas for a campaign."""
    from campaigns.models import Campaign
    
    try:
        campaign = Campaign.objects.get(id=campaign_id)
    except Campaign.DoesNotExist:
        return Response(
            {'error': 'Campaign not found'}, 
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Get statistics
    total_locked = LockedArea.objects.filter(
        campaign=campaign,
        is_active=True
    ).count()
    
    locked_by_type = {}
    for area_type, _ in AreaType.choices:
        count = LockedArea.objects.filter(
            campaign=campaign,
            area_type=area_type,
            is_active=True
        ).count()
        locked_by_type[area_type] = count
    
    # Get total available areas
    with connection.cursor() as cursor:
        cursor.execute("SELECT COUNT(*) FROM admin.areas")
        total_available = cursor.fetchone()[0]
    
    return Response({
        'campaign_id': str(campaign_id),
        'campaign_name': campaign.name,
        'total_available_areas': total_available,
        'total_locked_areas': total_locked,
        'locked_by_type': locked_by_type,
        'lock_percentage': round((total_locked / total_available) * 100, 2) if total_available > 0 else 0
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def spatial_query(request, campaign_id):
    """Get areas based on spatial queries (point-in-polygon, bounding box, etc.)."""
    query_type = request.query_params.get('type', 'point')
    
    if query_type == 'point':
        lat = request.query_params.get('lat')
        lon = request.query_params.get('lon')
        
        if not lat or not lon:
            return Response(
                {'error': 'lat and lon parameters are required for point query'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT 
                    a.*,
                    CASE WHEN la.id IS NOT NULL THEN true ELSE false END as is_locked,
                    la.locked_at,
                    COALESCE(
                        e.name,
                        m.name,
                        u.first_name || ' ' || u.last_name,
                        u.username
                    ) as locked_by_name
                FROM admin.areas a
                LEFT JOIN locked_areas la ON a.area_key = la.area_key 
                    AND la.campaign_id = %s AND la.is_active = true
                LEFT JOIN auth_user u ON la.locked_by_id = u.id
                LEFT JOIN employee e ON u.employee_id = e.id
                LEFT JOIN manager m ON u.manager_id = m.id
                WHERE ST_Contains(a.geom, ST_SetSRID(ST_MakePoint(%s, %s), 4326))
                ORDER BY a.level, a.name
            """, [campaign_id, float(lon), float(lat)])
            
            columns = [col[0] for col in cursor.description]
            return Response([dict(zip(columns, row)) for row in cursor.fetchall()])
    
    elif query_type == 'bbox':
        min_lat = request.query_params.get('min_lat')
        max_lat = request.query_params.get('max_lat')
        min_lon = request.query_params.get('min_lon')
        max_lon = request.query_params.get('max_lon')
        
        if not all([min_lat, max_lat, min_lon, max_lon]):
            return Response(
                {'error': 'min_lat, max_lat, min_lon, max_lon parameters are required for bbox query'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT 
                    a.*,
                    CASE WHEN la.id IS NOT NULL THEN true ELSE false END as is_locked,
                    la.locked_at,
                    COALESCE(
                        e.name,
                        m.name,
                        u.first_name || ' ' || u.last_name,
                        u.username
                    ) as locked_by_name
                FROM admin.areas a
                LEFT JOIN locked_areas la ON a.area_key = la.area_key 
                    AND la.campaign_id = %s AND la.is_active = true
                LEFT JOIN auth_user u ON la.locked_by_id = u.id
                LEFT JOIN employee e ON u.employee_id = e.id
                LEFT JOIN manager m ON u.manager_id = m.id
                WHERE ST_Intersects(a.geom, ST_MakeEnvelope(%s, %s, %s, %s, 4326))
                ORDER BY a.level, a.name
            """, [campaign_id, float(min_lon), float(min_lat), float(max_lon), float(max_lat)])
            
            columns = [col[0] for col in cursor.description]
            return Response([dict(zip(columns, row)) for row in cursor.fetchall()])
    
    else:
        return Response(
            {'error': 'Invalid query type. Supported types: point, bbox'}, 
            status=status.HTTP_400_BAD_REQUEST
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def simplified_hierarchy(request):
    """Get simplified hierarchical structure of all administrative areas."""
    level = request.query_params.get('level', 'grunnkrets')
    county_code = request.query_params.get('county_code')
    municipality_code = request.query_params.get('municipality_code')
    parent_area_key = request.query_params.get('parent_area_key')
    search = request.query_params.get('search')
    
    with connection.cursor() as cursor:
        # Build the base query
        query = """
            SELECT area_key, level, code, name, parent_code, parent_parent_code, 
                   area_km2, num_polygons
            FROM admin.areas 
            WHERE 1=1
        """
        params = []
        
        # Add filters
        if parent_area_key:
            # Extract level and code from parent_area_key (e.g., "fylke:03" -> level="fylke", code="03")
            if ':' in parent_area_key:
                parent_level, parent_code = parent_area_key.split(':', 1)
                if parent_level == 'fylke':
                    query += " AND (level = 'kommune' AND parent_parent_code = %s)"
                    params.append(parent_code)
                elif parent_level == 'kommune':
                    query += " AND (level = 'grunnkrets' AND parent_code = %s)"
                    params.append(parent_code)
                else:
                    # Invalid parent_area_key format
                    return Response({'error': 'Invalid parent_area_key format'}, status=400)
            else:
                return Response({'error': 'Invalid parent_area_key format'}, status=400)
        elif county_code:
            query += " AND (code = %s OR parent_parent_code = %s)"
            params.extend([county_code, county_code])
        
        if municipality_code:
            query += " AND (code = %s OR parent_code = %s)"
            params.extend([municipality_code, municipality_code])
        
        if search:
            query += " AND name ILIKE %s"
            params.append(f"%{search}%")
        
        # Add level filter
        if level == 'fylke':
            query += " AND level = 'fylke'"
        elif level == 'kommune':
            query += " AND level IN ('fylke', 'kommune')"
        # else 'grunnkrets' - include all levels
        
        query += " ORDER BY CASE level WHEN 'fylke' THEN 1 WHEN 'kommune' THEN 2 WHEN 'grunnkrets' THEN 3 END, code"
        
        cursor.execute(query, params)
        areas = cursor.fetchall()
    
    # If using parent_area_key, return flat list for progressive loading
    if parent_area_key:
        areas_list = []
        for area_key, level, code, name, parent_code, parent_parent_code, area_km2, num_polygons in areas:
            area_data = {
                'name': name,
                'area_key': area_key,
                'code': code,
                'area_km2': float(area_km2) if area_km2 else 0.0,
                'num_polygons': num_polygons or 0
            }
            areas_list.append(area_data)
        return Response({'areas': areas_list})
    
    # Build hierarchical structure for full hierarchy requests
    hierarchy = {'fylker': {}}
    
    for area_key, level, code, name, parent_code, parent_parent_code, area_km2, num_polygons in areas:
        area_data = {
            'name': name,
            'area_key': area_key,
            'code': code,
            'area_km2': float(area_km2) if area_km2 else 0.0,
            'num_polygons': num_polygons or 0
        }
        
        if level == 'fylke':
            hierarchy['fylker'][code] = area_data
            if level != 'fylke':  # Only add kommuner if not fylke-only
                area_data['kommuner'] = {}
        
        elif level == 'kommune':
            county_code = parent_parent_code
            if county_code in hierarchy['fylker']:
                if 'kommuner' not in hierarchy['fylker'][county_code]:
                    hierarchy['fylker'][county_code]['kommuner'] = {}
                hierarchy['fylker'][county_code]['kommuner'][code] = area_data
                if level != 'kommune':  # Only add grunnkretser if not kommune-only
                    area_data['grunnkretser'] = {}
        
        elif level == 'grunnkrets':
            municipality_code = parent_code
            county_code = parent_parent_code
            
            if (county_code in hierarchy['fylker'] and 
                municipality_code in hierarchy['fylker'][county_code].get('kommuner', {})):
                
                if 'grunnkretser' not in hierarchy['fylker'][county_code]['kommuner'][municipality_code]:
                    hierarchy['fylker'][county_code]['kommuner'][municipality_code]['grunnkretser'] = {}
                
                hierarchy['fylker'][county_code]['kommuner'][municipality_code]['grunnkretser'][code] = area_data
    
    # Ensure all counties have kommuner structure and all kommuner have grunnkretser structure
    for county_code, county_data in hierarchy['fylker'].items():
        if 'kommuner' not in county_data:
            county_data['kommuner'] = {}
        
        for kommune_code, kommune_data in county_data['kommuner'].items():
            if 'grunnkretser' not in kommune_data:
                kommune_data['grunnkretser'] = {}
    
    return Response(hierarchy)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def campaign_locked_areas_map(request, campaign_id):
    """Get all locked areas for a campaign with map geometry and locking details."""
    
    # Validate campaign exists
    try:
        from campaigns.models import Campaign
        campaign = Campaign.objects.get(id=campaign_id)
    except Campaign.DoesNotExist:
        return Response({'error': 'Campaign not found'}, status=404)
    
    # Build the query to get locked areas with geometry and user details
    with connection.cursor() as cursor:
        query = """
            SELECT 
                la.id,
                la.area_key,
                la.area_type,
                la.area_code,
                la.area_name,
                la.locked_at,
                la.locked_by_id,
                la.campaign_id,
                
                -- Area geometry and details from admin.areas
                ST_AsGeoJSON(a.geom) as geom_geojson,
                a.area_km2,
                a.num_polygons,
                
                -- User details
                u.username,
                COALESCE(
                    e.name,
                    m.name,
                    u.first_name || ' ' || u.last_name,
                    u.username
                ) as locked_by_name,
                CASE 
                    WHEN e.id IS NOT NULL THEN 'employee'
                    WHEN m.id IS NOT NULL THEN 'manager'
                    ELSE 'user'
                END as user_type,
                
                -- Profile details
                COALESCE(e.id, m.id) as profile_id,
                COALESCE(e.name, m.name) as profile_name,
                COALESCE(e.email, m.email) as profile_email,
                
                -- Campaign details
                c.name as campaign_name
                
            FROM locked_areas la
            LEFT JOIN admin.areas a ON la.area_key = a.area_key
            LEFT JOIN auth_user u ON la.locked_by_id = u.id
            LEFT JOIN employee e ON u.employee_id = e.id
            LEFT JOIN manager m ON u.manager_id = m.id
            LEFT JOIN campaign c ON la.campaign_id = c.id
            
            WHERE la.campaign_id = %s 
            AND la.is_active = true
            AND a.geom IS NOT NULL
        """
        
        params = [campaign_id]
        
        # Add optional filters
        area_type = request.query_params.get('area_type')
        if area_type and area_type in ['fylke', 'kommune', 'grunnkrets']:
            query += " AND la.area_type = %s"
            params.append(area_type)
        
        locked_by = request.query_params.get('locked_by')
        if locked_by:
            query += " AND la.locked_by_id = %s"
            params.append(locked_by)
        
        date_from = request.query_params.get('date_from')
        if date_from:
            query += " AND la.locked_at >= %s"
            params.append(date_from)
        
        date_to = request.query_params.get('date_to')
        if date_to:
            query += " AND la.locked_at <= %s"
            params.append(date_to)
        
        query += " ORDER BY la.locked_at DESC, la.area_name"
        
        cursor.execute(query, params)
        columns = [col[0] for col in cursor.description]
        areas_data = [dict(zip(columns, row)) for row in cursor.fetchall()]
    
    # Serialize the data
    serializer = LockedAreaMapSerializer(areas_data, many=True, context={'request': request})
    
    # Build response
    response_data = {
        'count': len(serializer.data),
        'campaign': {
            'id': str(campaign.id),
            'name': campaign.name,
            'description': getattr(campaign, 'description', '')
        },
        'locked_areas': serializer.data
    }
    
    return Response(response_data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def locked_areas_age_stats(request):
    """
    Get age statistics for locked areas (fylke and kommune only).
    
    Headers:
        X-Campaign-ID: UUID of the campaign (required)
    
    Behavior:
        1. Loads all active locked areas for the campaign
        2. Filters to area_type in ('fylke', 'kommune') only
        3. Identifies areas missing stats
        4. Fetches missing stats from SSB API (single bulk call)
        5. Updates database with new stats
        6. Returns all locked areas with their stats
    
    Response:
        {
            "campaign_id": "...",
            "stats_year": 2025,
            "data": [
                {
                    "id": "...",
                    "area_type": "kommune",
                    "area_code": "0301",
                    "area_name": "Oslo municipality",
                    "mean_age": 38.7,
                    "median_age": 36.0,
                    "cached": false
                }
            ]
        }
    """
    # Get campaign ID from header
    campaign_id = request.headers.get('X-Campaign-ID')
    if not campaign_id:
        return Response(
            {'error': 'X-Campaign-ID header is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Validate campaign exists
    try:
        from campaigns.models import Campaign
        campaign = Campaign.objects.get(id=campaign_id)
    except Campaign.DoesNotExist:
        return Response(
            {'error': 'Campaign not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except ValueError:
        return Response(
            {'error': 'Invalid campaign ID format'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Step A: Query database - Get locked areas for campaign (fylke and kommune only)
    locked_areas = LockedArea.objects.filter(
        campaign_id=campaign_id,
        is_active=True,
        area_type__in=['fylke', 'kommune']
    ).select_related('campaign')
    
    if not locked_areas.exists():
        return Response({
            'campaign_id': str(campaign_id),
            'stats_year': None,
            'data': []
        })
    
    # Step B: Identify missing stats
    missing_areas = []
    areas_with_stats = []
    
    for area in locked_areas:
        # Stats are missing if any of these are null
        if area.mean_age is None or area.median_age is None or area.stats_year is None:
            missing_areas.append(area)
        else:
            areas_with_stats.append(area)
    
    # Step C: Fetch missing stats from SSB API (if any)
    ssb_error = None
    stats_year = None  # Initialize stats_year outside the if block
    if missing_areas:
        # Validate codes and collect them
        missing_codes = []
        valid_missing_areas = []
        
        for area in missing_areas:
            if validate_region_code(area.area_type, area.area_code):
                missing_codes.append(area.area_code)
                valid_missing_areas.append(area)
            else:
                logger.warning(
                    f"Skipping invalid region code: {area.area_code} "
                    f"(type: {area.area_type})"
                )
        
        if missing_codes:
            # Step C: Call SSB API (single bulk call)
            stats_dict = fetch_ssb_13536_stats(missing_codes)
            
            # Step D & E: Update database with new stats
            updates = []
            
            for area in valid_missing_areas:
                if area.area_code in stats_dict:
                    stats = stats_dict[area.area_code]
                    
                    # Update area with stats
                    if stats['mean'] is not None:
                        area.mean_age = stats['mean']
                    if stats['median'] is not None:
                        area.median_age = stats['median']
                    if stats['year'] is not None:
                        area.stats_year = stats['year']
                        stats_year = stats['year']  # Use the year from SSB
                    
                    area.stats_updated_at = timezone.now()
                    updates.append(area)
            
            # Bulk update
            if updates:
                try:
                    LockedArea.objects.bulk_update(
                        updates,
                        ['mean_age', 'median_age', 'stats_year', 'stats_updated_at']
                    )
                    logger.info(f"Updated {len(updates)} locked areas with SSB stats")
                    
                except Exception as e:
                    logger.error(f"Error bulk updating stats: {str(e)}")
                    ssb_error = "Failed to update database with SSB stats"
            
            # Check if SSB call failed (all stats are None)
            if stats_dict and all(
                stats.get('mean') is None and stats.get('median') is None
                for stats in stats_dict.values()
            ):
                ssb_error = "SSB API returned no data"
    
    # Step F: Return response - refresh queryset to get latest data after bulk update
    all_areas = list(
        LockedArea.objects.filter(
            campaign_id=campaign_id,
            is_active=True,
            area_type__in=['fylke', 'kommune']
        ).select_related('campaign')
    )
    
    # Create a set of missing area IDs for efficient lookup
    missing_area_ids = {area.id for area in missing_areas}
    
    # Determine stats_year (use from SSB if available, otherwise from first area with stats)
    if not stats_year:
        for area in all_areas:
            if area.stats_year:
                stats_year = area.stats_year
                break
    
    # Prepare response data
    response_data_list = []
    for area in all_areas:
        # Determine if stats were cached (existed before this request)
        was_cached = area.id not in missing_area_ids
        
        area_data = {
            'id': str(area.id),
            'area_type': area.area_type,
            'area_code': area.area_code,
            'area_name': area.area_name,
            'mean_age': float(area.mean_age) if area.mean_age is not None else None,
            'median_age': float(area.median_age) if area.median_age is not None else None,
            'cached': was_cached
        }
        response_data_list.append(area_data)
    
    # Build final response
    response_data = {
        'campaign_id': str(campaign_id),
        'stats_year': stats_year,
        'data': response_data_list
    }
    
    # Add error field if SSB failed
    if ssb_error:
        response_data['error'] = ssb_error
    
    return Response(response_data)


# =============================================================================
# Grunnkrets Statistics API
# =============================================================================

# Age group mapping: (display_label, db_suffix)
AGE_GROUP_KEYS = [
    ("0-5", "0_5"),
    ("6-15", "6_15"),
    ("16-19", "16_19"),
    ("20-24", "20_24"),
    ("25-29", "25_29"),
    ("30-49", "30_49"),
    ("50-59", "50_59"),
    ("60-66", "60_66"),
    ("67-69", "67_69"),
    ("70-79", "70_79"),
    ("80+", "80p"),
]


class GrunnkretsStatsView(generics.GenericAPIView):
    """
    API endpoint to retrieve demographic statistics for a specific grunnkrets.
    
    GET /api/areas/grunnkrets/{code}/stats?year={year}
    
    Returns chart-ready demographic data including:
    - Population totals (male, female, total)
    - Age group bins (11 groups)
    - Donor segment aggregates
    - Gender shares
    - Mean age estimates
    
    Note: Public endpoint (no authentication required) for map interactions.
    """
    permission_classes = [AllowAny]
    
    def get(self, request, code):
        """
        Retrieve grunnkrets statistics.
        
        Path params:
            code: 8-digit grunnkrets code
            
        Query params:
            year (optional): Filter by statistics year
        """
        from django.core.cache import cache
        import hashlib
        
        # Validate code format (should be 8 digits)
        if not code or len(code) != 8 or not code.isdigit():
            return Response(
                {"error": "Invalid grunnkrets code", "details": "Code must be 8 digits"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Parse optional year parameter
        year_param = request.query_params.get('year')
        requested_year = None
        if year_param:
            try:
                requested_year = int(year_param)
            except ValueError:
                return Response(
                    {"error": "Invalid year parameter", "details": "Year must be a valid integer"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Check cache first
        cache_key = f"grunnkrets_stats:{requested_year or 'latest'}:{code}"
        cached_data = cache.get(cache_key)
        if cached_data:
            logger.debug(f"Cache hit for grunnkrets stats: {code}")
            return Response(cached_data)
        
        # Query database - only select required columns (no geometry!)
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT 
                    code, name, level,
                    parent_code, parent_parent_code,
                    stats_year, stats_updated_at,
                    -- Female age bins
                    f_0_5, f_6_15, f_16_19, f_20_24, f_25_29,
                    f_30_49, f_50_59, f_60_66, f_67_69, f_70_79, f_80p,
                    -- Male age bins
                    m_0_5, m_6_15, m_16_19, m_20_24, m_25_29,
                    m_30_49, m_50_59, m_60_66, m_67_69, m_70_79, m_80p,
                    -- Totals
                    female_total, male_total, population_total,
                    -- Donor aggregates
                    pop_0_15, pop_16_29, pop_30_66, pop_67_plus,
                    donor_pool_adults, donor_pool_stable, donor_pool_seniors,
                    -- Shares
                    female_share, male_share, share_30_66, share_67_plus,
                    -- Mean age estimates
                    mean_age_est_total, mean_age_est_female, mean_age_est_male
                FROM admin.areas
                WHERE level = 'grunnkrets' AND code = %s
            """, [code])
            
            row = cursor.fetchone()
            
            if not row:
                return Response(
                    {"error": "Grunnkrets not found", "code": code},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Map columns to dictionary
            columns = [
                'code', 'name', 'level',
                'parent_code', 'parent_parent_code',
                'stats_year', 'stats_updated_at',
                'f_0_5', 'f_6_15', 'f_16_19', 'f_20_24', 'f_25_29',
                'f_30_49', 'f_50_59', 'f_60_66', 'f_67_69', 'f_70_79', 'f_80p',
                'm_0_5', 'm_6_15', 'm_16_19', 'm_20_24', 'm_25_29',
                'm_30_49', 'm_50_59', 'm_60_66', 'm_67_69', 'm_70_79', 'm_80p',
                'female_total', 'male_total', 'population_total',
                'pop_0_15', 'pop_16_29', 'pop_30_66', 'pop_67_plus',
                'donor_pool_adults', 'donor_pool_stable', 'donor_pool_seniors',
                'female_share', 'male_share', 'share_30_66', 'share_67_plus',
                'mean_age_est_total', 'mean_age_est_female', 'mean_age_est_male',
            ]
            area = dict(zip(columns, row))
        
        # Check year match
        db_year = area.get('stats_year')
        if requested_year and db_year and requested_year != db_year:
            return Response(
                {
                    "error": "Stats not available for requested year",
                    "requested_year": requested_year,
                    "available_year": db_year
                },
                status=status.HTTP_409_CONFLICT
            )
        
        # Build response
        response_data = self._build_stats_response(area)
        
        # Cache for 24 hours
        cache.set(cache_key, response_data, timeout=86400)
        
        return Response(response_data)
    
    def _build_stats_response(self, area):
        """Build the complete statistics response from area data."""
        
        # Helper to safely get integer value
        def safe_int(val):
            return int(val) if val is not None else 0
        
        # Helper to safely get float value
        def safe_float(val):
            return float(val) if val is not None else 0.0
        
        # Build age group bins
        age_groups = []
        female_bins = []
        male_bins = []
        total_bins = []
        
        for label, suffix in AGE_GROUP_KEYS:
            f_val = safe_int(area.get(f'f_{suffix}'))
            m_val = safe_int(area.get(f'm_{suffix}'))
            
            age_groups.append(label)
            female_bins.append(f_val)
            male_bins.append(m_val)
            total_bins.append(f_val + m_val)
        
        # Get totals (use stored or recompute)
        female_total = safe_int(area.get('female_total')) or sum(female_bins)
        male_total = safe_int(area.get('male_total')) or sum(male_bins)
        population_total = safe_int(area.get('population_total')) or (female_total + male_total)
        
        # Get donor aggregates
        pop_0_15 = safe_int(area.get('pop_0_15'))
        pop_16_29 = safe_int(area.get('pop_16_29'))
        pop_30_66 = safe_int(area.get('pop_30_66'))
        pop_67_plus = safe_int(area.get('pop_67_plus'))
        donor_pool_adults = safe_int(area.get('donor_pool_adults'))
        donor_pool_stable = safe_int(area.get('donor_pool_stable'))
        donor_pool_seniors = safe_int(area.get('donor_pool_seniors'))
        
        # Calculate 50-75 age group
        # Sum: 50-59 (index 5) + 60-66 (index 6) + 67-69 (index 7) + (6/10 of 70-79 for ages 70-75, index 8)
        pop_50_75 = total_bins[5] + total_bins[6] + total_bins[7] + int(total_bins[8] * 0.6)
        
        # Calculate shares safely
        if population_total > 0:
            female_share = safe_float(area.get('female_share')) or (female_total / population_total)
            male_share = safe_float(area.get('male_share')) or (male_total / population_total)
            share_30_66 = safe_float(area.get('share_30_66')) or (pop_30_66 / population_total)
            share_67_plus = safe_float(area.get('share_67_plus')) or (pop_67_plus / population_total)
            share_50_75 = pop_50_75 / population_total
        else:
            female_share = 0.0
            male_share = 0.0
            share_30_66 = 0.0
            share_67_plus = 0.0
            share_50_75 = 0.0
        
        # Mean age estimates (return null if not available)
        mean_age_total = area.get('mean_age_est_total')
        mean_age_female = area.get('mean_age_est_female')
        mean_age_male = area.get('mean_age_est_male')
        
        # Format updated_at
        updated_at = area.get('stats_updated_at')
        if updated_at:
            updated_at = updated_at.isoformat() if hasattr(updated_at, 'isoformat') else str(updated_at)
        
        return {
            "code": area.get('code'),
            "name": area.get('name'),
            "level": "grunnkrets",
            "parents": {
                "kommune_code": area.get('parent_code'),
                "fylke_code": area.get('parent_parent_code')
            },
            "year": area.get('stats_year'),
            "updated_at": updated_at,
            "totals": {
                "population_total": population_total,
                "female_total": female_total,
                "male_total": male_total
            },
            "bins": {
                "age_groups": age_groups,
                "female": female_bins,
                "male": male_bins,
                "total": total_bins
            },
            "donor_segments": {
                "pop_0_15": pop_0_15,
                "pop_16_29": pop_16_29,
                "pop_30_66": pop_30_66,
                "pop_67_plus": pop_67_plus,
                "donor_pool_adults": donor_pool_adults,
                "donor_pool_stable": donor_pool_stable,
                "donor_pool_seniors": donor_pool_seniors,
                "pop_50_75": pop_50_75,
                "share_30_66": round(share_30_66, 4),
                "share_67_plus": round(share_67_plus, 4),
                "share_50_75": round(share_50_75, 4)
            },
            "shares": {
                "female_share": round(female_share, 4),
                "male_share": round(male_share, 4)
            },
            "mean_age_estimates": {
                "total": round(mean_age_total, 1) if mean_age_total is not None else None,
                "female": round(mean_age_female, 1) if mean_age_female is not None else None,
                "male": round(mean_age_male, 1) if mean_age_male is not None else None
            }
        }