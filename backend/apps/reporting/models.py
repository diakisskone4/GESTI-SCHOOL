from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


class RapportGenere(TimeStampedModel):
    """Trace des rapports personnalisés générés (pour historique/téléchargement ultérieur)."""
    TYPE_CHOICES = [
        ("academique", "Rapport académique"), ("administratif", "Rapport administratif"),
        ("financier", "Rapport financier"), ("statistiques_classe", "Statistiques par classe"),
        ("autre", "Autre"),
    ]
    FORMAT_CHOICES = [("pdf", "PDF"), ("excel", "Excel"), ("csv", "CSV")]

    etablissement = models.ForeignKey("core.Etablissement", on_delete=models.CASCADE, related_name="rapports")
    type_rapport = models.CharField(max_length=25, choices=TYPE_CHOICES)
    titre = models.CharField(max_length=200)
    format_export = models.CharField(max_length=10, choices=FORMAT_CHOICES, default="pdf")
    parametres = models.JSONField(default=dict, blank=True, help_text="Filtres utilisés (classe, période, dates...)")
    fichier = models.FileField(upload_to="reporting/rapports/", blank=True, null=True)
    genere_par = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Rapport généré"
        verbose_name_plural = "Rapports générés"

    def __str__(self):
        return self.titre
