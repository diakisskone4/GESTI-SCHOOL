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


class JournalConsole(models.Model):
    """Historique des actions de l'équipe dans la console (qui a fait quoi, sur quel établissement)."""
    ACTION_CHOICES = [
        ("creation", "Création"), ("modification", "Modification"),
        ("activation", "Activation"), ("desactivation", "Désactivation"),
        ("renouvellement", "Prolongation"), ("notes", "Notes internes"),
        ("administrateur", "Ajout d'administrateur"), ("suppression", "Suppression"),
        ("equipe", "Équipe"),
    ]

    auteur = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="actions_console",
    )
    # Conservé après suppression de l'établissement : le nom reste lisible dans l'historique
    etablissement = models.ForeignKey(
        "core.Etablissement", on_delete=models.SET_NULL, null=True, blank=True, related_name="+",
    )
    etablissement_nom = models.CharField(max_length=200, blank=True)
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    details = models.CharField(max_length=255, blank=True)
    horodatage = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-horodatage"]
        verbose_name = "Action de la console"
        verbose_name_plural = "Journal de la console"

    def __str__(self):
        return f"[{self.horodatage:%d/%m/%Y %H:%M}] {self.get_action_display()} — {self.etablissement_nom}"


class DemandeDemo(models.Model):
    """Demande de démonstration ou de contact envoyée depuis le site vitrine (dossier site/)."""
    STATUT_CHOICES = [("nouvelle", "Nouvelle"), ("en_cours", "En cours"), ("convertie", "Client"), ("abandonnee", "Sans suite")]

    nom = models.CharField(max_length=150)
    etablissement = models.CharField(max_length=200)
    fonction = models.CharField(max_length=100, blank=True)
    telephone = models.CharField(max_length=30)
    email = models.EmailField(blank=True)
    ville = models.CharField(max_length=100, blank=True)
    nb_eleves = models.CharField(max_length=30, blank=True)
    message = models.TextField(blank=True)
    statut = models.CharField(max_length=12, choices=STATUT_CHOICES, default="nouvelle", db_index=True)
    notes = models.TextField(blank=True, help_text="Notes internes de l'équipe")
    adresse_ip = models.GenericIPAddressField(null=True, blank=True)
    cree_le = models.DateTimeField(auto_now_add=True, db_index=True)
    modifie_le = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-cree_le"]
        verbose_name = "Demande de démonstration"
        verbose_name_plural = "Demandes de démonstration"

    def __str__(self):
        return f"{self.etablissement} — {self.nom} ({self.cree_le:%d/%m/%Y})"
