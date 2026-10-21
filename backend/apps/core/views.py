from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.models import (
    AnneeScolaire,
    Classe,
    CreneauEmploiDuTemps,
    ElementSupprime,
    Etablissement,
    JournalActivite,
    Matiere,
    Niveau,
    Periode,
    Serie,
)
from apps.core.permissions import IsAdmin, IsAdminOrReadOnly
from apps.core.serializers import (
    AnneeScolaireSerializer,
    ClasseSerializer,
    CreneauEmploiDuTempsSerializer,
    ElementSupprimeSerializer,
    EtablissementSerializer,
    JournalActiviteSerializer,
    MatiereSerializer,
    NiveauSerializer,
    PeriodeSerializer,
    SerieSerializer,
)
from django.http import Http404, HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny

from apps.core.images import contenu_image, type_mime
from apps.core.tenancy import EtablissementScopedMixin, etablissements_accessibles, etablissements_famille_ids


class EtablissementViewSet(viewsets.ModelViewSet):
    queryset = Etablissement.objects.all()
    serializer_class = EtablissementSerializer
    permission_classes = [IsAdminOrReadOnly]
    search_fields = ["nom", "sigle", "ville"]
    filterset_fields = ["actif", "type_etablissement"]

    def get_queryset(self):
        """Personnel : établissements auxquels il a accès (tous pour un super administrateur).
        Élève / parent : établissement(s) de la famille."""
        user = self.request.user
        if user.est_eleve or user.est_parent:
            return Etablissement.objects.filter(pk__in=etablissements_famille_ids(user))
        return etablissements_accessibles(user)

    @action(detail=True, methods=["get"], permission_classes=[AllowAny], authentication_classes=[])
    def logo(self, request, pk=None):
        """Logo de l'établissement (public, utilisé dans les balises <img>), depuis le fichier
        ou, s'il a disparu du disque, depuis la copie en base de données."""
        etablissement = get_object_or_404(Etablissement, pk=pk)
        contenu = contenu_image(etablissement, "logo")
        if not contenu:
            raise Http404("Aucun logo.")
        reponse = HttpResponse(contenu, content_type=type_mime(etablissement, "logo"))
        reponse["Cache-Control"] = "public, max-age=3600"
        return reponse

    # Création et suppression passent par la console de l'équipe Gesti-Scolaire (limite du nombre
    # d'établissements, abonnement et compte administrateur créés ensemble : apps/plateforme).
    def perform_create(self, serializer):
        raise PermissionDenied("La création d'un établissement se fait par l'équipe Gesti-Scolaire.")

    def perform_update(self, serializer):
        # Le statut d'accès est géré par la plateforme (abonnement), pas par l'établissement
        serializer.validated_data.pop("actif", None)
        serializer.save()

    def perform_destroy(self, instance):
        raise PermissionDenied("La suppression d'un établissement se fait par l'équipe Gesti-Scolaire.")


