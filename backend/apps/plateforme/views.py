import datetime
import hmac

from django.conf import settings
from django.db import transaction
from django.db.models import Count, F, Max, Prefetch, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.core.models import Etablissement
from apps.plateforme.models import DUREES_MOIS, Abonnement, DemandeDemo, JournalConsole, ajouter_mois
from apps.plateforme.serializers import (
    AdministrateurSerializer, DemandeDemoPubliqueSerializer, DemandeDemoSerializer, DeveloppeurSerializer,
    EtablissementConsoleSerializer, InscriptionEquipeSerializer,
    JournalConsoleSerializer, creer_administrateur,
)

ROLES_ADMIN = [User.Role.ADMIN, User.Role.SUPERADMIN]
SEUIL_ECHEANCE_JOURS = 30   # « à renouveler » : accès qui se termine dans 30 jours ou moins
SEUIL_INACTIVITE_JOURS = 30  # établissement en service sans aucune connexion depuis 30 jours


class EstDeveloppeur(BasePermission):
    """Console réservée à l'équipe développeurs. Pour tout autre compte, elle n'existe pas (404)."""

    def has_permission(self, request, view):
        user = request.user
        if user and user.is_authenticated and user.est_developpeur and user.is_active:
            return True
        raise NotFound()


class PaginationConsole(PageNumberPagination):
    """La plateforme compte au plus quelques dizaines d'établissements : une page suffit à tout afficher."""
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200


class TriValeursVidesALaFin(OrderingFilter):
    """Tri où les valeurs vides (jamais connecté, sans abonnement...) passent toujours en dernier."""

    def filter_queryset(self, request, queryset, view):
        ordre = self.get_ordering(request, queryset, view)
        if not ordre:
            return queryset
        return queryset.order_by(*[
            F(champ[1:]).desc(nulls_last=True) if champ.startswith("-") else F(champ).asc(nulls_last=True)
            for champ in ordre
        ], "pk")


def limite_etablissements():
    return settings.PLATEFORME_MAX_ETABLISSEMENTS


def journaliser(request, action, etablissement=None, details="", nom=None):
    JournalConsole.objects.create(
        auteur=request.user, action=action, etablissement=etablissement,
        etablissement_nom=nom or (etablissement.nom if etablissement else ""), details=details[:255],
    )


def _avec_volumes(qs):
    """Établissements + abonnement, volumes et dernière connexion (sans les comptes de l'équipe)."""
    hors_equipe = ~Q(utilisateurs__role=User.Role.DEVELOPPEUR)
    return qs.select_related("abonnement").prefetch_related(
        Prefetch("utilisateurs", queryset=User.objects.filter(role__in=ROLES_ADMIN), to_attr="admins"),
    ).annotate(
        nb_eleves=Count("eleves", distinct=True),
        nb_utilisateurs=Count("utilisateurs", filter=hors_equipe, distinct=True),
        derniere_activite=Max("utilisateurs__date_derniere_activite", filter=hors_equipe),
    )


def filtre_statut(statut, aujourd_hui):
    """Filtre ORM correspondant au statut d'accès demandé dans la console."""
    en_cours = Q(abonnement__actif=True, abonnement__date_fin__gte=aujourd_hui)
    return {
        "actif": en_cours,
        "a_renouveler": en_cours & Q(abonnement__date_fin__lte=aujourd_hui + datetime.timedelta(days=SEUIL_ECHEANCE_JOURS)),
        "expire": Q(abonnement__actif=True, abonnement__date_fin__lt=aujourd_hui),
        "suspendu": Q(abonnement__actif=False),
        "sans_abonnement": Q(abonnement__isnull=True),
    }.get(statut)


def _mois_precedents(aujourd_hui, nombre):
    """Les `nombre` derniers mois, du plus ancien au mois courant, sous forme de dates au 1er du mois."""
    debut = aujourd_hui.replace(day=1)
    mois = [debut]
    for _ in range(nombre - 1):
        debut = (debut - datetime.timedelta(days=1)).replace(day=1)
        mois.append(debut)
    return list(reversed(mois))


