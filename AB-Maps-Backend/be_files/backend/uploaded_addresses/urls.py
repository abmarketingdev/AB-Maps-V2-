"""
URLs for the uploaded_addresses app.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UploadedAddressViewSet
from .api_nearby import NearbyUploadedAddressView

router = DefaultRouter()
router.register(r'uploaded-addresses', UploadedAddressViewSet, basename='uploaded-address')

urlpatterns = [
    path('', include(router.urls)),
    path('nearby/', NearbyUploadedAddressView.as_view(), name='nearby-uploaded-address'),
] 