import io
import openpyxl
from django.http import FileResponse, HttpResponse
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.academics.models import Bulletin, Examen, MoyenneMatiere, Note, TableauHonneur, TypeEvaluation
from apps.academics.serializers import (
    BulletinSerializer,
    ExamenSerializer,
    MoyenneMatiereSerializer,
    NoteSerializer,
    TableauHonneurSerializer,
    TypeEvaluationSerializer,
)
from apps.academics.services import (
    calculer_moyenne_generale_et_rangs,
    calculer_moyennes_matiere,
    generer_pdf_bulletin,
)
from apps.core.models import Classe, Periode
from apps.core.permissions import IsAdmin, IsAdminOrEnseignantReadWrite


class TypeEvaluationViewSet(viewsets.ModelViewSet):
    queryset = TypeEvaluation.objects.all()
    serializer_class = TypeEvaluationSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ["etablissement"]


def _scoper_par_eleve_ou_parent(qs, user, chemin="inscription__eleve"):
    """Restreint un queryset aux données du propre profil élève (ou de l'enfant, pour un parent).
    Admin et enseignant voient tout ; les autres rôles ne voient rien."""
    if user.est_admin or user.est_enseignant:
        return qs
    if user.est_eleve:
        return qs.filter(**{f"{chemin}__user": user})
    if user.est_parent:
        return qs.filter(**{f"{chemin}__parents_lies__parent": user})
    return qs.none()


class NoteViewSet(viewsets.ModelViewSet):
    serializer_class = NoteSerializer
    permission_classes = [IsAdminOrEnseignantReadWrite]
    filterset_fields = ["inscription", "matiere", "periode", "type_evaluation", "enseignant"]
    search_fields = ["inscription__eleve__nom", "inscription__eleve__prenom"]

    def get_queryset(self):
        qs = Note.objects.select_related("inscription__eleve", "matiere", "periode")
        return _scoper_par_eleve_ou_parent(qs, self.request.user)

    def perform_create(self, serializer):
        from apps.staff.models import Enseignant
        enseignant = Enseignant.objects.filter(user=self.request.user).first()
        serializer.save(enseignant=enseignant or serializer.validated_data.get("enseignant"))


class MoyenneMatiereViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = MoyenneMatiereSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["inscription", "matiere", "periode"]

    def get_queryset(self):
        qs = MoyenneMatiere.objects.select_related("inscription__eleve", "matiere", "periode")
        return _scoper_par_eleve_ou_parent(qs, self.request.user)


class BulletinViewSet(viewsets.ModelViewSet):
    """Bulletins. Admin/enseignant : tout. Élève/parent : uniquement les bulletins
    de leur(s) propre(s) enfant(s) (accès restreint côté requête)."""
    serializer_class = BulletinSerializer
    filterset_fields = ["inscription", "inscription__eleve", "periode", "valide"]

    def get_queryset(self):
        qs = Bulletin.objects.select_related("inscription__eleve", "inscription__classe", "periode")
        user = self.request.user
        if user.est_admin or user.est_enseignant:
            return qs
        if user.est_eleve:
            return qs.filter(inscription__eleve__user=user)
        if user.est_parent:
            return qs.filter(inscription__eleve__parents_lies__parent=user)
        return qs.none()

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy", "calculer"):
            return [IsAdmin()]
        return [IsAuthenticated()]

    @action(detail=False, methods=["post"])
    def calculer(self, request):
        """Calcule moyennes matières, moyenne générale et rangs pour une classe/période."""
        classe = Classe.objects.get(pk=request.data.get("classe"))
        periode = Periode.objects.get(pk=request.data.get("periode"))
        calculer_moyennes_matiere(classe, periode)
        bulletins = calculer_moyenne_generale_et_rangs(classe, periode)
        return Response({
            "detail": f"{len(bulletins)} bulletins calculés pour {classe.nom} - {periode.libelle}.",
            "bulletins": BulletinSerializer(bulletins, many=True).data,
        })

    @action(detail=True, methods=["get"])
    def pdf(self, request, pk=None):
        """Génère et renvoie le PDF du bulletin. Ajouter ?taille=a5 pour la version compacte A5
        (générée à la volée, non archivée) ; par défaut, le format A4 officiel est généré et archivé.

        Note : le paramètre ne peut pas s'appeler "format" — c'est un nom réservé par Django
        REST Framework pour la négociation de contenu (ex: ?format=json), ce qui provoquerait
        un échec silencieux de la négociation de contenu (renvoyant à tort un 404)."""
        bulletin = self.get_object()
        format_page = "a5" if request.query_params.get("taille") == "a5" else "a4"

        if format_page == "a5":
            buffer = generer_pdf_bulletin(bulletin, format_page="a5")
            return FileResponse(buffer, as_attachment=False,
                                 filename=f"bulletin_{bulletin.inscription.eleve.matricule}_{bulletin.periode_id}_a5.pdf",
                                 content_type="application/pdf")

        generer_pdf_bulletin(bulletin)
        bulletin.refresh_from_db()
        return FileResponse(bulletin.fichier_pdf.open("rb"), as_attachment=False,
                             filename=bulletin.fichier_pdf.name.split("/")[-1], content_type="application/pdf")


class TableauHonneurViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = TableauHonneur.objects.select_related("inscription__eleve", "inscription__classe", "periode")
    serializer_class = TableauHonneurSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["periode", "niveau", "inscription__classe"]


class ExamenViewSet(viewsets.ModelViewSet):
    queryset = Examen.objects.select_related("classe", "matiere", "periode").prefetch_related("surveillants")
    serializer_class = ExamenSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ["etablissement", "classe", "matiere", "periode", "statut", "date_examen"]


class ExportResultatsView(viewsets.ViewSet):
    """Export des résultats d'une classe/période en PDF ou Excel."""
    permission_classes = [IsAdmin]

    @action(detail=False, methods=["get"])
    def excel(self, request):
        classe_id = request.query_params.get("classe")
        periode_id = request.query_params.get("periode")
        bulletins = Bulletin.objects.filter(inscription__classe_id=classe_id, periode_id=periode_id).select_related(
            "inscription__eleve"
        ).order_by("rang")

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Résultats"
        ws.append(["Rang", "Matricule", "Nom", "Prénom", "Moyenne Générale", "Mention"])
        for b in bulletins:
            ws.append([b.rang, b.inscription.eleve.matricule, b.inscription.eleve.nom,
                       b.inscription.eleve.prenom, float(b.moyenne_generale or 0), b.mention])

        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)
        response = HttpResponse(
            buffer.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = "attachment; filename=resultats.xlsx"
        return response
