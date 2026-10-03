"""Logique métier : calcul des moyennes, rangs, génération des bulletins."""
from decimal import Decimal, ROUND_HALF_UP
from django.core.files.base import ContentFile
from django.db.models import Avg
from django.utils import timezone

from apps.academics.models import Bulletin, MoyenneMatiere, Note, TableauHonneur
from apps.core.pdf_utils import generer_bulletin_pdf, generer_bulletin_pdf_a5


def _round2(value):
    return Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def moyenne_ponderee(notes):
    """Moyenne /20 d'un élève dans une matière.

    On calcule d'abord la moyenne de chaque type d'évaluation (interrogations, devoirs,
    compositions...), puis la moyenne de ces moyennes pondérée par le poids du type.
    Ex. Interrogation ×1, Devoir ×1, Composition ×2 → (moy. interros + moy. devoirs + 2 × compo) / 4.
    Les notes sans type forment un groupe de poids 1. Retourne None s'il n'y a aucune note."""
    groupes = {}
    for note in notes:
        type_eval = note.type_evaluation
        cle = type_eval.pk if type_eval else None
        poids = type_eval.ponderation if type_eval else Decimal("1")
        groupe = groupes.setdefault(cle, {"poids": Decimal(poids), "valeurs": []})
        groupe["valeurs"].append(Decimal(str(note.valeur_sur_20)))
    total_poids = sum((g["poids"] for g in groupes.values() if g["poids"] > 0), Decimal("0"))
    if not total_poids:
        return None
    total = sum(
        (g["poids"] * sum(g["valeurs"]) / len(g["valeurs"]) for g in groupes.values() if g["poids"] > 0),
        Decimal("0"),
    )
    return _round2(total / total_poids)


def calculer_moyennes_matiere(classe, periode):
    """Calcule/recalcule la moyenne de chaque élève de la classe, pour chaque matière, sur la période."""
    inscriptions = classe.inscriptions.filter(statut="active", annee_scolaire=periode.annee_scolaire)
    matieres_ids = Note.objects.filter(inscription__in=inscriptions, periode=periode).values_list("matiere_id", flat=True).distinct()

    for matiere_id in matieres_ids:
        resultats = []
        for inscription in inscriptions:
            notes = Note.objects.filter(
                inscription=inscription, matiere_id=matiere_id, periode=periode,
            ).select_related("type_evaluation")
            moyenne = moyenne_ponderee(notes)
            if moyenne is None:
                continue
            from apps.core.models import Matiere
            matiere = Matiere.objects.get(pk=matiere_id)
            mm, _ = MoyenneMatiere.objects.update_or_create(
                inscription=inscription, matiere_id=matiere_id, periode=periode,
                defaults={"coefficient": matiere.coefficient_defaut, "moyenne": moyenne},
            )
            resultats.append(mm)

        # Rangs dans la matière (meilleure moyenne = rang 1)
        resultats.sort(key=lambda x: x.moyenne, reverse=True)
        for i, mm in enumerate(resultats, start=1):
            mm.rang = i
            mm.save(update_fields=["rang"])

    return matieres_ids


def calculer_moyenne_generale_et_rangs(classe, periode):
    """Calcule la moyenne générale pondérée par coefficient et le rang de chaque élève de la classe."""
    inscriptions = list(classe.inscriptions.filter(statut="active", annee_scolaire=periode.annee_scolaire))
    resultats = []
    for inscription in inscriptions:
        moyennes = MoyenneMatiere.objects.filter(inscription=inscription, periode=periode)
        if not moyennes.exists():
            continue
        total_pondere = sum(Decimal(str(m.moyenne)) * Decimal(str(m.coefficient)) for m in moyennes)
        total_coef = sum(Decimal(str(m.coefficient)) for m in moyennes)
        moyenne_generale = _round2(total_pondere / total_coef) if total_coef else Decimal("0")
        resultats.append((inscription, moyenne_generale))

    resultats.sort(key=lambda x: x[1], reverse=True)
    effectif = len(resultats)
    bulletins = []
    for rang, (inscription, moyenne_generale) in enumerate(resultats, start=1):
        mention = _mention(moyenne_generale)
        bulletin, _ = Bulletin.objects.update_or_create(
            inscription=inscription, periode=periode,
            defaults={
                "moyenne_generale": moyenne_generale,
                "rang": rang,
                "effectif_classe": effectif,
                "mention": mention,
            },
        )
        bulletins.append(bulletin)
        if moyenne_generale >= Decimal("16"):
            TableauHonneur.objects.update_or_create(
                inscription=inscription, periode=periode,
                defaults={"niveau": "excellence", "moyenne": moyenne_generale, "rang_classe": rang},
            )
        elif moyenne_generale >= Decimal("14"):
            TableauHonneur.objects.update_or_create(
                inscription=inscription, periode=periode,
                defaults={"niveau": "honneur", "moyenne": moyenne_generale, "rang_classe": rang},
            )
    return bulletins


def _mention(moyenne):
    m = float(moyenne)
    if m >= 16:
        return "Excellent"
    if m >= 14:
        return "Très Bien"
    if m >= 12:
        return "Bien"
    if m >= 10:
        return "Assez Bien"
    return "Insuffisant"


def generer_pdf_bulletin(bulletin, format_page="a4"):
    """Génère le PDF du bulletin (A4 par défaut, ou A5 en version compacte).
    Seule la version A4 est archivée sur l'objet Bulletin ; l'A5 est générée à la volée."""
    inscription = bulletin.inscription
    eleve = inscription.eleve
    moyennes = MoyenneMatiere.objects.filter(inscription=inscription, periode=bulletin.periode).select_related("matiere")
    lignes = [
        {
            "matiere": m.matiere.nom,
            "moyenne": float(m.moyenne),
            "coefficient": float(m.coefficient),
            "rang_matiere": m.rang,
        }
        for m in moyennes
    ]
    moyenne_classe = Bulletin.objects.filter(
        inscription__classe=inscription.classe, periode=bulletin.periode, moyenne_generale__isnull=False
    ).aggregate(m=Avg("moyenne_generale"))["m"]
    kwargs = dict(
        eleve=eleve,
        inscription=inscription,
        periode=bulletin.periode,
        lignes_notes=lignes,
        moyenne_generale=float(bulletin.moyenne_generale or 0),
        rang=bulletin.rang or 0,
        effectif_classe=bulletin.effectif_classe or 0,
        etablissement=eleve.etablissement,
        appreciation=bulletin.appreciation_conseil,
        moyenne_classe=float(moyenne_classe) if moyenne_classe is not None else None,
    )

    if format_page == "a5":
        return generer_bulletin_pdf_a5(**kwargs)

    buffer = generer_bulletin_pdf(**kwargs)
    bulletin.fichier_pdf.save(f"bulletin_{eleve.matricule}_{bulletin.periode_id}.pdf", ContentFile(buffer.getvalue()), save=False)
    bulletin.genere_le = timezone.now()
    bulletin.save(update_fields=["fichier_pdf", "genere_le"])
    return buffer
