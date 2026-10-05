"""Détection des doublons : un même email, un même numéro de téléphone ou une même personne
(nom + prénom + date de naissance) ne peut pas être enregistré deux fois."""
import re

from rest_framework import serializers


def nettoyer_telephone(telephone):
    """Supprime espaces, points, tirets et parenthèses : « +223 70 00-00 00 » -> « +22370000000 »."""
    return re.sub(r"[\s.\-()/]", "", telephone or "")


def telephone_canonique(telephone):
    """Forme de comparaison : chiffres seuls, sans indicatif 223 / 00223 pour les numéros maliens à 8 chiffres.
    « +223 70 00 00 00 », « 0022370000000 » et « 70000000 » donnent tous « 70000000 »."""
    chiffres = re.sub(r"\D", "", telephone or "")
    for indicatif in ("00223", "223"):
        if chiffres.startswith(indicatif) and len(chiffres) == len(indicatif) + 8:
            return chiffres[len(indicatif):]
    return chiffres


def _meme_telephone(queryset, champ, telephone):
    canon = telephone_canonique(telephone)
    if len(canon) < 6:
        return None
    candidats = queryset.exclude(**{champ: ""}).filter(**{f"{champ}__endswith": canon[-6:]})
    return next((obj for obj in candidats if telephone_canonique(getattr(obj, champ)) == canon), None)


def verifier_email_utilisateur(email, exclure_pk=None):
    from apps.accounts.models import User

    qs = User.objects.filter(email__iexact=(email or "").strip())
    if exclure_pk:
        qs = qs.exclude(pk=exclure_pk)
    if email and qs.exists():
        raise serializers.ValidationError("Un compte existe déjà avec cette adresse email.")
    return (email or "").strip()


def verifier_telephone_utilisateur(telephone, exclure_pk=None):
    from apps.accounts.models import User

    telephone = nettoyer_telephone(telephone)
    if not telephone:
        return telephone
    qs = User.objects.all()
    if exclure_pk:
        qs = qs.exclude(pk=exclure_pk)
    if _meme_telephone(qs, "telephone", telephone):
        raise serializers.ValidationError("Ce numéro de téléphone est déjà utilisé par un autre compte.")
    return telephone


def verifier_eleve_unique(nom, prenom, date_naissance, etablissement_id, exclure_pk=None):
    """Un élève (même nom, prénom et date de naissance) n'a qu'une seule fiche par établissement."""
    from apps.students.models import Eleve

    if not (nom and prenom and date_naissance):
        return
    qs = Eleve.objects.filter(
        nom__iexact=nom.strip(), prenom__iexact=prenom.strip(), date_naissance=date_naissance,
        etablissement_id=etablissement_id,
    )
    if exclure_pk:
        qs = qs.exclude(pk=exclure_pk)
    existant = qs.first()
    if existant:
        raise serializers.ValidationError(
            f"Un élève {existant.prenom} {existant.nom} né le {date_naissance:%d/%m/%Y} existe déjà "
            f"(matricule {existant.matricule})."
        )


def verifier_employe_unique(modele, donnees, instance=None):
    """Personnel : pas deux fiches avec le même téléphone, ni la même personne (nom + prénom + naissance)."""
    def valeur(champ):
        return donnees.get(champ, getattr(instance, champ, None) if instance else None)

    qs = modele.objects.all()
    if instance:
        qs = qs.exclude(pk=instance.pk)
    etablissement = valeur("etablissement")
    if etablissement:
        qs = qs.filter(etablissement=etablissement)

    telephone = donnees.get("telephone")
    if telephone and (not instance or telephone_canonique(telephone) != telephone_canonique(instance.telephone)):
        doublon = _meme_telephone(qs, "telephone", telephone)
        if doublon:
            raise serializers.ValidationError({"telephone": f"Ce numéro est déjà celui de {doublon.prenom} {doublon.nom}."})

    nom, prenom, naissance = valeur("nom"), valeur("prenom"), valeur("date_naissance")
    if nom and prenom and naissance and qs.filter(
        nom__iexact=nom.strip(), prenom__iexact=prenom.strip(), date_naissance=naissance,
    ).exists():
        raise serializers.ValidationError(
            f"{prenom} {nom}, né(e) le {naissance:%d/%m/%Y}, est déjà enregistré(e) dans le personnel."
        )
