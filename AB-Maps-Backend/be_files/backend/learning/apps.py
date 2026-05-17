"""
App configuration for the learning platform integrated with AB Maps.
"""
from django.apps import AppConfig


class LearningConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'learning'
    verbose_name = 'Learning Platform'
    
    def ready(self):
        """Import signals when the app is ready."""
        import learning.signals
