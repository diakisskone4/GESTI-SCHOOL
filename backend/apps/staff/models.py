import uuid
from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


class Employe(TimeStampedModel):
    """Profil détaillé pour tout membre du personnel (enseignant ou non)."""
    TYPE_CHOICES = [
        ("enseignant", "Enseignant"),
        ("administratif", "Personnel administratif"),
        ("surveillant", "Surveillant"),
        ("technique", "Personnel technique/entretien"),
        ("autre", "Autre"),
    ]
    SEXE_CHOICES = [("M", "Masculin"), ("F", "Féminin")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profil_employe", null=True, blank=True)
    etablissement = models.ForeignKey("core.Etablissement", on_delete=models.CASCADE, related_name="employes")
    matricule = models.CharField(max_length=30, unique=True, blank=True)
    type_employe = models.CharField(max_length=20, choices=TYPE_CHOICES, default="enseignant")
    nom = models.CharField(max_length=100)
    prenom = models.CharField(max_length=100)
    sexe = models.CharField(max_length=1, choices=SEXE_CHOICES, default="M")
    date_naissance = models.DateField(null=True, blank=True)
    lieu_naissance = models.CharField(max_length=100, blank=True)
    telephone = models.CharField(max_length=30, blank=True)
    email_personnel = models.EmailField(blank=True)
    adresse = models.CharField(max_length=255, blank=True)
    photo = models.ImageField(upload_to="employes/photos/", blank=True, null=True)
    diplome = models.CharField(max_length=150, blank=True)
    specialite = models.CharField(max_length=150, blank=True)
    date_embauche = models.DateField(null=True, blank=True)
    date_fin_contrat = models.DateField(null=True, blank=True)
    type_contrat = models.CharField(max_length=50, blank=True, help_text="CDI, CDD, Vacataire, ...")
    numero_cnss = models.CharField(max_length=50, blank=True)
    iban_ou_compte = models.CharField(max_length=100, blank=True)
    actif = models.BooleanField(default=True)

    class Meta:
        ordering = ["nom", "prenom"]
        verbose_name = "Employé"
        verbose_name_plural = "Employés"

    def __str__(self):
        return f"{self.prenom} {self.nom}"

    def save(self, *args, **kwargs):
        if not self.matricule:
            prefix = "EMP"
            annee = str(__import__("datetime").date.today().year)
            last = Employe.objects.filter(matricule__startswith=f"{prefix}{annee}").order_by("-matricule").first()
            seq = int(last.matricule[-4:]) + 1 if last else 1
            self.matricule = f"{prefix}{annee}{seq:04d}"
        super().save(*args, **kwargs)


class Enseignant(Employe):
    """Sous-type d'Employe spécifique aux enseignants (via héritage multi-table)."""
    grade_academique = models.CharField(max_length=100, blank=True, help_text="Ex: Professeur certifié, Instituteur")
    matieres_enseignees = models.ManyToManyField("core.Matiere", related_name="enseignants", blank=True)

    class Meta:
        verbose_name = "Enseignant"
        verbose_name_plural = "Enseignants"

    def save(self, *args, **kwargs):
        self.type_employe = "enseignant"
        super().save(*args, **kwargs)


class Affectation(TimeStampedModel):
    """Affectation d'un enseignant à une classe pour une matière donnée."""
    enseignant = models.ForeignKey(Enseignant, on_delete=models.CASCADE, related_name="affectations")
    classe = models.ForeignKey("core.Classe", on_delete=models.CASCADE, related_name="affectations")
    matiere = models.ForeignKey("core.Matiere", on_delete=models.CASCADE, related_name="affectations")
    annee_scolaire = models.ForeignKey("core.AnneeScolaire", on_delete=models.CASCADE, related_name="affectations")
    volume_horaire_hebdo = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    date_debut = models.DateField(auto_now_add=True)
    date_fin = models.DateField(null=True, blank=True)
    actif = models.BooleanField(default=True)

    class Meta:
        unique_together = ("enseignant", "classe", "matiere", "annee_scolaire")
        verbose_name = "Affectation"
        verbose_name_plural = "Affectations"

    def __str__(self):
        return f"{self.enseignant} -> {self.classe} ({self.matiere})"


class PresenceEmploye(TimeStampedModel):
    """Suivi des présences/absences du personnel."""
    STATUT_CHOICES = [
        ("present", "Présent"), ("absent", "Absent"),
        ("retard", "Retard"), ("conge", "Congé"), ("mission", "Mission"),
    ]
    employe = models.ForeignKey(Employe, on_delete=models.CASCADE, related_name="presences")
    date = models.DateField()
    statut = models.CharField(max_length=10, choices=STATUT_CHOICES, default="present")
    heure_arrivee = models.TimeField(null=True, blank=True)
    heure_depart = models.TimeField(null=True, blank=True)
    motif = models.CharField(max_length=255, blank=True)
    justifie = models.BooleanField(default=False)
    enregistre_par = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")

    class Meta:
        unique_together = ("employe", "date")
        ordering = ["-date"]
        verbose_name = "Présence employé"
        verbose_name_plural = "Présences employés"

    def __str__(self):
        return f"{self.employe} - {self.date} ({self.get_statut_display()})"


class DocumentPedagogique(TimeStampedModel):
    """Document pédagogique téléversé par un enseignant (fiche, support de cours...)."""
    enseignant = models.ForeignKey(Enseignant, on_delete=models.CASCADE, related_name="documents_pedagogiques")
    classe = models.ForeignKey("core.Classe", on_delete=models.SET_NULL, null=True, blank=True, related_name="documents_pedagogiques")
    matiere = models.ForeignKey("core.Matiere", on_delete=models.SET_NULL, null=True, blank=True, related_name="documents_pedagogiques")
    titre = models.CharField(max_length=200)
    fichier = models.FileField(upload_to="pedagogie/documents/")
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Document pédagogique"
        verbose_name_plural = "Documents pédagogiques"

    def __str__(self):
        return self.titre
