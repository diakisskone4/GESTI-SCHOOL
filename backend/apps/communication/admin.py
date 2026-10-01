from django.contrib import admin

from apps.communication.models import Annonce, Message, Notification


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ["expediteur", "destinataire", "objet", "lu", "created_at"]
    search_fields = ["objet", "contenu"]


@admin.register(Annonce)
class AnnonceAdmin(admin.ModelAdmin):
    list_display = ["titre", "auteur", "public_cible", "date_publication", "epinglee"]
    list_filter = ["public_cible", "epinglee"]
    search_fields = ["titre", "contenu"]


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ["destinataire", "canal", "type_notification", "statut", "created_at"]
    list_filter = ["canal", "type_notification", "statut"]
