from rest_framework.routers import DefaultRouter

from apps.communication.views import AnnonceViewSet, MessageViewSet, NotificationViewSet

router = DefaultRouter()
router.register(r"messages", MessageViewSet, basename="message")
router.register(r"annonces", AnnonceViewSet, basename="annonce")
router.register(r"notifications", NotificationViewSet, basename="notification")

urlpatterns = router.urls
