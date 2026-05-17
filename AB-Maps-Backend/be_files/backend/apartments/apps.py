"""
App configuration for apartments app.
"""
from django.apps import AppConfig


class ApartmentsConfig(AppConfig):
    """Configuration for the apartments app."""
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apartments'
    
    def ready(self):
        """
        Import signal handlers when the app is ready.
        This ensures signals are connected.
        """
        import apartments.signals  # noqa
