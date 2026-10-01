from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView, TokenBlacklistView

from apps.accounts.views import (
    ChangePasswordView,
    CustomTokenObtainPairView,
    LienParentEleveViewSet,
    MeView,
    RegisterView,
    UserViewSet,
)

router = DefaultRouter()
router.register(r"utilisateurs", UserViewSet, basename="utilisateur")
router.register(r"liens-parent-eleve", LienParentEleveViewSet, basename="lien-parent-eleve")

urlpatterns = [
    path("auth/login/", CustomTokenObtainPairView.as_view(), name="login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/logout/", TokenBlacklistView.as_view(), name="token_blacklist"),
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/me/", MeView.as_view(), name="me"),
    path("auth/change-password/", ChangePasswordView.as_view(), name="change_password"),
] + router.urls
