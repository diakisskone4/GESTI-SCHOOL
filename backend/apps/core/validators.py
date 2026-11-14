"""Contrôle des fichiers envoyés par les utilisateurs (pièces jointes, justificatifs, documents)."""
from django.core.exceptions import ValidationError
from django.utils.deconstruct import deconstructible

# Documents et images courants ; jamais de page web, script, programme ou image vectorielle (SVG)
EXTENSIONS_AUTORISEES = (
    "pdf", "jpg", "jpeg", "png", "webp", "gif",
    "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp", "txt", "csv",
)
TAILLE_MAX_MO = 10


@deconstructible
class ValidateurFichier:
    def __init__(self, extensions=EXTENSIONS_AUTORISEES, taille_max_mo=TAILLE_MAX_MO):
        self.extensions = tuple(extensions)
        self.taille_max_mo = taille_max_mo

    def __call__(self, fichier):
        nom = getattr(fichier, "name", "") or ""
        extension = nom.rsplit(".", 1)[-1].lower() if "." in nom else ""
        if extension not in self.extensions:
            raise ValidationError(
                f"Type de fichier non autorisé (.{extension or '?'}). Formats acceptés : {', '.join(self.extensions)}."
            )
        taille = getattr(fichier, "size", 0) or 0
        if taille > self.taille_max_mo * 1024 * 1024:
            raise ValidationError(f"Le fichier dépasse {self.taille_max_mo} Mo.")

    def __eq__(self, autre):
        return (isinstance(autre, ValidateurFichier) and self.extensions == autre.extensions
                and self.taille_max_mo == autre.taille_max_mo)


valider_fichier_televerse = ValidateurFichier()
