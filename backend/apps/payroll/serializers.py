from rest_framework import serializers

from apps.payroll.models import Avance, BulletinPaie, ContratSalaire, ElementSalaire, LigneBulletinPaie


class ElementSalaireSerializer(serializers.ModelSerializer):
    class Meta:
        model = ElementSalaire
        fields = "__all__"


class ContratSalaireSerializer(serializers.ModelSerializer):
    employe_nom = serializers.CharField(source="employe.__str__", read_only=True)

    class Meta:
        model = ContratSalaire
        fields = "__all__"


class LigneBulletinPaieSerializer(serializers.ModelSerializer):
    element_nom = serializers.CharField(source="element.nom", read_only=True)
    element_nature = serializers.CharField(source="element.nature", read_only=True)

    class Meta:
        model = LigneBulletinPaie
        fields = "__all__"


class BulletinPaieSerializer(serializers.ModelSerializer):
    employe_nom = serializers.CharField(source="employe.__str__", read_only=True)
    lignes = LigneBulletinPaieSerializer(many=True, read_only=True)

    class Meta:
        model = BulletinPaie
        fields = "__all__"
        read_only_fields = [
            "id", "salaire_brut", "net_a_payer", "total_primes", "total_indemnites",
            "total_heures_sup", "total_retenues", "fichier_pdf", "genere_par",
        ]


class AvanceSerializer(serializers.ModelSerializer):
    employe_nom = serializers.CharField(source="employe.__str__", read_only=True)
    solde_restant = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Avance
        fields = "__all__"
