from django.urls import path
from .views import PolygonDeleteView, PolygonSearchView

app_name = 'polygon_operations'

urlpatterns = [
    path('delete/', PolygonDeleteView.as_view(), name='polygon-delete'),
    path('search/', PolygonSearchView.as_view(), name='polygon-search'),
]

