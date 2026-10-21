"""Corbeille : tout élément supprimé depuis l'application peut être restauré.

Juste avant une suppression, on photographie l'élément ET tout ce que la base supprimera avec lui en cascade
(supprimer un élève supprime aussi ses inscriptions, notes, absences...), avec le même mécanisme que Django
utilise pour décider quoi supprimer (Collector). On note aussi les références qui seront remises à vide
(ex. le professeur principal d'une classe quand on supprime l'enseignant).

La restauration réinsère tous ces objets à l'identique (mêmes identifiants), puis rétablit les références.
Si c'est impossible (un parent a été supprimé depuis, un doublon a été créé entre-temps...), rien n'est
modifié et un message explique pourquoi.
"""
import datetime
from collections import Counter

from django.apps import apps
from django.conf import settings
from django.core import serializers
from django.db import DEFAULT_DB_ALIAS, IntegrityError, connection, transaction
from django.db.models import QuerySet
from django.db.models.deletion import Collector
from django.utils import timezone
from rest_framework.exceptions import ValidationError

# Jamais mis dans la corbeille (ni restaurés) : archives, corbeille elle-même, données de la plateforme
MODELES_EXCLUS = {"students.archiveeleves", "core.elementsupprime", "plateforme.abonnement", "plateforme.journalconsole"}


def _label(model):
    return model._meta.label_lower


def duree_conservation():
    return getattr(settings, "CORBEILLE_DUREE_JOURS", 30)


def capturer(instance):
    """Instantané de tout ce que la suppression de `instance` va effacer, pris AVANT la suppression."""
    collector = Collector(using=DEFAULT_DB_ALIAS, origin=instance)
    collector.collect([instance])

    objets = []
    for model, instances in collector.data.items():
        if _label(model) not in MODELES_EXCLUS:
            objets.extend(instances)
    for qs in collector.fast_deletes:
        if _label(qs.model) not in MODELES_EXCLUS:
            objets.extend(qs)

    liens = []
    for (champ, valeur), groupes in collector.field_updates.items():
        for groupe in groupes:
            if isinstance(groupe, QuerySet):
                lignes = groupe.values_list("pk", champ.attname)
                modele = groupe.model
            else:
                lignes = [(o.pk, getattr(o, champ.attname)) for o in groupe]
                modele = champ.model
            liens.extend(
                {"modele": _label(modele), "pk": str(pk), "champ": champ.attname, "valeur": str(ancienne)}
                for pk, ancienne in lignes if ancienne is not None
            )

    resume = Counter(str(o._meta.verbose_name) for o in objets if not o._meta.auto_created)
    return {
        "donnees": serializers.serialize("json", objets),
        "liens": liens,
        "nb_objets": sum(resume.values()),
        "resume": dict(resume),
    }


def mettre_a_la_corbeille(instance, etablissement_id, utilisateur, suppression):
    """Capture `instance`, exécute `suppression()` (la vraie suppression), puis enregistre l'instantané.
    Le tout dans une seule transaction : si la suppression échoue, rien n'est mis à la corbeille."""
    from apps.core.models import ElementSupprime

    if _label(type(instance)) in MODELES_EXCLUS or not etablissement_id:
        return suppression()
    with transaction.atomic():
        try:
            capture = capturer(instance)
        except Exception:  # noqa: BLE001 - ex. ProtectedError : la suppression elle-même expliquera le refus
            capture = None
        resultat = suppression()
        if capture:
            ElementSupprime.objects.create(
                etablissement_id=etablissement_id, supprime_par=utilisateur,
                modele=_label(type(instance)), type_objet=str(instance._meta.verbose_name).capitalize(),
                objet_pk=str(instance.pk), libelle=str(instance)[:255], **capture,
            )
    return resultat


def restaurer(element):
    """Réinsère l'élément et tout ce qui avait été supprimé avec lui, puis le retire de la corbeille."""
    objets = list(serializers.deserialize("json", element.donnees, ignorenonexistent=True))
    principaux = [o for o in objets if not o.object._meta.auto_created]
    liaisons = [o for o in objets if o.object._meta.auto_created]  # tables de liaison plusieurs-à-plusieurs

    try:
        with transaction.atomic():
            for obj in principaux:
                modele = type(obj.object)
                if modele._default_manager.filter(pk=obj.object.pk).exists():
                    raise ValidationError({"detail": f"{modele._meta.verbose_name.capitalize()} « {obj.object} » existe déjà : "
                                                     "cet élément a sans doute déjà été restauré."})
                obj.save()
            for obj in liaisons:
                modele = type(obj.object)
                champs = {f.attname: getattr(obj.object, f.attname) for f in modele._meta.concrete_fields if f.is_relation}
                if not modele._default_manager.filter(**champs).exists():
                    obj.save()
            for lien in element.liens:
                modele = apps.get_model(lien["modele"])
                modele._default_manager.filter(pk=lien["pk"], **{lien["champ"]: None}).update(**{lien["champ"]: lien["valeur"]})
            # Les clés étrangères sont vérifiées à la fin de la transaction sous PostgreSQL : on force la vérification
            # maintenant pour pouvoir annuler proprement avec un message clair.
            connection.check_constraints()
            element.delete()
    except IntegrityError as exc:
        texte = str(exc).lower()
        if "foreign key" in texte or "clé étrangère" in texte:
            raise ValidationError({"detail": "Restauration impossible : un élément dont il dépend (classe, année, élève...) "
                                             "a été supprimé depuis. Restaurez-le d'abord depuis la corbeille."})
        raise ValidationError({"detail": "Restauration impossible : un élément identique (même matricule, même email...) "
                                         "a été créé depuis la suppression."})


def purger_expires(etablissement_id):
    """Supprime définitivement les éléments plus anciens que la durée de conservation."""
    from apps.core.models import ElementSupprime

    limite = timezone.now() - datetime.timedelta(days=duree_conservation())
    ElementSupprime.objects.filter(etablissement_id=etablissement_id, supprime_le__lt=limite).delete()
