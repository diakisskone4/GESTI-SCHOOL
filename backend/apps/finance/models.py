import uuid
from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


class TypeFrais(TimeStampedModel):
    """Type de frais scolaire (inscription, scolarité, cantine, transport...)."""
    PERIODICITE_CHOICES = [
        ("unique", "Paiement unique"), ("mensuel", "Mensuel"),
        ("trimestriel", "Trimestriel"), ("annuel", "Annuel"),
    ]
    etablissement = models.ForeignKey("core.Etablissement", on_delete=models.CASCADE, related_name="types_frais")
    nom = models.CharField(max_length=100)
    periodicite = models.CharField(max_length=15, choices=PERIODICITE_CHOICES, default="trimestriel")
    obligatoire = models.BooleanField(default=True)

    class Meta:
        unique_together = ("etablissement", "nom")
        verbose_name = "Type de frais"
        verbose_name_plural = "Types de frais"

    def __str__(self):
        return self.nom


class BaremeFrais(TimeStampedModel):
    """Montant d'un type de frais pour un niveau et une année scolaire donnés."""
    type_frais = models.ForeignKey(TypeFrais, on_delete=models.CASCADE, related_name="baremes")
    niveau = models.ForeignKey("core.Niveau", on_delete=models.CASCADE, related_name="baremes_frais")
    annee_scolaire = models.ForeignKey("core.AnneeScolaire", on_delete=models.CASCADE, related_name="baremes_frais")
    montant = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        unique_together = ("type_frais", "niveau", "annee_scolaire")
        verbose_name = "Barème de frais"
        verbose_name_plural = "Barèmes de frais"

    def __str__(self):
        return f"{self.type_frais} - {self.niveau} - {self.montant} FCFA"


class Bourse(TimeStampedModel):
    """Bourse ou réduction accordée à un élève."""
    TYPE_CHOICES = [
        ("bourse_totale", "Bourse totale"), ("bourse_partielle", "Bourse partielle"),
        ("reduction_fratrie", "Réduction fratrie"), ("reduction_merite", "Réduction au mérite"),
        ("autre", "Autre"),
    ]
    inscription = models.ForeignKey("students.Inscription", on_delete=models.CASCADE, related_name="bourses")
    type_bourse = models.CharField(max_length=20, choices=TYPE_CHOICES)
    pourcentage_reduction = models.DecimalField(max_digits=5, decimal_places=2, default=0, help_text="% de réduction sur les frais")
    montant_fixe = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, help_text="Alternative : montant fixe de réduction")
    motif = models.TextField(blank=True)
    approuve_par = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    date_octroi = models.DateField(auto_now_add=True)
    actif = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Bourse / Réduction"
        verbose_name_plural = "Bourses / Réductions"

    def __str__(self):
        return f"{self.inscription.eleve} - {self.get_type_bourse_display()}"


class FactureFrais(TimeStampedModel):
    """Facture / échéance de frais due par un élève (ex: scolarité T1)."""
    STATUT_CHOICES = [
        ("impayee", "Impayée"), ("partielle", "Partiellement payée"),
        ("payee", "Payée"), ("annulee", "Annulée"),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    inscription = models.ForeignKey("students.Inscription", on_delete=models.CASCADE, related_name="factures")
    type_frais = models.ForeignKey(TypeFrais, on_delete=models.PROTECT, related_name="factures")
    periode = models.ForeignKey("core.Periode", on_delete=models.SET_NULL, null=True, blank=True, related_name="factures")
    libelle = models.CharField(max_length=150, blank=True)
    montant_du = models.DecimalField(max_digits=12, decimal_places=2)
    montant_remise = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    date_echeance = models.DateField()
    statut = models.CharField(max_length=12, choices=STATUT_CHOICES, default="impayee")

    class Meta:
        ordering = ["-date_echeance"]
        verbose_name = "Facture de frais"
        verbose_name_plural = "Factures de frais"

    def __str__(self):
        return f"{self.inscription.eleve} - {self.libelle or self.type_frais.nom} - {self.montant_du} FCFA"

    @property
    def montant_net(self):
        return self.montant_du - self.montant_remise

    @property
    def montant_paye(self):
        """Total des paiements valides (les paiements annulés ne comptent pas)."""
        return sum(p.montant for p in self.paiements.all() if not p.annule)

    @property
    def solde(self):
        return self.montant_net - self.montant_paye

    def maj_statut(self):
        if self.statut == "annulee":
            return
        solde = self.solde
        if solde <= 0:
            self.statut = "payee"
        elif solde < self.montant_net:
            self.statut = "partielle"
        else:
            self.statut = "impayee"
        self.save(update_fields=["statut"])


class Paiement(TimeStampedModel):
    """Paiement effectué par un élève/parent, avec reçu imprimable."""
    MODE_CHOICES = [
        ("especes", "Espèces"), ("mobile_money", "Mobile Money"),
        ("virement", "Virement bancaire"), ("cheque", "Chèque"), ("carte", "Carte bancaire"),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    facture = models.ForeignKey(FactureFrais, on_delete=models.CASCADE, related_name="paiements")
    numero_recu = models.CharField(max_length=40, unique=True, blank=True)
    montant = models.DecimalField(max_digits=12, decimal_places=2)
    mode_paiement = models.CharField(max_length=15, choices=MODE_CHOICES, default="especes")
    reference_transaction = models.CharField(max_length=100, blank=True)
    date_paiement = models.DateField(auto_now_add=True)
    encaisse_par = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="paiements_encaisses")
    recu_pdf = models.FileField(upload_to="finance/recus/", blank=True, null=True)
    annule = models.BooleanField(default=False)

    class Meta:
        ordering = ["-date_paiement"]
        verbose_name = "Paiement"
        verbose_name_plural = "Paiements"

    def __str__(self):
        return f"Reçu {self.numero_recu} - {self.montant} FCFA"

    @property
    def eleve(self):
        return self.facture.inscription.eleve

    @property
    def libelle(self):
        return self.facture.libelle or self.facture.type_frais.nom

    def save(self, *args, **kwargs):
        if not self.numero_recu:
            import datetime
            annee = datetime.date.today().year
            last = Paiement.objects.filter(numero_recu__startswith=f"REC-{annee}-").order_by("-numero_recu").first()
            seq = int(last.numero_recu.split("-")[-1]) + 1 if last else 1
            self.numero_recu = f"REC-{annee}-{seq:06d}"
        super().save(*args, **kwargs)
        # Recalcul aussi lors d'une annulation : la facture redevient impayée / partielle
        self.facture.maj_statut()
