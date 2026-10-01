import uuid
import datetime
from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


class Eleve(TimeStampedModel):
    """Fiche élève, indépendante de l'inscription annuelle (l'historique est conservé)."""
    SEXE_CHOICES = [("M", "Masculin"), ("F", "Féminin")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="profil_eleve")
    etablissement = models.ForeignKey("core.Etablissement", on_delete=models.CASCADE, related_name="eleves")
    matricule = models.CharField(max_length=30, unique=True, blank=True)
    nom = models.CharField(max_length=100)
    prenom = models.CharField(max_length=100)
    sexe = models.CharField(max_length=1, choices=SEXE_CHOICES)
    date_naissance = models.DateField()
    lieu_naissance = models.CharField(max_length=100, blank=True)
    nationalite = models.CharField(max_length=100, default="Malienne")
    nom_pere = models.CharField(max_length=150, blank=True, help_text="Nom du père (figure sur les certificats officiels)")
    nom_mere = models.CharField(max_length=150, blank=True, help_text="Nom de la mère (figure sur les certificats officiels)")
    photo = models.ImageField(upload_to="eleves/photos/", blank=True, null=True)
    adresse = models.CharField(max_length=255, blank=True)
    groupe_sanguin = models.CharField(max_length=5, blank=True)
    allergies_ou_besoins_speciaux = models.TextField(blank=True)
    contact_urgence_nom = models.CharField(max_length=150, blank=True)
    contact_urgence_telephone = models.CharField(max_length=30, blank=True)
    ecole_provenance = models.CharField(max_length=150, blank=True)
    actif = models.BooleanField(default=True)

    class Meta:
        ordering = ["nom", "prenom"]
        verbose_name = "Élève"
        verbose_name_plural = "Élèves"

    def __str__(self):
        return f"{self.prenom} {self.nom} ({self.matricule})"

    def save(self, *args, **kwargs):
        if not self.matricule:
            self.matricule = self._generer_matricule()
        super().save(*args, **kwargs)

    def _generer_matricule(self):
        from django.conf import settings as dj_settings
        prefix = dj_settings.MATRICULE_PREFIX
        annee = datetime.date.today().year
        sigle = self.etablissement.sigle if self.etablissement_id else "GEN"
        base = f"{prefix}-{sigle}-{annee}-"
        last = Eleve.objects.filter(matricule__startswith=base).order_by("-matricule").first()
        seq = int(last.matricule.split("-")[-1]) + 1 if last else 1
        return f"{base}{seq:04d}"

    @property
    def inscription_courante(self):
        return self.inscriptions.filter(statut="active").order_by("-date_inscription").first()


