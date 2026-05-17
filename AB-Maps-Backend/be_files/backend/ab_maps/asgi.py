"""
ASGI config for AB Maps project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/4.2/howto/deployment/asgi/
"""

import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ab_maps.settings_production')

from django.core.asgi import get_asgi_application

# Initialize Django ASGI application early to ensure the AppRegistry
# is populated before importing code that may import ORM models.
django_asgi_app = get_asgi_application()

# Now import Channels and your routing
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from tracking.routing import websocket_urlpatterns
from tracking.middleware import JWTAuthMiddleware, LocationTrackingMiddleware
from talkmore_enrichment.routing import websocket_urlpatterns as talkmore_websocket_urlpatterns

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": 
        JWTAuthMiddleware(
            LocationTrackingMiddleware(
                AuthMiddlewareStack(
                    URLRouter(
                        websocket_urlpatterns +  # Existing tracking routes
                        talkmore_websocket_urlpatterns  # New talkmore enrichment routes
                    )
                )
            )
        )
    ,
})