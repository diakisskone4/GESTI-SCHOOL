from rest_framework.routers import DefaultRouter

from apps.reporting.views import RapportGenereViewSet, StatistiquesViewSet

router = DefaultRouter()
router.register(r"rapports", RapportGenereViewSet, basename="rapport")
router.register(r"statistiques", StatistiquesViewSet, basename="statistiques")

urlpatterns = router.urls
