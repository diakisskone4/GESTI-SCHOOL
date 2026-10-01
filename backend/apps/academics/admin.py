from django.contrib import admin

from apps.academics.models import Bulletin, Examen, MoyenneMatiere, Note, TableauHonneur, TypeEvaluation


@admin.register(TypeEvaluation)
class TypeEvaluationAdmin(admin.ModelAdmin):
    list_display = ["nom", "etablissement", "ponderation"]


@admin.register(Note)
class NoteAdmin(admin.ModelAdmin):
    list_display = ["inscription", "matiere", "periode", "valeur", "bareme", "enseignant"]
    list_filter = ["periode", "matiere"]
    search_fields = ["inscription__eleve__nom", "inscription__eleve__prenom"]


@admin.register(MoyenneMatiere)
class MoyenneMatiereAdmin(admin.ModelAdmin):
    list_display = ["inscription", "matiere", "periode", "moyenne", "rang"]
    list_filter = ["periode", "matiere"]


@admin.register(Bulletin)
class BulletinAdmin(admin.ModelAdmin):
    list_display = ["inscription", "periode", "moyenne_generale", "rang", "mention", "valide"]
    list_filter = ["periode", "valide", "mention"]


@admin.register(TableauHonneur)
class TableauHonneurAdmin(admin.ModelAdmin):
    list_display = ["inscription", "periode", "niveau", "moyenne", "rang_classe"]
    list_filter = ["periode", "niveau"]


@admin.register(Examen)
class ExamenAdmin(admin.ModelAdmin):
    list_display = ["nom", "classe", "matiere", "date_examen", "salle", "statut"]
    list_filter = ["statut", "periode"]
    filter_horizontal = ["surveillants"]
