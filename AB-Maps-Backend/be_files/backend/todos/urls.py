"""
URLs for the Todos app.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TodoViewSet, assignment_users, assign_users_create

router = DefaultRouter()
router.register(r'todos', TodoViewSet, basename='todo')

urlpatterns = [
    path('', include(router.urls)),
    path('assignment-users/', assignment_users, name='todo-assignment-users'),
    path('assign-users/', assign_users_create, name='todo-assign-users'),
]

