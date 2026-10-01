import uuid
from django.conf import settings
from django.db import models


class TimeStampedModel(models.Model):
    """Ajoute des champs de traçabilité à tous les modèles métier."""
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Etablissement(TimeStampedModel):
    """Un établissement scolaire (support du multi-établissements)."""
    TYPE_CHOICES = [
        ("prescolaire", "Préscolaire"),
        ("primaire", "Primaire"),
        ("secondaire", "Secondaire"),
        ("mixte", "Mixte (plusieurs cycles)"),
    ]

    nom = models.CharField(max_length=200)
    sigle = models.CharField(max_length=20, unique=True, help_text="Code court utilisé dans les matricules")
    type_etablissement = models.CharField(max_length=20, choices=TYPE_CHOICES, default="mixte")
    adresse = models.CharField(max_length=255, blank=True)
    ville = models.CharField(max_length=100, blank=True)
    pays = models.CharField(max_length=100, default="Mali")
    telephone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    logo = models.ImageField(upload_to="etablissements/logos/", blank=True, null=True)
    devise = models.CharField(max_length=255, blank=True, help_text="Slogan / devise de l'établissement")
    arrete_creation = models.CharField(max_length=100, blank=True, help_text="Ex: N° 10-2235/MEALN-SG du 21/07/2010")
    arrete_ouverture = models.CharField(max_length=100, blank=True, help_text="Ex: N° 2011-4993/MEALN-SG du 07/12/2011")
    academie = models.CharField(max_length=150, blank=True, help_text="Ex: Académie d'Enseignement de Bamako Rive Droite")
    cap = models.CharField(max_length=150, blank=True, verbose_name="CAP", help_text="Centre d'Animation Pédagogique de rattachement (primaire/collège), si applicable")
    directeur_nom = models.CharField(max_length=150, blank=True)
    directeur_titre = models.CharField(max_length=50, blank=True, default="Le Directeur", help_text="Ex: Le Proviseur, Le Directeur...")
    directeur_signature = models.ImageField(upload_to="etablissements/signatures/", blank=True, null=True)
    cachet = models.ImageField(upload_to="etablissements/cachets/", blank=True, null=True)
    actif = models.BooleanField(default=True)

    class Meta:
        ordering = ["nom"]
        verbose_name = "Établissement"
        verbose_name_plural = "Établissements"

    def __str__(self):
        return self.nom


class AnneeScolaire(TimeStampedModel):
    """Année scolaire, ex: 2025-2026, propre à un établissement."""
    etablissement = models.ForeignKey(Etablissement, on_delete=models.CASCADE, related_name="annees_scolaires")
    libelle = models.CharField(max_length=20, help_text="Ex: 2025-2026")
    date_debut = models.DateField()
    date_fin = models.DateField()
    est_courante = models.BooleanField(default=False)

    class Meta:
        unique_together = ("etablissement", "libelle")
        ordering = ["-date_debut"]
        verbose_name = "Année scolaire"
        verbose_name_plural = "Années scolaires"

    def __str__(self):
        return f"{self.libelle} ({self.etablissement.sigle})"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.est_courante:
            AnneeScolaire.objects.filter(etablissement=self.etablissement).exclude(pk=self.pk).update(est_courante=False)


class Periode(TimeStampedModel):
    """Trimestre ou semestre d'une année scolaire."""
    TYPE_CHOICES = [("trimestre", "Trimestre"), ("semestre", "Semestre")]

    annee_scolaire = models.ForeignKey(AnneeScolaire, on_delete=models.CASCADE, related_name="periodes")
    type_periode = models.CharField(max_length=10, choices=TYPE_CHOICES, default="trimestre")
    numero = models.PositiveSmallIntegerField(help_text="1, 2 ou 3 (trimestre) / 1, 2 (semestre)")
    libelle = models.CharField(max_length=50, blank=True)
    date_debut = models.DateField()
    date_fin = models.DateField()
    est_courante = models.BooleanField(default=False)
    cloturee = models.BooleanField(default=False)

    class Meta:
        unique_together = ("annee_scolaire", "type_periode", "numero")
        ordering = ["annee_scolaire", "numero"]

    def __str__(self):
        return self.libelle or f"{self.get_type_periode_display()} {self.numero} - {self.annee_scolaire.libelle}"

    def save(self, *args, **kwargs):
        if not self.libelle:
            self.libelle = f"{self.get_type_periode_display()} {self.numero}"
        super().save(*args, **kwargs)
        if self.est_courante:
            Periode.objects.filter(annee_scolaire=self.annee_scolaire).exclude(pk=self.pk).update(est_courante=False)


