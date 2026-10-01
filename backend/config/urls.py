"""Configuration des URLs du projet Gesti-Scolaire ERP."""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi

schema_view = get_schema_view(
    openapi.Info(
        title="Gesti-Scolaire ERP API",
        default_version="v1",
        description="API REST du système de gestion scolaire Gesti-Scolaire (Django + DRF + JWT).",
    ),
    public=True,
    permission_classes=[permissions.AllowAny],
)

urlpatterns = [
    path("admin/", admin.site.urls),

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

    # Documentation API
    path("api/docs/", schema_view.with_ui("swagger", cache_timeout=0), name="schema-swagger-ui"),
    path("api/redoc/", schema_view.with_ui("redoc", cache_timeout=0), name="schema-redoc"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
