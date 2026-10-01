import uuid
from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


class DocumentGenere(TimeStampedModel):
    """Document administratif généré et archivé automatiquement."""

    # Documents destinés à un élève (ou son parent/tuteur).
    TYPES_ELEVE = [
        ("certificat_scolarite", "Certificat de scolarité"),
        ("certificat_frequentation", "Certificat de fréquentation scolaire"),
        ("convocation_examen", "Convocation - Examen"),
        ("convocation_reunion", "Convocation - Réunion"),
        ("attestation_reussite", "Attestation de réussite"),
        ("attestation_passage", "Attestation de passage"),
        ("fiche_permission", "Fiche de permission"),
        ("fiche_medicale", "Fiche médicale"),
        ("billet_entree", "Billet d'entrée"),
        ("avis_recouvrement", "Avis de recouvrement"),
    ]
    # Documents internes/RH concernant un employé — jamais destinés à un élève.
    TYPES_EMPLOYE = [
        ("attestation_travail", "Attestation de travail"),
        ("certificat_travail", "Certificat de travail"),
        ("certificat_fin_contrat", "Certificat de fin de contrat"),
        ("attestation_fin_stage", "Attestation de fin de stage"),
        ("fiche_licenciement", "Fiche de licenciement"),
    ]
    TYPE_CHOICES = TYPES_ELEVE + TYPES_EMPLOYE + [("autre", "Autre")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    type_document = models.CharField(max_length=30, choices=TYPE_CHOICES)
    eleve = models.ForeignKey("students.Eleve", on_delete=models.CASCADE, related_name="documents_generes", null=True, blank=True)
    employe = models.ForeignKey("staff.Employe", on_delete=models.CASCADE, related_name="documents_generes", null=True, blank=True)
    inscription = models.ForeignKey("students.Inscription", on_delete=models.SET_NULL, null=True, blank=True, related_name="documents_generes")
    reference = models.CharField(max_length=50, unique=True, blank=True)
    objet = models.CharField(max_length=255, blank=True)
    contenu_texte = models.TextField(blank=True, help_text="Corps du document (texte brut, une ligne par paragraphe)")
    date_evenement = models.DateField(null=True, blank=True, help_text="Date de l'examen/réunion/début de permission ou de stage")
    date_fin_evenement = models.DateField(null=True, blank=True, help_text="Date de fin (permission, stage...), si la période a un terme connu")
    lieu_evenement = models.CharField(max_length=200, blank=True, help_text="Lieu, ou provenance (établissement d'origine/spécialité pour un stagiaire)")
    fichier_pdf = models.FileField(upload_to="documents/archives/%Y/%m/", blank=True, null=True)
    genere_par = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Document généré"
        verbose_name_plural = "Documents générés (archives)"

    def __str__(self):
        return f"{self.get_type_document_display()} - {self.reference}"

    def save(self, *args, **kwargs):
        if not self.reference:
            import datetime
            annee = datetime.date.today().year
            prefix = {
                "certificat_scolarite": "CS", "certificat_frequentation": "CF",
                "convocation_examen": "CVE", "convocation_reunion": "CVR",
                "attestation_reussite": "AR", "attestation_passage": "AP",
                "fiche_permission": "FP", "fiche_medicale": "FM",
                "billet_entree": "BE", "avis_recouvrement": "REC",
                "attestation_travail": "AW", "certificat_travail": "CW",
                "certificat_fin_contrat": "CFC", "attestation_fin_stage": "AFS",
                "fiche_licenciement": "FL",
            }.get(self.type_document, "DOC")
            last = DocumentGenere.objects.filter(reference__startswith=f"{prefix}-{annee}-").order_by("-reference").first()
            seq = int(last.reference.split("-")[-1]) + 1 if last else 1
            self.reference = f"{prefix}-{annee}-{seq:05d}"
        super().save(*args, **kwargs)