class AnneeScolaireViewSet(EtablissementScopedMixin, viewsets.ModelViewSet):
    etablissement_field = "etablissement"
    queryset = AnneeScolaire.objects.all()
    serializer_class = AnneeScolaireSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ["etablissement", "est_courante"]

    @action(detail=True, methods=["post"])
    def generer_periodes(self, request, pk=None):
        """Génère automatiquement les 3 trimestres ou 2 semestres pour cette année scolaire."""
        from datetime import timedelta
        annee = self.get_object()
        type_periode = request.data.get("type_periode", "trimestre")
        nb = 3 if type_periode == "trimestre" else 2

        total_days = (annee.date_fin - annee.date_debut).days
        step = max(1, total_days // nb)

        created = []
        for i in range(1, nb + 1):
            d_deb = annee.date_debut + timedelta(days=(i - 1) * step)
            d_fin = annee.date_debut + timedelta(days=i * step - 1) if i < nb else annee.date_fin
            nom_type = "Trimestre" if type_periode == "trimestre" else "Semestre"
            libelle = f"{i}er {nom_type}" if i == 1 else f"{i}ème {nom_type}"
            p, was_created = Periode.objects.get_or_create(
                annee_scolaire=annee,
                type_periode=type_periode,
                numero=i,
                defaults=dict(
                    libelle=libelle,
                    date_debut=d_deb,
                    date_fin=d_fin,
                    est_courante=(i == 1),
                ),
            )
            created.append(PeriodeSerializer(p).data)
        return Response({"detail": f"{len(created)} périodes configurées avec succès pour l'année {annee.libelle}.", "results": created})


class PeriodeViewSet(EtablissementScopedMixin, viewsets.ModelViewSet):
    etablissement_field = "annee_scolaire__etablissement"
    queryset = Periode.objects.all()
    serializer_class = PeriodeSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ["annee_scolaire", "est_courante", "type_periode", "cloturee"]


class NiveauViewSet(EtablissementScopedMixin, viewsets.ModelViewSet):
    etablissement_field = "etablissement"
    queryset = Niveau.objects.all()
    serializer_class = NiveauSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ["etablissement", "cycle"]


class SerieViewSet(EtablissementScopedMixin, viewsets.ModelViewSet):
    etablissement_field = "niveau__etablissement"
    queryset = Serie.objects.all()
    serializer_class = SerieSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ["niveau"]


class ClasseViewSet(EtablissementScopedMixin, viewsets.ModelViewSet):
    etablissement_field = "etablissement"
    etablissement_coherence = ("etablissement", "niveau__etablissement", "annee_scolaire__etablissement")
    queryset = Classe.objects.select_related("niveau", "serie", "annee_scolaire", "professeur_principal")
    serializer_class = ClasseSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ["etablissement", "annee_scolaire", "niveau", "serie"]
    search_fields = ["nom"]


class MatiereViewSet(EtablissementScopedMixin, viewsets.ModelViewSet):
    etablissement_field = "etablissement"
    queryset = Matiere.objects.all()
    serializer_class = MatiereSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ["etablissement"]
    search_fields = ["nom", "code"]


class CreneauEmploiDuTempsViewSet(EtablissementScopedMixin, viewsets.ModelViewSet):
    etablissement_field = "classe__etablissement"
    etablissement_coherence = ("classe__etablissement", "matiere__etablissement")
    queryset = CreneauEmploiDuTemps.objects.select_related("classe", "matiere", "enseignant")
    serializer_class = CreneauEmploiDuTempsSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ["classe", "classe__etablissement", "classe__annee_scolaire", "matiere", "enseignant", "jour", "salle"]


class JournalActiviteViewSet(EtablissementScopedMixin, viewsets.ReadOnlyModelViewSet):
    """Consultation du journal d'audit (lecture seule, admin uniquement)."""
    etablissement_field = "etablissement"
    queryset = JournalActivite.objects.select_related("utilisateur", "etablissement")
    serializer_class = JournalActiviteSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ["action", "utilisateur", "etablissement"]
    search_fields = ["description", "modele"]


class CorbeilleViewSet(EtablissementScopedMixin, mixins.ListModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    """Corbeille de l'établissement actif : éléments supprimés, restaurables pendant CORBEILLE_DUREE_JOURS jours.
    DELETE /corbeille/<id>/ supprime définitivement l'élément (sans possibilité de retour)."""
    etablissement_field = "etablissement"
    queryset = ElementSupprime.objects.select_related("supprime_par").defer("donnees")
    serializer_class = ElementSupprimeSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ["modele"]
    search_fields = ["libelle", "type_objet"]

    def list(self, request, *args, **kwargs):
        from apps.core.corbeille import purger_expires
        from apps.core.tenancy import etablissement_actif_id

        actif = etablissement_actif_id(request.user)
        if actif not in (None, -1):
            purger_expires(actif)
        return super().list(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def restaurer(self, request, pk=None):
        from apps.core.corbeille import restaurer

        element = self.get_queryset().defer(None).get(pk=self.get_object().pk)
        libelle, type_objet, nb = element.libelle, element.type_objet, element.nb_objets
        restaurer(element)
        if element.modele.startswith("students."):
            from apps.students.archives import archiver_apres_operation

            archiver_apres_operation(element.etablissement_id, request.user, "restauration",
                                     f"Restauration depuis la corbeille : {type_objet} « {libelle} »")
        detail = f"{type_objet} « {libelle} » restauré"
        if nb > 1:
            detail += f" avec {nb - 1} élément(s) lié(s)"
        return Response({"detail": detail + "."})

    @action(detail=False, methods=["post"])
    def vider(self, request):
        """Supprime définitivement tout le contenu de la corbeille de l'établissement actif."""
        nombre, _ = self.filter_queryset(self.get_queryset()).delete()
        return Response({"detail": f"Corbeille vidée ({nombre} élément(s) supprimé(s) définitivement)."})
