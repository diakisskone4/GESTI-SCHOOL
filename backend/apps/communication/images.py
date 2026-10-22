"""Préparation des images d'annonce avant enregistrement en base de données.

Chaque image est vérifiée (vraie image, format accepté, taille raisonnable), remise dans le bon sens
(photos de téléphone), réduite à 1600 px maximum et recompressée : une photo de 4 Mo pèse ensuite
quelques centaines de Ko, ce qui ménage la base de données et le chargement sur mobile.
"""
import io

from django.conf import settings
from PIL import Image, ImageOps, UnidentifiedImageError
from rest_framework.exceptions import ValidationError

FORMATS_ACCEPTES = {"JPEG", "PNG", "WEBP", "GIF"}
COTE_MAX = 1600


def max_images():
    return getattr(settings, "ANNONCES_IMAGES_MAX", 6)


def max_octets():
    return getattr(settings, "ANNONCES_IMAGE_MAX_MO", 8) * 1024 * 1024


def preparer_image(fichier):
    """Renvoie (contenu, type_mime, largeur, hauteur) prêts à enregistrer, ou lève ValidationError."""
    nom = getattr(fichier, "name", "image")
    if fichier.size > max_octets():
        raise ValidationError({"images": f"« {nom} » dépasse {max_octets() // (1024 * 1024)} Mo."})
    try:
        image = Image.open(fichier)
        image.load()
    except (UnidentifiedImageError, OSError):
        raise ValidationError({"images": f"« {nom} » n'est pas une image valide."})
    if image.format not in FORMATS_ACCEPTES:
        raise ValidationError({"images": f"« {nom} » : format non accepté (JPEG, PNG, WebP ou GIF)."})

    # GIF animé : conservé tel quel pour ne pas perdre l'animation
    if image.format == "GIF" and getattr(image, "is_animated", False):
        fichier.seek(0)
        return fichier.read(), "image/gif", image.width, image.height

    image = ImageOps.exif_transpose(image)  # photo prise en portrait sur téléphone : remise droite
    image.thumbnail((COTE_MAX, COTE_MAX))
    tampon = io.BytesIO()
    transparente = image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info)
    if transparente:
        image.save(tampon, format="PNG", optimize=True)
        type_mime = "image/png"
    else:
        image.convert("RGB").save(tampon, format="JPEG", quality=82, optimize=True, progressive=True)
        type_mime = "image/jpeg"
    return tampon.getvalue(), type_mime, image.width, image.height
