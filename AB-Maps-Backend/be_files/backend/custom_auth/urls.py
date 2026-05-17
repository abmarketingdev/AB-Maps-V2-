"""
URLs for the custom_auth app.
"""
from django.urls import path
from .views import (
    CustomTokenObtainPairView,
    CustomTokenRefreshView,
    LoginView,
    logout_view,
    verify_token,
    verify_token_public
)

urlpatterns = [
    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('logout/', logout_view, name='logout'),
    path('refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),
    path('token/', CustomTokenObtainPairView.as_view(), name='token'),
    path('verify/', verify_token, name='verify'),
    path('verify-public/', verify_token_public, name='verify_public'),
] 