class Inscription(TimeStampedModel):
    """Inscription (ou réinscription) d'un élève dans une classe pour une année scolaire."""
    STATUT_CHOICES = [
        ("active", "Active"), ("transferee", "Transférée"),
        ("abandonnee", "Abandonnée"), ("terminee", "Terminée / Promue"), ("exclue", "Exclue"),
    ]
    TYPE_CHOICES = [("inscription", "Nouvelle inscription"), ("reinscription", "Réinscription")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    eleve = models.ForeignKey(Eleve, on_delete=models.CASCADE, related_name="inscriptions")
    classe = models.ForeignKey("core.Classe", on_delete=models.CASCADE, related_name="inscriptions")
    annee_scolaire = models.ForeignKey("core.AnneeScolaire", on_delete=models.CASCADE, related_name="inscriptions")
    type_inscription = models.CharField(max_length=15, choices=TYPE_CHOICES, default="inscription")
    date_inscription = models.DateField(auto_now_add=True)
    statut = models.CharField(max_length=15, choices=STATUT_CHOICES, default="active")
    redoublant = models.BooleanField(default=False)
    boursier = models.BooleanField(default=False)
    observations = models.TextField(blank=True)

    class Meta:
        unique_together = ("eleve", "annee_scolaire")
        ordering = ["-date_inscription"]
        verbose_name = "Inscription"
        verbose_name_plural = "Inscriptions"

    def __str__(self):
        return f"{self.eleve} - {self.classe} ({self.annee_scolaire.libelle})"


class Absence(TimeStampedModel):
    """Absence ou retard d'un élève, avec justification éventuelle."""
    TYPE_CHOICES = [("absence", "Absence"), ("retard", "Retard")]

    inscription = models.ForeignKey(Inscription, on_delete=models.CASCADE, related_name="absences")
    date = models.DateField()
    type_evenement = models.CharField(max_length=10, choices=TYPE_CHOICES, default="absence")
    creneau = models.ForeignKey("core.CreneauEmploiDuTemps", on_delete=models.SET_NULL, null=True, blank=True, related_name="absences")
    duree_minutes_retard = models.PositiveIntegerField(null=True, blank=True)
    justifiee = models.BooleanField(default=False)
    motif = models.CharField(max_length=255, blank=True)
    piece_justificative = models.FileField(upload_to="eleves/justificatifs/", blank=True, null=True)
    signale_par = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")

    class Meta:
        ordering = ["-date"]
        verbose_name = "Absence / Retard"
        verbose_name_plural = "Absences / Retards"

    def __str__(self):
        return f"{self.inscription.eleve} - {self.get_type_evenement_display()} - {self.date}"


class SanctionRecompense(TimeStampedModel):
    """Sanction disciplinaire ou récompense/mérite accordée à un élève."""
    NATURE_CHOICES = [("sanction", "Sanction"), ("recompense", "Récompense")]
    TYPE_SANCTION_CHOICES = [
        ("avertissement", "Avertissement"), ("blame", "Blâme"),
        ("exclusion_temporaire", "Exclusion temporaire"), ("exclusion_definitive", "Exclusion définitive"),
        ("travail_interet_general", "Travail d'intérêt général"), ("autre", "Autre"),
    ]
    TYPE_RECOMPENSE_CHOICES = [
        ("tableau_honneur", "Tableau d'honneur"), ("tableau_excellence", "Tableau d'excellence"),
        ("felicitations", "Félicitations"), ("encouragements", "Encouragements"), ("autre", "Autre"),
    ]

    inscription = models.ForeignKey(Inscription, on_delete=models.CASCADE, related_name="sanctions_recompenses")
    nature = models.CharField(max_length=12, choices=NATURE_CHOICES)
    type_sanction = models.CharField(max_length=30, choices=TYPE_SANCTION_CHOICES, blank=True)
    type_recompense = models.CharField(max_length=30, choices=TYPE_RECOMPENSE_CHOICES, blank=True)
    periode = models.ForeignKey("core.Periode", on_delete=models.SET_NULL, null=True, blank=True, related_name="sanctions_recompenses")
    date = models.DateField()
    motif = models.TextField()
    decidee_par = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")

    class Meta:
        ordering = ["-date"]
        verbose_name = "Sanction / Récompense"
        verbose_name_plural = "Sanctions / Récompenses"

    def __str__(self):
        return f"{self.inscription.eleve} - {self.get_nature_display()} - {self.date}"


class CarteScolaire(TimeStampedModel):
    """Carte scolaire générée (format PVC CR80, 85.6x54mm) pour un élève et une année scolaire."""
    inscription = models.OneToOneField(Inscription, on_delete=models.CASCADE, related_name="carte_scolaire")
    numero_carte = models.CharField(max_length=40, unique=True, blank=True)
    date_emission = models.DateField(auto_now_add=True)
    date_expiration = models.DateField(null=True, blank=True)
    fichier_pdf = models.FileField(upload_to="eleves/cartes/", blank=True, null=True)
    qr_code_data = models.CharField(max_length=255, blank=True)

    class Meta:
        verbose_name = "Carte scolaire"
        verbose_name_plural = "Cartes scolaires"

    def __str__(self):
        return f"Carte {self.numero_carte or self.inscription.eleve.matricule}"

    def save(self, *args, **kwargs):
        if not self.numero_carte:
            self.numero_carte = f"CARTE-{self.inscription.eleve.matricule}-{self.inscription.annee_scolaire.libelle}"
        if not self.qr_code_data:
            self.qr_code_data = str(self.inscription.eleve.id)
        super().save(*args, **kwargs)
