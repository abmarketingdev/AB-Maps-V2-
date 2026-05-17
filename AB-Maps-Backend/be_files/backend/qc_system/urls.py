"""
URL configuration for the QC System app.

All endpoints are mounted at /api/qc/ via the main urls.py.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from . import audit_views

router = DefaultRouter()
router.register(r'contacts', views.ContactViewSet, basename='qc-contacts')
router.register(r'agents', views.AgentViewSet, basename='qc-agents')
router.register(r'history', views.HistoryViewSet, basename='qc-history')
router.register(r'settings', views.SettingsViewSet, basename='qc-settings')
router.register(r'dashboard', views.DashboardViewSet, basename='qc-dashboard')
router.register(r'imports', views.ImportViewSet, basename='qc-imports')
router.register(r'transfer-requests', views.TransferRequestViewSet, basename='qc-transfer-requests')

urlpatterns = [
    # Auth endpoints
    path('auth/login', views.qc_login, name='qc-login'),
    path('auth/logout', views.qc_logout, name='qc-logout'),
    path('auth/me', views.qc_me, name='qc-me'),

    # TODO endpoints (QC-specific)
    path('todos/', views.qc_get_todos, name='qc-get-todos'),
    path('todos/create/', views.qc_create_todo, name='qc-create-todo'),
    path('todos/bulk-complete/', views.qc_bulk_complete_todos, name='qc-bulk-complete-todos'),
    path('todos/<uuid:todo_id>/complete/', views.qc_mark_todo_complete, name='qc-mark-todo-complete'),
    path('todos/<uuid:todo_id>/', views.qc_delete_todo, name='qc-delete-todo'),

    # QC admin: employee directory + assignment
    path('get-qc-employees/', views.qc_get_qc_employees, name='qc-get-qc-employees'),
    path('assign-qc-employees/', views.qc_assign_qc_employees, name='qc-assign-qc-employees'),

    # Sales chiefs (digest email + audit log + team)
    path('sales-chiefs/', views.qc_sales_chiefs_list, name='qc-sales-chiefs-list'),
    path('sales-chiefs/notify/', views.qc_sales_chiefs_notify, name='qc-sales-chiefs-notify'),
    path('sales-chiefs/notify-log/', views.qc_sales_chiefs_notify_log, name='qc-sales-chiefs-notify-log'),
    path('sales-chiefs/<uuid:chief_id>/team/', views.qc_sales_chief_team, name='qc-sales-chief-team'),

    # Audit trail (admin only)
    path('admin/audit-log/', audit_views.audit_log_list, name='qc-audit-log-list'),
    path('admin/audit-log/export/', audit_views.audit_log_export, name='qc-audit-log-export'),
    path('admin/agents/', audit_views.audit_agents_list, name='qc-audit-agents-list'),

    # Admin agent board — view any employee's board (admin only)
    path('admin/agent-board/', views.qc_admin_agent_board, name='qc-admin-agent-board'),

    # ViewSet routes (contacts, agents, history, settings, dashboard, imports)
    path('', include(router.urls)),
]
