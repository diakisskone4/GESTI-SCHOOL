from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.plateforme.views import (
    DemandeDemoPubliqueView, DemandeDemoViewSet, EquipeViewSet, EtablissementConsoleViewSet, InscriptionEquipeView,
    JournalConsoleViewSet, StatistiquesPlateformeView,
)

router = DefaultRouter(trailing_slash=True)
router.register(r"plateforme/etablissements", EtablissementConsoleViewSet, basename="plateforme-etablissement")
router.register(r"plateforme/equipe", EquipeViewSet, basename="plateforme-equipe")
router.register(r"plateforme/journal", JournalConsoleViewSet, basename="plateforme-journal")
router.register(r"plateforme/demandes", DemandeDemoViewSet, basename="plateforme-demande")

urlpatterns = [
    path("plateforme/statistiques/", StatistiquesPlateformeView.as_view(), name="plateforme-statistiques"),
    path("plateforme/inscription-equipe/", InscriptionEquipeView.as_view(), name="plateforme-inscription-equipe"),
    # Formulaire public du site vitrine
    path("public/demande-demo/", DemandeDemoPubliqueView.as_view(), name="demande-demo-publique"),
] + router.urls
