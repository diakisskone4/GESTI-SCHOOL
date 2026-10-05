from django.contrib.auth import get_user_model, password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
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
from apps.core.tenancy import EtablissementScopedMixin, etablissement_actif_id, peut_acceder

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


class RegisterOptionsView(APIView):
    """Données publiques du formulaire d'inscription : établissements actifs et,
    pour l'établissement choisi, les classes de l'année scolaire en cours."""
    permission_classes = [AllowAny]

    def get(self, request):
        from apps.core.models import Classe, Etablissement

        etablissements = Etablissement.objects.filter(actif=True).order_by("nom")
        data = {"etablissements": [{"id": e.id, "nom": e.nom, "ville": e.ville} for e in etablissements]}
        etablissement_id = request.query_params.get("etablissement")
        if etablissement_id:
            classes = (
                Classe.objects.filter(
                    etablissement_id=etablissement_id, etablissement__actif=True, annee_scolaire__est_courante=True,
                )
                .select_related("niveau", "serie", "annee_scolaire")
                .order_by("niveau__ordre", "nom")
            )
            data["classes"] = [
                {
                    "id": c.id, "nom": c.nom, "niveau": c.niveau.nom,
                    "serie": c.serie.nom if c.serie else None, "annee_scolaire": c.annee_scolaire.libelle,
                }
                for c in classes
            ]
        return Response(data)


class MeView(APIView):
    """Profil de l'utilisateur connecté."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    # Champs qu'un utilisateur peut modifier lui-même (jamais son rôle, ses accès ou son statut).
    CHAMPS_MODIFIABLES = {"first_name", "last_name", "telephone", "photo", "langue_preferee", "etablissement_courant"}

    def patch(self, request):
        interdits = set(request.data.keys()) - self.CHAMPS_MODIFIABLES
        if interdits:
            return Response(
                {"detail": f"Champs non modifiables depuis le profil : {', '.join(sorted(interdits))}."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        etablissement = request.data.get("etablissement_courant")
        if etablissement and not peut_acceder(request.user, etablissement):
            return Response({"detail": "Vous n'avez pas accès à cet établissement."}, status=status.HTTP_403_FORBIDDEN)
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
    """Gestion des utilisateurs par un administrateur (CRUD complet, tous rôles),
    limitée aux comptes de l'établissement actif."""
    queryset = User.objects.all()

    def get_queryset(self):
        qs = super().get_queryset()
        actif = etablissement_actif_id(self.request.user)
        if actif is None:
            return qs
        # Comptes de l'établissement actif + parents pas encore rattachés à un établissement
        return qs.filter(
            Q(etablissements=actif) | Q(role=User.Role.PARENT, etablissements__isnull=True)
        ).distinct()
    serializer_class = UserSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ["role", "is_active", "etablissement_courant"]
    search_fields = ["email", "first_name", "last_name", "telephone"]
    ordering_fields = ["date_joined", "last_name"]

    def _verifier_role(self, role):
        """Seul un super administrateur peut attribuer le rôle « superadmin »."""
        demandeur = self.request.user
        if role == User.Role.SUPERADMIN and not (demandeur.role == User.Role.SUPERADMIN or demandeur.is_superuser):
            raise serializers.ValidationError({"role": "Seul un super administrateur peut attribuer ce rôle."})

    def _valider_mot_de_passe(self, password, user=None):
        try:
            password_validation.validate_password(password, user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)})

    def _verifier_etablissements(self, serializer):
        """Un administrateur ne peut rattacher un compte qu'aux établissements qu'il gère."""
        demandeur = self.request.user
        donnees = serializer.validated_data
        cibles = list(donnees.get("etablissements") or [])
        if donnees.get("etablissement_courant"):
            cibles.append(donnees["etablissement_courant"])
        refuses = [e.nom for e in cibles if not peut_acceder(demandeur, e.pk)]
        if refuses:
            raise PermissionDenied(f"Vous ne gérez pas ces établissements : {', '.join(refuses)}.")

    def perform_create(self, serializer):
        import secrets
        self._verifier_role(serializer.validated_data.get("role"))
        self._verifier_etablissements(serializer)
        if not serializer.validated_data.get("etablissement_courant"):
            # Par défaut, le nouveau compte appartient à l'établissement actif de l'administrateur
            actif = etablissement_actif_id(self.request.user)
            if actif not in (None, -1):
                serializer.validated_data["etablissement_courant_id"] = actif
        password = self.request.data.get("password")
        if password:
            self._valider_mot_de_passe(password)
        else:
            password = secrets.token_urlsafe(10)
        user = serializer.save()
        user.set_password(password)
        user.doit_changer_mot_de_passe = True
        user.save()
        if user.etablissement_courant:
            user.etablissements.add(user.etablissement_courant)

    def perform_update(self, serializer):
        if "role" in serializer.validated_data:
            self._verifier_role(serializer.validated_data["role"])
        self._verifier_etablissements(serializer)
        password = self.request.data.get("password")
        if password:
            self._valider_mot_de_passe(password, serializer.instance)
        user = serializer.save()
        if password:
            user.set_password(password)
            user.doit_changer_mot_de_passe = True
            user.save()
        if user.etablissement_courant:
            user.etablissements.add(user.etablissement_courant)


class LienParentEleveViewSet(EtablissementScopedMixin, viewsets.ModelViewSet):
    etablissement_field = "eleve__etablissement"
    queryset = LienParentEleve.objects.select_related("parent", "eleve")
    serializer_class = LienParentEleveSerializer
    filterset_fields = ["parent", "eleve", "eleve__etablissement", "relation"]
    search_fields = [
        "parent__first_name", "parent__last_name", "parent__email",
        "eleve__nom", "eleve__prenom", "eleve__matricule",
    ]
    ordering = ["eleve__nom", "eleve__prenom"]

    def get_permissions(self):
        if self.action == "mes_enfants":
            return [IsAuthenticated()]
        return [IsAdmin()]

    def perform_create(self, serializer):
        lien = serializer.save()
        # Le parent devient visible dans l'établissement de son enfant
        lien.parent.etablissements.add(lien.eleve.etablissement_id)
        if not lien.parent.etablissement_courant_id:
            lien.parent.etablissement_courant_id = lien.eleve.etablissement_id
            lien.parent.save(update_fields=["etablissement_courant"])

    @action(detail=False, methods=["get"])
    def mes_enfants(self, request):
        """Retourne les élèves liés au compte parent connecté."""
        liens = self.get_queryset().filter(parent=request.user)
        return Response(self.get_serializer(liens, many=True).data)
