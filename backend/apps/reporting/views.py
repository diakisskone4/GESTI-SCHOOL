import csv
import io
import openpyxl
from django.http import HttpResponse
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.academics.models import Bulletin
from apps.core.models import Classe
from apps.core.permissions import IsAdmin
from apps.finance.models import FactureFrais, Paiement
from apps.reporting.models import RapportGenere
from apps.reporting.serializers import RapportGenereSerializer
from apps.students.models import Absence, Inscription


class RapportGenereViewSet(viewsets.ModelViewSet):
    queryset = RapportGenere.objects.all()
    serializer_class = RapportGenereSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ["etablissement", "type_rapport", "format_export"]

    def perform_create(self, serializer):
        serializer.save(genere_par=self.request.user)


class StatistiquesViewSet(viewsets.ViewSet):
    """Statistiques par classe : réussite, absences, moyennes."""
    permission_classes = [IsAdmin]

    @action(detail=False, methods=["get"])
    def par_classe(self, request):
        classe_id = request.query_params.get("classe")
        periode_id = request.query_params.get("periode")
        if not classe_id or not periode_id:
            return Response({"detail": "Paramètres 'classe' et 'periode' requis."}, status=400)

        classe = Classe.objects.get(pk=classe_id)
        inscriptions = classe.inscriptions.filter(statut="active")
        bulletins = Bulletin.objects.filter(inscription__in=inscriptions, periode_id=periode_id)
        total = bulletins.count()
        reussite = bulletins.filter(moyenne_generale__gte=10).count()
        moyenne_classe = sum(float(b.moyenne_generale or 0) for b in bulletins) / total if total else 0
        nb_absences = Absence.objects.filter(inscription__in=inscriptions, type_evenement="absence").count()
        nb_retards = Absence.objects.filter(inscription__in=inscriptions, type_evenement="retard").count()

        return Response({
            "classe": classe.nom,
            "effectif": inscriptions.count(),
            "taux_reussite": round((reussite / total * 100), 2) if total else 0,
            "moyenne_classe": round(moyenne_classe, 2),
            "nb_absences": nb_absences,
            "nb_retards": nb_retards,
        })

    @action(detail=False, methods=["get"])
    def vue_ensemble_etablissement(self, request):
        etablissement_id = request.query_params.get("etablissement")
        annee_id = request.query_params.get("annee_scolaire")
        inscriptions = Inscription.objects.filter(statut="active")
        if etablissement_id:
            inscriptions = inscriptions.filter(eleve__etablissement_id=etablissement_id)
        if annee_id:
            inscriptions = inscriptions.filter(annee_scolaire_id=annee_id)

        factures = FactureFrais.objects.filter(inscription__in=inscriptions)
        total_encaisse = sum(float(p.montant) for p in Paiement.objects.filter(facture__in=factures, annule=False))

        return Response({
            "total_eleves": inscriptions.count(),
            "total_garcons": inscriptions.filter(eleve__sexe="M").count(),
            "total_filles": inscriptions.filter(eleve__sexe="F").count(),
            "total_boursiers": inscriptions.filter(boursier=True).count(),
            "total_redoublants": inscriptions.filter(redoublant=True).count(),
            "total_encaisse": total_encaisse,
        })

    @action(detail=False, methods=["get"])
    def export_csv(self, request):
        """Export CSV générique des effectifs par classe."""
        etablissement_id = request.query_params.get("etablissement")
        classes = Classe.objects.all()
        if etablissement_id:
            classes = classes.filter(etablissement_id=etablissement_id)

        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = "attachment; filename=effectifs_par_classe.csv"
        writer = csv.writer(response)
        writer.writerow(["Classe", "Niveau", "Effectif"])
        for classe in classes:
            writer.writerow([classe.nom, classe.niveau.nom, classe.effectif_actuel])
        return response

    @action(detail=False, methods=["get"])
    def export_excel(self, request):
        etablissement_id = request.query_params.get("etablissement")
        classes = Classe.objects.all()
        if etablissement_id:
            classes = classes.filter(etablissement_id=etablissement_id)

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Effectifs"
        ws.append(["Classe", "Niveau", "Effectif"])
        for classe in classes:
            ws.append([classe.nom, classe.niveau.nom, classe.effectif_actuel])

        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)
        response = HttpResponse(
            buffer.getvalue(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response["Content-Disposition"] = "attachment; filename=effectifs_par_classe.xlsx"
        return response
