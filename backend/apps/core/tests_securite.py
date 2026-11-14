"""Tests de sécurité : liens /media/ signés, blocage des connexions, fichiers envoyés, en-têtes."""
import datetime
import os
import shutil
import tempfile
from unittest import mock

from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.core.media_securise import GRANULARITE, signer
from apps.core.tests import creer_etablissement
from apps.core.validators import valider_fichier_televerse

MEDIA_TEST = tempfile.mkdtemp(prefix="gs-media-test-")


@override_settings(MEDIA_ROOT=MEDIA_TEST)
class MediaSigneTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA_TEST, ignore_errors=True)

    def setUp(self):
        self.nom = default_storage.save("academique/bulletins/bulletin_GS-X-2026-0001_1.pdf", ContentFile(b"%PDF-1.4 test"))

    def test_lien_signe_obligatoire(self):
        url = default_storage.url(self.nom)
        self.assertIn("?s=", url)
        self.assertEqual(self.client.get(url).status_code, 200)
        # Nom deviné sans signature, signature d'un autre fichier, signature falsifiée : introuvable
        self.assertEqual(self.client.get(f"/media/{self.nom}").status_code, 404)
        autre = signer("academique/bulletins/autre.pdf")
        self.assertEqual(self.client.get(f"/media/{self.nom}?s={autre}").status_code, 404)
        self.assertEqual(self.client.get(url[:-3] + "abc").status_code, 404)
        # Sortie du dossier media
        self.assertEqual(self.client.get(f"/media/../manage.py?s={signer('../manage.py')}").status_code, 404)

    def test_lien_expire(self):
        url = default_storage.url(self.nom)
        plus_tard = datetime.datetime.now().timestamp() + 26 * 3600 + GRANULARITE
        with mock.patch("time.time", return_value=plus_tard):
            self.assertEqual(self.client.get(url).status_code, 404)

    def test_fichier_html_jamais_affiche(self):
        nom = default_storage.save("communication/pieces_jointes/piege.html", ContentFile(b"<script>alert(1)</script>"))
        r = self.client.get(default_storage.url(nom))
        self.assertEqual(r.status_code, 200)
        self.assertIn("attachment", r["Content-Disposition"])
        self.assertEqual(r["Content-Type"], "application/octet-stream")
        self.assertIn("sandbox", r["Content-Security-Policy"])
        self.assertEqual(r["X-Content-Type-Options"], "nosniff")


class BlocageConnexionTests(TestCase):
    def setUp(self):
        cache.clear()
        etab, _, _ = creer_etablissement("SEC")
        self.user = User.objects.create_user(email="dir@sec.ml", password="Bon-mot-de-passe-1", role="admin",
                                             etablissement_courant=etab)
        self.user.etablissements.add(etab)
        self.client = APIClient(HTTP_HOST="localhost")

    def connexion(self, mdp, email="dir@sec.ml"):
        return self.client.post("/api/v1/auth/login/", {"email": email, "password": mdp}, format="json")

    @override_settings(CONNEXION_ECHECS_MAX=3)
    def test_compte_bloque_apres_trop_d_echecs(self):
        for _ in range(3):
            self.assertEqual(self.connexion("mauvais").status_code, 401)
        r = self.connexion("Bon-mot-de-passe-1")  # même le bon mot de passe est refusé pendant le blocage
        self.assertEqual(r.status_code, 429)
        self.assertIn("Réessayez", r.data["detail"])
        # La casse de l'adresse ne contourne pas le blocage
        self.assertEqual(self.connexion("Bon-mot-de-passe-1", email="DIR@sec.ml").status_code, 429)
        cache.clear()
        self.assertEqual(self.connexion("Bon-mot-de-passe-1").status_code, 200)

    @override_settings(CONNEXION_ECHECS_MAX=3)
    def test_succes_remet_le_compteur_a_zero(self):
        self.connexion("mauvais")
        self.connexion("mauvais")
        self.assertEqual(self.connexion("Bon-mot-de-passe-1").status_code, 200)
        self.connexion("mauvais")
        self.connexion("mauvais")
        self.assertEqual(self.connexion("Bon-mot-de-passe-1").status_code, 200)

    def test_essais_de_matricule_limites(self):
        _, classe, eleve = creer_etablissement("MAT")
        eleve.save()
        demande = {
            "email": "x@x.ml", "first_name": "A", "last_name": "B", "password": "Tres-long-mdp-9",
            "password_confirm": "Tres-long-mdp-9", "role": "eleve", "classe": classe.id,
            "matricule": eleve.matricule, "date_naissance": "2000-01-01",
        }
        for _ in range(5):
            r = self.client.post("/api/v1/auth/register/", demande, format="json")
            self.assertEqual(r.status_code, 400)
        # Même avec la bonne date de naissance, le matricule est bloqué pour l'heure
        r = self.client.post("/api/v1/auth/register/", {**demande, "date_naissance": eleve.date_naissance.isoformat()}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("Trop d'essais", str(r.data))


class FichiersEtEntetesTests(TestCase):
    def test_validation_des_fichiers_envoyes(self):
        valider_fichier_televerse(SimpleUploadedFile("justificatif.pdf", b"%PDF"))
        valider_fichier_televerse(SimpleUploadedFile("photo.JPG", b"x"))
        for nom in ("page.html", "image.svg", "script.js", "virus.exe", "sans_extension"):
            with self.assertRaises(ValidationError):
                valider_fichier_televerse(SimpleUploadedFile(nom, b"x"))
        gros = SimpleUploadedFile("gros.pdf", b"x")
        gros.size = 11 * 1024 * 1024
        with self.assertRaises(ValidationError):
            valider_fichier_televerse(gros)

    def test_route_de_sante_et_entetes_api(self):
        r = self.client.get("/api/v1/sante/", HTTP_HOST="localhost")
        self.assertEqual(r.json(), {"statut": "ok"})
        r = self.client.get("/api/v1/auth/me/", HTTP_HOST="localhost")
        self.assertEqual(r.status_code, 401)
        self.assertIn("default-src 'none'", r["Content-Security-Policy"])
        self.assertIn("camera=()", r["Permissions-Policy"])
        self.assertEqual(r["X-Frame-Options"], "DENY")

    @override_settings(DEBUG=False)
    def test_documentation_reservee_aux_administrateurs(self):
        import importlib

        from django.urls import clear_url_caches

        import config.urls

        try:
            clear_url_caches()
            importlib.reload(config.urls)
            r = self.client.get("/api/docs/", HTTP_HOST="localhost")
            self.assertEqual(r.status_code, 302)  # renvoi vers la connexion de l'administration
            self.assertIn("login", r["Location"])
        finally:
            clear_url_caches()
            importlib.reload(config.urls)

    def test_mot_de_passe_absent_du_code(self):
        reglages = open(os.path.join(os.path.dirname(__file__), "..", "..", "config", "settings", "base.py"), encoding="utf-8").read()
        self.assertNotIn("Diakis", reglages)
