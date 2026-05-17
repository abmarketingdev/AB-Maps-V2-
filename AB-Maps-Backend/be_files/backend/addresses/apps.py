from django.apps import AppConfig


class AddressesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'addresses'
    
    def ready(self):
        """Import signals when the app is ready."""
        from . import signals  # noqa: F401