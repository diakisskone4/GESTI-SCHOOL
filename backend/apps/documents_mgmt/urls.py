from rest_framework.routers import DefaultRouter

from apps.documents_mgmt.views import DocumentGenereViewSet

router = DefaultRouter()
router.register(r"documents", DocumentGenereViewSet, basename="document-genere")

urlpatterns = router.urls
