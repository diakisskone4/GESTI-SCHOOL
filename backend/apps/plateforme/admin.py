from django.contrib import admin

from apps.plateforme.models import Abonnement, DemandeDemo, JournalConsole


@admin.register(Abonnement)
class AbonnementAdmin(admin.ModelAdmin):
    list_display = ["etablissement", "duree_mois", "date_debut", "date_fin", "actif"]
    list_filter = ["actif", "duree_mois"]
    search_fields = ["etablissement__nom", "etablissement__sigle"]


@admin.register(JournalConsole)
class JournalConsoleAdmin(admin.ModelAdmin):
    list_display = ["horodatage", "auteur", "action", "etablissement_nom", "details"]
    list_filter = ["action"]
    search_fields = ["etablissement_nom", "details"]


@admin.register(DemandeDemo)
class DemandeDemoAdmin(admin.ModelAdmin):
    list_display = ["cree_le", "etablissement", "nom", "telephone", "ville", "statut"]
    list_filter = ["statut"]
    search_fields = ["etablissement", "nom", "telephone", "email"]
