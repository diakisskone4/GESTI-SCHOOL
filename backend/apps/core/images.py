"""Accès aux images d'un établissement (logo, cachet, signature du directeur).

Le fichier sur disque est utilisé s'il existe ; sinon on se rabat sur la copie conservée en
base de données (ImageEtablissement), qui survit aux redéploiements des hébergements sans
disque persistant.
"""
import io
import mimetypes

from reportlab.lib.utils import ImageReader


def contenu_image(etablissement, champ):
    """Octets de l'image (ou None si l'établissement n'en a pas)."""
    fichier = getattr(etablissement, champ, None)
    if not fichier:
        return None
    try:
        fichier.open("rb")
        contenu = fichier.read()
        fichier.close()
        return contenu
    except (OSError, ValueError):
        pass
    stockee = etablissement.images_stockees.filter(champ=champ).only("contenu").first()
    return bytes(stockee.contenu) if stockee else None


def lecteur_image(etablissement, champ):
    """ImageReader prêt pour ReportLab. Lève ValueError si l'image est indisponible
    (les appelants affichent alors leur solution de repli, ex. les initiales)."""
    contenu = contenu_image(etablissement, champ)
    if not contenu:
        raise ValueError(f"Image « {champ} » indisponible pour {etablissement}")
    return ImageReader(io.BytesIO(contenu))


def type_mime(etablissement, champ):
    fichier = getattr(etablissement, champ, None)
    return (mimetypes.guess_type(fichier.name)[0] if fichier else None) or "image/png"
