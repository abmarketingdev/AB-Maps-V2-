"""
URL configuration for AB Maps project.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

schema_view = get_schema_view(
    openapi.Info(
        title="AB Maps API",
        default_version='v1',
        description="API documentation for AB Maps System",
        terms_of_service="https://www.google.com/policies/terms/",
        contact=openapi.Contact(email="support@abmaps.com"),
        license=openapi.License(name="BSD License"),
    ),
    public=True,
    permission_classes=(permissions.AllowAny,),
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('custom_auth.urls')),
    path('api/users/', include('users.urls')),
    path('api/campaigns/', include('campaigns.urls')),
    path('api/areas/', include('areas.urls')),
    path('api/addresses/', include('addresses.urls')),
    path('api/uploaded-addresses/', include('uploaded_addresses.urls')),
    path('api/tracking/', include('tracking.urls')),
    path('api/dashboard/', include('dashboard.urls')),
    path('api/learning/', include('learning.urls')),
    path('api/todos/', include('todos.urls')),
    path('api/locked-areas/', include('locked_areas.urls')),
    path('api/polygon-operations/', include('polygon_operations.urls')),
    path('api/talkmore/', include('talkmore_enrichment.urls')),
    path('api/', include('apartments.urls')),
    path('api/', include('buildings.urls')),
    path('api/qc/', include('qc_system.urls')),
    path('api/gamification/', include('qc_system.gamification_urls')),
    path('api/admin/', include('qc_system.admin_urls')),
    # Tiles endpoints (no /api prefix for tiles)
    path('', include('tiles.urls')),
    # Swagger/OpenAPI endpoints (drf-yasg)
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
    # drf-spectacular endpoints (JWT-secured)
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
