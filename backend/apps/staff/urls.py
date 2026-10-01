from rest_framework.routers import DefaultRouter

from apps.staff.views import (
    AffectationViewSet,
    DocumentPedagogiqueViewSet,
    EmployeViewSet,
    EnseignantViewSet,
    PresenceEmployeViewSet,
)

router = DefaultRouter()
router.register(r"employes", EmployeViewSet, basename="employe")
router.register(r"enseignants", EnseignantViewSet, basename="enseignant")
router.register(r"affectations", AffectationViewSet, basename="affectation")
router.register(r"presences-employes", PresenceEmployeViewSet, basename="presence-employe")
router.register(r"documents-pedagogiques", DocumentPedagogiqueViewSet, basename="document-pedagogique")

urlpatterns = router.urls
