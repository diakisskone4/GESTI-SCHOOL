from rest_framework.routers import DefaultRouter

from apps.core.views import (
    AnneeScolaireViewSet,
    ClasseViewSet,
    CreneauEmploiDuTempsViewSet,
    EtablissementViewSet,
    JournalActiviteViewSet,
    MatiereViewSet,
    NiveauViewSet,
    PeriodeViewSet,
    SerieViewSet,
)

router = DefaultRouter()
router.register(r"etablissements", EtablissementViewSet, basename="etablissement")
router.register(r"annees-scolaires", AnneeScolaireViewSet, basename="annee-scolaire")
router.register(r"periodes", PeriodeViewSet, basename="periode")
router.register(r"niveaux", NiveauViewSet, basename="niveau")
router.register(r"series", SerieViewSet, basename="serie")
router.register(r"classes", ClasseViewSet, basename="classe")
router.register(r"matieres", MatiereViewSet, basename="matiere")
router.register(r"emplois-du-temps", CreneauEmploiDuTempsViewSet, basename="creneau-edt")
router.register(r"journal-activite", JournalActiviteViewSet, basename="journal-activite")

urlpatterns = router.urls
