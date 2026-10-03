from django.core.files.base import ContentFile
from django.http import FileResponse
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.pdf_utils import generer_carte_scolaire_pdf
from apps.core.permissions import IsAdmin, IsAdminOrReadOnly, IsAdminOuSurveillant
from apps.students.models import Absence, CarteScolaire, Eleve, Inscription, SanctionRecompense
from apps.students.serializers import (
    AbsenceSerializer,
    CarteScolaireSerializer,
    EleveSerializer,
    InscriptionSerializer,
    SanctionRecompenseSerializer,
)


class EleveViewSet(viewsets.ModelViewSet):
    queryset = Eleve.objects.select_related("etablissement", "user")
    serializer_class = EleveSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ["etablissement", "sexe", "actif", "user"]
    search_fields = ["nom", "prenom", "matricule"]

    @action(detail=True, methods=["get"], permission_classes=[IsAuthenticated])
    def historique(self, request, pk=None):
        """Historique scolaire complet : inscriptions, absences, sanctions/récompenses."""
        eleve = self.get_object()
        user = request.user
        est_autorise = (
            user.est_admin or user.est_enseignant or user.est_surveillant
            or (user.est_eleve and eleve.user_id == user.id)
            or (user.est_parent and eleve.parents_lies.filter(parent=user).exists())
        )
        if not est_autorise:
            return Response({"detail": "Non autorisé."}, status=403)
        inscriptions = eleve.inscriptions.select_related("classe", "annee_scolaire").order_by("-date_inscription")
        data = []
        for insc in inscriptions:
            data.append({
                "annee_scolaire": insc.annee_scolaire.libelle,
                "classe": insc.classe.nom,
                "statut": insc.get_statut_display(),
                "redoublant": insc.redoublant,
                "nb_absences": insc.absences.filter(type_evenement="absence").count(),
                "nb_retards": insc.absences.filter(type_evenement="retard").count(),
                "sanctions": insc.sanctions_recompenses.filter(nature="sanction").count(),
                "recompenses": insc.sanctions_recompenses.filter(nature="recompense").count(),
            })
        return Response({"eleve": EleveSerializer(eleve).data, "parcours": data})


class InscriptionViewSet(viewsets.ModelViewSet):
    serializer_class = InscriptionSerializer
    filterset_fields = ["classe", "annee_scolaire", "statut", "type_inscription", "boursier", "redoublant", "eleve"]
    search_fields = ["eleve__nom", "eleve__prenom", "eleve__matricule"]

    def get_queryset(self):
        qs = Inscription.objects.select_related("eleve", "classe", "annee_scolaire")
        user = self.request.user
        if user.est_admin or user.est_enseignant or user.est_comptable:
            return qs
        if user.est_surveillant:
            return qs.filter(eleve__etablissement__in=user.etablissements.all())
        if user.est_eleve:
            return qs.filter(eleve__user=user)
        if user.est_parent:
            return qs.filter(eleve__parents_lies__parent=user)
        return qs.none()

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAdmin()]
        return [IsAuthenticated()]


def _scoper_par_eleve_ou_parent(qs, user, chemin="inscription__eleve"):
    """Restreint un queryset aux données du propre profil élève (ou de l'enfant, pour un parent).
    Admin et enseignant voient tout ; le surveillant voit les élèves de ses établissements ;
    les autres rôles ne voient rien."""
    if user.est_admin or user.est_enseignant:
        return qs
    if user.est_surveillant:
        return qs.filter(**{f"{chemin}__etablissement__in": user.etablissements.all()})
    if user.est_eleve:
        return qs.filter(**{f"{chemin}__user": user})
    if user.est_parent:
        return qs.filter(**{f"{chemin}__parents_lies__parent": user})
    return qs.none()


def _verifier_inscription_accessible(user, inscription):
    """Un surveillant ne peut agir que sur les élèves de ses établissements."""
    if user.est_surveillant and not user.etablissements.filter(pk=inscription.eleve.etablissement_id).exists():
        raise PermissionDenied("Cet élève n'appartient pas à votre établissement.")


class AbsenceViewSet(viewsets.ModelViewSet):
    serializer_class = AbsenceSerializer
    filterset_fields = ["inscription", "type_evenement", "justifiee", "date"]

    def get_queryset(self):
        qs = Absence.objects.select_related("inscription__eleve")
        return _scoper_par_eleve_ou_parent(qs, self.request.user)

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAdminOuSurveillant()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        _verifier_inscription_accessible(self.request.user, serializer.validated_data["inscription"])
        serializer.save(signale_par=self.request.user)

    def perform_update(self, serializer):
        _verifier_inscription_accessible(
            self.request.user, serializer.validated_data.get("inscription", serializer.instance.inscription)
        )
        serializer.save()


