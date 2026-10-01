from rest_framework import serializers

from apps.staff.models import Affectation, DocumentPedagogique, Employe, Enseignant, PresenceEmploye


class EmployeSerializer(serializers.ModelSerializer):
    nom_complet = serializers.SerializerMethodField()

    class Meta:
        model = Employe
        fields = "__all__"
        read_only_fields = ["id", "matricule"]

    def get_nom_complet(self, obj):
        return f"{obj.prenom} {obj.nom}"


class EnseignantSerializer(serializers.ModelSerializer):
    nom_complet = serializers.SerializerMethodField()
    matieres_enseignees_noms = serializers.StringRelatedField(source="matieres_enseignees", many=True, read_only=True)

    class Meta:
        model = Enseignant
        fields = "__all__"
        read_only_fields = ["id", "matricule"]

    def get_nom_complet(self, obj):
        return f"{obj.prenom} {obj.nom}"


class AffectationSerializer(serializers.ModelSerializer):
    enseignant_nom = serializers.CharField(source="enseignant.__str__", read_only=True)
    classe_nom = serializers.CharField(source="classe.nom", read_only=True)
    matiere_nom = serializers.CharField(source="matiere.nom", read_only=True)

    class Meta:
        model = Affectation
        fields = "__all__"


class PresenceEmployeSerializer(serializers.ModelSerializer):
    employe_nom = serializers.CharField(source="employe.__str__", read_only=True)

    class Meta:
        model = PresenceEmploye
        fields = "__all__"


class DocumentPedagogiqueSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentPedagogique
        fields = "__all__"
