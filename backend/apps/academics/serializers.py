from rest_framework import serializers

from apps.academics.models import Bulletin, Examen, MoyenneMatiere, Note, TableauHonneur, TypeEvaluation


class TypeEvaluationSerializer(serializers.ModelSerializer):
    class Meta:
        model = TypeEvaluation
        fields = "__all__"


class NoteSerializer(serializers.ModelSerializer):
    eleve_nom = serializers.CharField(source="inscription.eleve.__str__", read_only=True)
    matiere_nom = serializers.CharField(source="matiere.nom", read_only=True)
    valeur_sur_20 = serializers.FloatField(read_only=True)

    class Meta:
        model = Note
        fields = "__all__"


class MoyenneMatiereSerializer(serializers.ModelSerializer):
    matiere_nom = serializers.CharField(source="matiere.nom", read_only=True)
    eleve_nom = serializers.CharField(source="inscription.eleve.__str__", read_only=True)

    class Meta:
        model = MoyenneMatiere
        fields = "__all__"


class BulletinSerializer(serializers.ModelSerializer):
    eleve_nom = serializers.CharField(source="inscription.eleve.__str__", read_only=True)
    classe_nom = serializers.CharField(source="inscription.classe.nom", read_only=True)
    periode_libelle = serializers.CharField(source="periode.libelle", read_only=True)
    moyennes_matieres = serializers.SerializerMethodField()

    class Meta:
        model = Bulletin
        fields = "__all__"
        read_only_fields = ["fichier_pdf", "genere_le"]

    def get_moyennes_matieres(self, obj):
        moyennes = MoyenneMatiere.objects.filter(inscription=obj.inscription, periode=obj.periode).select_related("matiere")
        return MoyenneMatiereSerializer(moyennes, many=True).data


class TableauHonneurSerializer(serializers.ModelSerializer):
    eleve_nom = serializers.CharField(source="inscription.eleve.__str__", read_only=True)
    classe_nom = serializers.CharField(source="inscription.classe.nom", read_only=True)

    class Meta:
        model = TableauHonneur
        fields = "__all__"


class ExamenSerializer(serializers.ModelSerializer):
    classe_nom = serializers.CharField(source="classe.nom", read_only=True)
    matiere_nom = serializers.CharField(source="matiere.nom", read_only=True)

    class Meta:
        model = Examen
        fields = "__all__"
