from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.models import (
    AnneeScolaire,
    Classe,
    CreneauEmploiDuTemps,
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
    EtablissementSerializer,
    JournalActiviteSerializer,
    MatiereSerializer,
    NiveauSerializer,
    PeriodeSerializer,
    SerieSerializer,
)


class EtablissementViewSet(viewsets.ModelViewSet):
    queryset = Etablissement.objects.all()
    serializer_class = EtablissementSerializer
    permission_classes = [IsAdminOrReadOnly]
    search_fields = ["nom", "sigle", "ville"]
    filterset_fields = ["actif", "type_etablissement"]

    def perform_create(self, serializer):
        """Rattache automatiquement le créateur à l'établissement qu'il vient de créer,
        et en fait son établissement courant s'il n'en avait pas encore."""
        etablissement = serializer.save()
        user = self.request.user
        user.etablissements.add(etablissement)
        if not user.etablissement_courant_id:
            user.etablissement_courant = etablissement
            user.save(update_fields=["etablissement_courant"])


class AnneeScolaireViewSet(viewsets.ModelViewSet):
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


class PeriodeViewSet(viewsets.ModelViewSet):
    queryset = Periode.objects.all()
    serializer_class = PeriodeSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ["annee_scolaire", "est_courante", "type_periode", "cloturee"]


class NiveauViewSet(viewsets.ModelViewSet):
    queryset = Niveau.objects.all()
    serializer_class = NiveauSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ["etablissement", "cycle"]


class SerieViewSet(viewsets.ModelViewSet):
    queryset = Serie.objects.all()
    serializer_class = SerieSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ["niveau"]


class ClasseViewSet(viewsets.ModelViewSet):
    queryset = Classe.objects.select_related("niveau", "serie", "annee_scolaire", "professeur_principal")
    serializer_class = ClasseSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ["etablissement", "annee_scolaire", "niveau", "serie"]
    search_fields = ["nom"]


class MatiereViewSet(viewsets.ModelViewSet):
    queryset = Matiere.objects.all()
    serializer_class = MatiereSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ["etablissement"]
    search_fields = ["nom", "code"]


class CreneauEmploiDuTempsViewSet(viewsets.ModelViewSet):
    queryset = CreneauEmploiDuTemps.objects.select_related("classe", "matiere", "enseignant")
    serializer_class = CreneauEmploiDuTempsSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ["classe", "classe__etablissement", "classe__annee_scolaire", "matiere", "enseignant", "jour", "salle"]


class JournalActiviteViewSet(viewsets.ReadOnlyModelViewSet):
    """Consultation du journal d'audit (lecture seule, admin uniquement)."""
    queryset = JournalActivite.objects.select_related("utilisateur", "etablissement")
    serializer_class = JournalActiviteSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ["action", "utilisateur", "etablissement"]
    search_fields = ["description", "modele"]
