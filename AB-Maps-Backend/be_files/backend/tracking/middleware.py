"""
WebSocket middleware for tracking app.
"""
import json
import logging
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

User = get_user_model()
logger = logging.getLogger(__name__)


class JWTAuthMiddleware(BaseMiddleware):
    """
    Middleware to authenticate WebSocket connections using JWT tokens.
    """
    
    async def __call__(self, scope, receive, send):
        token = None
        
        # Try to get token from query parameters (standard for WebSocket)
        query_string = scope.get('query_string', b'').decode()
        if query_string:
            query_params = dict(x.split('=') for x in query_string.split('&') if '=' in x)
            token = query_params.get('token')
        
        # Try to get token from headers as fallback (some WebSocket libraries support this)
        if not token:
            # Headers are list of tuples [(b'header-name', b'value'), ...] in ASGI
            headers = scope.get('headers', [])
            for header_name, header_value in headers:
                if header_name.lower() == b'authorization':
                    auth_header = header_value.decode('utf-8')
                    if auth_header.startswith('Bearer '):
                        token = auth_header[7:]  # Remove 'Bearer ' prefix
                    break
        
        logger.debug(f"JWTAuthMiddleware - Token present: {bool(token)}")
        
        if token:
            # Authenticate the user
            user = await self.get_user_from_token(token)
            if user:
                scope['user'] = user
                logger.info(f"JWTAuthMiddleware - Authentication successful for user: {user.id}")
            else:
                # Use AnonymousUser instead of None to avoid AttributeError in AuthMiddlewareStack
                scope['user'] = AnonymousUser()
                logger.warning("JWTAuthMiddleware - Authentication failed - invalid token or user not found")
        else:
            # Use AnonymousUser instead of None to avoid AttributeError in AuthMiddlewareStack
            scope['user'] = AnonymousUser()
            logger.debug("JWTAuthMiddleware - No token provided")
        
        return await super().__call__(scope, receive, send)
    
    @database_sync_to_async
    def get_user_from_token(self, token):
        """Get user from JWT token."""
        try:
            access_token = AccessToken(token)
            user_id = access_token['user_id']
            user = User.objects.get(id=user_id)
            logger.info(f"Successfully authenticated user {user_id} from token")
            return user
        except (InvalidToken, TokenError) as e:
            logger.error(f"JWT token validation failed: {str(e)}")
            return None
        except User.DoesNotExist:
            logger.error(f"User with ID {access_token.get('user_id', 'unknown')} not found in database")
            return None
        except Exception as e:
            logger.error(f"Unexpected error during token authentication: {str(e)}")
            return None


class LocationTrackingMiddleware(BaseMiddleware):
    """
    Middleware to set up location tracking specific data in scope.
    """
    
    async def __call__(self, scope, receive, send):
        # Add tracking-specific data to scope
        scope['tracking'] = {
            'enabled': True,
            'version': '1.0'
        }
        
        return await super().__call__(scope, receive, send) 