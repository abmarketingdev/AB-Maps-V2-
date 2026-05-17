"""
URLs for the addresses app.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AddressViewSet
from .api_nearby import NearbyAddressView

router = DefaultRouter()
router.register(r'addresses', AddressViewSet, basename='address')

urlpatterns = [
    path('', include(router.urls)),
    path('nearby/', NearbyAddressView.as_view(), name='nearby-address'),
] 