from django.apps import AppConfig


class BuildingsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'buildings'
    
    def ready(self):
        """Import signal handlers when the app is ready."""
        import buildings.signals  # noqa