from django.core.files.base import ContentFile
from django.db.models import Sum
from django.http import FileResponse
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.permissions import IsAdminOuComptable
from apps.finance.models import BaremeFrais, Bourse, FactureFrais, Paiement, TypeFrais
from apps.finance.pdf import generer_facture_pdf, generer_recu_pdf, numero_facture
from apps.finance.serializers import (
    BaremeFraisSerializer,
    BourseSerializer,
    FactureFraisSerializer,
    PaiementSerializer,
    TypeFraisSerializer,
)


def _scoper_par_eleve_ou_parent(qs, user, chemin):
    """Restreint un queryset aux données du propre profil élève (ou de l'enfant, pour un parent).
    Admin et comptable voient tout ; élève/parent ne voient que leurs propres données ; les autres rôles ne voient rien."""
    if user.est_admin or user.est_comptable:
        return qs
    if user.est_eleve:
        return qs.filter(**{f"{chemin}__user": user})
    if user.est_parent:
        return qs.filter(**{f"{chemin}__parents_lies__parent": user})
    return qs.none()


class TypeFraisViewSet(viewsets.ModelViewSet):
    queryset = TypeFrais.objects.all()
    serializer_class = TypeFraisSerializer
    permission_classes = [IsAdminOuComptable]
    filterset_fields = ["etablissement", "periodicite", "obligatoire"]


class BaremeFraisViewSet(viewsets.ModelViewSet):
    queryset = BaremeFrais.objects.select_related("type_frais", "niveau", "annee_scolaire")
    serializer_class = BaremeFraisSerializer
    permission_classes = [IsAdminOuComptable]
    filterset_fields = ["type_frais", "niveau", "annee_scolaire"]


class BourseViewSet(viewsets.ModelViewSet):
    queryset = Bourse.objects.select_related("inscription__eleve")
    serializer_class = BourseSerializer
    permission_classes = [IsAdminOuComptable]
    filterset_fields = ["inscription", "type_bourse", "actif"]

    def perform_create(self, serializer):
        serializer.save(approuve_par=self.request.user)


class FactureFraisViewSet(viewsets.ModelViewSet):
    serializer_class = FactureFraisSerializer
    filterset_fields = ["inscription", "inscription__eleve", "type_frais", "periode", "statut"]
    search_fields = ["inscription__eleve__nom", "inscription__eleve__prenom", "inscription__eleve__matricule"]

    def get_queryset(self):
        qs = FactureFrais.objects.select_related("inscription__eleve", "type_frais", "periode").prefetch_related("paiements")
        return _scoper_par_eleve_ou_parent(qs, self.request.user, "inscription__eleve")

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAdminOuComptable()]
        return [IsAuthenticated()]

    @action(detail=True, methods=["get"])
    def pdf(self, request, pk=None):
        """Facture imprimable (PDF A4) avec l'en-tête de l'établissement et l'historique des paiements."""
        facture = self.get_object()
        buffer = generer_facture_pdf(facture, facture.inscription.eleve.etablissement)
        return FileResponse(buffer, as_attachment=False, filename=f"{numero_facture(facture)}.pdf",
                            content_type="application/pdf")


class PaiementViewSet(viewsets.ModelViewSet):
    serializer_class = PaiementSerializer
    filterset_fields = ["facture", "mode_paiement", "annule", "date_paiement"]

    def get_queryset(self):
        qs = Paiement.objects.select_related("facture__inscription__eleve")
        return _scoper_par_eleve_ou_parent(qs, self.request.user, "facture__inscription__eleve")

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAdminOuComptable()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(encaisse_par=self.request.user)

    @action(detail=True, methods=["get"])
    def recu(self, request, pk=None):
        """Génère et renvoie le reçu de paiement imprimable (PDF A5) aux couleurs de l'établissement."""
        paiement = self.get_object()
        etablissement = paiement.facture.inscription.eleve.etablissement
        buffer = generer_recu_pdf(paiement, etablissement)
        paiement.recu_pdf.save(f"recu_{paiement.numero_recu}.pdf", ContentFile(buffer.getvalue()), save=True)
        buffer.seek(0)
        return FileResponse(buffer, as_attachment=False, filename=f"recu_{paiement.numero_recu}.pdf", content_type="application/pdf")


class DashboardFinancierView(viewsets.ViewSet):
    """Tableau de bord financier : totaux facturés, encaissés, impayés."""
    permission_classes = [IsAdminOuComptable]

    def list(self, request):
        etablissement_id = request.query_params.get("etablissement")
        annee_id = request.query_params.get("annee_scolaire")
        factures = FactureFrais.objects.all()
        if etablissement_id:
            factures = factures.filter(inscription__eleve__etablissement_id=etablissement_id)
        if annee_id:
            factures = factures.filter(inscription__annee_scolaire_id=annee_id)

        total_facture = factures.aggregate(t=Sum("montant_du"))["t"] or 0
        total_remise = factures.aggregate(t=Sum("montant_remise"))["t"] or 0
        total_encaisse = Paiement.objects.filter(facture__in=factures, annule=False).aggregate(t=Sum("montant"))["t"] or 0
        total_du = float(total_facture) - float(total_remise)
        total_impaye = total_du - float(total_encaisse)

        par_statut = {}
        for statut, _ in FactureFrais.STATUT_CHOICES:
            par_statut[statut] = factures.filter(statut=statut).count()

        return Response({
            "total_facture": float(total_facture),
            "total_remise": float(total_remise),
            "total_encaisse": float(total_encaisse),
            "total_impaye": max(total_impaye, 0),
            "nb_factures": factures.count(),
            "repartition_par_statut": par_statut,
        })
