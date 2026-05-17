from django.db import connection
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes

from uploaded_addresses.models import UploadedAddress
from common.serializers_utils import isoz, to_point

MILES_TO_METERS = 1609.344


class NearbyUploadedAddressView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Find nearby uploaded addresses",
        description="Find uploaded addresses within a specified radius from a given latitude and longitude using fast PostGIS spatial queries.",
        parameters=[
            OpenApiParameter(
                name='lat',
                type=OpenApiTypes.FLOAT,
                location=OpenApiParameter.QUERY,
                required=True,
                description='Latitude coordinate (required)'
            ),
            OpenApiParameter(
                name='lon',
                type=OpenApiTypes.FLOAT,
                location=OpenApiParameter.QUERY,
                required=True,
                description='Longitude coordinate (required)'
            ),
            OpenApiParameter(
                name='radius_m',
                type=OpenApiTypes.FLOAT,
                location=OpenApiParameter.QUERY,
                required=False,
                description='Search radius in meters (default: 16093.44 = 10 miles)'
            ),
            OpenApiParameter(
                name='limit',
                type=OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
                required=False,
                description='Maximum number of results (default: 1000)'
            ),
            OpenApiParameter(
                name='campaign_id',
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                required=False,
                description='Filter results by campaign ID'
            ),
            OpenApiParameter(
                name='manager_id',
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                required=False,
                description='Filter results by manager ID'
            ),
        ],
        responses={
            200: {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string", "format": "uuid"},
                        "manager": {"type": "object", "nullable": True},
                        "campaign": {"type": "object", "nullable": True},
                        "address_text": {"type": "string"},
                        "latitude": {"type": "number", "nullable": True},
                        "longitude": {"type": "number", "nullable": True},
                        "added_at": {"type": "string", "format": "date-time"},
                        "geocoded_at": {"type": "string", "format": "date-time", "nullable": True},
                        "is_geocoded": {"type": "boolean"},
                        "coordinates": {
                            "type": "object",
                            "nullable": True,
                            "properties": {
                                "type": {"type": "string", "enum": ["Point"]},
                                "coordinates": {
                                    "type": "array",
                                    "items": {"type": "number"},
                                    "minItems": 2,
                                    "maxItems": 2
                                }
                            }
                        }
                    }
                }
            },
            400: {
                "type": "object",
                "properties": {
                    "detail": {"type": "string"}
                }
            }
        },
        tags=['Uploaded Addresses']
    )
    def get(self, request):
        try:
            lat = float(request.query_params["lat"])
            lon = float(request.query_params["lon"])
        except Exception:
            return Response({"detail": "lat & lon are required floats"}, status=400)

        radius_m = float(request.query_params.get("radius_m", 10 * MILES_TO_METERS))
        limit = int(request.query_params.get("limit", 1000))
        campaign_id = request.query_params.get("campaign_id")
        manager_id = request.query_params.get("manager_id")

        # Apply user-specific filtering based on permissions
        user = request.user
        employee_campaign_filter = ""
        employee_campaign_params = []
        
        if hasattr(user, 'employee') and user.employee:
            # Employees can only see addresses in campaigns they're assigned to
            employee_campaign_filter = "AND ua.campaign_id IN (SELECT DISTINCT campaign_id FROM campaign_employee WHERE employee_id = %s)"
            employee_campaign_params.append(str(user.employee.id))
        elif hasattr(user, 'manager') and user.manager:
            # Managers can see all addresses (no additional filter needed)
            pass
        else:
            # Other user types - restrict access
            return Response({"detail": "Access denied. Only employees and managers can access this endpoint."}, status=403)

        sql = f"""
        WITH u AS (
          SELECT ST_SetSRID(ST_MakePoint(%s,%s),4326)::geography AS user_geog
        )
        SELECT ua.id::text, ua.longitude::float8 AS lon, ua.latitude::float8 AS lat
        FROM uploaded_address ua, u
        WHERE ua.geog IS NOT NULL
          AND ST_DWithin(ua.geog, u.user_geog, %s)
          {"AND ua.campaign_id = %s" if campaign_id else ""}
          {"AND ua.manager_id = %s" if manager_id else ""}
          {employee_campaign_filter}
        ORDER BY ua.geog <-> u.user_geog
        LIMIT %s;
        """
        params = [lon, lat, radius_m]
        if campaign_id: 
            params.append(campaign_id)
        if manager_id:  
            params.append(manager_id)
        params.extend(employee_campaign_params)  # Add employee campaign filter params
        params.append(limit)

        with connection.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()

        if not rows:
            return Response([])

        ids = [r[0] for r in rows]
        coord_map = {r[0]: (r[1], r[2]) for r in rows}
        order_index = {id_: i for i, id_ in enumerate(ids)}

        qs = (UploadedAddress.objects
              .filter(id__in=ids)
              .select_related("campaign", "manager"))

        out = []
        for ua in qs:
            lon_coord, lat_coord = coord_map.get(str(ua.id), (ua.longitude, ua.latitude))
            m = ua.manager
            manager_obj = None
            if m:
                manager_obj = {
                    "id": str(m.id),
                    "name": getattr(m, "name", None),
                    "email": getattr(m, "email", None),
                    "phone": getattr(m, "phone", None),
                    "status": getattr(m, "status", None),
                    "is_online": getattr(m, "is_online", None),
                    "last_seen": isoz(getattr(m, "last_seen", None)),
                    "created_at": isoz(getattr(m, "created_at", None)),
                    "updated_at": isoz(getattr(m, "updated_at", None)),
                }

            c = ua.campaign
            campaign_obj = None
            if c:
                campaign_obj = {
                    "id": str(c.id),
                    "name": getattr(c, "name", None),
                    "description": getattr(c, "description", None),
                }

            out.append({
                "id": str(ua.id),
                "manager": manager_obj,
                "campaign": campaign_obj,
                "address_text": ua.address_text,
                "latitude": float(lat_coord) if lat_coord is not None else None,
                "longitude": float(lon_coord) if lon_coord is not None else None,
                "added_at": isoz(ua.added_at),
                "geocoded_at": isoz(ua.geocoded_at),
                "is_geocoded": (ua.latitude is not None and ua.longitude is not None),
                "coordinates": to_point(lon_coord, lat_coord),
            })

        out.sort(key=lambda x: order_index[x["id"]])
        return Response(out)