class Niveau(TimeStampedModel):
    """Niveau scolaire : Petite Section, CP1, 6e, Terminale, etc."""
    CYCLE_CHOICES = [
        ("prescolaire", "Préscolaire"),
        ("primaire", "Primaire"),
        ("secondaire_1", "Secondaire 1er cycle"),
        ("secondaire_2", "Secondaire 2nd cycle"),
    ]
    etablissement = models.ForeignKey(Etablissement, on_delete=models.CASCADE, related_name="niveaux")
    nom = models.CharField(max_length=100, help_text="Ex: 6e, Terminale, CP1, Grande Section")
    cycle = models.CharField(max_length=20, choices=CYCLE_CHOICES)
    ordre = models.PositiveSmallIntegerField(default=0, help_text="Ordre d'affichage / progression")

    class Meta:
        ordering = ["etablissement", "ordre"]
        unique_together = ("etablissement", "nom")

    def __str__(self):
        return self.nom


class Serie(TimeStampedModel):
    """Série / filière (ex: TSE, TSECO, Littéraire) applicable à un niveau."""
    niveau = models.ForeignKey(Niveau, on_delete=models.CASCADE, related_name="series")
    nom = models.CharField(max_length=100, help_text="Ex: TSE, TSECO, Lettres")
    code = models.CharField(max_length=20, blank=True)

    class Meta:
        unique_together = ("niveau", "nom")

    def __str__(self):
        return f"{self.niveau.nom} - {self.nom}"


class Classe(TimeStampedModel):
    """Classe concrète pour une année scolaire donnée (ex: 6e A)."""
    etablissement = models.ForeignKey(Etablissement, on_delete=models.CASCADE, related_name="classes")
    annee_scolaire = models.ForeignKey(AnneeScolaire, on_delete=models.CASCADE, related_name="classes")
    niveau = models.ForeignKey(Niveau, on_delete=models.CASCADE, related_name="classes")
    serie = models.ForeignKey(Serie, on_delete=models.SET_NULL, null=True, blank=True, related_name="classes")
    nom = models.CharField(max_length=50, help_text="Ex: 6e A, Terminale TSE B")
    effectif_max = models.PositiveIntegerField(default=50)
    professeur_principal = models.ForeignKey(
        "staff.Enseignant", on_delete=models.SET_NULL, null=True, blank=True, related_name="classes_principales"
    )
    salle = models.CharField(max_length=50, blank=True)

    class Meta:
        unique_together = ("annee_scolaire", "niveau", "nom")
        ordering = ["niveau__ordre", "nom"]

    def __str__(self):
        return f"{self.nom} ({self.annee_scolaire.libelle})"

    @property
    def effectif_actuel(self):
        return self.inscriptions.filter(statut="active").count()


class Matiere(TimeStampedModel):
    """Matière enseignée (partagée entre établissements ou spécifique)."""
    etablissement = models.ForeignKey(Etablissement, on_delete=models.CASCADE, related_name="matieres")
    nom = models.CharField(max_length=100)
    code = models.CharField(max_length=20, blank=True)
    coefficient_defaut = models.DecimalField(max_digits=4, decimal_places=1, default=1)

    class Meta:
        unique_together = ("etablissement", "nom")

    def __str__(self):
        return self.nom


class CreneauEmploiDuTemps(TimeStampedModel):
    """Un créneau de l'emploi du temps d'une classe."""
    JOUR_CHOICES = [
        (0, "Lundi"), (1, "Mardi"), (2, "Mercredi"),
        (3, "Jeudi"), (4, "Vendredi"), (5, "Samedi"), (6, "Dimanche"),
    ]
    classe = models.ForeignKey(Classe, on_delete=models.CASCADE, related_name="creneaux")
    matiere = models.ForeignKey(Matiere, on_delete=models.CASCADE, related_name="creneaux")
    enseignant = models.ForeignKey(
        "staff.Enseignant", on_delete=models.SET_NULL, null=True, blank=True, related_name="creneaux"
    )
    jour = models.PositiveSmallIntegerField(choices=JOUR_CHOICES)
    heure_debut = models.TimeField()
    heure_fin = models.TimeField()
    salle = models.CharField(max_length=50, blank=True)

    class Meta:
        ordering = ["jour", "heure_debut"]
        verbose_name = "Créneau d'emploi du temps"
        verbose_name_plural = "Emplois du temps"

    def __str__(self):
        return f"{self.classe} - {self.matiere} ({self.get_jour_display()} {self.heure_debut})"


class JournalActivite(models.Model):
    """Journal d'audit : trace toutes les actions sensibles du système."""
    ACTION_CHOICES = [
        ("create", "Création"), ("update", "Modification"),
        ("delete", "Suppression"), ("login", "Connexion"),
        ("logout", "Déconnexion"), ("export", "Export"),
        ("payment", "Paiement"), ("other", "Autre"),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    utilisateur = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="actions_journal"
    )
    etablissement = models.ForeignKey(Etablissement, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    modele = models.CharField(max_length=100, blank=True, help_text="Nom du modèle concerné")
    objet_id = models.CharField(max_length=64, blank=True)
    description = models.TextField(blank=True)
    adresse_ip = models.GenericIPAddressField(null=True, blank=True)
    horodatage = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-horodatage"]
        verbose_name = "Entrée du journal d'activité"
        verbose_name_plural = "Journal d'activité"

    def __str__(self):
        return f"[{self.horodatage:%Y-%m-%d %H:%M}] {self.utilisateur} - {self.get_action_display()}"
