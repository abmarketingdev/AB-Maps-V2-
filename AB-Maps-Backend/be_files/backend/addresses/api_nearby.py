from django.db import connection
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes

from addresses.models import Address
from common.serializers_utils import STATUS_COLORS, isoz, to_point, normalize_tags

MILES_TO_METERS = 1609.344


class NearbyAddressView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Find nearby addresses",
        description="Find addresses within a specified radius from a given latitude and longitude using fast PostGIS spatial queries.",
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
        ],
        responses={
            200: {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string", "format": "uuid"},
                        "address_text": {"type": "string"},
                        "status": {"type": "string", "enum": ["ja", "ikke_hjemme", "nei", "folg_opp"]},
                        "status_display": {"type": "string"},
                        "status_color": {"type": "string"},
                        "position": {
                            "type": "object",
                            "properties": {
                                "type": {"type": "string", "enum": ["Point"]},
                                "coordinates": {
                                    "type": "array",
                                    "items": {"type": "number"},
                                    "minItems": 2,
                                    "maxItems": 2
                                }
                            }
                        },
                        "tags": {"type": "array", "items": {"type": "string"}},
                        "recorded_at": {"type": "string", "format": "date-time"},
                        "campaign": {"type": "object", "nullable": True},
                        "employee": {"type": "object", "nullable": True},
                        "manager": {"type": "object", "nullable": True},
                        "notes": {"type": "string", "nullable": True}
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
        tags=['Addresses']
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

        # Apply user-specific filtering based on permissions
        user = request.user
        employee_campaign_filter = ""
        employee_campaign_params = []
        
        if hasattr(user, 'employee') and user.employee:
            # Employees can only see addresses in campaigns they're assigned to
            employee_campaign_filter = "AND a.campaign_id IN (SELECT DISTINCT campaign_id FROM campaign_employee WHERE employee_id = %s)"
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
        SELECT a.id::text, ST_X(a.position)::float8 AS lon, ST_Y(a.position)::float8 AS lat
        FROM address a, u
        WHERE a.geog IS NOT NULL
          AND ST_DWithin(a.geog, u.user_geog, %s)
          {"AND a.campaign_id = %s" if campaign_id else ""}
          {employee_campaign_filter}
        ORDER BY a.geog <-> u.user_geog
        LIMIT %s;
        """
        params = [lon, lat, radius_m]
        if campaign_id:
            params.append(campaign_id)
        params.extend(employee_campaign_params)  # Add employee campaign filter params
        params.append(limit)

        with connection.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()

        if not rows:
            return Response([])

        ids = [r[0] for r in rows]
        pos_map = {r[0]: (r[1], r[2]) for r in rows}
        order_index = {id_: i for i, id_ in enumerate(ids)}

        qs = (Address.objects
              .filter(id__in=ids)
              .select_related("campaign", "manager"))

        out = []
        for a in qs:
            status_display = a.get_status_display() if hasattr(a, "get_status_display") else a.status
            status_color = STATUS_COLORS.get(a.status)
            lon_pos, lat_pos = pos_map.get(str(a.id), (None, None))

            # campaign
            c = a.campaign
            campaign_obj = None
            if c:
                campaign_obj = {
                    "id": str(c.id),
                    "name": getattr(c, "name", None),
                    "description": getattr(c, "description", None),
                }

            # top-level manager on Address
            m_top = a.manager
            manager_top = None
            if m_top:
                manager_top = {
                    "id": str(m_top.id),
                    "name": getattr(m_top, "name", None),
                    "email": getattr(m_top, "email", None),
                    "phone": getattr(m_top, "phone", None),
                    "status": getattr(m_top, "status", None),
                    "is_online": getattr(m_top, "is_online", None),
                    "last_seen": isoz(getattr(m_top, "last_seen", None)),
                    "created_at": isoz(getattr(m_top, "created_at", None)),
                    "updated_at": isoz(getattr(m_top, "updated_at", None)),
                }

            # employee (no longer has manager relationship)
            e = a.employee
            employee_obj = None
            if e:
                employee_obj = {
                    "id": str(e.id),
                    "name": getattr(e, "name", None),
                    "email": getattr(e, "email", None),
                    "phone": getattr(e, "phone", None),
                    "manager": None,  # Employees no longer have managers
                    "status": getattr(e, "status", None),
                    "is_online": getattr(e, "is_online", None),
                    "last_seen": isoz(getattr(e, "last_seen", None)),
                    "created_at": isoz(getattr(e, "created_at", None)),
                    "updated_at": isoz(getattr(e, "updated_at", None)),
                }

            out.append({
                "id": str(a.id),
                "address_text": a.address_text,
                "status": a.status,
                "status_display": status_display,
                "status_color": status_color,
                "position": to_point(lon_pos, lat_pos),
                "tags": normalize_tags(a.tags),
                "recorded_at": isoz(a.recorded_at),
                "campaign": campaign_obj,
                "employee": employee_obj,
                "manager": manager_top,
                "notes": a.notes,
            })

        out.sort(key=lambda x: order_index[x["id"]])
        return Response(out)
