from rest_framework import serializers

from apps.academics.models import Bulletin, Evaluation, Examen, MoyenneMatiere, Note, TableauHonneur, TypeEvaluation


class TypeEvaluationSerializer(serializers.ModelSerializer):
    class Meta:
        model = TypeEvaluation
        fields = "__all__"


class EvaluationSerializer(serializers.ModelSerializer):
    type_nom = serializers.CharField(source="type_evaluation.nom", read_only=True)
    ponderation = serializers.DecimalField(source="type_evaluation.ponderation", max_digits=4, decimal_places=2, read_only=True)
    matiere_nom = serializers.CharField(source="matiere.nom", read_only=True)
    nb_notes = serializers.IntegerField(source="notes.count", read_only=True)

    class Meta:
        model = Evaluation
        fields = "__all__"
        read_only_fields = ["enseignant"]

    def validate(self, attrs):
        classe = attrs.get("classe") or self.instance.classe
        periode = attrs.get("periode") or self.instance.periode
        type_eval = attrs.get("type_evaluation") or self.instance.type_evaluation
        if periode.annee_scolaire_id != classe.annee_scolaire_id:
            raise serializers.ValidationError({"periode": "Cette période n'appartient pas à l'année scolaire de la classe."})
        if type_eval.etablissement_id != classe.etablissement_id:
            raise serializers.ValidationError({"type_evaluation": "Ce type d'évaluation appartient à un autre établissement."})
        bareme = attrs.get("bareme")
        if bareme is not None and bareme <= 0:
            raise serializers.ValidationError({"bareme": "Le barème doit être supérieur à 0."})
        return attrs


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
