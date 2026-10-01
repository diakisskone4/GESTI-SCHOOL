from django.contrib.auth import password_validation
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.accounts.models import LienParentEleve, User


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source="get_full_name", read_only=True)
    est_admin = serializers.BooleanField(read_only=True)
    est_enseignant = serializers.BooleanField(read_only=True)
    est_eleve = serializers.BooleanField(read_only=True)
    est_parent = serializers.BooleanField(read_only=True)
    est_comptable = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id", "email", "first_name", "last_name", "full_name", "role",
            "telephone", "photo", "etablissements", "etablissement_courant",
            "langue_preferee", "is_active", "date_joined", "date_derniere_activite",
            "est_admin", "est_enseignant", "est_eleve", "est_parent", "est_comptable",
        ]
        read_only_fields = ["id", "date_joined", "date_derniere_activite"]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = [
            "email", "first_name", "last_name", "password", "password_confirm",
            "role", "telephone", "etablissement_courant",
        ]

    def validate(self, attrs):
        if attrs["password"] != attrs.pop("password_confirm"):
            raise serializers.ValidationError({"password_confirm": "Les mots de passe ne correspondent pas."})
        password_validation.validate_password(attrs["password"])
        # Seul un admin peut créer un autre admin ; l'auto-inscription publique
        # est restreinte aux rôles élève/parent par la vue (voir accounts/views.py).
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        if user.etablissement_courant:
            user.etablissements.add(user.etablissement_courant)
        return user


class ChangePasswordSerializer(serializers.Serializer):
    ancien_mot_de_passe = serializers.CharField(write_only=True)
    nouveau_mot_de_passe = serializers.CharField(write_only=True, min_length=8)

    def validate_nouveau_mot_de_passe(self, value):
        password_validation.validate_password(value, self.context["request"].user)
        return value


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Ajoute le rôle et l'établissement courant dans le payload du token JWT."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["email"] = user.email
        token["full_name"] = user.get_full_name()
        token["etablissement_id"] = str(user.etablissement_courant_id) if user.etablissement_courant_id else None
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data


class LienParentEleveSerializer(serializers.ModelSerializer):
    parent_nom = serializers.CharField(source="parent.get_full_name", read_only=True)
    parent_email = serializers.EmailField(source="parent.email", read_only=True)
    parent_telephone = serializers.CharField(source="parent.telephone", read_only=True)
    eleve_nom = serializers.SerializerMethodField()
    eleve_matricule = serializers.CharField(source="eleve.matricule", read_only=True)
    relation_label = serializers.CharField(source="get_relation_display", read_only=True)

    class Meta:
        model = LienParentEleve
        fields = [
            "id", "parent", "eleve", "relation", "relation_label", "est_contact_principal",
            "parent_nom", "parent_email", "parent_telephone", "eleve_nom", "eleve_matricule",
        ]

    def get_eleve_nom(self, obj):
        return f"{obj.eleve.prenom} {obj.eleve.nom}"

    def validate_parent(self, value):
        if value.role != User.Role.PARENT:
            raise serializers.ValidationError("Le compte sélectionné n'a pas le rôle « Parent ».")
        return value
