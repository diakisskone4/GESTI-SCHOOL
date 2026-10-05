"""Tests du cloisonnement multi-établissements (apps/core/tenancy.py)."""
import datetime

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.core.models import AnneeScolaire, Classe, Etablissement, Niveau
from apps.students.models import Eleve, Inscription


def creer_etablissement(sigle):
    etab = Etablissement.objects.create(nom=f"École {sigle}", sigle=sigle)
    annee = AnneeScolaire.objects.create(
        etablissement=etab, libelle="2026-2027", est_courante=True,
        date_debut=datetime.date(2026, 10, 1), date_fin=datetime.date(2027, 7, 31),
    )
    niveau = Niveau.objects.create(etablissement=etab, nom="6e", cycle="secondaire_1", ordre=1)
    classe = Classe.objects.create(etablissement=etab, annee_scolaire=annee, niveau=niveau, nom=f"6e {sigle}")
    eleve = Eleve.objects.create(etablissement=etab, nom="ELEVE", prenom=sigle, sexe="M", date_naissance=datetime.date(2012, 1, 1))
    return etab, classe, eleve


class CloisonnementEtablissementsTests(TestCase):
    def setUp(self):
        self.etab_a, self.classe_a, self.eleve_a = creer_etablissement("AAA")
        self.etab_b, self.classe_b, self.eleve_b = creer_etablissement("BBB")
        self.admin_a = User.objects.create_user(
            email="admin.a@test.ml", password="x", role="admin", first_name="A", last_name="A",
            etablissement_courant=self.etab_a,
        )
        self.admin_a.etablissements.add(self.etab_a)
        self.client = APIClient(HTTP_HOST="localhost")
        self.client.force_authenticate(self.admin_a)

    def test_ne_voit_que_les_donnees_de_son_etablissement(self):
        eleves = self.client.get("/api/v1/eleves/").data["results"]
        self.assertEqual([e["id"] for e in eleves], [str(self.eleve_a.id)])
        self.assertEqual(self.client.get(f"/api/v1/classes/{self.classe_b.id}/").status_code, 404)
        etabs = [e["sigle"] for e in self.client.get("/api/v1/etablissements/").data["results"]]
        self.assertEqual(etabs, ["AAA"])

    def test_creation_rattachee_automatiquement(self):
        r = self.client.post("/api/v1/eleves/", {
            "nom": "NOUVEL", "prenom": "Eleve", "sexe": "F", "date_naissance": "2012-02-02",
        }, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(Eleve.objects.get(nom="NOUVEL").etablissement, self.etab_a)

    def test_ecriture_vers_un_autre_etablissement_refusee(self):
        r = self.client.post("/api/v1/eleves/", {
            "nom": "X", "prenom": "Y", "sexe": "M", "date_naissance": "2012-01-01", "etablissement": self.etab_b.id,
        }, format="json")
        self.assertEqual(r.status_code, 403)
        # Élève de A inscrit dans une classe de B : refusé, rien n'est créé
        r = self.client.post("/api/v1/inscriptions/", {
            "eleve": str(self.eleve_a.id), "classe": self.classe_b.id, "annee_scolaire": self.classe_b.annee_scolaire_id,
        }, format="json")
        self.assertEqual(r.status_code, 403)
        self.assertFalse(Inscription.objects.filter(eleve=self.eleve_a).exists())

    def test_bascule_limitee_aux_etablissements_accessibles(self):
        r = self.client.patch("/api/v1/auth/me/", {"etablissement_courant": self.etab_b.id}, format="json")
        self.assertEqual(r.status_code, 403)
        self.admin_a.etablissements.add(self.etab_b)
        r = self.client.patch("/api/v1/auth/me/", {"etablissement_courant": self.etab_b.id}, format="json")
        self.assertEqual(r.status_code, 200)
        eleves = self.client.get("/api/v1/eleves/").data["results"]
        self.assertEqual([e["id"] for e in eleves], [str(self.eleve_b.id)])

    def test_profil_ne_permet_pas_de_changer_son_role(self):
        eleve = User.objects.create_user(email="e@test.ml", password="x", role="eleve", first_name="E", last_name="E")
        client = APIClient(HTTP_HOST="localhost")
        client.force_authenticate(eleve)
        self.assertEqual(client.patch("/api/v1/auth/me/", {"role": "admin"}, format="json").status_code, 400)
        eleve.refresh_from_db()
        self.assertEqual(eleve.role, "eleve")
