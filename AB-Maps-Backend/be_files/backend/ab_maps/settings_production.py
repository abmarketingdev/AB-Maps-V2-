"""
Django production settings for AB Maps project on Render.
"""

import os
from pathlib import Path
from decouple import config
from datetime import timedelta

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Add the backend directory to Python path for services module
import sys
sys.path.insert(0, str(BASE_DIR))

# Debug: Print Python path for troubleshooting
print(f"Python path: {sys.path}")
print(f"BASE_DIR: {BASE_DIR}")
print(f"Current working directory: {os.getcwd()}")

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = config('SECRET_KEY')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = config('DEBUG', default=False, cast=bool)

# Get the Render external URL
RENDER_EXTERNAL_HOSTNAME = config('RENDER_EXTERNAL_HOSTNAME', default=None)

# Build ALLOWED_HOSTS from environment
ALLOWED_HOSTS = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    'api-prod-frankfurt.onrender.com',
    'abmaps.absystem.no',
    'www.abmaps.absystem.no',
    'abtest.no',
    'www.abtest.no',
]

if RENDER_EXTERNAL_HOSTNAME:
    ALLOWED_HOSTS.append(RENDER_EXTERNAL_HOSTNAME)

# Application definition
INSTALLED_APPS = [
    # Must be at the top of INSTALLED_APPS so Daphne's `runserver`
    # command overrides Django's default WSGI runserver and serves ASGI
    # (required for Channels 4.x WebSockets).
    'daphne',

    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.gis',
    
    # Third party apps
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'rest_framework_gis',
    'corsheaders',
    'channels',
    'django_filters',
    'django_extensions',
    'drf_spectacular',
    'drf_yasg',
    'ab_maps',

    
    # Local apps
    'users',
    'custom_auth',
    'campaigns',
    'areas',
    'addresses',
    'tracking',
    'dashboard',
    'uploaded_addresses',
    'learning',
    'tiles',
    'todos',  # Personal TODO feature
    'locked_areas',  # Locked areas feature
    'polygon_operations',  # Polygon-based bulk deletion operations
    'apartments',  # Apartment catalogue management
    'buildings',  # Building-centric architecture (parent of apartments)
    'talkmore_enrichment',  # Talkmore enrichment pipeline
    'qc_system',  # QC System for quality control employees
    # 'sales',
    # 'reports',
]

MIDDLEWARE = [
    # Consider enabling GZip only if compatible with streaming through your platform
    # 'django.middleware.gzip.GZipMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'ab_maps.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'ab_maps.wsgi.application'
ASGI_APPLICATION = 'ab_maps.asgi.application'

# Database - Use Render's PostgreSQL
DATABASES = {
    'default': {
        'ENGINE': 'django.contrib.gis.db.backends.postgis',
        'NAME': config('POSTGRES_DB'),
        'USER': config('POSTGRES_USER'),
        'PASSWORD': config('POSTGRES_PASSWORD'),
        'HOST': config('POSTGRES_HOST'),
        'PORT': config('POSTGRES_PORT', default='5432'),
    }
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Only include static directories that exist
STATICFILES_DIRS = []
if (BASE_DIR / 'static').exists():
    STATICFILES_DIRS.append(BASE_DIR / 'static')

# WhiteNoise configuration for static files
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# 0CodeKit Storage API Configuration
# Used for uploading images and videos for learning content
# Documentation: https://docs.0codekit.com/api/storage-perm-add-post/
# Base URL: https://prod.0codekit.com (from official documentation)
ZEROCODEKIT_API_KEY = config('ZEROCODEKIT_API_KEY', default='rt0PhIQun1Qd7SZMqhJhECjl1JRUh3H2Cy2r5AfHu-M')
ZEROCODEKIT_BASE_URL = config('ZEROCODEKIT_BASE_URL', default='https://prod.0codekit.com')
ZEROCODEKIT_MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB max for images
ZEROCODEKIT_MAX_VIDEO_SIZE = 100 * 1024 * 1024  # 100MB max for videos

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Custom User model
AUTH_USER_MODEL = 'users.User'

# REST Framework settings
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ),
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
        'ab_maps.renderers.NDJSONRenderer',
    ),
    # Throttling disabled for bulk endpoints per business requirement
    # 'DEFAULT_THROTTLE_CLASSES': (
    #     'rest_framework.throttling.AnonRateThrottle',
    #     'rest_framework.throttling.UserRateThrottle',
    #     'rest_framework.throttling.ScopedRateThrottle',
    # ),
    # 'DEFAULT_THROTTLE_RATES': {
    #     'anon': '60/min',
    #     'user': '120/min',
    #     'bulk_export': '2/hour',
    # },
}

