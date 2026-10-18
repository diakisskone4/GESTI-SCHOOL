import calendar
import datetime

from django.db import models
from django.utils import timezone

from apps.core.models import TimeStampedModel

DUREES_MOIS = [(3, "3 mois"), (6, "6 mois"), (12, "12 mois"), (24, "24 mois")]


def ajouter_mois(date, mois):
    """Ajoute `mois` mois à une date (le 31/01 + 1 mois donne le 28 ou 29/02)."""
    total = date.month - 1 + mois
    annee, mois_index = date.year + total // 12, total % 12 + 1
    jour = min(date.day, calendar.monthrange(annee, mois_index)[1])
    return datetime.date(annee, mois_index, jour)


class Abonnement(TimeStampedModel):
    """Droit d'accès d'un établissement à l'application, géré par l'équipe développeurs."""

    STATUT_ACTIF, STATUT_EXPIRE, STATUT_SUSPENDU = "actif", "expire", "suspendu"

    etablissement = models.OneToOneField("core.Etablissement", on_delete=models.CASCADE, related_name="abonnement")
    duree_mois = models.PositiveSmallIntegerField(choices=DUREES_MOIS, default=12)
    date_debut = models.DateField(default=timezone.localdate)
    date_fin = models.DateField()
    actif = models.BooleanField(default=True, help_text="Décocher pour suspendre immédiatement l'accès")
    notes = models.TextField(blank=True, help_text="Notes internes de l'équipe (contact, paiement, contrat...)")

    class Meta:
        verbose_name = "Abonnement"
        verbose_name_plural = "Abonnements"

    def __str__(self):
        return f"{self.etablissement} — {self.statut} jusqu'au {self.date_fin:%d/%m/%Y}"

    @property
    def jours_restants(self):
        return (self.date_fin - timezone.localdate()).days

    @property
    def statut(self):
        if not self.actif:
            return self.STATUT_SUSPENDU
        if self.date_fin < timezone.localdate():
            return self.STATUT_EXPIRE
        return self.STATUT_ACTIF

    @property
    def donne_acces(self):
        return self.statut == self.STATUT_ACTIF

    def renouveler(self, duree_mois):
        """Prolonge l'accès : à la suite de la période en cours si elle est encore valide,
        sinon à partir d'aujourd'hui. Réactive l'abonnement."""
        aujourd_hui = timezone.localdate()
        if self.date_fin and self.date_fin >= aujourd_hui and self.actif:
            self.date_fin = ajouter_mois(self.date_fin, duree_mois)
        else:
            self.date_debut = aujourd_hui
            self.date_fin = ajouter_mois(aujourd_hui, duree_mois)
        self.duree_mois = duree_mois
        self.actif = True
        self.save()
