"""Passage en classe supérieure : décisions de fin d'année et transfert vers l'année scolaire suivante.

1. Décisions (automatiques dès que les bulletins de la DERNIÈRE période de l'année sont calculés) :
   moyenne annuelle = moyenne des moyennes générales des périodes de l'année (ex. (T1 + T2 + T3) / 3) ;
   « admis » si elle atteint le seuil de l'établissement (Etablissement.moyenne_passage, 10/20 par défaut),
   « redouble » sinon ; un élève admis du niveau le plus élevé est en « fin de cycle ».
   Une décision modifiée par la direction (conseil de classe) est marquée « manuelle » et n'est plus recalculée.

2. Transfert (un bouton, après le conseil de classe) : crée l'année suivante et ses classes si besoin,
   inscrit les admis dans la classe du niveau supérieur (6e A -> 5e A) et les redoublants dans la même classe.
   Les inscriptions de l'année qui se termine sont conservées (historique, bulletins, tableau d'honneur).
"""
import re
from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.db.models import Count, Q
from rest_framework.exceptions import ValidationError

from apps.academics.models import Bulletin, DecisionPassage
from apps.core.models import AnneeScolaire, Classe, Niveau, Periode, Serie


def _arrondi(valeur):
    return Decimal(valeur).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


# ---------------------------------------------------------------------------
# Périodes et niveaux
# ---------------------------------------------------------------------------
def derniere_periode(annee):
    """Dernière période de l'année (3e trimestre, ou 2e semestre)."""
    return Periode.objects.filter(annee_scolaire=annee).order_by("-numero", "-date_fin").first()


def est_derniere_periode(periode):
    derniere = derniere_periode(periode.annee_scolaire)
    return derniere is not None and derniere.pk == periode.pk


def niveau_suivant(niveau):
    """Niveau qui suit dans la progression de l'établissement (ordre immédiatement supérieur), ou None."""
    return (Niveau.objects.filter(etablissement_id=niveau.etablissement_id, ordre__gt=niveau.ordre)
            .order_by("ordre", "nom").first())


def libelle_decision(decision):
    """Texte affiché sur le bulletin, ex. « ADMIS(E) EN 5e », « REDOUBLE LA 6e »."""
    if decision.decision == "admis":
        return f"ADMIS(E) EN {decision.niveau_suivant}" if decision.niveau_suivant else "ADMIS(E) EN CLASSE SUPÉRIEURE"
    if decision.decision == "fin_cycle":
        return "ADMIS(E) — FIN DE CYCLE"
    return f"REDOUBLE LA {decision.niveau_suivant}" if decision.niveau_suivant else "REDOUBLE"


# ---------------------------------------------------------------------------
# Décisions
# ---------------------------------------------------------------------------
def _decision_automatique(inscription, moyenne, seuil, suivant):
    if moyenne >= seuil:
        return ("admis", suivant.nom) if suivant else ("fin_cycle", "")
    return "redouble", inscription.classe.niveau.nom


def calculer_decisions_classe(classe, annee=None):
    """Calcule (ou recalcule) moyenne annuelle, rang annuel et décision de chaque élève de la classe.
    Les décisions manuelles gardent leur décision mais voient leur moyenne et leur rang mis à jour."""
    annee = annee or classe.annee_scolaire
    seuil = Decimal(classe.etablissement.moyenne_passage)
    suivant = niveau_suivant(classe.niveau)
    inscriptions = classe.inscriptions.filter(annee_scolaire=annee, statut="active").select_related("eleve", "classe__niveau")

    resultats = []
    for inscription in inscriptions:
        moyennes = list(Bulletin.objects.filter(
            inscription=inscription, periode__annee_scolaire=annee, moyenne_generale__isnull=False,
        ).values_list("moyenne_generale", flat=True))
        if moyennes:
            resultats.append((inscription, _arrondi(sum(Decimal(m) for m in moyennes) / len(moyennes)), len(moyennes)))
    resultats.sort(key=lambda r: r[1], reverse=True)

    decisions = []
    for rang, (inscription, moyenne, nb) in enumerate(resultats, start=1):
        decision = DecisionPassage.objects.filter(inscription=inscription).first()
        if decision is None:
            decision = DecisionPassage(inscription=inscription)
        decision.moyenne_annuelle, decision.rang_annuel, decision.nb_periodes = moyenne, rang, nb
        if not decision.manuelle:
            decision.decision, decision.niveau_suivant = _decision_automatique(inscription, moyenne, seuil, suivant)
        decision.save()
        decisions.append(decision)
    return decisions


