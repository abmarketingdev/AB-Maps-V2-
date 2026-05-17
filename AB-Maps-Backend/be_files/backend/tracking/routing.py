"""
WebSocket routing for the tracking app.
"""
from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/tracking/$', consumers.LocationTrackingConsumer.as_asgi()),
    re_path(r'ws/tracking/dashboard/$', consumers.ManagerDashboardConsumer.as_asgi()),
    re_path(r'ws/tracking/superuser/$', consumers.SuperUserConsumer.as_asgi()),
] 