from rest_framework import serializers

from apps.accounts.doublons import verifier_eleve_unique

from apps.students.models import Absence, ArchiveEleves, CarteScolaire, Eleve, Inscription, SanctionRecompense


class EleveSerializer(serializers.ModelSerializer):
    nom_complet = serializers.SerializerMethodField()
    classe_actuelle = serializers.SerializerMethodField()

    class Meta:
        model = Eleve
        fields = "__all__"
        read_only_fields = ["id"]

    def get_nom_complet(self, obj):
        return f"{obj.prenom} {obj.nom}"

    def validate(self, attrs):
        instance = self.instance
        valeur = lambda champ: attrs.get(champ, getattr(instance, champ, None) if instance else None)  # noqa: E731
        etablissement = valeur("etablissement")
        try:
            verifier_eleve_unique(valeur("nom"), valeur("prenom"), valeur("date_naissance"),
                                  getattr(etablissement, "pk", etablissement), exclure_pk=getattr(instance, "pk", None))
        except serializers.ValidationError as exc:
            raise serializers.ValidationError({"nom": exc.detail})
        return attrs

    def get_classe_actuelle(self, obj):
        # Inscriptions actives préchargées par la vue : une seule requête pour toute la page
        if hasattr(obj, "inscriptions_actives"):
            insc = obj.inscriptions_actives[0] if obj.inscriptions_actives else None
        else:
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


class ArchiveElevesSerializer(serializers.ModelSerializer):
    auteur_nom = serializers.SerializerMethodField()

    class Meta:
        model = ArchiveEleves
        fields = ["id", "cree_le", "modifie_le", "auteur_nom", "operations", "nb_eleves", "nom_fichier", "taille"]

    def get_auteur_nom(self, obj):
        return obj.auteur.get_full_name() if obj.auteur else "—"
