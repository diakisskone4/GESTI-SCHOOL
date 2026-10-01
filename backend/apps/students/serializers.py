from rest_framework import serializers

from apps.students.models import Absence, CarteScolaire, Eleve, Inscription, SanctionRecompense


class EleveSerializer(serializers.ModelSerializer):
    nom_complet = serializers.SerializerMethodField()
    classe_actuelle = serializers.SerializerMethodField()

    class Meta:
        model = Eleve
        fields = "__all__"
        read_only_fields = ["id"]

    def get_nom_complet(self, obj):
        return f"{obj.prenom} {obj.nom}"

    def get_classe_actuelle(self, obj):
        insc = obj.inscription_courante
        return insc.classe.nom if insc else None


class InscriptionSerializer(serializers.ModelSerializer):
    eleve_nom = serializers.CharField(source="eleve.__str__", read_only=True)
    classe_nom = serializers.CharField(source="classe.nom", read_only=True)

    class Meta:
        model = Inscription
        fields = "__all__"
        read_only_fields = ["id", "date_inscription"]


class AbsenceSerializer(serializers.ModelSerializer):
    eleve_nom = serializers.CharField(source="inscription.eleve.__str__", read_only=True)

    class Meta:
        model = Absence
        fields = "__all__"


class SanctionRecompenseSerializer(serializers.ModelSerializer):
    eleve_nom = serializers.CharField(source="inscription.eleve.__str__", read_only=True)

    class Meta:
        model = SanctionRecompense
        fields = "__all__"


class CarteScolaireSerializer(serializers.ModelSerializer):
    eleve_id = serializers.CharField(source="inscription.eleve.id", read_only=True)
    eleve_nom = serializers.CharField(source="inscription.eleve.__str__", read_only=True)
    eleve_matricule = serializers.CharField(source="inscription.eleve.matricule", read_only=True)
    classe_nom = serializers.CharField(source="inscription.classe.nom", read_only=True)
    annee_scolaire_libelle = serializers.CharField(source="inscription.annee_scolaire.libelle", read_only=True)

    class Meta:
        model = CarteScolaire
        fields = "__all__"
        read_only_fields = ["id", "numero_carte", "date_emission", "fichier_pdf", "qr_code_data"]
