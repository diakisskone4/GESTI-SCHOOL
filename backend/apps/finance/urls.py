from rest_framework.routers import DefaultRouter

from apps.finance.views import (
    BaremeFraisViewSet,
    BourseViewSet,
    DashboardFinancierView,
    FactureFraisViewSet,
    PaiementViewSet,
    TypeFraisViewSet,
)

router = DefaultRouter()
router.register(r"types-frais", TypeFraisViewSet, basename="type-frais")
router.register(r"baremes-frais", BaremeFraisViewSet, basename="bareme-frais")
router.register(r"bourses", BourseViewSet, basename="bourse")
router.register(r"factures", FactureFraisViewSet, basename="facture")
router.register(r"paiements", PaiementViewSet, basename="paiement")
router.register(r"dashboard-financier", DashboardFinancierView, basename="dashboard-financier")

urlpatterns = router.urls
