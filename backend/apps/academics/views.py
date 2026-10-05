import io
from decimal import Decimal, InvalidOperation

import openpyxl
from django.db import transaction
from django.db.models import ProtectedError
from django.http import FileResponse, HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.academics.models import Bulletin, Evaluation, Examen, MoyenneMatiere, Note, TableauHonneur, TypeEvaluation
from apps.academics.serializers import (
    BulletinSerializer,
    EvaluationSerializer,
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
    moyenne_ponderee,
)
from apps.core.models import Classe, Periode
from apps.core.permissions import IsAdmin, IsAdminOrEnseignantReadWrite, IsAdminOrReadOnly
from apps.core.tenancy import EtablissementScopedMixin, classe_du_perimetre, verifier_etablissement


TYPES_EVALUATION_PAR_DEFAUT = [
    {"nom": "Interrogation", "ponderation": Decimal("1"), "ordre": 1},
    {"nom": "Devoir", "ponderation": Decimal("1"), "ordre": 2},
    {"nom": "Composition", "ponderation": Decimal("2"), "ordre": 3},
]


class TypeEvaluationViewSet(EtablissementScopedMixin, viewsets.ModelViewSet):
    """Types d'évaluation et leur poids : lecture pour tous, modification par l'administration."""
    etablissement_field = "etablissement"
    queryset = TypeEvaluation.objects.all()
    serializer_class = TypeEvaluationSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ["etablissement"]

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except ProtectedError:
            raise serializers.ValidationError(
                {"detail": "Ce type est utilisé par des évaluations : supprimez-les ou changez leur type d'abord."}
            )

    @action(detail=False, methods=["post"])
    def initialiser(self, request):
        """Crée les types par défaut (Interrogation ×1, Devoir ×1, Composition ×2) s'ils n'existent pas."""
        etablissement_id = verifier_etablissement(request.user, request.data.get("etablissement"))
        if not etablissement_id:
            raise serializers.ValidationError({"etablissement": "Établissement requis."})
        for t in TYPES_EVALUATION_PAR_DEFAUT:
            TypeEvaluation.objects.get_or_create(
                etablissement_id=etablissement_id, nom=t["nom"],
                defaults={"ponderation": t["ponderation"], "ordre": t["ordre"]},
            )
        types = TypeEvaluation.objects.filter(etablissement_id=etablissement_id)
        return Response(TypeEvaluationSerializer(types, many=True).data)


class EvaluationViewSet(EtablissementScopedMixin, viewsets.ModelViewSet):
    """Évaluations (colonnes du carnet de notes) et saisie groupée des notes."""
    etablissement_field = "classe__etablissement"
    etablissement_coherence = ("classe__etablissement", "matiere__etablissement", "type_evaluation__etablissement")
    serializer_class = EvaluationSerializer
    permission_classes = [IsAdminOrEnseignantReadWrite]
    filterset_fields = ["classe", "matiere", "periode", "type_evaluation"]

    def get_queryset(self):
        qs = Evaluation.objects.select_related("type_evaluation", "matiere", "classe", "periode")
        user = self.request.user
        if user.est_admin or user.est_enseignant:
            return qs
        if user.est_eleve:
            return qs.filter(classe__inscriptions__eleve__user=user).distinct()
        if user.est_parent:
            return qs.filter(classe__inscriptions__eleve__parents_lies__parent=user).distinct()
        return qs.none()

    def _enseignant(self):
        from apps.staff.models import Enseignant
        return Enseignant.objects.filter(user=self.request.user).first()

    def perform_create(self, serializer):
        serializer.save(enseignant=self._enseignant())

    def perform_update(self, serializer):
        evaluation = serializer.save()
        # Les notes recopient le type, le barème et la date de leur évaluation (utilisés par le calcul des moyennes).
        evaluation.notes.update(
            type_evaluation=evaluation.type_evaluation, bareme=evaluation.bareme,
            date_evaluation=evaluation.date_evaluation, matiere=evaluation.matiere, periode=evaluation.periode,
        )

    @action(detail=False, methods=["get"])
    def carnet(self, request):
        """Carnet de notes d'une classe pour une matière et une période :
        évaluations (colonnes), élèves (lignes), notes et moyenne pondérée de chaque élève."""
        from apps.students.models import Inscription

        user = request.user
        if not (user.est_admin or user.est_enseignant):
            raise PermissionDenied("Réservé à l'administration et aux enseignants.")
        params = request.query_params
        manquants = [p for p in ("classe", "matiere", "periode") if not params.get(p)]
        if manquants:
            raise serializers.ValidationError({p: "Paramètre requis." for p in manquants})

        classe = classe_du_perimetre(user, params["classe"])
        evaluations = list(
            self.get_queryset().filter(classe=classe, matiere_id=params["matiere"], periode_id=params["periode"])
        )
        inscriptions = (
            Inscription.objects.filter(classe=classe, statut="active")
            .select_related("eleve").order_by("eleve__nom", "eleve__prenom")
        )
        notes = Note.objects.filter(
            inscription__in=inscriptions, matiere_id=params["matiere"], periode_id=params["periode"],
        ).select_related("type_evaluation")
        par_inscription = {}
        for note in notes:
            par_inscription.setdefault(note.inscription_id, []).append(note)

        eleves = []
        for insc in inscriptions:
            notes_eleve = par_inscription.get(insc.id, [])
            moyenne = moyenne_ponderee(notes_eleve)
            eleves.append({
                "inscription": insc.id,
                "nom": f"{insc.eleve.nom} {insc.eleve.prenom}",
                "matricule": insc.eleve.matricule,
                "notes": {str(n.evaluation_id): str(n.valeur) for n in notes_eleve if n.evaluation_id},
                "notes_hors_evaluation": [n.valeur_sur_20 for n in notes_eleve if not n.evaluation_id],
                "moyenne": float(moyenne) if moyenne is not None else None,
            })
        types = TypeEvaluation.objects.filter(etablissement=classe.etablissement)
        return Response({
            "types": TypeEvaluationSerializer(types, many=True).data,
            "evaluations": EvaluationSerializer(evaluations, many=True).data,
            "eleves": eleves,
        })

    @action(detail=True, methods=["post"])
    def saisir_notes(self, request, pk=None):
        """Enregistre les notes d'une évaluation en une fois.
        Corps : {"notes": [{"inscription": id, "valeur": "14.5"}, ...]} ; une valeur vide efface la note."""
        evaluation = self.get_object()
        inscriptions_valides = {
            str(i) for i in evaluation.classe.inscriptions.filter(statut="active").values_list("id", flat=True)
        }
        erreurs, a_enregistrer, a_effacer = {}, [], []
        for ligne in request.data.get("notes") or []:
            inscription_id = str(ligne.get("inscription"))
            if inscription_id not in inscriptions_valides:
                erreurs[inscription_id] = "Cet élève n'est pas inscrit dans cette classe."
                continue
            valeur = ligne.get("valeur")
            if valeur in (None, ""):
                a_effacer.append(inscription_id)
                continue
            try:
                valeur = Decimal(str(valeur).replace(",", "."))
            except InvalidOperation:
                erreurs[inscription_id] = "Note invalide."
                continue
            if valeur < 0 or valeur > evaluation.bareme:
                erreurs[inscription_id] = f"La note doit être comprise entre 0 et {evaluation.bareme:g}."
                continue
            a_enregistrer.append((inscription_id, valeur))
        if erreurs:
            return Response(
                {"detail": "Certaines notes sont invalides.", "erreurs": erreurs}, status=status.HTTP_400_BAD_REQUEST
            )

        enseignant = self._enseignant() or evaluation.enseignant
        with transaction.atomic():
            evaluation.notes.filter(inscription_id__in=a_effacer).delete()
            for inscription_id, valeur in a_enregistrer:
                Note.objects.update_or_create(
                    evaluation=evaluation, inscription_id=inscription_id,
                    defaults={
                        "valeur": valeur, "bareme": evaluation.bareme, "matiere": evaluation.matiere,
                        "periode": evaluation.periode, "type_evaluation": evaluation.type_evaluation,
                        "date_evaluation": evaluation.date_evaluation, "enseignant": enseignant,
                    },
                )
        return Response({"enregistrees": len(a_enregistrer), "effacees": len(a_effacer)})


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


