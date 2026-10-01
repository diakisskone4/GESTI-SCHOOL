from django.core.files.base import ContentFile
from django.db.models import Sum
from django.http import FileResponse
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.pdf_utils import generer_bulletin_paie_pdf
from apps.core.permissions import IsAdminOuComptable
from apps.payroll.models import Avance, BulletinPaie, ContratSalaire, ElementSalaire, LigneBulletinPaie
from apps.payroll.serializers import (
    AvanceSerializer,
    BulletinPaieSerializer,
    ContratSalaireSerializer,
    ElementSalaireSerializer,
    LigneBulletinPaieSerializer,
)


class ElementSalaireViewSet(viewsets.ModelViewSet):
    queryset = ElementSalaire.objects.all()
    serializer_class = ElementSalaireSerializer
    permission_classes = [IsAdminOuComptable]
    filterset_fields = ["etablissement", "nature"]


class ContratSalaireViewSet(viewsets.ModelViewSet):
    queryset = ContratSalaire.objects.select_related("employe")
    serializer_class = ContratSalaireSerializer
    permission_classes = [IsAdminOuComptable]
    filterset_fields = ["employe"]


class LigneBulletinPaieViewSet(viewsets.ModelViewSet):
    queryset = LigneBulletinPaie.objects.select_related("bulletin", "element")
    serializer_class = LigneBulletinPaieSerializer
    permission_classes = [IsAdminOuComptable]
    filterset_fields = ["bulletin", "element"]

    def perform_create(self, serializer):
        ligne = serializer.save()
        ligne.bulletin.calculer()


class BulletinPaieViewSet(viewsets.ModelViewSet):
    """Bulletins de paie. Admin/comptable : tout. Un employé (non-admin/comptable) ne voit que les siens."""
    serializer_class = BulletinPaieSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["employe", "mois", "annee", "statut"]

    def get_queryset(self):
        qs = BulletinPaie.objects.select_related("employe").prefetch_related("lignes__element")
        user = self.request.user
        if user.est_admin or user.est_comptable:
            return qs
        return qs.filter(employe__user=user)

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAdminOuComptable()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        bulletin = serializer.save(genere_par=self.request.user)
        bulletin.calculer()

    @action(detail=True, methods=["post"])
    def recalculer(self, request, pk=None):
        bulletin = self.get_object()
        bulletin.calculer()
        return Response(self.get_serializer(bulletin).data)

    @action(detail=True, methods=["get"])
    def pdf(self, request, pk=None):
        """Bulletin de paie PDF — accès restreint : l'employé ne peut voir que le sien."""
        bulletin = self.get_object()
        etablissement = bulletin.employe.etablissement
        buffer = generer_bulletin_paie_pdf(bulletin, etablissement)
        bulletin.fichier_pdf.save(
            f"paie_{bulletin.employe.matricule}_{bulletin.mois:02d}_{bulletin.annee}.pdf",
            ContentFile(buffer.getvalue()), save=True,
        )
        buffer.seek(0)
        return FileResponse(buffer, as_attachment=False,
                             filename=f"paie_{bulletin.employe.matricule}_{bulletin.mois:02d}_{bulletin.annee}.pdf",
                             content_type="application/pdf")


class AvanceViewSet(viewsets.ModelViewSet):
    queryset = Avance.objects.select_related("employe")
    serializer_class = AvanceSerializer
    permission_classes = [IsAdminOuComptable]
    filterset_fields = ["employe", "statut"]

    def perform_create(self, serializer):
        serializer.save(approuve_par=self.request.user)


class DashboardMasseSalarialeView(viewsets.ViewSet):
    """Tableau de bord de la masse salariale."""
    permission_classes = [IsAdminOuComptable]

    def list(self, request):
        mois = request.query_params.get("mois")
        annee = request.query_params.get("annee")
        qs = BulletinPaie.objects.all()
        if mois:
            qs = qs.filter(mois=mois)
        if annee:
            qs = qs.filter(annee=annee)

        totaux = qs.aggregate(
            brut=Sum("salaire_brut"), net=Sum("net_a_payer"),
            primes=Sum("total_primes"), retenues=Sum("total_retenues"),
        )
        return Response({
            "nb_employes_payes": qs.count(),
            "masse_salariale_brute": float(totaux["brut"] or 0),
            "masse_salariale_nette": float(totaux["net"] or 0),
            "total_primes": float(totaux["primes"] or 0),
            "total_retenues": float(totaux["retenues"] or 0),
        })
