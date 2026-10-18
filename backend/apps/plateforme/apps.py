from django.apps import AppConfig


class PlateformeConfig(AppConfig):
    """Console de l'équipe développeurs : établissements clients, abonnements et accès."""
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.plateforme"
    verbose_name = "Plateforme (console développeurs)"