def calculer_decisions_annee(etablissement, annee):
    nombre = 0
    for classe in Classe.objects.filter(etablissement=etablissement, annee_scolaire=annee).select_related("niveau", "etablissement"):
        nombre += len(calculer_decisions_classe(classe, annee))
    return nombre


def modifier_decision(decision, nouvelle, motif=""):
    """Décision du conseil de classe : prioritaire sur le calcul automatique."""
    if nouvelle == "auto":
        decision.manuelle = False
        decision.motif = ""
        decision.save()
        calculer_decisions_classe(decision.inscription.classe, decision.inscription.annee_scolaire)
        decision.refresh_from_db()
        return decision
    if nouvelle not in dict(DecisionPassage.DECISION_CHOICES):
        raise ValidationError({"decision": "Décision invalide."})
    if decision.inscription_suivante_id:
        raise ValidationError({"detail": "Cet élève a déjà été transféré : annulez d'abord le transfert."})
    niveau = decision.inscription.classe.niveau
    suivant = niveau_suivant(niveau)
    if nouvelle == "admis" and suivant is None:
        nouvelle = "fin_cycle"
    decision.decision = nouvelle
    decision.niveau_suivant = suivant.nom if nouvelle == "admis" else (niveau.nom if nouvelle == "redouble" else "")
    decision.manuelle = True
    decision.motif = (motif or "")[:255]
    decision.save()
    return decision


# ---------------------------------------------------------------------------
# Transfert vers l'année suivante
# ---------------------------------------------------------------------------
def _libelle_suivant(annee):
    annees = re.findall(r"\d{4}", annee.libelle)
    if len(annees) == 2:
        return f"{int(annees[0]) + 1}-{int(annees[1]) + 1}"
    return f"{annee.date_debut.year + 1}-{annee.date_debut.year + 2}"


def _plus_un_an(date):
    try:
        return date.replace(year=date.year + 1)
    except ValueError:  # 29 février
        return date.replace(year=date.year + 1, day=28)


def annee_suivante(annee, creer=False):
    """Année scolaire qui suit `annee` dans l'établissement ; créée (non courante) si `creer`."""
    suivante = (AnneeScolaire.objects.filter(etablissement_id=annee.etablissement_id, date_debut__gt=annee.date_debut)
                .order_by("date_debut").first())
    if suivante or not creer:
        return suivante
    libelle = _libelle_suivant(annee)
    suivante, _ = AnneeScolaire.objects.get_or_create(
        etablissement_id=annee.etablissement_id, libelle=libelle,
        defaults={"date_debut": _plus_un_an(annee.date_debut), "date_fin": _plus_un_an(annee.date_fin), "est_courante": False},
    )
    return suivante


def _suffixe(classe):
    """Partie propre à la classe dans son nom : « 6e A » -> « A » ; « Terminale SE 2 » -> « SE 2 »."""
    nom, niveau = classe.nom.strip(), classe.niveau.nom.strip()
    if nom.lower().startswith(niveau.lower()):
        return nom[len(niveau):].strip(" -")
    return ""


def _classe_dans(annee, niveau, nom, modele, cree):
    """Classe `nom` du niveau dans l'année ; créée sur le modèle de `modele` si elle n'existe pas."""
    classe = Classe.objects.filter(annee_scolaire=annee, niveau=niveau, nom=nom).first()
    if classe:
        return classe
    serie = None
    if modele.serie_id:
        serie = modele.serie if modele.niveau_id == niveau.pk else Serie.objects.filter(niveau=niveau, nom=modele.serie.nom).first()
    classe = Classe.objects.create(
        etablissement_id=modele.etablissement_id, annee_scolaire=annee, niveau=niveau, serie=serie, nom=nom,
        effectif_max=modele.effectif_max, salle=modele.salle,
    )
    cree.append(classe.nom)
    return classe


def classe_destination(decision, suivante, cree):
    """Classe de l'année suivante pour l'élève : même classe s'il redouble, classe correspondante du niveau supérieur s'il passe."""
    classe = decision.inscription.classe
    if decision.decision == "redouble":
        return _classe_dans(suivante, classe.niveau, classe.nom, classe, cree)
    if decision.decision != "admis":
        return None
    niveau = niveau_suivant(classe.niveau)
    if niveau is None:
        return None
    suffixe = _suffixe(classe)
    nom = f"{niveau.nom} {suffixe}".strip()
    existante = Classe.objects.filter(annee_scolaire=suivante, niveau=niveau, nom=nom).first()
    if existante:
        return existante
    # Pas de classe au nom correspondant : la classe du niveau supérieur la moins chargée, sinon on la crée
    autre = (Classe.objects.filter(annee_scolaire=suivante, niveau=niveau)
             .annotate(nb=Count("inscriptions", filter=Q(inscriptions__statut="active"))).order_by("nb", "nom").first())
    return autre or _classe_dans(suivante, niveau, nom, classe, cree)


