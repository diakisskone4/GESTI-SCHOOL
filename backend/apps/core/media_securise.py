"""Fichiers envoyés et générés (/media/) accessibles uniquement par un lien signé.

Les bulletins, cartes scolaires, reçus, photos... portent des noms prévisibles
(bulletin_<matricule>_<n>.pdf) : servis tels quels, n'importe qui pourrait les télécharger en
devinant un matricule. Chaque adresse produite par l'API porte donc une signature (clé secrète
du serveur) valable MEDIA_LIEN_DUREE_HEURES ; sans signature valide, le fichier est « introuvable ».

L'API ne renvoie ces adresses qu'aux utilisateurs connectés autorisés à voir l'objet : le lien
suffit ensuite à une balise <img> ou à un téléchargement, qui n'envoient pas le jeton de connexion.
"""
import mimetypes
import os
import time

from django.conf import settings
from django.core import signing
from django.core.files.storage import FileSystemStorage
from django.http import FileResponse, Http404
from django.utils._os import safe_join
from django.utils.encoding import filepath_to_uri

SEL = "gesti-scolaire.media"
# Signatures arrondies à l'heure : la même adresse est renvoyée pendant une heure (cache du navigateur)
GRANULARITE = 3600

# Affichés dans le navigateur ; tout le reste est téléchargé (jamais exécuté sur le domaine de l'API)
TYPES_AFFICHABLES = {"image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"}


class _Signataire(signing.TimestampSigner):
    def timestamp(self):
        return signing.b62_encode(int(time.time()) // GRANULARITE * GRANULARITE)


def _signataire():
    return _Signataire(salt=SEL)


def signer(nom):
    """Jeton à joindre à l'adresse du fichier `nom` (chemin relatif à MEDIA_ROOT)."""
    return _signataire().sign(nom)[len(nom) + 1:]


def verifier(nom, jeton):
    duree = getattr(settings, "MEDIA_LIEN_DUREE_HEURES", 24) * 3600 + GRANULARITE
    try:
        _signataire().unsign(f"{nom}:{jeton}", max_age=duree)
    except signing.BadSignature:
        return False
    return True


class StockageSigne(FileSystemStorage):
    """Stockage sur disque dont les adresses (.url) contiennent une signature temporaire."""

    def url(self, name):
        adresse = super().url(name)
        if name is None:
            return adresse
        nom = name.replace("\\", "/")
        return f"{adresse}?s={filepath_to_uri(signer(nom))}"


def servir_media(request, path):
    """Sert un fichier de MEDIA_ROOT si le lien est correctement signé et encore valide."""
    nom = path.replace("\\", "/")
    if not verifier(nom, request.GET.get("s", "")):
        raise Http404("Fichier introuvable.")
    try:
        chemin = safe_join(settings.MEDIA_ROOT, nom)
    except Exception as exc:  # noqa: BLE001 - tentative de sortie du dossier media (../)
        raise Http404("Fichier introuvable.") from exc
    if not os.path.isfile(chemin):
        raise Http404("Fichier introuvable.")

    type_mime = mimetypes.guess_type(chemin)[0] or "application/octet-stream"
    affichable = type_mime in TYPES_AFFICHABLES
    reponse = FileResponse(
        open(chemin, "rb"),  # noqa: SIM115 - fermé par FileResponse
        content_type=type_mime if affichable else "application/octet-stream",
        as_attachment=not affichable,
        filename=os.path.basename(chemin),
    )
    reponse["X-Content-Type-Options"] = "nosniff"
    reponse["Cache-Control"] = "private, max-age=3600"
    if type_mime != "application/pdf":
        # Aucun script ne peut s'exécuter depuis un fichier envoyé (image piégée, HTML déguisé...)
        reponse["Content-Security-Policy"] = "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox"
    return reponse
