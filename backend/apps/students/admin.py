from django.contrib import admin

from apps.students.models import Absence, CarteScolaire, Eleve, Inscription, SanctionRecompense


@admin.register(Eleve)
class EleveAdmin(admin.ModelAdmin):
    list_display = ["matricule", "nom", "prenom", "sexe", "date_naissance", "etablissement", "actif"]
    search_fields = ["matricule", "nom", "prenom"]
    list_filter = ["etablissement", "sexe", "actif"]


@admin.register(Inscription)
class InscriptionAdmin(admin.ModelAdmin):
    list_display = ["eleve", "classe", "annee_scolaire", "statut", "redoublant", "boursier"]
    list_filter = ["annee_scolaire", "statut", "redoublant", "boursier"]
    search_fields = ["eleve__nom", "eleve__prenom", "eleve__matricule"]


@admin.register(Absence)
class AbsenceAdmin(admin.ModelAdmin):
    list_display = ["inscription", "date", "type_evenement", "justifiee"]
    list_filter = ["type_evenement", "justifiee", "date"]


@admin.register(SanctionRecompense)
class SanctionRecompenseAdmin(admin.ModelAdmin):
    list_display = ["inscription", "nature", "date", "periode"]
    list_filter = ["nature", "periode"]


@admin.register(CarteScolaire)
class CarteScolaireAdmin(admin.ModelAdmin):
    list_display = ["numero_carte", "inscription", "date_emission"]
    search_fields = ["numero_carte"]