@transaction.atomic
def transferer(etablissement, annee):
    """Inscrit chaque élève dans sa classe de l'année suivante selon sa décision. Renvoie un résumé."""
    if derniere_periode(annee) is None:
        raise ValidationError({"detail": "Aucune période dans cette année scolaire."})
    calculer_decisions_annee(etablissement, annee)
    decisions = (DecisionPassage.objects
                 .filter(inscription__annee_scolaire=annee, inscription__classe__etablissement=etablissement,
                         inscription_suivante__isnull=True)
                 .select_related("inscription__eleve", "inscription__classe__niveau", "inscription__classe__serie"))
    if not decisions.exclude(decision="fin_cycle").exists():
        deja = DecisionPassage.objects.filter(inscription__annee_scolaire=annee, inscription__classe__etablissement=etablissement,
                                              inscription_suivante__isnull=False).exists()
        raise ValidationError({"detail": "Tous les élèves ont déjà été transférés vers l'année suivante." if deja else
                               "Aucune décision à transférer : calculez d'abord les bulletins de la dernière période."})

    from apps.students.models import Inscription

    suivante = annee_suivante(annee, creer=True)
    # Les classes de l'année qui se termine existent aussi l'année suivante (même nom, même niveau)
    classes_creees = []
    for classe in Classe.objects.filter(etablissement=etablissement, annee_scolaire=annee).select_related("niveau", "serie"):
        _classe_dans(suivante, classe.niveau, classe.nom, classe, classes_creees)

    resume = {"annee_suivante": suivante.libelle, "admis": 0, "redoublants": 0, "fin_cycle": 0, "deja_inscrits": [],
              "classes_creees": classes_creees}
    for decision in decisions:
        eleve = decision.inscription.eleve
        if decision.decision == "fin_cycle":
            resume["fin_cycle"] += 1
            continue
        if Inscription.objects.filter(eleve=eleve, annee_scolaire=suivante).exists():
            resume["deja_inscrits"].append(str(eleve))
            continue
        destination = classe_destination(decision, suivante, classes_creees)
        if destination is None:
            continue
        nouvelle = Inscription.objects.create(
            eleve=eleve, classe=destination, annee_scolaire=suivante, type_inscription="reinscription",
            redoublant=decision.decision == "redouble", boursier=decision.inscription.boursier,
            observations=f"Passage automatique {decision.inscription.annee_scolaire.libelle} : "
                         f"{decision.get_decision_display().lower()} ({decision.moyenne_annuelle}/20)",
        )
        decision.inscription_suivante = nouvelle
        decision.save(update_fields=["inscription_suivante", "updated_at"])
        resume["admis" if decision.decision == "admis" else "redoublants"] += 1
    return resume


@transaction.atomic
def annuler_transfert(etablissement, annee):
    """Supprime les inscriptions créées par le transfert, sauf celles qui ont déjà des notes ou des bulletins."""
    decisions = DecisionPassage.objects.filter(
        inscription__annee_scolaire=annee, inscription__classe__etablissement=etablissement, inscription_suivante__isnull=False,
    ).select_related("inscription_suivante")
    annulees, conservees = 0, []
    for decision in decisions:
        suivante = decision.inscription_suivante
        if suivante.notes.exists() or suivante.bulletins.exists():
            conservees.append(str(suivante.eleve))
            continue
        decision.inscription_suivante = None
        decision.save(update_fields=["inscription_suivante", "updated_at"])
        suivante.delete()
        annulees += 1
    return {"annulees": annulees, "conservees": conservees}


def decision_pour_bulletin(bulletin):
    """Décision à imprimer sur le bulletin de la dernière période (None pour les autres périodes)."""
    if not est_derniere_periode(bulletin.periode):
        return None
    decision = DecisionPassage.objects.filter(inscription=bulletin.inscription).first()
    if decision is None:
        return None
    return {"texte": libelle_decision(decision), "admis": decision.est_admis,
            "moyenne_annuelle": float(decision.moyenne_annuelle), "nb_periodes": decision.nb_periodes}


__all__ = [
    "annee_suivante", "annuler_transfert", "calculer_decisions_annee", "calculer_decisions_classe",
    "classe_destination", "decision_pour_bulletin", "derniere_periode", "est_derniere_periode", "libelle_decision",
    "modifier_decision", "niveau_suivant", "transferer",
]

