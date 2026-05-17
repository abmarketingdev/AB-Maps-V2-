"""
URLs for the users app.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ManagerViewSet, EmployeeViewSet, UserViewSet, AuthViewSet,
    admin_list_employees, admin_list_managers, send_welcome_email,
    sales_chief_team_list, sales_chief_team_add, sales_chief_team_bulk_add,
    sales_chief_team_remove, sales_chief_team_bulk_remove,
    sales_chief_available_people,
)
from .promotion_views import promote_employee_to_manager, promote_manager_to_superuser, demote_superuser_to_manager

# Create routers
router = DefaultRouter()
router.register(r'managers', ManagerViewSet)
router.register(r'employees', EmployeeViewSet)
router.register(r'users', UserViewSet)

auth_router = DefaultRouter()
auth_router.register(r'auth', AuthViewSet, basename='auth')

urlpatterns = [
    # Include router URLs
    path('', include(router.urls)),
    path('', include(auth_router.urls)),
    # Admin endpoints
    path('admin/employees/', admin_list_employees, name='admin-list-employees'),
    path('admin/managers/', admin_list_managers, name='admin-list-managers'),
    # Email endpoints
    path('send-welcome-email/', send_welcome_email, name='send-welcome-email'),
    # Promotion endpoints
    path('promote-employee-to-manager/', promote_employee_to_manager, name='promote-employee-to-manager'),
    path('promote-manager-to-superuser/', promote_manager_to_superuser, name='promote-manager-to-superuser'),
    path('demote-superuser-to-manager/', demote_superuser_to_manager, name='demote-superuser-to-manager'),
    # Sales Chief Team endpoints
    path('sales-chief/available-people/', sales_chief_available_people, name='sales-chief-available-people'),
    path('sales-chief/team/', sales_chief_team_list, name='sales-chief-team-list'),
    path('sales-chief/team/add/', sales_chief_team_add, name='sales-chief-team-add'),
    path('sales-chief/team/bulk-add/', sales_chief_team_bulk_add, name='sales-chief-team-bulk-add'),
    path('sales-chief/team/bulk-remove/', sales_chief_team_bulk_remove, name='sales-chief-team-bulk-remove'),
    path('sales-chief/team/<uuid:user_id>/remove/', sales_chief_team_remove, name='sales-chief-team-remove'),
]