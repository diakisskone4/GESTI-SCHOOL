import uuid
from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("L'email est obligatoire")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", User.Role.ADMIN)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Le superutilisateur doit avoir is_staff=True")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Le superutilisateur doit avoir is_superuser=True")
        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    """Utilisateur central de la plateforme, avec rôle métier.

    L'authentification se fait par email. Le username reste disponible
    pour compatibilité avec l'admin Django mais n'est pas utilisé pour la connexion.
    """

    class Role(models.TextChoices):
        SUPERADMIN = "superadmin", "Super Administrateur"
        ADMIN = "admin", "Administrateur d'établissement"
        ENSEIGNANT = "enseignant", "Enseignant"
        ELEVE = "eleve", "Élève"
        PARENT = "parent", "Parent"
        COMPTABLE = "comptable", "Comptable / Caissier"
        SURVEILLANT = "surveillant", "Surveillant général"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    username = models.CharField(max_length=150, unique=True, blank=True, null=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.ELEVE)
    telephone = models.CharField(max_length=30, blank=True)
    photo = models.ImageField(upload_to="users/photos/", blank=True, null=True)
    etablissements = models.ManyToManyField(
        "core.Etablissement", related_name="utilisateurs", blank=True,
        help_text="Établissements auxquels l'utilisateur a accès (multi-établissements)",
    )
    etablissement_courant = models.ForeignKey(
        "core.Etablissement", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    doit_changer_mot_de_passe = models.BooleanField(default=False)
    deux_facteurs_actif = models.BooleanField(default=False)
    langue_preferee = models.CharField(max_length=5, default="fr")
    date_derniere_activite = models.DateTimeField(null=True, blank=True)
    est_actif_compte = models.BooleanField(default=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    objects = UserManager()

    class Meta:
        ordering = ["last_name", "first_name"]
        verbose_name = "Utilisateur"
        verbose_name_plural = "Utilisateurs"
        constraints = [
            # Dernier rempart contre les doublons (les formulaires vérifient avant, avec un message clair)
            models.UniqueConstraint(Lower("email"), name="utilisateur_email_unique_insensible_casse"),
            models.UniqueConstraint(fields=["telephone"], condition=~Q(telephone=""), name="utilisateur_telephone_unique"),
        ]

    def get_full_name(self):
        full = super().get_full_name().strip()
        if full:
            return full
        if hasattr(self, "profil_employe") and self.profil_employe:
            nom_emp = f"{self.profil_employe.prenom} {self.profil_employe.nom}".strip()
            if nom_emp:
                return nom_emp
        if hasattr(self, "profil_eleve") and self.profil_eleve:
            nom_el = f"{self.profil_eleve.prenom} {self.profil_eleve.nom}".strip()
            if nom_el:
                return nom_el
        if self.email:
            return self.email.split("@")[0]
        return self.username or "Utilisateur"

    def __str__(self):
        return f"{self.get_full_name()} ({self.get_role_display()})"

    def save(self, *args, **kwargs):
        from apps.accounts.doublons import nettoyer_telephone

        self.telephone = nettoyer_telephone(self.telephone)
        if not self.username:
            self.username = self.email
        super().save(*args, **kwargs)

    @property
    def est_admin(self):
        return self.role in (self.Role.ADMIN, self.Role.SUPERADMIN) or self.is_superuser

    @property
    def est_enseignant(self):
        return self.role == self.Role.ENSEIGNANT

    @property
    def est_eleve(self):
        return self.role == self.Role.ELEVE

    @property
    def est_parent(self):
        return self.role == self.Role.PARENT

    @property
    def est_comptable(self):
        return self.role == self.Role.COMPTABLE

    @property
    def est_surveillant(self):
        return self.role == self.Role.SURVEILLANT


class LienParentEleve(models.Model):
    """Relation entre un compte parent et un ou plusieurs élèves."""
    RELATION_CHOICES = [
        ("pere", "Père"), ("mere", "Mère"), ("tuteur", "Tuteur/Tutrice"), ("autre", "Autre"),
    ]
    parent = models.ForeignKey(User, on_delete=models.CASCADE, related_name="enfants_lies", limit_choices_to={"role": User.Role.PARENT})
    eleve = models.ForeignKey("students.Eleve", on_delete=models.CASCADE, related_name="parents_lies")
    relation = models.CharField(max_length=10, choices=RELATION_CHOICES, default="tuteur")
    est_contact_principal = models.BooleanField(default=False)

    class Meta:
        unique_together = ("parent", "eleve")
        verbose_name = "Lien parent-élève"
        verbose_name_plural = "Liens parents-élèves"

    def __str__(self):
        return f"{self.parent} - {self.eleve} ({self.get_relation_display()})"
