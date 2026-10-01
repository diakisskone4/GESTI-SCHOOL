from rest_framework import serializers

from apps.documents_mgmt.models import DocumentGenere


class DocumentGenereSerializer(serializers.ModelSerializer):
    eleve_nom = serializers.SerializerMethodField()
    employe_nom = serializers.SerializerMethodField()

    class Meta:
        model = DocumentGenere
        fields = "__all__"
        read_only_fields = ["id", "reference", "fichier_pdf", "genere_par"]

    def get_eleve_nom(self, obj):
        return str(obj.eleve) if obj.eleve else None

    def get_employe_nom(self, obj):
        return str(obj.employe) if obj.employe else None

    def validate(self, attrs):
        type_document = attrs.get("type_document", getattr(self.instance, "type_document", None))
        eleve = attrs.get("eleve", getattr(self.instance, "eleve", None))
        employe = attrs.get("employe", getattr(self.instance, "employe", None))
        types_eleve = dict(DocumentGenere.TYPES_ELEVE)
        types_employe = dict(DocumentGenere.TYPES_EMPLOYE)
        if type_document in types_eleve and not eleve:
            raise serializers.ValidationError({"eleve": "Ce type de document doit être associé à un élève."})
        if type_document in types_employe and type_document != "attestation_fin_stage" and not employe:
            raise serializers.ValidationError({"employe": "Ce type de document doit être associé à un employé."})
        return attrs
