"""Cloisonnement multi-établissements.

Chaque membre du personnel (administrateur, enseignant, comptable, surveillant) travaille dans
UN établissement à la fois : son « établissement courant » (User.etablissement_courant), qu'il
peut changer parmi ceux auxquels il a accès (User.etablissements). Toutes les données de l'API
sont alors limitées à cet établissement, en lecture comme en écriture.

Les élèves et parents ne sont pas concernés : ils ne voient déjà que leurs propres données
(ou celles de leurs enfants), quel que soit l'établissement.
"""
from functools import reduce
from operator import or_

from django.db import transaction
from django.db.models import Q
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response


def est_super_admin(user):
    return bool(user and user.is_authenticated and (user.is_superuser or user.role == "superadmin"))


def est_cloisonne(user):
    """Le personnel est cloisonné par établissement ; élèves et parents non."""
    return bool(user and user.is_authenticated and not (user.est_eleve or user.est_parent))


def etablissements_accessibles(user):
    """Établissements que l'utilisateur peut gérer (tous pour un super administrateur)."""
    from apps.core.models import Etablissement

    if est_super_admin(user):
        return Etablissement.objects.all()
    return user.etablissements.all()


def peut_acceder(user, etablissement_id):
    if not etablissement_id:
        return False
    if est_super_admin(user):
        return True
    return user.etablissements.filter(pk=etablissement_id).exists()


def etablissement_actif_id(user):
    """Établissement dont les données sont affichées pour cet utilisateur (None = aucun filtre).

    - Personnel : son établissement courant, s'il y a bien accès (sinon aucune donnée).
    - Super administrateur sans établissement courant : tous les établissements.
    """
    if not est_cloisonne(user):
        return None
    courant = user.etablissement_courant_id
    if courant and peut_acceder(user, courant):
        return courant
    if est_super_admin(user):
        return None
    return -1  # aucun établissement valide : aucune donnée


def etablissements_famille_ids(user):
    """Établissements de l'élève connecté, ou des enfants d'un parent."""
    from apps.students.models import Eleve

    if user.est_eleve:
        eleves = Eleve.objects.filter(user=user)
    elif user.est_parent:
        eleves = Eleve.objects.filter(parents_lies__parent=user)
    else:
        return []
    return list(eleves.values_list("etablissement_id", flat=True).distinct())


def verifier_etablissement(user, etablissement_id):
    """Lève une erreur 403 si un paramètre ?etablissement= ne correspond pas à l'établissement actif."""
    actif = etablissement_actif_id(user)
    if actif is not None and etablissement_id and str(etablissement_id) != str(actif):
        raise PermissionDenied("Ces données appartiennent à un autre établissement.")
    return etablissement_id or (actif if actif not in (None, -1) else None)


def classe_du_perimetre(user, classe_id):
    """Classe de l'établissement actif (404 si elle n'existe pas ou appartient à un autre établissement)."""
    from django.shortcuts import get_object_or_404

    from apps.core.models import Classe

    qs = Classe.objects.select_related("etablissement", "annee_scolaire")
    actif = etablissement_actif_id(user)
    if actif is not None:
        qs = qs.filter(etablissement_id=actif)
    return get_object_or_404(qs, pk=classe_id)


class EtablissementScopedMixin:
    """À placer en premier dans les bases d'un ViewSet.

    `etablissement_field` : chemin(s) ORM vers l'établissement, par ex. "inscription__eleve__etablissement"
    (une chaîne, ou un tuple de chemins combinés par OU).
    `etablissement_coherence` : chemins supplémentaires (relations obligatoires) qui doivent tous
    mener au même établissement lors d'une création / modification.
    """
    etablissement_field = "etablissement"

    def _filtre_etablissement(self, etablissement_id, plusieurs=False):
        chemins = self.etablissement_field if isinstance(self.etablissement_field, (tuple, list)) else (self.etablissement_field,)
        suffixe = "__in" if plusieurs else ""
        return reduce(or_, (
            Q(**{(f"{c}_id" if c.endswith("etablissement") else c) + suffixe: etablissement_id}) for c in chemins
        ))

    def __init_subclass__(cls, **kwargs):
        """Si le ViewSet définit son propre get_queryset (filtrage par rôle...), on l'enveloppe
        pour que le cloisonnement par établissement s'applique quand même."""
        super().__init_subclass__(**kwargs)
        propre = cls.__dict__.get("get_queryset")
        if propre and not getattr(propre, "_cloisonne", False):
            def get_queryset(self, _propre=propre):
                return self._cloisonner(_propre(self))
            get_queryset._cloisonne = True
            get_queryset.__doc__ = propre.__doc__
            cls.get_queryset = get_queryset

    def get_queryset(self):
        return self._cloisonner(super().get_queryset())

    def _cloisonner(self, qs):
        user = self.request.user
        if user.is_authenticated and (user.est_eleve or user.est_parent):
            # Élève / parent : uniquement le(s) établissement(s) de la famille
            return qs.filter(self._filtre_etablissement(etablissements_famille_ids(user), plusieurs=True)).distinct()
        actif = etablissement_actif_id(user)
        if actif is None:
            return qs
        return qs.filter(self._filtre_etablissement(actif)).distinct()

    def _dans_le_perimetre(self, modele, pk):
        """À l'écriture : l'objet doit appartenir à l'établissement actif et, si `etablissement_coherence`
        est défini, TOUS ses objets liés aussi (ex. une inscription : l'élève ET la classe)."""
        actif = etablissement_actif_id(self.request.user)
        qs = modele.objects.filter(pk=pk)
        coherence = getattr(self, "etablissement_coherence", ())
        if actif is not None:
            qs = qs.filter(self._filtre_etablissement(actif))
            for chemin in coherence:
                qs = qs.filter(**{f"{chemin}_id": actif})
        elif coherence:
            # Super administrateur sans établissement actif : les objets liés doivent au moins
            # appartenir au même établissement entre eux.
            from django.db.models import F

            premier, *autres = coherence
            for chemin in autres:
                qs = qs.filter(**{f"{chemin}_id": F(f"{premier}_id")})
        return qs.exists()

    # Le contrôle se fait ici (et non dans perform_create) pour couvrir aussi les vues qui
    # redéfinissent perform_create : l'objet enregistré doit appartenir à l'établissement actif,
    # sinon tout est annulé (les objets liés d'un autre établissement sont ainsi refusés).
    def create(self, request, *args, **kwargs):
        data = request.data
        modele = self.get_serializer_class().Meta.model
        actif = etablissement_actif_id(request.user)
        champs = {f.name for f in modele._meta.fields}
        if "etablissement" in champs and actif not in (None, -1) and not data.get("etablissement"):
            # Rattachement automatique à l'établissement actif (les données multipart avec
            # fichiers ne se copient pas : on complète alors directement le QueryDict)
            if hasattr(data, "_mutable"):
                data._mutable = True
                data["etablissement"] = actif
            else:
                data = {**data, "etablissement": actif}
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            self.perform_create(serializer)
            if not self._dans_le_perimetre(modele, serializer.instance.pk):
                raise PermissionDenied("Vous ne pouvez créer des données que dans votre établissement actif.")
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=self.get_success_headers(serializer.data))

    def update(self, request, *args, **kwargs):
        with transaction.atomic():
            response = super().update(request, *args, **kwargs)
            modele = self.get_serializer_class().Meta.model
            pk = self.kwargs.get(self.lookup_url_kwarg or self.lookup_field)
            if not self._dans_le_perimetre(modele, pk):
                raise PermissionDenied("Vous ne pouvez pas déplacer ces données vers un autre établissement.")
        return response
