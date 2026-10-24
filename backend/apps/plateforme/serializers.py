from django.contrib.auth import password_validation
from django.db import transaction
from rest_framework import serializers

from apps.accounts.doublons import verifier_email_utilisateur, verifier_telephone_utilisateur
from apps.accounts.models import User
from apps.core.models import Etablissement
from apps.plateforme.models import DUREES_MOIS, Abonnement, DemandeDemo, JournalConsole, ajouter_mois


class AbonnementSerializer(serializers.ModelSerializer):
    statut = serializers.CharField(read_only=True)
    jours_restants = serializers.IntegerField(read_only=True)

    class Meta:
        model = Abonnement
        fields = ["duree_mois", "date_debut", "date_fin", "actif", "statut", "jours_restants", "notes"]
        read_only_fields = ["date_debut", "date_fin", "actif"]


class AdministrateurSerializer(serializers.Serializer):
    """Compte administrateur créé en même temps que l'établissement."""
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    telephone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    password = serializers.CharField(min_length=8, write_only=True)

    def validate_email(self, value):
        return verifier_email_utilisateur(value)

    def validate_telephone(self, value):
        return verifier_telephone_utilisateur(value)

    def validate_password(self, value):
        password_validation.validate_password(value)
        return value


def creer_administrateur(etablissement, donnees):
    user = User(
        email=donnees["email"], first_name=donnees["first_name"], last_name=donnees["last_name"],
        telephone=donnees.get("telephone", ""), role=User.Role.ADMIN, etablissement_courant=etablissement,
        doit_changer_mot_de_passe=True,
    )
    user.set_password(donnees["password"])
    user.save()
    user.etablissements.add(etablissement)
    return user


class EtablissementConsoleSerializer(serializers.ModelSerializer):
    """Établissement client vu depuis la console : identité, abonnement et volumes (jamais ses données internes)."""
    abonnement = AbonnementSerializer(read_only=True)
    administrateurs = serializers.SerializerMethodField()
    nb_eleves = serializers.IntegerField(read_only=True)
    nb_utilisateurs = serializers.IntegerField(read_only=True)
    derniere_activite = serializers.DateTimeField(read_only=True)
    # Création uniquement
    duree_mois = serializers.ChoiceField(choices=DUREES_MOIS, write_only=True, required=False)
    administrateur = AdministrateurSerializer(write_only=True, required=False)

    class Meta:
        model = Etablissement
        fields = [
            "id", "nom", "sigle", "type_etablissement", "adresse", "ville", "pays", "telephone", "email",
            "created_at", "abonnement", "administrateurs", "nb_eleves", "nb_utilisateurs", "derniere_activite",
            "duree_mois", "administrateur",
        ]
        read_only_fields = ["id", "created_at"]

    def get_administrateurs(self, obj):
        return [
            {"id": str(u.id), "nom": u.get_full_name(), "email": u.email, "telephone": u.telephone, "actif": u.is_active}
            for u in self._admins(obj)
        ]

    @staticmethod
    def _admins(obj):
        # Préchargés par la vue (to_attr="admins") ; sinon requête directe
        if hasattr(obj, "admins"):
            return obj.admins
        return obj.utilisateurs.filter(role__in=[User.Role.ADMIN, User.Role.SUPERADMIN])

    def validate(self, attrs):
        if self.instance is None:
            if not attrs.get("duree_mois"):
                raise serializers.ValidationError({"duree_mois": "Choisissez la durée d'accès (3, 6, 12 ou 24 mois)."})
            if not attrs.get("administrateur"):
                raise serializers.ValidationError({"administrateur": "Le compte administrateur de l'établissement est requis."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        duree = validated_data.pop("duree_mois")
        admin = validated_data.pop("administrateur")
        etablissement = Etablissement.objects.create(**validated_data)
        Abonnement.objects.create(
            etablissement=etablissement, duree_mois=duree, date_fin=ajouter_mois(etablissement.created_at.date(), duree),
        )
        creer_administrateur(etablissement, admin)
        return etablissement

    def update(self, instance, validated_data):
        validated_data.pop("duree_mois", None)
        validated_data.pop("administrateur", None)
        return super().update(instance, validated_data)


class DeveloppeurSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source="get_full_name", read_only=True)
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "full_name", "telephone", "is_active",
                  "date_joined", "date_derniere_activite", "password"]
        read_only_fields = ["id", "date_joined", "date_derniere_activite"]

    def validate_email(self, value):
        return verifier_email_utilisateur(value, exclure_pk=getattr(self.instance, "pk", None))

    def validate_telephone(self, value):
        return verifier_telephone_utilisateur(value, exclure_pk=getattr(self.instance, "pk", None))

    def validate_password(self, value):
        password_validation.validate_password(value)
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data, role=User.Role.DEVELOPPEUR)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        user = super().update(instance, validated_data)
        if password:
            user.set_password(password)
            user.save()
        return user


class InscriptionEquipeSerializer(DeveloppeurSerializer):
    """Inscription privée d'un membre de l'équipe : nécessite le code d'invitation."""
    code_invitation = serializers.CharField(write_only=True)
    password_confirm = serializers.CharField(write_only=True)

    class Meta(DeveloppeurSerializer.Meta):
        fields = DeveloppeurSerializer.Meta.fields + ["code_invitation", "password_confirm"]

    def validate(self, attrs):
        if attrs["password"] != attrs.pop("password_confirm"):
            raise serializers.ValidationError({"password_confirm": "Les mots de passe ne correspondent pas."})
        attrs.pop("code_invitation")  # vérifié par la vue
        return attrs


class JournalConsoleSerializer(serializers.ModelSerializer):
    auteur_nom = serializers.SerializerMethodField()
    action_label = serializers.CharField(source="get_action_display", read_only=True)

    class Meta:
        model = JournalConsole
        fields = ["id", "horodatage", "action", "action_label", "auteur_nom", "etablissement", "etablissement_nom", "details"]

    def get_auteur_nom(self, obj):
        return obj.auteur.get_full_name() if obj.auteur else "Compte supprimé"


class DemandeDemoPubliqueSerializer(serializers.ModelSerializer):
    """Formulaire du site vitrine. `site_web` est un piège à robots : invisible pour les visiteurs, il doit rester vide."""
    site_web = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = DemandeDemo
        fields = ["nom", "etablissement", "fonction", "telephone", "email", "ville", "nb_eleves", "message", "site_web"]

    def validate_telephone(self, value):
        chiffres = "".join(c for c in value if c.isdigit())
        if len(chiffres) < 8:
            raise serializers.ValidationError("Numéro de téléphone incomplet.")
        return value.strip()


class DemandeDemoSerializer(serializers.ModelSerializer):
    statut_label = serializers.CharField(source="get_statut_display", read_only=True)

    class Meta:
        model = DemandeDemo
        fields = ["id", "nom", "etablissement", "fonction", "telephone", "email", "ville", "nb_eleves", "message",
                  "statut", "statut_label", "notes", "cree_le", "modifie_le"]
        read_only_fields = ["nom", "etablissement", "fonction", "telephone", "email", "ville", "nb_eleves", "message",
                            "cree_le", "modifie_le"]
