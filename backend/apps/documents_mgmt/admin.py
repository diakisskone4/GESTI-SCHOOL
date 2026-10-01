from django.contrib import admin

from apps.documents_mgmt.models import DocumentGenere


@admin.register(DocumentGenere)
class DocumentGenereAdmin(admin.ModelAdmin):
    list_display = ["reference", "type_document", "eleve", "employe", "created_at"]
    list_filter = ["type_document"]
    search_fields = ["reference", "objet"]
