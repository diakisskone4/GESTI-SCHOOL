from rest_framework import serializers

from apps.reporting.models import RapportGenere


class RapportGenereSerializer(serializers.ModelSerializer):
    class Meta:
        model = RapportGenere
        fields = "__all__"
        read_only_fields = ["fichier", "genere_par"]
