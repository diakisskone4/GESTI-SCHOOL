from django.contrib import admin

from apps.staff.models import Affectation, DocumentPedagogique, Employe, Enseignant, PresenceEmploye


@admin.register(Employe)
class EmployeAdmin(admin.ModelAdmin):
    list_display = ["matricule", "nom", "prenom", "type_employe", "etablissement", "actif"]
    search_fields = ["matricule", "nom", "prenom"]
    list_filter = ["type_employe", "etablissement", "actif"]


@admin.register(Enseignant)
class EnseignantAdmin(admin.ModelAdmin):
    list_display = ["matricule", "nom", "prenom", "grade_academique", "etablissement", "actif"]
    search_fields = ["matricule", "nom", "prenom"]
    filter_horizontal = ["matieres_enseignees"]


@admin.register(Affectation)
class AffectationAdmin(admin.ModelAdmin):
    list_display = ["enseignant", "classe", "matiere", "annee_scolaire", "actif"]
    list_filter = ["annee_scolaire", "actif"]


@admin.register(PresenceEmploye)
class PresenceEmployeAdmin(admin.ModelAdmin):
    list_display = ["employe", "date", "statut", "justifie"]
    list_filter = ["statut", "justifie", "date"]


@admin.register(DocumentPedagogique)
class DocumentPedagogiqueAdmin(admin.ModelAdmin):
    list_display = ["titre", "enseignant", "classe", "matiere", "created_at"]
    search_fields = ["titre"]
