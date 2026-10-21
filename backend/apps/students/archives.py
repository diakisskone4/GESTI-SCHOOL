"""Archivage ZIP automatique des données élèves.

Après chaque opération sur les élèves ou leurs inscriptions (création, modification, changement de classe,
suppression), une archive ZIP de l'établissement est enregistrée :

    eleves_<SIGLE>_<date>.xlsx   la liste complète, un onglet par classe (apps/students/exports.py)
    donnees.json                 toutes les données élèves et inscriptions, lisibles par un programme
    operations.json              les opérations couvertes : qui, quoi, quand, et l'état AVANT une suppression
    LISEZMOI.txt                 description du contenu

Les opérations rapprochées d'un même utilisateur (moins de 2 minutes) sont regroupées dans la même archive :
inscrire un élève puis l'affecter à une classe ne produit qu'une archive. Seules les N dernières archives
de chaque établissement sont conservées (réglage ARCHIVES_ELEVES_MAX, 50 par défaut).

L'archivage ne doit jamais faire échouer l'opération elle-même : en cas d'erreur, elle est seulement journalisée.
"""
import datetime
import io
import json
import logging
import zipfile

from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.utils import timezone

from apps.students.exports import classeur_eleves, eleves_avec_classe
from apps.students.models import ArchiveEleves

logger = logging.getLogger(__name__)

FENETRE_REGROUPEMENT = datetime.timedelta(minutes=2)

CHAMPS_ELEVE = [
    "matricule", "nom", "prenom", "sexe", "date_naissance", "lieu_naissance", "nationalite", "nom_pere",
    "nom_mere", "adresse", "groupe_sanguin", "allergies_ou_besoins_speciaux", "contact_urgence_nom",
    "contact_urgence_telephone", "ecole_provenance", "actif",
]


def donnees_eleve(eleve):
    """Instantané lisible d'un élève et de ses inscriptions (utilisé aussi avant une suppression)."""
    return {
        "id": str(eleve.pk),
        **{champ: getattr(eleve, champ) for champ in CHAMPS_ELEVE},
        "inscriptions": [
            {
                "annee_scolaire": i.annee_scolaire.libelle, "classe": i.classe.nom, "statut": i.statut,
                "type": i.type_inscription, "redoublant": i.redoublant, "boursier": i.boursier,
                "date_inscription": i.date_inscription,
            }
            for i in eleve.inscriptions.select_related("classe", "annee_scolaire").order_by("-date_inscription")
        ],
    }


def _limite():
    return getattr(settings, "ARCHIVES_ELEVES_MAX", 50)


def construire_zip(etablissement, operations):
    eleves = list(eleves_avec_classe(etablissement))
    horodatage = timezone.localtime()
    nom_excel = f"eleves_{etablissement.sigle}_{horodatage:%Y-%m-%d_%H%M}.xlsx"
    donnees = {
        "etablissement": {"id": etablissement.pk, "nom": etablissement.nom, "sigle": etablissement.sigle},
        "genere_le": horodatage,
        "nb_eleves": len(eleves),
        "eleves": [donnees_eleve(e) for e in eleves],
    }
    lisezmoi = (
        f"Archive des données élèves — {etablissement.nom}\n"
        f"Générée le {horodatage:%d/%m/%Y à %H:%M:%S} ({len(eleves)} élève(s)).\n\n"
        f"{nom_excel} : liste des élèves, un onglet par classe (ouvrir avec Excel ou LibreOffice).\n"
        "donnees.json : toutes les données élèves et inscriptions.\n"
        "operations.json : opérations à l'origine de cette archive (auteur, date, état avant suppression).\n"
    )
    tampon = io.BytesIO()
    with zipfile.ZipFile(tampon, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(nom_excel, classeur_eleves(etablissement))
        zf.writestr("donnees.json", json.dumps(donnees, cls=DjangoJSONEncoder, ensure_ascii=False, indent=2))
        zf.writestr("operations.json", json.dumps(operations, cls=DjangoJSONEncoder, ensure_ascii=False, indent=2))
        zf.writestr("LISEZMOI.txt", lisezmoi)
    return tampon.getvalue(), len(eleves), f"archive_{etablissement.sigle}_{horodatage:%Y-%m-%d_%H%M%S}.zip"


def creer_archive(etablissement, auteur, type_operation, description, avant=None, regrouper=True):
    """Crée (ou complète, si une archive récente du même auteur existe) l'archive ZIP de l'établissement."""
    operation = {
        "date": timezone.now(), "type": type_operation, "description": description,
        "auteur": auteur.get_full_name() if auteur else None,
    }
    if avant is not None:
        operation["avant"] = avant
    operation = json.loads(json.dumps(operation, cls=DjangoJSONEncoder))

    recente = None
    if regrouper and auteur is not None:
        recente = ArchiveEleves.objects.filter(
            etablissement=etablissement, auteur=auteur, modifie_le__gte=timezone.now() - FENETRE_REGROUPEMENT,
        ).order_by("-modifie_le").first()
    operations = (recente.operations if recente else []) + [operation]
    contenu, nb_eleves, nom = construire_zip(etablissement, operations)

    archive = recente or ArchiveEleves(etablissement=etablissement, auteur=auteur, nom_fichier=nom)
    archive.operations = operations
    archive.contenu = contenu
    archive.taille = len(contenu)
    archive.nb_eleves = nb_eleves
    archive.save()

    # Rétention : seules les N dernières archives de l'établissement sont gardées
    anciennes = ArchiveEleves.objects.filter(etablissement=etablissement).order_by("-cree_le").values_list("pk", flat=True)[_limite():]
    ArchiveEleves.objects.filter(pk__in=list(anciennes)).delete()
    return archive


def archiver_apres_operation(etablissement_id, auteur, type_operation, description, avant=None):
    """À appeler pendant une opération : l'archive est créée une fois l'opération validée en base
    (rien n'est archivé si elle est annulée), et une erreur d'archivage ne la fait jamais échouer."""
    if not etablissement_id:
        return

    def _archiver():
        from apps.core.models import Etablissement

        try:
            etablissement = Etablissement.objects.get(pk=etablissement_id)
            creer_archive(etablissement, auteur, type_operation, description, avant=avant)
        except Exception:  # noqa: BLE001 - l'archivage est un filet de sécurité, jamais bloquant
            logger.exception("Échec de l'archivage des élèves (établissement %s)", etablissement_id)

    transaction.on_commit(_archiver)
