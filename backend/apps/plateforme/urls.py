from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.plateforme.views import (
    EquipeViewSet, EtablissementConsoleViewSet, InscriptionEquipeView, JournalConsoleViewSet, StatistiquesPlateformeView,
)

router = DefaultRouter(trailing_slash=True)
router.register(r"plateforme/etablissements", EtablissementConsoleViewSet, basename="plateforme-etablissement")
router.register(r"plateforme/equipe", EquipeViewSet, basename="plateforme-equipe")
router.register(r"plateforme/journal", JournalConsoleViewSet, basename="plateforme-journal")

urlpatterns = [
    path("plateforme/statistiques/", StatistiquesPlateformeView.as_view(), name="plateforme-statistiques"),
    path("plateforme/inscription-equipe/", InscriptionEquipeView.as_view(), name="plateforme-inscription-equipe"),
] + router.urls
