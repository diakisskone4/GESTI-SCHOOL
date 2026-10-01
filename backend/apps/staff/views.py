from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.permissions import IsAdmin, IsAdminOrReadOnly, IsAdminOuComptable, IsEnseignant
from apps.staff.models import Affectation, DocumentPedagogique, Employe, Enseignant, PresenceEmploye
from apps.staff.serializers import (
    AffectationSerializer,
    DocumentPedagogiqueSerializer,
    EmployeSerializer,
    EnseignantSerializer,
    PresenceEmployeSerializer,
)


class EmployeViewSet(viewsets.ModelViewSet):
    queryset = Employe.objects.select_related("user", "etablissement")
    serializer_class = EmployeSerializer
    permission_classes = [IsAdminOuComptable]
    filterset_fields = ["etablissement", "type_employe", "actif"]
    search_fields = ["nom", "prenom", "matricule", "telephone"]


class EnseignantViewSet(viewsets.ModelViewSet):
    queryset = Enseignant.objects.select_related("user", "etablissement").prefetch_related("matieres_enseignees")
    serializer_class = EnseignantSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ["etablissement", "actif"]
    search_fields = ["nom", "prenom", "matricule"]

    @action(detail=False, methods=["get"], permission_classes=[IsEnseignant])
    def moi(self, request):
        """Retourne le profil enseignant de l'utilisateur connecté."""
        try:
            enseignant = Enseignant.objects.get(user=request.user)
        except Enseignant.DoesNotExist:
            return Response({"detail": "Aucun profil enseignant lié à cet utilisateur."}, status=404)
        return Response(self.get_serializer(enseignant).data)

    @action(detail=True, methods=["get"], permission_classes=[IsAuthenticated])
    def tableau_de_bord(self, request, pk=None):
        """Statistiques rapides pour l'espace enseignant : nb classes, nb élèves, affectations."""
        enseignant = self.get_object()
        affectations = enseignant.affectations.filter(actif=True).select_related("classe", "matiere")
        classes = {a.classe_id: a.classe for a in affectations}
        total_eleves = sum(c.effectif_actuel for c in classes.values())
        return Response({
            "nb_classes": len(classes),
            "nb_matieres": affectations.values("matiere").distinct().count(),
            "total_eleves": total_eleves,
            "classes": [{"id": c.id, "nom": c.nom, "effectif": c.effectif_actuel} for c in classes.values()],
        })


class AffectationViewSet(viewsets.ModelViewSet):
    queryset = Affectation.objects.select_related("enseignant", "classe", "matiere", "annee_scolaire")
    serializer_class = AffectationSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ["enseignant", "classe", "matiere", "annee_scolaire", "actif"]


class PresenceEmployeViewSet(viewsets.ModelViewSet):
    queryset = PresenceEmploye.objects.select_related("employe")
    serializer_class = PresenceEmployeSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ["employe", "date", "statut", "justifie"]

    def perform_create(self, serializer):
        serializer.save(enregistre_par=self.request.user)


class DocumentPedagogiqueViewSet(viewsets.ModelViewSet):
    queryset = DocumentPedagogique.objects.select_related("enseignant", "classe", "matiere")
    serializer_class = DocumentPedagogiqueSerializer
    permission_classes = [IsEnseignant]
    filterset_fields = ["enseignant", "classe", "matiere"]

    def perform_create(self, serializer):
        enseignant = Enseignant.objects.filter(user=self.request.user).first()
        serializer.save(enseignant=enseignant or serializer.validated_data.get("enseignant"))
