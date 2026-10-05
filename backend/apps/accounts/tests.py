"""Tests anti-doublons : email, téléphone, élève (nom + prénom + date de naissance), personnel."""
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.doublons import telephone_canonique
from apps.accounts.models import User
from apps.core.tests import creer_etablissement


class DoublonsTests(TestCase):
    def setUp(self):
        self.etab, self.classe, self.eleve = creer_etablissement("DBL")
        self.admin = User.objects.create_user(
            email="Admin@Ecole.ml", password="x", role="admin", first_name="A", last_name="D",
            telephone="+223 70 11 22 33", etablissement_courant=self.etab,
        )
        self.admin.etablissements.add(self.etab)
        self.anonyme = APIClient(HTTP_HOST="localhost")
        self.client = APIClient(HTTP_HOST="localhost")
        self.client.force_authenticate(self.admin)
        self.inscription = {
            "first_name": "Awa", "last_name": "Diarra", "password": "Xk9!pqrs-long",
            "password_confirm": "Xk9!pqrs-long", "role": "parent",
        }

    def test_telephone_canonique(self):
        for variante in ("+223 70 11 22 33", "0022370112233", "70-11-22-33", "70112233"):
            self.assertEqual(telephone_canonique(variante), "70112233")

    def test_email_deja_utilise_quelle_que_soit_la_casse(self):
        r = self.anonyme.post("/api/v1/auth/register/", {**self.inscription, "email": "admin@ecole.ML"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("email", r.data)

    def test_telephone_deja_utilise_dans_un_autre_format(self):
        r = self.anonyme.post("/api/v1/auth/register/", {
            **self.inscription, "email": "awa@ecole.ml", "telephone": "70112233",
        }, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("telephone", r.data)
        r = self.client.post("/api/v1/utilisateurs/", {
            "email": "autre@ecole.ml", "first_name": "B", "last_name": "C", "role": "enseignant",
            "telephone": "00223 70 11 22 33",
        }, format="json")
        self.assertEqual(r.status_code, 400)

    def test_connexion_insensible_a_la_casse(self):
        self.admin.set_password("Xk9!pqrs-long")
        self.admin.save()
        r = self.anonyme.post("/api/v1/auth/login/", {"email": "admin@ecole.ml", "password": "Xk9!pqrs-long"}, format="json")
        self.assertEqual(r.status_code, 200)

    def test_eleve_en_double_refuse(self):
        # Même nom / prénom / date de naissance qu'un élève existant, à la casse près
        r = self.client.post("/api/v1/eleves/", {
            "nom": self.eleve.nom.lower(), "prenom": self.eleve.prenom, "sexe": "M",
            "date_naissance": self.eleve.date_naissance.isoformat(),
        }, format="json")
        self.assertEqual(r.status_code, 400)
        # Inscription publique : on indique le matricule pour relier le compte au dossier existant
        r = self.anonyme.post("/api/v1/auth/register/", {
            **self.inscription, "role": "eleve", "email": "eleve@ecole.ml", "classe": self.classe.id, "sexe": "M",
            "first_name": self.eleve.prenom, "last_name": self.eleve.nom,
            "date_naissance": self.eleve.date_naissance.isoformat(),
        }, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn(self.eleve.matricule, str(r.data["matricule"]))

    def test_personnel_en_double_refuse(self):
        fiche = {"nom": "KONE", "prenom": "Ali", "sexe": "M", "date_naissance": "1985-04-04",
                 "telephone": "76 00 00 01", "type_employe": "administratif", "date_embauche": "2020-10-01"}
        self.assertEqual(self.client.post("/api/v1/employes/", fiche, format="json").status_code, 201)
        r = self.client.post("/api/v1/employes/", {**fiche, "nom": "TRAORE", "date_naissance": "1990-01-01",
                                                   "telephone": "+22376000001"}, format="json")
        self.assertEqual(r.status_code, 400)
        r = self.client.post("/api/v1/employes/", {**fiche, "telephone": "66000000"}, format="json")
        self.assertEqual(r.status_code, 400)