class NoteViewSet(EtablissementScopedMixin, viewsets.ModelViewSet):
    etablissement_field = "inscription__eleve__etablissement"
    etablissement_coherence = ("inscription__eleve__etablissement", "matiere__etablissement")
    serializer_class = NoteSerializer
    permission_classes = [IsAdminOrEnseignantReadWrite]
    filterset_fields = ["inscription", "matiere", "periode", "type_evaluation", "enseignant", "evaluation"]
    search_fields = ["inscription__eleve__nom", "inscription__eleve__prenom"]

    def get_queryset(self):
        qs = Note.objects.select_related("inscription__eleve", "matiere", "periode")
        return _scoper_par_eleve_ou_parent(qs, self.request.user)

    def perform_create(self, serializer):
        from apps.staff.models import Enseignant
        enseignant = Enseignant.objects.filter(user=self.request.user).first()
        serializer.save(enseignant=enseignant or serializer.validated_data.get("enseignant"))


class MoyenneMatiereViewSet(EtablissementScopedMixin, viewsets.ReadOnlyModelViewSet):
    etablissement_field = "inscription__eleve__etablissement"
    serializer_class = MoyenneMatiereSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["inscription", "matiere", "periode"]

    def get_queryset(self):
        qs = MoyenneMatiere.objects.select_related("inscription__eleve", "matiere", "periode")
        return _scoper_par_eleve_ou_parent(qs, self.request.user)


class BulletinViewSet(EtablissementScopedMixin, viewsets.ModelViewSet):
    """Bulletins. Admin/enseignant : tout. Élève/parent : uniquement les bulletins
    de leur(s) propre(s) enfant(s) (accès restreint côté requête)."""
    etablissement_field = "inscription__eleve__etablissement"
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
        classe = classe_du_perimetre(request.user, request.data.get("classe"))
        periode = get_object_or_404(Periode, pk=request.data.get("periode"), annee_scolaire=classe.annee_scolaire)
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


class TableauHonneurViewSet(EtablissementScopedMixin, viewsets.ReadOnlyModelViewSet):
    etablissement_field = "inscription__eleve__etablissement"
    queryset = TableauHonneur.objects.select_related("inscription__eleve", "inscription__classe", "periode")
    serializer_class = TableauHonneurSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["periode", "niveau", "inscription__classe"]


class ExamenViewSet(EtablissementScopedMixin, viewsets.ModelViewSet):
    etablissement_field = "etablissement"
    etablissement_coherence = ("etablissement", "classe__etablissement", "matiere__etablissement")
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
        classe_du_perimetre(request.user, classe_id)
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
