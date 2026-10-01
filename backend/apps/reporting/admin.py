from django.contrib import admin

from apps.reporting.models import RapportGenere


@admin.register(RapportGenere)
class RapportGenereAdmin(admin.ModelAdmin):
    list_display = ["titre", "type_rapport", "format_export", "etablissement", "created_at"]
    list_filter = ["type_rapport", "format_export"]
