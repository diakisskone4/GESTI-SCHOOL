from rest_framework import serializers

from apps.communication.models import Annonce, Message, Notification


class MessageSerializer(serializers.ModelSerializer):
    expediteur_nom = serializers.SerializerMethodField()
    destinataire_nom = serializers.SerializerMethodField()
    expediteur_email = serializers.CharField(source="expediteur.email", read_only=True)
    destinataire_email = serializers.CharField(source="destinataire.email", read_only=True)
    expediteur_role = serializers.CharField(source="expediteur.role", read_only=True)
    destinataire_role = serializers.CharField(source="destinataire.role", read_only=True)
    expediteur_role_label = serializers.CharField(source="expediteur.get_role_display", read_only=True)
    destinataire_role_label = serializers.CharField(source="destinataire.get_role_display", read_only=True)

    class Meta:
        model = Message
        fields = "__all__"
        read_only_fields = ["id", "expediteur", "lu", "lu_le"]

    def get_expediteur_nom(self, obj):
        return obj.expediteur.get_full_name() or obj.expediteur.email

    def get_destinataire_nom(self, obj):
        return obj.destinataire.get_full_name() or obj.destinataire.email

    def validate_destinataire(self, value):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user and user.is_authenticated and not user.est_admin:
            if user.etablissement_courant_id and not value.etablissements.filter(pk=user.etablissement_courant_id).exists():
                raise serializers.ValidationError("Le destinataire doit appartenir à votre établissement.")
        if user and user.is_authenticated and value.pk == user.pk:
            raise serializers.ValidationError("Vous ne pouvez pas vous envoyer un message à vous-même.")
        return value


class AnnonceSerializer(serializers.ModelSerializer):
    auteur_nom = serializers.CharField(source="auteur.get_full_name", read_only=True)

    class Meta:
        model = Annonce
        fields = "__all__"
        read_only_fields = ["id", "auteur", "date_publication"]


class NotificationSerializer(serializers.ModelSerializer):
    type_label = serializers.CharField(source="get_type_notification_display", read_only=True)

    class Meta:
        model = Notification
        fields = "__all__"
        read_only_fields = ["statut", "envoyee_le", "erreur"]
