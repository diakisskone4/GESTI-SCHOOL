from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


class TypeEvaluation(TimeStampedModel):
    """Type d'évaluation pondéré (devoir, composition, interrogation...)."""
    etablissement = models.ForeignKey("core.Etablissement", on_delete=models.CASCADE, related_name="types_evaluation")
    nom = models.CharField(max_length=60)
    ponderation = models.DecimalField(max_digits=4, decimal_places=2, default=1, help_text="Poids relatif dans la moyenne de la matière")

    class Meta:
        unique_together = ("etablissement", "nom")

    def __str__(self):
        return self.nom


class Note(TimeStampedModel):
    """Note d'un élève dans une matière, pour une évaluation et une période données."""
    inscription = models.ForeignKey("students.Inscription", on_delete=models.CASCADE, related_name="notes")
    matiere = models.ForeignKey("core.Matiere", on_delete=models.CASCADE, related_name="notes")
    periode = models.ForeignKey("core.Periode", on_delete=models.CASCADE, related_name="notes")
    type_evaluation = models.ForeignKey(TypeEvaluation, on_delete=models.SET_NULL, null=True, blank=True, related_name="notes")
    enseignant = models.ForeignKey("staff.Enseignant", on_delete=models.SET_NULL, null=True, blank=True, related_name="notes_saisies")
    valeur = models.DecimalField(max_digits=5, decimal_places=2)
    bareme = models.DecimalField(max_digits=5, decimal_places=2, default=20)
    date_evaluation = models.DateField(null=True, blank=True)
    observation = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-periode", "matiere"]
        verbose_name = "Note"
        verbose_name_plural = "Notes"

    def __str__(self):
        return f"{self.inscription.eleve} - {self.matiere} - {self.valeur}/{self.bareme}"

    @property
    def valeur_sur_20(self):
        if self.bareme and self.bareme != 20:
            return round(float(self.valeur) * 20 / float(self.bareme), 2)
        return float(self.valeur)


class MoyenneMatiere(TimeStampedModel):
    """Moyenne calculée d'un élève dans une matière pour une période (cache calculé)."""
    inscription = models.ForeignKey("students.Inscription", on_delete=models.CASCADE, related_name="moyennes_matieres")
    matiere = models.ForeignKey("core.Matiere", on_delete=models.CASCADE, related_name="moyennes")
    periode = models.ForeignKey("core.Periode", on_delete=models.CASCADE, related_name="moyennes_matieres")
    coefficient = models.DecimalField(max_digits=4, decimal_places=1, default=1)
    moyenne = models.DecimalField(max_digits=5, decimal_places=2)
    rang = models.PositiveIntegerField(null=True, blank=True)
    appreciation = models.CharField(max_length=100, blank=True)

    class Meta:
        unique_together = ("inscription", "matiere", "periode")
        verbose_name = "Moyenne par matière"
        verbose_name_plural = "Moyennes par matière"

    def __str__(self):
        return f"{self.inscription.eleve} - {self.matiere} - {self.moyenne}"


class Bulletin(TimeStampedModel):
    """Bulletin scolaire consolidé pour un élève et une période (format A5)."""
    inscription = models.ForeignKey("students.Inscription", on_delete=models.CASCADE, related_name="bulletins")
    periode = models.ForeignKey("core.Periode", on_delete=models.CASCADE, related_name="bulletins")
    moyenne_generale = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    rang = models.PositiveIntegerField(null=True, blank=True)
    effectif_classe = models.PositiveIntegerField(null=True, blank=True)
    appreciation_conseil = models.CharField(max_length=255, blank=True)
    mention = models.CharField(max_length=50, blank=True)
    fichier_pdf = models.FileField(upload_to="academique/bulletins/", blank=True, null=True)
    genere_le = models.DateTimeField(null=True, blank=True)
    valide = models.BooleanField(default=False)

    class Meta:
        unique_together = ("inscription", "periode")
        verbose_name = "Bulletin"
        verbose_name_plural = "Bulletins"

    def __str__(self):
        return f"Bulletin {self.inscription.eleve} - {self.periode}"


class TableauHonneur(TimeStampedModel):
    """Élève figurant au tableau d'honneur/excellence pour une période."""
    NIVEAU_CHOICES = [("honneur", "Tableau d'honneur"), ("excellence", "Tableau d'excellence")]

    inscription = models.ForeignKey("students.Inscription", on_delete=models.CASCADE, related_name="tableaux_honneur")
    periode = models.ForeignKey("core.Periode", on_delete=models.CASCADE, related_name="tableaux_honneur")
    niveau = models.CharField(max_length=12, choices=NIVEAU_CHOICES, default="honneur")
    moyenne = models.DecimalField(max_digits=5, decimal_places=2)
    rang_classe = models.PositiveIntegerField()

    class Meta:
        unique_together = ("inscription", "periode")
        verbose_name = "Tableau d'honneur/excellence"
        verbose_name_plural = "Tableaux d'honneur/excellence"

    def __str__(self):
        return f"{self.inscription.eleve} - {self.get_niveau_display()} ({self.periode})"


class Examen(TimeStampedModel):
    """Planification d'un examen : date, salle, surveillants."""
    STATUT_CHOICES = [("planifie", "Planifié"), ("en_cours", "En cours"), ("termine", "Terminé"), ("annule", "Annulé")]

    etablissement = models.ForeignKey("core.Etablissement", on_delete=models.CASCADE, related_name="examens")
    nom = models.CharField(max_length=150)
    classe = models.ForeignKey("core.Classe", on_delete=models.CASCADE, related_name="examens")
    matiere = models.ForeignKey("core.Matiere", on_delete=models.CASCADE, related_name="examens")
    periode = models.ForeignKey("core.Periode", on_delete=models.CASCADE, related_name="examens")
    date_examen = models.DateField()
    heure_debut = models.TimeField()
    heure_fin = models.TimeField()
    salle = models.CharField(max_length=50, blank=True)
    surveillants = models.ManyToManyField("staff.Enseignant", related_name="examens_surveilles", blank=True)
    statut = models.CharField(max_length=15, choices=STATUT_CHOICES, default="planifie")

    class Meta:
        ordering = ["date_examen", "heure_debut"]
        verbose_name = "Examen"
        verbose_name_plural = "Examens"

    def __str__(self):
        return f"{self.nom} - {self.classe} ({self.date_examen})"