class SanctionRecompenseViewSet(viewsets.ModelViewSet):
    serializer_class = SanctionRecompenseSerializer
    permission_classes = [IsAdminOuSurveillant]
    filterset_fields = ["inscription", "nature", "periode"]

    def get_queryset(self):
        qs = SanctionRecompense.objects.select_related("inscription__eleve")
        return _scoper_par_eleve_ou_parent(qs, self.request.user)

    def perform_create(self, serializer):
        _verifier_inscription_accessible(self.request.user, serializer.validated_data["inscription"])
        serializer.save(decidee_par=self.request.user)

    def perform_update(self, serializer):
        _verifier_inscription_accessible(
            self.request.user, serializer.validated_data.get("inscription", serializer.instance.inscription)
        )
        serializer.save()


class CarteScolaireViewSet(viewsets.ModelViewSet):
    serializer_class = CarteScolaireSerializer
    filterset_fields = ["inscription"]

    def get_queryset(self):
        qs = CarteScolaire.objects.select_related("inscription__eleve", "inscription__classe")
        return _scoper_par_eleve_ou_parent(qs, self.request.user)

    def get_permissions(self):
        if self.action in (
            "create", "update", "partial_update", "destroy",
            "generer_pour_inscription", "generer_pour_eleve", "generer_pour_classe",
        ):
            return [IsAdmin()]
        return [IsAuthenticated()]

    @action(detail=True, methods=["get"])
    def pdf(self, request, pk=None):
        """Génère (ou régénère) et retourne le PDF de la carte scolaire au format PVC CR80."""
        carte = self.get_object()
        inscription = carte.inscription
        eleve = inscription.eleve
        buffer = generer_carte_scolaire_pdf(eleve, inscription, eleve.etablissement, qr_data=carte.qr_code_data)
        carte.fichier_pdf.save(f"carte_{eleve.matricule}.pdf", ContentFile(buffer.getvalue()), save=True)
        buffer.seek(0)
        return FileResponse(buffer, as_attachment=False, filename=f"carte_{eleve.matricule}.pdf", content_type="application/pdf")

    @action(detail=False, methods=["post"])
    def generer_pour_inscription(self, request):
        """Crée (si besoin) et génère la carte scolaire pour une inscription donnée."""
        inscription_id = request.data.get("inscription")
        try:
            inscription = Inscription.objects.select_related("eleve", "classe", "annee_scolaire").get(pk=inscription_id)
        except Inscription.DoesNotExist:
            return Response({"detail": "Inscription introuvable."}, status=404)
        carte, _ = CarteScolaire.objects.get_or_create(inscription=inscription)
        return Response(CarteScolaireSerializer(carte).data, status=201)

    @action(detail=False, methods=["post"])
    def generer_pour_eleve(self, request):
        """Crée ou retrouve la carte scolaire pour le profil élève donné."""
        eleve_id = request.data.get("eleve")
        try:
            eleve = Eleve.objects.get(pk=eleve_id)
        except Eleve.DoesNotExist:
            return Response({"detail": "Élève introuvable."}, status=404)

        inscription = eleve.inscription_courante or eleve.inscriptions.select_related("eleve", "classe", "annee_scolaire").order_by("-date_inscription").first()
        if not inscription:
            return Response({"detail": "Cet élève n'a aucune inscription active."}, status=400)

        carte, _ = CarteScolaire.objects.get_or_create(inscription=inscription)
        return Response(CarteScolaireSerializer(carte).data, status=201)

    @action(detail=False, methods=["post"])
    def generer_pour_classe(self, request):
        """Génère les cartes scolaires pour tous les élèves inscrits dans une classe."""
        classe_id = request.data.get("classe")
        inscriptions = Inscription.objects.filter(classe_id=classe_id, statut="active").select_related("eleve", "classe", "annee_scolaire")
        if not inscriptions.exists():
            return Response({"detail": "Aucun élève inscrit actif dans cette classe."}, status=400)

        cartes = []
        for insc in inscriptions:
            carte, _ = CarteScolaire.objects.get_or_create(inscription=insc)
            cartes.append(CarteScolaireSerializer(carte).data)

        return Response({
            "detail": f"{len(cartes)} cartes scolaires prêtes pour la classe.",
            "count": len(cartes),
            "results": cartes,
        }, status=201)
