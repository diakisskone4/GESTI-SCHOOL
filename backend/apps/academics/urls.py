from rest_framework.routers import DefaultRouter

from apps.academics.views import (
    BulletinViewSet,
    ExamenViewSet,
    ExportResultatsView,
    MoyenneMatiereViewSet,
    NoteViewSet,
    TableauHonneurViewSet,
    TypeEvaluationViewSet,
)

router = DefaultRouter()
router.register(r"types-evaluation", TypeEvaluationViewSet, basename="type-evaluation")
router.register(r"notes", NoteViewSet, basename="note")
router.register(r"moyennes-matieres", MoyenneMatiereViewSet, basename="moyenne-matiere")
router.register(r"bulletins", BulletinViewSet, basename="bulletin")
router.register(r"tableaux-honneur", TableauHonneurViewSet, basename="tableau-honneur")
router.register(r"examens", ExamenViewSet, basename="examen")
router.register(r"exports", ExportResultatsView, basename="export-resultats")

urlpatterns = router.urls