class StatistiquesPlateformeView(APIView):
    """Tableau de bord de l'équipe : capacité, état des accès, croissance, usage, échéances et activité."""
    swagger_schema = None  # invisible dans /api/docs
    permission_classes = [EstDeveloppeur]

    def get(self, request):
        maintenant = timezone.now()
        aujourd_hui = timezone.localdate()
        etablissements = list(_avec_volumes(Etablissement.objects.all()))
        limite = limite_etablissements()

        statuts = {"actif": 0, "expire": 0, "suspendu": 0, "sans_abonnement": 0}
        par_duree = {d: 0 for d, _ in DUREES_MOIS}
        echeancier, inactifs = [], []
        seuil_inactivite = maintenant - datetime.timedelta(days=SEUIL_INACTIVITE_JOURS)
        for e in etablissements:
            ab = getattr(e, "abonnement", None)
            if ab is None:
                statuts["sans_abonnement"] += 1
                continue
            statuts[ab.statut] += 1
            par_duree[ab.duree_mois] = par_duree.get(ab.duree_mois, 0) + 1
            ligne = {"id": e.id, "nom": e.nom, "sigle": e.sigle, "ville": e.ville,
                     "date_fin": ab.date_fin, "jours_restants": ab.jours_restants, "statut": ab.statut}
            if ab.statut == "expire" or (ab.statut == "actif" and ab.jours_restants <= 60):
                echeancier.append(ligne)
            if ab.statut == "actif" and (e.derniere_activite is None or e.derniere_activite < seuil_inactivite):
                inactifs.append({**ligne, "derniere_activite": e.derniere_activite})

        # Croissance : nouveaux établissements par mois sur 12 mois, et total cumulé en fin de mois
        mois = _mois_precedents(aujourd_hui, 12)
        evolution = []
        for i, debut in enumerate(mois):
            fin = mois[i + 1] if i + 1 < len(mois) else ajouter_mois(debut, 1)
            evolution.append({
                "mois": debut.strftime("%Y-%m"),
                "nouveaux": sum(1 for e in etablissements if debut <= timezone.localtime(e.created_at).date() < fin),
                "total": sum(1 for e in etablissements if timezone.localtime(e.created_at).date() < fin),
            })

        comptes = User.objects.exclude(role=User.Role.DEVELOPPEUR).filter(etablissements__isnull=False).distinct()
        actifs_7j = comptes.filter(date_derniere_activite__gte=maintenant - datetime.timedelta(days=7)).count()
        actifs_30j = comptes.filter(date_derniere_activite__gte=maintenant - datetime.timedelta(days=30)).count()

        total = len(etablissements)
        a_renouveler = sum(1 for l in echeancier if l["statut"] == "actif" and l["jours_restants"] <= SEUIL_ECHEANCE_JOURS)
        return Response({
            "genere_le": maintenant,
            "total_etablissements": total,
            "limite": limite,
            "places_restantes": max(limite - total, 0),
            "par_statut": statuts,
            "a_renouveler": a_renouveler,
            "par_duree": [{"duree_mois": d, "nombre": n} for d, n in sorted(par_duree.items())],
            "evolution": evolution,
            "nouveaux_ce_mois": evolution[-1]["nouveaux"],
            "echeancier": sorted(echeancier, key=lambda x: x["jours_restants"]),
            "inactifs": sorted(inactifs, key=lambda x: (x["derniere_activite"] is not None, x["derniere_activite"] or maintenant)),
            "top_eleves": [
                {"id": e.id, "nom": e.nom, "sigle": e.sigle, "nb_eleves": e.nb_eleves}
                for e in sorted(etablissements, key=lambda e: -e.nb_eleves)[:8] if e.nb_eleves
            ],
            "total_eleves": sum(e.nb_eleves for e in etablissements),
            "total_utilisateurs": sum(e.nb_utilisateurs for e in etablissements),
            "utilisateurs_actifs_7j": actifs_7j,
            "utilisateurs_actifs_30j": actifs_30j,
            "nb_developpeurs": User.objects.filter(role=User.Role.DEVELOPPEUR, is_active=True).count(),
            "demandes_nouvelles": DemandeDemo.objects.filter(statut="nouvelle").count(),
            "activite_recente": JournalConsoleSerializer(
                JournalConsole.objects.select_related("auteur")[:12], many=True,
            ).data,
        })


