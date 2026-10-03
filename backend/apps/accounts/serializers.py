from django.contrib.auth import password_validation
from django.db import transaction
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.accounts.models import LienParentEleve, User
from apps.core.models import Classe
from apps.students.models import Eleve, Inscription


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
    # Profil scolaire, obligatoire pour une inscription d'élève
    classe = serializers.PrimaryKeyRelatedField(
        queryset=Classe.objects.select_related("annee_scolaire", "etablissement"),
        write_only=True, required=False, allow_null=True,
    )
    sexe = serializers.ChoiceField(choices=Eleve.SEXE_CHOICES, write_only=True, required=False)
    date_naissance = serializers.DateField(write_only=True, required=False)
    matricule = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            "email", "first_name", "last_name", "password", "password_confirm",
            "role", "telephone", "etablissement_courant",
            "classe", "sexe", "date_naissance", "matricule",
        ]

    def validate(self, attrs):
        if attrs["password"] != attrs.pop("password_confirm"):
            raise serializers.ValidationError({"password_confirm": "Les mots de passe ne correspondent pas."})
        password_validation.validate_password(attrs["password"])
        # Seul un admin peut créer un autre admin ; l'auto-inscription publique
        # est restreinte aux rôles élève/parent par la vue (voir accounts/views.py).

        if attrs.get("role") == User.Role.ELEVE:
            erreurs = {}
            classe = attrs.get("classe")
            if not classe:
                erreurs["classe"] = "Choisissez la classe dans laquelle vous êtes inscrit."
            elif not classe.annee_scolaire.est_courante:
                erreurs["classe"] = "Cette classe n'appartient pas à l'année scolaire en cours."
            if not attrs.get("date_naissance"):
                erreurs["date_naissance"] = "La date de naissance est obligatoire."
            matricule = (attrs.get("matricule") or "").strip()
            if matricule:
                # Rattachement à une fiche élève déjà créée par l'administration :
                # le matricule ET la date de naissance doivent correspondre.
                eleve = Eleve.objects.filter(
                    matricule__iexact=matricule, date_naissance=attrs.get("date_naissance"), user__isnull=True,
                ).first()
                if not eleve:
                    erreurs["matricule"] = "Aucune fiche élève libre ne correspond à ce matricule et à cette date de naissance."
                elif classe and eleve.etablissement_id != classe.etablissement_id:
                    erreurs["matricule"] = "Ce matricule appartient à un autre établissement."
                attrs["eleve_existant"] = eleve
            elif not attrs.get("sexe"):
                erreurs["sexe"] = "Le sexe est obligatoire."
            if erreurs:
                raise serializers.ValidationError(erreurs)
            attrs["etablissement_courant"] = classe.etablissement
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        password = validated_data.pop("password")
        classe = validated_data.pop("classe", None)
        sexe = validated_data.pop("sexe", None)
        date_naissance = validated_data.pop("date_naissance", None)
        validated_data.pop("matricule", None)
        eleve = validated_data.pop("eleve_existant", None)

        user = User(**validated_data)
        user.set_password(password)
        user.save()
        if user.etablissement_courant:
            user.etablissements.add(user.etablissement_courant)

        if user.role == User.Role.ELEVE and classe:
            if eleve:
                eleve.user = user
                eleve.save(update_fields=["user"])
            else:
                eleve = Eleve.objects.create(
                    user=user, etablissement=classe.etablissement,
                    nom=user.last_name, prenom=user.first_name,
                    sexe=sexe, date_naissance=date_naissance,
                )
            # Inscription dans la classe choisie, sauf si l'administration l'a déjà inscrit cette année.
            Inscription.objects.get_or_create(
                eleve=eleve, annee_scolaire=classe.annee_scolaire, defaults={"classe": classe},
            )
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