# JWT Settings
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=8),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': False,
    'BLACKLIST_AFTER_ROTATION': False,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'VERIFYING_KEY': None,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_HEADER_NAME': 'HTTP_AUTHORIZATION',
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
    'TOKEN_TYPE_CLAIM': 'token_type',
    'JTI_CLAIM': 'jti',
    'TOKEN_USER_CLASS': 'users.User',
}

# Channels configuration - Use Render's Redis
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            "hosts": [config('REDIS_URL')],
        },
    },
}

# WebSocket Configuration
WEBSOCKET_CONFIG = {
    'PING_INTERVAL': 60,
    'PONG_TIMEOUT': 30,
    'CONNECTION_TIMEOUT': 1800,
    'MAX_CONNECTIONS_PER_USER': 5,
    'HEARTBEAT_INTERVAL': 45,
}

# Redis Configuration (for WebSockets)
REDIS_URL = config('REDIS_URL')

# Cache Configuration (for tile caching)
CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": REDIS_URL,
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        },
        "TIMEOUT": 300,  # 5 minutes default timeout
    }
}

# CORS settings for production
CORS_ALLOWED_ORIGINS = [
    "https://abtest.no",   
    "https://www.abtest.no",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001", 
    "http://127.0.0.1:3001",
    "http://localhost:3002",
    "http://127.0.0.1:3002",
    "https://www.abmaps.absystem.no",
    "https://abmaps.absystem.no",
    "https://qc.absystem.no"




]

# Add your Render frontend URLs here
if RENDER_EXTERNAL_HOSTNAME:
    CORS_ALLOWED_ORIGINS.append(f"https://{RENDER_EXTERNAL_HOSTNAME}")

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
    'x-campaign-id',
]

# Security settings for production
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'services.kid_generator': {
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': False,
        },
        'campaigns.serializers': {
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': False,
        },
        'addresses.signals': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'tiles.tiles': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'tiles.views': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'uploaded_addresses': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'services.email_service': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'locked_areas': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'learning.views': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'learning': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}
# DRF Spectacular settings
SPECTACULAR_SETTINGS = {
    'TITLE': 'AB Maps API',
    'DESCRIPTION': 'API documentation for AB Maps System',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'COMPONENT_SPLIT_REQUEST': True,
    'SCHEMA_PATH_PREFIX': '/api/',
    'SWAGGER_UI_SETTINGS': {
        'deepLinking': True,
        'persistAuthorization': True,
        'displayOperationId': True,
    },
} 

KID_GENERATION_ENABLED = config('KID_GENERATION_ENABLED', default=True, cast=bool)
KID_API_BASE_URL = config('KID_API_BASE_URL', default='https://wsmember.npaid.org/rest')
KID_API_AUTH_TOKEN = config('KID_API_AUTH_TOKEN', default='bWM6L3pAWlhuNUg=')
KID_API_TIMEOUT = config('KID_API_TIMEOUT', default=30, cast=int)

# Email Configuration for Production
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'mail.absystem.no'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = 'admin@absystem.no'
EMAIL_HOST_PASSWORD = 'v1jYVdwcMGkB'
DEFAULT_FROM_EMAIL = 'AB Maps System <admin@absystem.no>'

# Google Geocoding / Places API key
# Use env var name as provided: GOOGLE_PLACES_API_KEY
# If env var is not set, use the provided API key as default
GOOGLE_PLACES_API_KEY = config('GOOGLE_PLACES_API_KEY', default='AIzaSyAGBFZFw8hqNulocXBXyHZYhGgL49_eBuY')

# Learning Platform Settings
# Set to False to bypass completion checks (hardcode all_completed=True for testing)
# Set to True to enable normal completion checking
LEARNING_COMPLETION_CHECK_ENABLED = False  # TODO: Set to True when testing is complete

# Talkmore Enrichment API Keys
# These should be set as environment variables in production
API1881_EXTENDED_KEY = config('API1881_EXTENDED_KEY', default=None)
API1881_BASIC_KEY = config('API1881_BASIC_KEY', default=None)
DATA247_KEY = config('DATA247_KEY', default=None)

# QC: campaigns with 3rd call column (Blå Kors). UUID list and/or name substrings.
_qc_third_ids = config('QC_THIRD_ATTEMPT_CAMPAIGN_IDS', default='')
QC_THIRD_ATTEMPT_CAMPAIGN_IDS = [x.strip() for x in _qc_third_ids.split(',') if x.strip()]
_subs = config('QC_THIRD_ATTEMPT_NAME_SUBSTRINGS', default='blå kors,bla kors,blakors')
QC_THIRD_ATTEMPT_NAME_SUBSTRINGS = [x.strip().lower() for x in _subs.split(',') if x.strip()]
QC_IMPORT_MAX_ROWS = config('QC_IMPORT_MAX_ROWS', default=50000, cast=int)
QC_IMPORT_MAX_FILE_MB = config('QC_IMPORT_MAX_FILE_MB', default=10, cast=int)