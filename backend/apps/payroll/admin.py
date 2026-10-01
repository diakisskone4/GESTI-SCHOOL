from django.contrib import admin

from apps.payroll.models import Avance, BulletinPaie, ContratSalaire, ElementSalaire, LigneBulletinPaie


@admin.register(ElementSalaire)
class ElementSalaireAdmin(admin.ModelAdmin):
    list_display = ["nom", "nature", "etablissement", "imposable"]
    list_filter = ["nature"]


@admin.register(ContratSalaire)
class ContratSalaireAdmin(admin.ModelAdmin):
    list_display = ["employe", "salaire_base", "date_effet"]


class LigneBulletinPaieInline(admin.TabularInline):
    model = LigneBulletinPaie
    extra = 1


@admin.register(BulletinPaie)
class BulletinPaieAdmin(admin.ModelAdmin):
    list_display = ["employe", "mois", "annee", "salaire_brut", "net_a_payer", "statut"]
    list_filter = ["mois", "annee", "statut"]
    inlines = [LigneBulletinPaieInline]


@admin.register(Avance)
class AvanceAdmin(admin.ModelAdmin):
    list_display = ["employe", "montant", "montant_rembourse", "statut"]
    list_filter = ["statut"]
