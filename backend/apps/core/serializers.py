from rest_framework import serializers

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


class EtablissementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Etablissement
        fields = "__all__"


class AnneeScolaireSerializer(serializers.ModelSerializer):
    etablissement_nom = serializers.CharField(source="etablissement.nom", read_only=True)
    etablissement_sigle = serializers.CharField(source="etablissement.sigle", read_only=True)
    nb_periodes = serializers.IntegerField(source="periodes.count", read_only=True)

    class Meta:
        model = AnneeScolaire
        fields = "__all__"


class PeriodeSerializer(serializers.ModelSerializer):
    annee_scolaire_libelle = serializers.CharField(source="annee_scolaire.libelle", read_only=True)
    etablissement_nom = serializers.CharField(source="annee_scolaire.etablissement.nom", read_only=True)
    type_periode_display = serializers.CharField(source="get_type_periode_display", read_only=True)

    class Meta:
        model = Periode
        fields = "__all__"


class NiveauSerializer(serializers.ModelSerializer):
    class Meta:
        model = Niveau
        fields = "__all__"


class SerieSerializer(serializers.ModelSerializer):
    class Meta:
        model = Serie
        fields = "__all__"


class ClasseSerializer(serializers.ModelSerializer):
    effectif_actuel = serializers.IntegerField(read_only=True)
    niveau_nom = serializers.CharField(source="niveau.nom", read_only=True)
    serie_nom = serializers.CharField(source="serie.nom", read_only=True)
    annee_scolaire_libelle = serializers.CharField(source="annee_scolaire.libelle", read_only=True)
    professeur_principal_nom = serializers.SerializerMethodField()

    class Meta:
        model = Classe
        fields = "__all__"

    def get_professeur_principal_nom(self, obj):
        return str(obj.professeur_principal) if obj.professeur_principal else None


class MatiereSerializer(serializers.ModelSerializer):
    class Meta:
        model = Matiere
        fields = "__all__"


class CreneauEmploiDuTempsSerializer(serializers.ModelSerializer):
    classe_nom = serializers.CharField(source="classe.nom", read_only=True)
    matiere_nom = serializers.CharField(source="matiere.nom", read_only=True)
    matiere_code = serializers.CharField(source="matiere.code", read_only=True)
    enseignant_nom = serializers.SerializerMethodField()
    jour_label = serializers.CharField(source="get_jour_display", read_only=True)

    class Meta:
        model = CreneauEmploiDuTemps
        fields = "__all__"

    def get_enseignant_nom(self, obj):
        return str(obj.enseignant) if obj.enseignant else None


class JournalActiviteSerializer(serializers.ModelSerializer):
    utilisateur_nom = serializers.CharField(source="utilisateur.get_full_name", read_only=True)

    class Meta:
        model = JournalActivite
        fields = "__all__"
        read_only_fields = fields
