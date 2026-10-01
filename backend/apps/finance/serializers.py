from rest_framework import serializers

from apps.finance.models import BaremeFrais, Bourse, FactureFrais, Paiement, TypeFrais


class TypeFraisSerializer(serializers.ModelSerializer):
    class Meta:
        model = TypeFrais
        fields = "__all__"


class BaremeFraisSerializer(serializers.ModelSerializer):
    type_frais_nom = serializers.CharField(source="type_frais.nom", read_only=True)
    niveau_nom = serializers.CharField(source="niveau.nom", read_only=True)

    class Meta:
        model = BaremeFrais
        fields = "__all__"


class BourseSerializer(serializers.ModelSerializer):
    eleve_nom = serializers.CharField(source="inscription.eleve.__str__", read_only=True)

    class Meta:
        model = Bourse
        fields = "__all__"


class PaiementSerializer(serializers.ModelSerializer):
    eleve_nom = serializers.CharField(source="facture.inscription.eleve.__str__", read_only=True)
    libelle = serializers.CharField(read_only=True)

    class Meta:
        model = Paiement
        fields = "__all__"
        read_only_fields = ["id", "numero_recu", "recu_pdf", "encaisse_par"]


class FactureFraisSerializer(serializers.ModelSerializer):
    eleve_nom = serializers.CharField(source="inscription.eleve.__str__", read_only=True)
    montant_net = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    montant_paye = serializers.SerializerMethodField()
    solde = serializers.SerializerMethodField()
    paiements = PaiementSerializer(many=True, read_only=True)

    class Meta:
        model = FactureFrais
        fields = "__all__"
        read_only_fields = ["id", "statut"]

    def get_montant_paye(self, obj):
        return float(obj.montant_paye)

    def get_solde(self, obj):
        return float(obj.solde)
