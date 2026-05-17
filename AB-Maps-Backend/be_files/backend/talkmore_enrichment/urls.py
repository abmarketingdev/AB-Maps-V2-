"""
URL configuration for talkmore_enrichment app.
"""
from django.urls import path
from . import views

app_name = 'talkmore_enrichment'

urlpatterns = [
    path('jobs/<uuid:job_id>/status/', views.JobStatusView.as_view(), name='job-status'),
    path('jobs/<uuid:job_id>/results/', views.JobResultsView.as_view(), name='job-results'),
    path('jobs/<uuid:job_id>/results/<uuid:address_uuid>/', views.AddressDetailView.as_view(), name='address-detail'),
    path('areas/<uuid:area_id>/results/', views.AreaResultsView.as_view(), name='area-results'),
]