class EtablissementConsoleViewSet(viewsets.ModelViewSet):
    """Établissements clients : création (avec abonnement et compte administrateur), accès, renouvellement."""
    serializer_class = EtablissementConsoleSerializer
    swagger_schema = None  # invisible dans /api/docs
    permission_classes = [EstDeveloppeur]
    pagination_class = PaginationConsole
    filter_backends = [SearchFilter, TriValeursVidesALaFin]
    search_fields = ["nom", "sigle", "ville", "email"]
    ordering_fields = ["nom", "created_at", "nb_eleves", "nb_utilisateurs", "abonnement__date_fin", "derniere_activite"]
    ordering = ["nom"]

    def get_queryset(self):
        qs = _avec_volumes(Etablissement.objects.all())
        statut = self.request.query_params.get("statut")
        if statut:
            filtre = filtre_statut(statut, timezone.localdate())
            if filtre is None:
                raise ValidationError({"statut": "Statut inconnu."})
            qs = qs.filter(filtre)
        return qs

    def perform_create(self, serializer):
        with transaction.atomic():
            # Verrou : deux créations simultanées ne peuvent pas dépasser la limite
            nombre = len(Etablissement.objects.select_for_update().values_list("pk", flat=True))
            if nombre >= limite_etablissements():
                raise ValidationError({"detail": f"Limite atteinte : la plateforme accepte au maximum "
                                                 f"{limite_etablissements()} établissements."})
            etablissement = serializer.save()
            journaliser(self.request, "creation", etablissement,
                        f"Accès de {etablissement.abonnement.duree_mois} mois, jusqu'au {etablissement.abonnement.date_fin:%d/%m/%Y}")

    def perform_update(self, serializer):
        etablissement = serializer.save()
        journaliser(self.request, "modification", etablissement, "Informations de l'établissement")

    def destroy(self, request, *args, **kwargs):
        etablissement = self.get_object()
        # Suppression définitive de TOUTES les données : on exige de retaper le sigle
        if (request.query_params.get("confirmation") or "").strip().upper() != (etablissement.sigle or "").upper():
            raise ValidationError({"detail": "Confirmation invalide : saisissez le sigle de l'établissement."})
        nom = etablissement.nom
        etablissement.delete()
        journaliser(request, "suppression", None, "Établissement et toutes ses données supprimés", nom=nom)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _abonnement(self):
        etablissement = self.get_object()
        abonnement, _ = Abonnement.objects.get_or_create(
            etablissement=etablissement,
            defaults={"date_fin": ajouter_mois(timezone.localdate(), 12), "duree_mois": 12},
        )
        return etablissement, abonnement

    def _reponse(self, etablissement):
        return Response(self.get_serializer(_avec_volumes(Etablissement.objects.all()).get(pk=etablissement.pk)).data)

    @action(detail=True, methods=["post"])
    def activer(self, request, pk=None):
        etablissement, abonnement = self._abonnement()
        abonnement.actif = True
        abonnement.save(update_fields=["actif", "updated_at"])
        Etablissement.objects.filter(pk=etablissement.pk).update(actif=True)
        journaliser(request, "activation", etablissement, "Accès réactivé")
        return self._reponse(etablissement)

    @action(detail=True, methods=["post"])
    def desactiver(self, request, pk=None):
        etablissement, abonnement = self._abonnement()
        abonnement.actif = False
        abonnement.save(update_fields=["actif", "updated_at"])
        Etablissement.objects.filter(pk=etablissement.pk).update(actif=False)
        motif = str(request.data.get("motif") or "").strip()
        journaliser(request, "desactivation", etablissement, motif or "Accès désactivé")
        return self._reponse(etablissement)

    @action(detail=True, methods=["post"])
    def renouveler(self, request, pk=None):
        try:
            duree = int(request.data.get("duree_mois") or 0)
        except (TypeError, ValueError):
            duree = 0
        if duree not in dict(DUREES_MOIS):
            raise ValidationError({"duree_mois": "Durée invalide : 3, 6, 12 ou 24 mois."})
        etablissement, abonnement = self._abonnement()
        abonnement.renouveler(duree)
        Etablissement.objects.filter(pk=etablissement.pk).update(actif=True)
        journaliser(request, "renouvellement", etablissement, f"+{duree} mois, jusqu'au {abonnement.date_fin:%d/%m/%Y}")
        return self._reponse(etablissement)

    @action(detail=True, methods=["patch"])
    def notes(self, request, pk=None):
        etablissement, abonnement = self._abonnement()
        abonnement.notes = request.data.get("notes", "")
        abonnement.save(update_fields=["notes", "updated_at"])
        journaliser(request, "notes", etablissement, "Notes internes mises à jour")
        return self._reponse(etablissement)

    @action(detail=True, methods=["post"])
    def ajouter_administrateur(self, request, pk=None):
        etablissement = self.get_object()
        donnees = AdministrateurSerializer(data=request.data)
        donnees.is_valid(raise_exception=True)
        admin = creer_administrateur(etablissement, donnees.validated_data)
        journaliser(request, "administrateur", etablissement, f"Compte {admin.email}")
        return self._reponse(etablissement)

    @action(detail=True, methods=["get"])
    def historique(self, request, pk=None):
        etablissement = self.get_object()
        actions = JournalConsole.objects.filter(etablissement=etablissement).select_related("auteur")[:50]
        return Response(JournalConsoleSerializer(actions, many=True).data)


class JournalConsoleViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Historique complet des actions de l'équipe."""
    serializer_class = JournalConsoleSerializer
    swagger_schema = None
    permission_classes = [EstDeveloppeur]
    pagination_class = PaginationConsole
    queryset = JournalConsole.objects.select_related("auteur")
    filterset_fields = ["action", "etablissement", "auteur"]
    search_fields = ["etablissement_nom", "details"]


class EquipeViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """Membres de l'équipe développeurs (créés par un membre existant)."""
    serializer_class = DeveloppeurSerializer
    swagger_schema = None  # invisible dans /api/docs
    permission_classes = [EstDeveloppeur]
    pagination_class = PaginationConsole

    def get_queryset(self):
        return User.objects.filter(role=User.Role.DEVELOPPEUR).order_by("first_name", "last_name")

    def perform_create(self, serializer):
        membre = serializer.save()
        journaliser(self.request, "equipe", details=f"Membre ajouté : {membre.email}")

    def perform_update(self, serializer):
        if serializer.instance.pk == self.request.user.pk and serializer.validated_data.get("is_active") is False:
            raise ValidationError({"detail": "Vous ne pouvez pas désactiver votre propre compte."})
        membre = serializer.save()
        if "is_active" in serializer.validated_data:
            etat = "réactivé" if membre.is_active else "désactivé"
            journaliser(self.request, "equipe", details=f"Membre {etat} : {membre.email}")


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


class DemandeDemoPubliqueView(APIView):
    """Formulaire « Demander une démonstration » du site vitrine (public, limité à quelques envois par heure)."""
    swagger_schema = None
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = "contact"

    def post(self, request):
        serializer = DemandeDemoPubliqueSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        donnees = dict(serializer.validated_data)
        if donnees.pop("site_web", ""):
            # Robot détecté (champ invisible rempli) : on répond comme d'habitude sans rien enregistrer
            return Response({"detail": "Merci, votre demande a bien été envoyée."}, status=status.HTTP_201_CREATED)
        adresse = (request.META.get("HTTP_X_FORWARDED_FOR") or request.META.get("REMOTE_ADDR") or "").split(",")[0].strip()
        demande = DemandeDemo.objects.create(**donnees, adresse_ip=adresse or None)
        return Response({
            "detail": "Merci, votre demande a bien été envoyée. Nous vous recontactons très vite.",
            "reference": demande.reference,
        }, status=status.HTTP_201_CREATED)


