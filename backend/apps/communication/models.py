import uuid
from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


class Message(TimeStampedModel):
    """Message de messagerie interne entre administration, enseignants et parents/élèves."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    expediteur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="messages_envoyes")
    destinataire = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="messages_recus")
    objet = models.CharField(max_length=200, blank=True)
    contenu = models.TextField()
    piece_jointe = models.FileField(upload_to="communication/pieces_jointes/", blank=True, null=True)
    lu = models.BooleanField(default=False)
    lu_le = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Message"
        verbose_name_plural = "Messages"

    def __str__(self):
        return f"{self.expediteur} -> {self.destinataire}: {self.objet or self.contenu[:30]}"


class Annonce(TimeStampedModel):
    """Annonce publiée par un enseignant ou l'administration."""
    PUBLIC_CHOICES = [
        ("tous", "Tout le monde"), ("enseignants", "Enseignants"),
        ("eleves", "Élèves"), ("parents", "Parents"), ("classe", "Une classe spécifique"),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    etablissement = models.ForeignKey("core.Etablissement", on_delete=models.CASCADE, related_name="annonces")
    auteur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="annonces_publiees")
    titre = models.CharField(max_length=200)
    contenu = models.TextField()
    public_cible = models.CharField(max_length=15, choices=PUBLIC_CHOICES, default="tous")
    classe = models.ForeignKey("core.Classe", on_delete=models.CASCADE, null=True, blank=True, related_name="annonces")
    piece_jointe = models.FileField(upload_to="communication/annonces/", blank=True, null=True)
    date_publication = models.DateTimeField(auto_now_add=True)
    date_expiration = models.DateTimeField(null=True, blank=True)
    epinglee = models.BooleanField(default=False)

    class Meta:
        ordering = ["-epinglee", "-date_publication"]
        verbose_name = "Annonce"
        verbose_name_plural = "Annonces"

    def __str__(self):
        return self.titre


class Notification(TimeStampedModel):
    """Notification envoyée à un utilisateur (SMS/Email/interne)."""
    CANAL_CHOICES = [("sms", "SMS"), ("email", "Email"), ("interne", "Notification interne")]
    TYPE_CHOICES = [
        ("resultat", "Résultat scolaire"), ("absence", "Absence"),
        ("convocation", "Convocation"), ("paiement", "Paiement"),
        ("annonce", "Annonce"), ("message", "Message"), ("autre", "Autre"),
    ]
    STATUT_CHOICES = [("en_attente", "En attente"), ("envoyee", "Envoyée"), ("echec", "Échec")]

    destinataire = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    canal = models.CharField(max_length=10, choices=CANAL_CHOICES, default="interne")
    type_notification = models.CharField(max_length=15, choices=TYPE_CHOICES, default="autre")
    titre = models.CharField(max_length=200, blank=True)
    contenu = models.TextField()
    statut = models.CharField(max_length=12, choices=STATUT_CHOICES, default="en_attente")
    lu = models.BooleanField(default=False)
    envoyee_le = models.DateTimeField(null=True, blank=True)
    erreur = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Notification"
        verbose_name_plural = "Notifications"

    def __str__(self):
        return f"{self.get_canal_display()} -> {self.destinataire} : {self.titre or self.contenu[:30]}"
