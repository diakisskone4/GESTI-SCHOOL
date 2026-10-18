from django.contrib import admin

from apps.plateforme.models import Abonnement


@admin.register(Abonnement)
class AbonnementAdmin(admin.ModelAdmin):
    list_display = ["etablissement", "duree_mois", "date_debut", "date_fin", "actif"]
    list_filter = ["actif", "duree_mois"]
    search_fields = ["etablissement__nom", "etablissement__sigle"]