class DemandeDemoViewSet(mixins.ListModelMixin, mixins.UpdateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    """Demandes reçues depuis le site vitrine : notifications, prise en charge et suivi par l'équipe.

    ?mes=1 : uniquement les demandes prises en charge par le membre connecté.
    """
    serializer_class = DemandeDemoSerializer
    swagger_schema = None
    permission_classes = [EstDeveloppeur]
    pagination_class = PaginationConsole
    filterset_fields = ["statut"]
    search_fields = ["nom", "etablissement", "ville", "telephone", "email"]

    def get_queryset(self):
        qs = DemandeDemo.objects.select_related("pris_en_charge_par")
        if self.request.query_params.get("mes") in ("1", "true"):
            qs = qs.filter(pris_en_charge_par=self.request.user)
        return qs

    @action(detail=False, methods=["get"])
    def notifications(self, request):
        """Boîte de notifications de la console : nouvelles demandes (non prises en charge) et les miennes en cours."""
        nouvelles = DemandeDemo.objects.filter(statut="nouvelle", pris_en_charge_par__isnull=True)
        return Response({
            "nouvelles": nouvelles.count(),
            "mes_en_cours": DemandeDemo.objects.filter(pris_en_charge_par=request.user, statut="en_cours").count(),
            "dernieres": self.get_serializer(nouvelles.select_related("pris_en_charge_par")[:8], many=True).data,
        })

    @action(detail=True, methods=["post"])
    def prendre_en_charge(self, request, pk=None):
        """Le membre connecté s'attribue la demande. Si un collègue l'a déjà prise, il faut confirmer (?forcer=1)."""
        with transaction.atomic():
            demande = get_object_or_404(DemandeDemo.objects.select_for_update(), pk=pk)
            forcer = str(request.data.get("forcer", "")).lower() in ("1", "true")
            if demande.pris_en_charge_par_id and demande.pris_en_charge_par_id != request.user.pk and not forcer:
                return Response({
                    "detail": f"{demande.pris_en_charge_par.get_full_name()} s'occupe déjà de cette demande.",
                    "code": "deja_prise",
                }, status=status.HTTP_409_CONFLICT)
            demande.pris_en_charge_par = request.user
            demande.pris_en_charge_le = timezone.now()
            if demande.statut == "nouvelle":
                demande.statut = "en_cours"
            demande.save(update_fields=["pris_en_charge_par", "pris_en_charge_le", "statut", "modifie_le"])
        journaliser(request, "modification", details=f"Demande {demande.reference} prise en charge", nom=demande.etablissement)
        return Response(self.get_serializer(demande).data)

    @action(detail=True, methods=["post"])
    def liberer(self, request, pk=None):
        """Rend la demande à l'équipe (elle redevient « nouvelle » si elle n'avait pas encore avancé)."""
        demande = self.get_object()
        demande.pris_en_charge_par = None
        demande.pris_en_charge_le = None
        if demande.statut == "en_cours":
            demande.statut = "nouvelle"
        demande.save(update_fields=["pris_en_charge_par", "pris_en_charge_le", "statut", "modifie_le"])
        journaliser(request, "modification", details=f"Demande {demande.reference} rendue à l'équipe", nom=demande.etablissement)
        return Response(self.get_serializer(demande).data)

    def perform_update(self, serializer):
        demande = serializer.save()
        journaliser(self.request, "modification", details=f"Demande de {demande.etablissement} : {demande.get_statut_display()}",
                    nom=demande.etablissement)
