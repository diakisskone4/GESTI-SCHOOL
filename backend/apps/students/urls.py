from rest_framework.routers import DefaultRouter

from apps.students.views import (
    AbsenceViewSet,
    CarteScolaireViewSet,
    EleveViewSet,
    InscriptionViewSet,
    SanctionRecompenseViewSet,
)

router = DefaultRouter()
router.register(r"eleves", EleveViewSet, basename="eleve")
router.register(r"inscriptions", InscriptionViewSet, basename="inscription")
router.register(r"absences", AbsenceViewSet, basename="absence")
router.register(r"sanctions-recompenses", SanctionRecompenseViewSet, basename="sanction-recompense")
router.register(r"cartes-scolaires", CarteScolaireViewSet, basename="carte-scolaire")

urlpatterns = router.urls
