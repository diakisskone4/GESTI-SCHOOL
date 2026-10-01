from django.contrib import admin

from apps.finance.models import BaremeFrais, Bourse, FactureFrais, Paiement, TypeFrais


@admin.register(TypeFrais)
class TypeFraisAdmin(admin.ModelAdmin):
    list_display = ["nom", "etablissement", "periodicite", "obligatoire"]


@admin.register(BaremeFrais)
class BaremeFraisAdmin(admin.ModelAdmin):
    list_display = ["type_frais", "niveau", "annee_scolaire", "montant"]
    list_filter = ["annee_scolaire"]


@admin.register(Bourse)
class BourseAdmin(admin.ModelAdmin):
    list_display = ["inscription", "type_bourse", "pourcentage_reduction", "actif"]
    list_filter = ["type_bourse", "actif"]


@admin.register(FactureFrais)
class FactureFraisAdmin(admin.ModelAdmin):
    list_display = ["inscription", "type_frais", "montant_du", "montant_remise", "statut", "date_echeance"]
    list_filter = ["statut", "type_frais"]
    search_fields = ["inscription__eleve__nom", "inscription__eleve__matricule"]


@admin.register(Paiement)
class PaiementAdmin(admin.ModelAdmin):
    list_display = ["numero_recu", "facture", "montant", "mode_paiement", "date_paiement", "annule"]
    search_fields = ["numero_recu"]
    list_filter = ["mode_paiement", "annule"]
