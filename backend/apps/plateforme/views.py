import hmac

from django.conf import settings
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.core.models import Etablissement
from apps.plateforme.models import DUREES_MOIS, Abonnement, ajouter_mois
from apps.plateforme.serializers import (
    AdministrateurSerializer, DeveloppeurSerializer, EtablissementConsoleSerializer, InscriptionEquipeSerializer,
    creer_administrateur,
)


class EstDeveloppeur(BasePermission):
    """Console réservée à l'équipe développeurs. Pour tout autre compte, elle n'existe pas (404)."""

    def has_permission(self, request, view):
        user = request.user
        if user and user.is_authenticated and user.est_developpeur and user.is_active:
            return True
        raise NotFound()


def limite_etablissements():
    return settings.PLATEFORME_MAX_ETABLISSEMENTS


def _avec_volumes(qs):
    return qs.select_related("abonnement").annotate(
        nb_eleves=Count("eleves", distinct=True),
        nb_utilisateurs=Count("utilisateurs", filter=~Q(utilisateurs__role=User.Role.DEVELOPPEUR), distinct=True),
    )


class StatistiquesPlateformeView(APIView):
    swagger_schema = None  # invisible dans /api/docs
    permission_classes = [EstDeveloppeur]

    def get(self, request):
        aujourd_hui = timezone.localdate()
        etablissements = list(_avec_volumes(Etablissement.objects.all()))
        statuts = {"actif": 0, "expire": 0, "suspendu": 0, "sans_abonnement": 0}
        bientot = []
        for e in etablissements:
            ab = getattr(e, "abonnement", None)
            if ab is None:
                statuts["sans_abonnement"] += 1
                continue
            statuts[ab.statut] += 1
            if ab.statut == "actif" and ab.jours_restants <= 30:
                bientot.append({"id": e.id, "nom": e.nom, "date_fin": ab.date_fin, "jours_restants": ab.jours_restants})
        total = len(etablissements)
        return Response({
            "total_etablissements": total,
            "limite": limite_etablissements(),
            "places_restantes": max(limite_etablissements() - total, 0),
            "par_statut": statuts,
            "expirent_bientot": sorted(bientot, key=lambda x: x["jours_restants"]),
            "total_eleves": sum(e.nb_eleves for e in etablissements),
            "total_utilisateurs": sum(e.nb_utilisateurs for e in etablissements),
            "nouveaux_ce_mois": sum(1 for e in etablissements
                                    if e.created_at.date() >= aujourd_hui.replace(day=1)),
            "nb_developpeurs": User.objects.filter(role=User.Role.DEVELOPPEUR, is_active=True).count(),
        })


class EtablissementConsoleViewSet(viewsets.ModelViewSet):
    """Établissements clients : création (avec abonnement et compte administrateur), accès, renouvellement."""
    serializer_class = EtablissementConsoleSerializer
    swagger_schema = None  # invisible dans /api/docs
    permission_classes = [EstDeveloppeur]
    search_fields = ["nom", "sigle", "ville", "email"]

    def get_queryset(self):
        return _avec_volumes(Etablissement.objects.all()).order_by("nom")

    def perform_create(self, serializer):
        if Etablissement.objects.count() >= limite_etablissements():
            raise ValidationError({"detail": f"Limite atteinte : la plateforme accepte au maximum "
                                             f"{limite_etablissements()} établissements."})
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        etablissement = self.get_object()
        # Suppression définitive de TOUTES les données : on exige de retaper le sigle
        if (request.query_params.get("confirmation") or "").strip().upper() != (etablissement.sigle or "").upper():
            raise ValidationError({"detail": "Confirmation invalide : saisissez le sigle de l'établissement."})
        etablissement.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _abonnement(self):
        etablissement = self.get_object()
        abonnement, _ = Abonnement.objects.get_or_create(
            etablissement=etablissement,
            defaults={"date_fin": ajouter_mois(timezone.localdate(), 12), "duree_mois": 12},
        )
        return etablissement, abonnement

    def _reponse(self, etablissement):
        return Response(self.get_serializer(self.get_queryset().get(pk=etablissement.pk)).data)

    @action(detail=True, methods=["post"])
    def activer(self, request, pk=None):
        etablissement, abonnement = self._abonnement()
        abonnement.actif = True
        abonnement.save(update_fields=["actif", "updated_at"])
        Etablissement.objects.filter(pk=etablissement.pk).update(actif=True)
        return self._reponse(etablissement)

    @action(detail=True, methods=["post"])
    def desactiver(self, request, pk=None):
        etablissement, abonnement = self._abonnement()
        abonnement.actif = False
        abonnement.save(update_fields=["actif", "updated_at"])
        Etablissement.objects.filter(pk=etablissement.pk).update(actif=False)
        return self._reponse(etablissement)

    @action(detail=True, methods=["post"])
    def renouveler(self, request, pk=None):
        duree = int(request.data.get("duree_mois") or 0)
        if duree not in dict(DUREES_MOIS):
            raise ValidationError({"duree_mois": "Durée invalide : 3, 6, 12 ou 24 mois."})
        etablissement, abonnement = self._abonnement()
        abonnement.renouveler(duree)
        Etablissement.objects.filter(pk=etablissement.pk).update(actif=True)
        return self._reponse(etablissement)

    @action(detail=True, methods=["patch"])
    def notes(self, request, pk=None):
        etablissement, abonnement = self._abonnement()
        abonnement.notes = request.data.get("notes", "")
        abonnement.save(update_fields=["notes", "updated_at"])
        return self._reponse(etablissement)

    @action(detail=True, methods=["post"])
    def ajouter_administrateur(self, request, pk=None):
        etablissement = self.get_object()
        donnees = AdministrateurSerializer(data=request.data)
        donnees.is_valid(raise_exception=True)
        creer_administrateur(etablissement, donnees.validated_data)
        return self._reponse(etablissement)


class EquipeViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """Membres de l'équipe développeurs (créés par un membre existant)."""
    serializer_class = DeveloppeurSerializer
    swagger_schema = None  # invisible dans /api/docs
    permission_classes = [EstDeveloppeur]

    def get_queryset(self):
        return User.objects.filter(role=User.Role.DEVELOPPEUR).order_by("first_name", "last_name")

    def perform_update(self, serializer):
        if serializer.instance.pk == self.request.user.pk and serializer.validated_data.get("is_active") is False:
            raise ValidationError({"detail": "Vous ne pouvez pas désactiver votre propre compte."})
        serializer.save()


class InscriptionEquipeView(APIView):
    """Inscription privée de l'équipe (page non référencée) : exige le code d'invitation défini sur le serveur.
    Sans code configuré, l'inscription est fermée et l'adresse répond 404."""
    swagger_schema = None  # invisible dans /api/docs
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = "auth"

    def post(self, request):
        code_attendu = settings.PLATEFORME_CODE_INVITATION
        if not code_attendu:
            raise NotFound()
        code = str(request.data.get("code_invitation") or "")
        if not hmac.compare_digest(code.encode(), code_attendu.encode()):
            raise PermissionDenied("Code d'invitation invalide.")
        serializer = InscriptionEquipeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(DeveloppeurSerializer(user).data, status=status.HTTP_201_CREATED)
