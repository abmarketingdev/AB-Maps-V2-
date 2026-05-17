"""
WebSocket routing for talkmore_enrichment app.
"""
from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    # Support both with and without api/ prefix
    # UUID format: 8-4-4-4-12 hex digits with hyphens
    re_path(r'api/ws/talkmore/jobs/(?P<job_id>[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/$', consumers.TalkmoreJobConsumer.as_asgi()),
    re_path(r'ws/talkmore/jobs/(?P<job_id>[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/$', consumers.TalkmoreJobConsumer.as_asgi()),
]
