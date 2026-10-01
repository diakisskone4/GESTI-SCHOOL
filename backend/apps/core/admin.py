from django.contrib import admin

from apps.core.models import (
    AnneeScolaire,
    Classe,
    CreneauEmploiDuTemps,
    Etablissement,
    JournalActivite,
    Matiere,
    Niveau,
    Periode,
    Serie,
)


@admin.register(Etablissement)
class EtablissementAdmin(admin.ModelAdmin):
    list_display = ["nom", "sigle", "type_etablissement", "ville", "actif"]
    search_fields = ["nom", "sigle"]
    list_filter = ["actif", "type_etablissement"]


@admin.register(AnneeScolaire)
class AnneeScolaireAdmin(admin.ModelAdmin):
    list_display = ["libelle", "etablissement", "date_debut", "date_fin", "est_courante"]
    list_filter = ["etablissement", "est_courante"]


@admin.register(Periode)
class PeriodeAdmin(admin.ModelAdmin):
    list_display = ["libelle", "annee_scolaire", "date_debut", "date_fin", "est_courante", "cloturee"]
    list_filter = ["annee_scolaire", "type_periode", "est_courante", "cloturee"]


@admin.register(Niveau)
class NiveauAdmin(admin.ModelAdmin):
    list_display = ["nom", "etablissement", "cycle", "ordre"]
    list_filter = ["etablissement", "cycle"]


@admin.register(Serie)
class SerieAdmin(admin.ModelAdmin):
    list_display = ["nom", "niveau", "code"]


@admin.register(Classe)
class ClasseAdmin(admin.ModelAdmin):
    list_display = ["nom", "niveau", "annee_scolaire", "professeur_principal", "effectif_actuel"]
    list_filter = ["annee_scolaire", "niveau"]
    search_fields = ["nom"]


@admin.register(Matiere)
class MatiereAdmin(admin.ModelAdmin):
    list_display = ["nom", "code", "etablissement", "coefficient_defaut"]
    search_fields = ["nom", "code"]


@admin.register(CreneauEmploiDuTemps)
class CreneauEmploiDuTempsAdmin(admin.ModelAdmin):
    list_display = ["classe", "matiere", "enseignant", "jour", "heure_debut", "heure_fin"]
    list_filter = ["jour", "classe"]


@admin.register(JournalActivite)
class JournalActiviteAdmin(admin.ModelAdmin):
    list_display = ["horodatage", "utilisateur", "action", "modele"]
    list_filter = ["action"]
    search_fields = ["description", "modele"]
    readonly_fields = [f.name for f in JournalActivite._meta.fields]

    def has_add_permission(self, request):
        return False
