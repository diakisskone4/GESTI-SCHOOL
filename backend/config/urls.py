"""Configuration des URLs du projet Gesti-Scolaire ERP."""
from django.conf import settings
from django.contrib import admin
from django.contrib.admin.views.decorators import staff_member_required
from django.http import JsonResponse
from django.urls import include, path, re_path
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi

from apps.core.media_securise import servir_media

schema_view = get_schema_view(
    openapi.Info(
        title="Gesti-Scolaire ERP API",
        default_version="v1",
        description="API REST du système de gestion scolaire Gesti-Scolaire (Django + DRF + JWT).",
    ),
    public=True,
    permission_classes=[permissions.AllowAny],
)


def documentation(vue):
    """La documentation de l'API décrit toutes les routes : réservée aux administrateurs en production."""
    return vue if settings.DEBUG else staff_member_required(vue)


def sante(request):
    """Contrôle de bon fonctionnement utilisé par l'hébergeur (Render), sans aucune donnée."""
    return JsonResponse({"statut": "ok"})


urlpatterns = [
    # Adresse de l'administration Django modifiable (variable ADMIN_URL) pour ne pas exposer « /admin/ »
    path(settings.ADMIN_URL, admin.site.urls),
    path("api/v1/sante/", sante, name="sante"),

    # Auth & utilisateurs
    path("api/v1/", include("apps.accounts.urls")),
    # Établissements, années, périodes, classes, matières, EDT, journal
    path("api/v1/", include("apps.core.urls")),
    # Élèves, inscriptions, absences, sanctions, cartes
    path("api/v1/", include("apps.students.urls")),
    # Enseignants / personnel
    path("api/v1/", include("apps.staff.urls")),
    # Notes, bulletins, examens
    path("api/v1/", include("apps.academics.urls")),
    # Documents administratifs (certificats, convocations, attestations)
    path("api/v1/", include("apps.documents_mgmt.urls")),
    # Finance (frais, bourses, paiements)
    path("api/v1/", include("apps.finance.urls")),
    # Paie
    path("api/v1/", include("apps.payroll.urls")),
    # Communication (messages, annonces, notifications)
    path("api/v1/", include("apps.communication.urls")),
    # Reporting / statistiques
    path("api/v1/", include("apps.reporting.urls")),
    # Console de l'équipe développeurs (établissements clients, abonnements)
    path("api/v1/", include("apps.plateforme.urls")),

    # Documentation API
    path("api/docs/", documentation(schema_view.with_ui("swagger", cache_timeout=0)), name="schema-swagger-ui"),
    path("api/redoc/", documentation(schema_view.with_ui("redoc", cache_timeout=0)), name="schema-redoc"),

    # Fichiers envoyés et générés : uniquement par des liens signés et temporaires délivrés par l'API
    # (apps/core/media_securise.py) ; sans signature valide, réponse 404.
    re_path(r"^media/(?P<path>.+)$", servir_media),
]
