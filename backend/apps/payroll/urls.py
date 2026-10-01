from rest_framework.routers import DefaultRouter

from apps.payroll.views import (
    AvanceViewSet,
    BulletinPaieViewSet,
    ContratSalaireViewSet,
    DashboardMasseSalarialeView,
    ElementSalaireViewSet,
    LigneBulletinPaieViewSet,
)

router = DefaultRouter()
router.register(r"elements-salaire", ElementSalaireViewSet, basename="element-salaire")
router.register(r"contrats-salaire", ContratSalaireViewSet, basename="contrat-salaire")
router.register(r"lignes-bulletin-paie", LigneBulletinPaieViewSet, basename="ligne-bulletin-paie")
router.register(r"bulletins-paie", BulletinPaieViewSet, basename="bulletin-paie")
router.register(r"avances", AvanceViewSet, basename="avance")
router.register(r"dashboard-paie", DashboardMasseSalarialeView, basename="dashboard-paie")

urlpatterns = router.urls
