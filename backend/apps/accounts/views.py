from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.accounts.models import LienParentEleve
from apps.accounts.serializers import (
    ChangePasswordSerializer,
    CustomTokenObtainPairSerializer,
    LienParentEleveSerializer,
    RegisterSerializer,
    UserSerializer,
)
from apps.core.models import JournalActivite
from apps.core.permissions import IsAdmin

User = get_user_model()


class CustomTokenObtainPairView(TokenObtainPairView):
    """Connexion (login) : renvoie access/refresh token + profil utilisateur."""
    serializer_class = CustomTokenObtainPairSerializer
    throttle_scope = "auth"

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            email = request.data.get("email")
            try:
                user = User.objects.get(email=email)
                user.date_derniere_activite = timezone.now()
                user.save(update_fields=["date_derniere_activite"])
                JournalActivite.objects.create(
                    utilisateur=user, action="login",
                    description="Connexion réussie",
                    adresse_ip=request.META.get("REMOTE_ADDR"),
                )
            except User.DoesNotExist:
                pass
        return response


class RegisterView(generics.CreateAPIView):
    """Inscription par rôle avec protection des comptes internes.

    Les élèves et parents peuvent s'inscrire publiquement. Les comptes
    d'administration et du personnel doivent être créés par un administrateur.
    """
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def create(self, request, *args, **kwargs):
        public_roles = {User.Role.ELEVE, User.Role.PARENT}
        role = request.data.get("role", User.Role.ELEVE)
        staff_roles = {
            User.Role.SUPERADMIN,
            User.Role.ADMIN,
            User.Role.ENSEIGNANT,
            User.Role.COMPTABLE,
            User.Role.SURVEILLANT,
        }
        can_create_staff = request.user.is_authenticated and request.user.est_admin
        if role not in public_roles and (role not in staff_roles or not can_create_staff):
            return Response(
                {"detail": "Les comptes du personnel doivent être créés par un administrateur."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class MeView(APIView):
    """Profil de l'utilisateur connecté."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = request.user
        if not user.check_password(serializer.validated_data["ancien_mot_de_passe"]):
            return Response({"ancien_mot_de_passe": "Mot de passe incorrect."}, status=400)
        user.set_password(serializer.validated_data["nouveau_mot_de_passe"])
        user.doit_changer_mot_de_passe = False
        user.save()
        return Response({"detail": "Mot de passe changé avec succès."})


class UserViewSet(viewsets.ModelViewSet):
    """Gestion des utilisateurs par un administrateur (CRUD complet, tous rôles)."""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ["role", "is_active", "etablissement_courant"]
    search_fields = ["email", "first_name", "last_name", "telephone"]
    ordering_fields = ["date_joined", "last_name"]

    def perform_create(self, serializer):
        import secrets
        password = self.request.data.get("password") or secrets.token_urlsafe(10)
        user = serializer.save()
        user.set_password(password)
        user.doit_changer_mot_de_passe = True
        user.save()


class LienParentEleveViewSet(viewsets.ModelViewSet):
    queryset = LienParentEleve.objects.select_related("parent", "eleve")
    serializer_class = LienParentEleveSerializer
    filterset_fields = ["parent", "eleve"]

    def get_permissions(self):
        if self.action == "mes_enfants":
            return [IsAuthenticated()]
        return [IsAdmin()]

    @action(detail=False, methods=["get"])
    def mes_enfants(self, request):
        """Retourne les élèves liés au compte parent connecté."""
        liens = self.get_queryset().filter(parent=request.user)
        return Response(self.get_serializer(liens, many=True).data)
