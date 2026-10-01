import uuid
from decimal import Decimal
from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


class ElementSalaire(TimeStampedModel):
    """Élément de rémunération/retenue réutilisable : prime, indemnité, retenue..."""
    NATURE_CHOICES = [("prime", "Prime"), ("indemnite", "Indemnité"), ("retenue", "Retenue"), ("heure_sup", "Heures supplémentaires")]
    etablissement = models.ForeignKey("core.Etablissement", on_delete=models.CASCADE, related_name="elements_salaire")
    nom = models.CharField(max_length=100)
    nature = models.CharField(max_length=12, choices=NATURE_CHOICES)
    imposable = models.BooleanField(default=True)

    class Meta:
        unique_together = ("etablissement", "nom")
        verbose_name = "Élément de salaire"
        verbose_name_plural = "Éléments de salaire"

    def __str__(self):
        return f"{self.nom} ({self.get_nature_display()})"


class ContratSalaire(TimeStampedModel):
    """Salaire de base et informations contractuelles d'un employé."""
    employe = models.OneToOneField("staff.Employe", on_delete=models.CASCADE, related_name="contrat_salaire")
    salaire_base = models.DecimalField(max_digits=12, decimal_places=2)
    taux_horaire_supplementaire = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    date_effet = models.DateField(auto_now_add=True)

    class Meta:
        verbose_name = "Contrat de salaire"
        verbose_name_plural = "Contrats de salaire"

    def __str__(self):
        return f"{self.employe} - {self.salaire_base} FCFA/mois"


class BulletinPaie(TimeStampedModel):
    """Bulletin de paie mensuel d'un employé, avec calcul automatique du net à payer."""
    STATUT_CHOICES = [("brouillon", "Brouillon"), ("valide", "Validé"), ("paye", "Payé")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employe = models.ForeignKey("staff.Employe", on_delete=models.CASCADE, related_name="bulletins_paie")
    mois = models.PositiveSmallIntegerField()
    annee = models.PositiveSmallIntegerField()
    salaire_base = models.DecimalField(max_digits=12, decimal_places=2)
    total_primes = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_indemnites = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_heures_sup = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_retenues = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    avances_deduites = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    salaire_brut = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    net_a_payer = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    statut = models.CharField(max_length=10, choices=STATUT_CHOICES, default="brouillon")
    date_paiement = models.DateField(null=True, blank=True)
    fichier_pdf = models.FileField(upload_to="paie/bulletins/", blank=True, null=True)
    genere_par = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")

    class Meta:
        unique_together = ("employe", "mois", "annee")
        ordering = ["-annee", "-mois"]
        verbose_name = "Bulletin de paie"
        verbose_name_plural = "Bulletins de paie"

    def __str__(self):
        return f"Paie {self.employe} - {self.mois:02d}/{self.annee}"

    def calculer(self):
        lignes = self.lignes.all()
        primes = sum((l.montant for l in lignes if l.element.nature == "prime"), Decimal("0"))
        indemnites = sum((l.montant for l in lignes if l.element.nature == "indemnite"), Decimal("0"))
        heures_sup = sum((l.montant for l in lignes if l.element.nature == "heure_sup"), Decimal("0"))
        retenues = sum((l.montant for l in lignes if l.element.nature == "retenue"), Decimal("0"))

        self.total_primes = primes
        self.total_indemnites = indemnites
        self.total_heures_sup = heures_sup
        self.total_retenues = retenues
        self.salaire_brut = self.salaire_base + primes + indemnites + heures_sup
        self.net_a_payer = self.salaire_brut - retenues - self.avances_deduites
        self.save()
        return self


class LigneBulletinPaie(models.Model):
    """Détail d'un bulletin de paie : une ligne = un élément (prime, retenue...)."""
    bulletin = models.ForeignKey(BulletinPaie, on_delete=models.CASCADE, related_name="lignes")
    element = models.ForeignKey(ElementSalaire, on_delete=models.PROTECT, related_name="lignes")
    quantite = models.DecimalField(max_digits=8, decimal_places=2, default=1)
    montant = models.DecimalField(max_digits=12, decimal_places=2)
    commentaire = models.CharField(max_length=255, blank=True)

    class Meta:
        verbose_name = "Ligne de bulletin de paie"
        verbose_name_plural = "Lignes de bulletin de paie"

    def __str__(self):
        return f"{self.element.nom}: {self.montant}"


class Avance(TimeStampedModel):
    """Avance sur salaire accordée à un employé."""
    STATUT_CHOICES = [("en_cours", "En cours de remboursement"), ("remboursee", "Remboursée"), ("annulee", "Annulée")]

    employe = models.ForeignKey("staff.Employe", on_delete=models.CASCADE, related_name="avances")
    montant = models.DecimalField(max_digits=12, decimal_places=2)
    montant_rembourse = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    date_demande = models.DateField(auto_now_add=True)
    motif = models.CharField(max_length=255, blank=True)
    nb_mensualites = models.PositiveSmallIntegerField(default=1)
    statut = models.CharField(max_length=12, choices=STATUT_CHOICES, default="en_cours")
    approuve_par = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")

    class Meta:
        verbose_name = "Avance sur salaire"
        verbose_name_plural = "Avances sur salaire"

    def __str__(self):
        return f"{self.employe} - Avance {self.montant} FCFA"

    @property
    def solde_restant(self):
        return self.montant - self.montant_rembourse
