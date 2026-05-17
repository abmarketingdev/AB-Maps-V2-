"""
App configuration for todos app.
"""
from django.apps import AppConfig


class TodosConfig(AppConfig):
    """Configuration for todos app."""
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'todos'
    verbose_name = 'Todos'
