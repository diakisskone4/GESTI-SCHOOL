"""Tests de la console développeurs : établissements clients, abonnements, accès et confidentialité."""
import datetime

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.core.models import Etablissement
from apps.core.tests import creer_etablissement
from apps.plateforme.models import Abonnement, ajouter_mois

MOT_DE_PASSE = "Xk9!pqrs-long"


def client_pour(user=None):
    client = APIClient(HTTP_HOST="localhost")
    if user:
        client.force_authenticate(user)
    return client


class ConsoleDeveloppeursTests(TestCase):
    def setUp(self):
        self.dev = User.objects.create_user(email="dev@plateforme.ml", password=MOT_DE_PASSE, role="developpeur",
                                            first_name="Dev", last_name="Equipe")
        self.console = client_pour(self.dev)

    def creer_client(self, sigle="LYC", duree=12, email="admin@lyc.ml"):
        return self.console.post("/api/v1/plateforme/etablissements/", {
            "nom": f"Lycée {sigle}", "sigle": sigle, "ville": "Bamako", "duree_mois": duree,
            "administrateur": {"first_name": "Awa", "last_name": "Admin", "email": email, "password": MOT_DE_PASSE},
        }, format="json")

    def test_ajouter_mois(self):
        self.assertEqual(ajouter_mois(datetime.date(2026, 1, 31), 1), datetime.date(2026, 2, 28))
        self.assertEqual(ajouter_mois(datetime.date(2026, 10, 18), 24), datetime.date(2028, 10, 18))

    def test_creation_etablissement_avec_abonnement_et_administrateur(self):
        r = self.creer_client(duree=6)
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["abonnement"]["duree_mois"], 6)
        self.assertEqual(r.data["abonnement"]["statut"], "actif")
        admin = User.objects.get(email="admin@lyc.ml")
        self.assertEqual(admin.role, "admin")
        self.assertEqual(admin.etablissement_courant.sigle, "LYC")
        # L'administrateur se connecte et gère son établissement
        r = client_pour().post("/api/v1/auth/login/", {"email": "admin@lyc.ml", "password": MOT_DE_PASSE}, format="json")
        self.assertEqual(r.status_code, 200)

    @override_settings(PLATEFORME_MAX_ETABLISSEMENTS=1)
    def test_limite_du_nombre_d_etablissements(self):
        self.assertEqual(self.creer_client("A1", email="a1@x.ml").status_code, 201)
        r = self.creer_client("A2", email="a2@x.ml")
        self.assertEqual(r.status_code, 400)
        self.assertFalse(Etablissement.objects.filter(sigle="A2").exists())

    def test_console_invisible_pour_les_etablissements(self):
        etab, _, _ = creer_etablissement("ECO")
        admin = User.objects.create_user(email="a@eco.ml", password="x", role="admin", first_name="A", last_name="B",
                                         etablissement_courant=etab, is_superuser=False)
        admin.etablissements.add(etab)
        for url in ("/api/v1/plateforme/statistiques/", "/api/v1/plateforme/etablissements/", "/api/v1/plateforme/equipe/"):
            self.assertEqual(client_pour(admin).get(url).status_code, 404)
        # L'administrateur ne crée pas d'établissement, ne voit pas les développeurs, ne peut pas en créer
        self.assertEqual(client_pour(admin).post("/api/v1/etablissements/", {"nom": "X", "sigle": "X"}, format="json").status_code, 403)
        emails = [u["email"] for u in client_pour(admin).get("/api/v1/utilisateurs/").data["results"]]
        self.assertNotIn(self.dev.email, emails)
        r = client_pour(admin).post("/api/v1/utilisateurs/", {
            "email": "x@eco.ml", "first_name": "X", "last_name": "Y", "role": "developpeur"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_developpeur_ne_voit_pas_les_donnees_internes(self):
        creer_etablissement("PRV")
        self.assertEqual(self.console.get("/api/v1/eleves/").data["count"], 0)
        stats = self.console.get("/api/v1/plateforme/statistiques/").data
        self.assertEqual(stats["total_etablissements"], 1)
        self.assertEqual(stats["total_eleves"], 1)

    def test_suspension_puis_renouvellement(self):
        etab_id = self.creer_client().data["id"]
        admin = User.objects.get(email="admin@lyc.ml")
        self.console.post(f"/api/v1/plateforme/etablissements/{etab_id}/desactiver/")
        # Plus de connexion ni d'accès à l'API, avec un code exploitable par l'application
        r = client_pour().post("/api/v1/auth/login/", {"email": "admin@lyc.ml", "password": MOT_DE_PASSE}, format="json")
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.data["code"], "abonnement_inactif")
        client = APIClient(HTTP_HOST="localhost")
        jeton = self._jeton(admin)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {jeton}")
        self.assertEqual(client.get("/api/v1/eleves/").status_code, 403)
        self.assertEqual(client.get("/api/v1/auth/me/").status_code, 200)  # profil toujours lisible
        # Renouvellement : accès rétabli
        r = self.console.post(f"/api/v1/plateforme/etablissements/{etab_id}/renouveler/", {"duree_mois": 3}, format="json")
        self.assertEqual(r.data["abonnement"]["statut"], "actif")
        self.assertEqual(client.get("/api/v1/eleves/").status_code, 200)

    def test_abonnement_expire_bloque_l_acces(self):
        etab_id = self.creer_client().data["id"]
        Abonnement.objects.filter(etablissement_id=etab_id).update(date_fin=datetime.date.today() - datetime.timedelta(days=1))
        r = client_pour().post("/api/v1/auth/login/", {"email": "admin@lyc.ml", "password": MOT_DE_PASSE}, format="json")
        self.assertEqual(r.status_code, 403)
        self.assertIn("expiré", r.data["detail"])

    def test_suppression_exige_le_sigle(self):
        etab_id = self.creer_client().data["id"]
        self.assertEqual(self.console.delete(f"/api/v1/plateforme/etablissements/{etab_id}/?confirmation=NON").status_code, 400)
        self.assertEqual(self.console.delete(f"/api/v1/plateforme/etablissements/{etab_id}/?confirmation=lyc").status_code, 204)

    def test_inscription_privee_de_l_equipe(self):
        donnees = {"email": "nouveau@plateforme.ml", "first_name": "N", "last_name": "D",
                   "password": MOT_DE_PASSE, "password_confirm": MOT_DE_PASSE}
        anonyme = client_pour()
        with override_settings(PLATEFORME_CODE_INVITATION=""):
            self.assertEqual(anonyme.post("/api/v1/plateforme/inscription-equipe/", {**donnees, "code_invitation": "x"}, format="json").status_code, 404)
        with override_settings(PLATEFORME_CODE_INVITATION="secret-equipe"):
            self.assertEqual(anonyme.post("/api/v1/plateforme/inscription-equipe/", {**donnees, "code_invitation": "faux"}, format="json").status_code, 403)
            r = anonyme.post("/api/v1/plateforme/inscription-equipe/", {**donnees, "code_invitation": "secret-equipe"}, format="json")
            self.assertEqual(r.status_code, 201)
        self.assertEqual(User.objects.get(email="nouveau@plateforme.ml").role, "developpeur")

    def _jeton(self, user):
        from rest_framework_simplejwt.tokens import RefreshToken

        return str(RefreshToken.for_user(user).access_token)


class TableauDeBordConsoleTests(TestCase):
    def setUp(self):
        self.dev = User.objects.create_user(email="dev2@plateforme.ml", password=MOT_DE_PASSE, role="developpeur",
                                            first_name="Dev", last_name="Deux")
        self.console = client_pour(self.dev)

    def creer(self, sigle, duree=12):
        r = self.console.post("/api/v1/plateforme/etablissements/", {
            "nom": f"École {sigle}", "sigle": sigle, "duree_mois": duree,
            "administrateur": {"first_name": "A", "last_name": sigle, "email": f"admin@{sigle.lower()}.ml",
                               "password": MOT_DE_PASSE},
        }, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        return r.data["id"]

    def test_statistiques_completes(self):
        a, b, c = self.creer("AAA", 3), self.creer("BBB", 24), self.creer("CCC")
        Abonnement.objects.filter(etablissement_id=b).update(date_fin=datetime.date.today() + datetime.timedelta(days=10))
        Abonnement.objects.filter(etablissement_id=c).update(date_fin=datetime.date.today() - datetime.timedelta(days=2))
        stats = self.console.get("/api/v1/plateforme/statistiques/").data
        self.assertEqual(stats["par_statut"]["actif"], 2)
        self.assertEqual(stats["par_statut"]["expire"], 1)
        self.assertEqual(stats["a_renouveler"], 1)
        self.assertEqual(len(stats["evolution"]), 12)
        self.assertEqual(stats["evolution"][-1]["nouveaux"], 3)
        self.assertEqual(stats["evolution"][-1]["total"], 3)
        self.assertEqual({l["id"] for l in stats["echeancier"]}, {b, c})
        # Aucun administrateur ne s'est encore connecté : les établissements actifs sont « sans activité »
        self.assertEqual({l["id"] for l in stats["inactifs"]}, {a, b})
        self.assertEqual(stats["activite_recente"][0]["action"], "creation")

    def test_filtre_par_statut_et_journal(self):
        a, b = self.creer("AAA"), self.creer("BBB")
        self.console.post(f"/api/v1/plateforme/etablissements/{b}/desactiver/", {"motif": "Impayé"}, format="json")
        ids = lambda statut: [e["id"] for e in self.console.get(
            "/api/v1/plateforme/etablissements/", {"statut": statut}).data["results"]]
        self.assertEqual(ids("actif"), [a])
        self.assertEqual(ids("suspendu"), [b])
        self.assertEqual(self.console.get("/api/v1/plateforme/etablissements/", {"statut": "x"}).status_code, 400)
        historique = self.console.get(f"/api/v1/plateforme/etablissements/{b}/historique/").data
        self.assertEqual([h["action"] for h in historique], ["desactivation", "creation"])
        self.assertEqual(historique[0]["details"], "Impayé")
        self.assertEqual(historique[0]["auteur_nom"], "Dev Deux")

    def test_renouvellement_duree_invalide(self):
        a = self.creer("AAA")
        r = self.console.post(f"/api/v1/plateforme/etablissements/{a}/renouveler/", {"duree_mois": "abc"}, format="json")
        self.assertEqual(r.status_code, 400)


class TriConsoleTests(TestCase):
    def test_tri_par_activite_met_les_jamais_connectes_a_la_fin(self):
        from django.utils import timezone

        dev = User.objects.create_user(email="dev3@plateforme.ml", password=MOT_DE_PASSE, role="developpeur")
        console = client_pour(dev)
        jamais, _, _ = creer_etablissement("JAM")
        actif, _, _ = creer_etablissement("ACT")
        admin = User.objects.create_user(email="a@act.ml", password="x", role="admin", date_derniere_activite=timezone.now())
        admin.etablissements.add(actif)
        sigles = [e["sigle"] for e in console.get("/api/v1/plateforme/etablissements/", {"ordering": "-derniere_activite"}).data["results"]]
        self.assertEqual(sigles, ["ACT", "JAM"])
        sigles = [e["sigle"] for e in console.get("/api/v1/plateforme/etablissements/", {"ordering": "-nb_eleves", "search": "JAM"}).data["results"]]
        self.assertEqual(sigles, ["JAM"])


class DemandesDemoTests(TestCase):
    def setUp(self):
        from django.core.cache import cache

        cache.clear()  # compteurs de limitation d'envois
        self.anonyme = client_pour()
        self.formulaire = {"nom": "Awa Traoré", "etablissement": "Lycée de Kati", "telephone": "+223 70 00 00 00",
                           "ville": "Kati", "nb_eleves": "300 à 800", "message": "Nous voulons une démonstration."}

    def test_demande_depuis_le_site_puis_suivi_dans_la_console(self):
        from apps.plateforme.models import DemandeDemo

        r = self.anonyme.post("/api/v1/public/demande-demo/", self.formulaire, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        demande = DemandeDemo.objects.get()
        self.assertEqual(demande.statut, "nouvelle")

        dev = User.objects.create_user(email="d@p.ml", password=MOT_DE_PASSE, role="developpeur", first_name="D", last_name="P")
        console = client_pour(dev)
        self.assertEqual(console.get("/api/v1/plateforme/statistiques/").data["demandes_nouvelles"], 1)
        [ligne] = console.get("/api/v1/plateforme/demandes/").data["results"]
        self.assertEqual(ligne["etablissement"], "Lycée de Kati")
        r = console.patch(f"/api/v1/plateforme/demandes/{demande.pk}/", {"statut": "en_cours", "notes": "Rappeler lundi",
                                                                        "nom": "Pirate"}, format="json")
        self.assertEqual(r.data["statut"], "en_cours")
        self.assertEqual(r.data["nom"], "Awa Traoré")  # les données du prospect ne sont pas modifiables

    def test_validation_robots_et_limite(self):
        from apps.plateforme.models import DemandeDemo

        r = self.anonyme.post("/api/v1/public/demande-demo/", {**self.formulaire, "telephone": "12"}, format="json")
        self.assertEqual(r.status_code, 400)
        r = self.anonyme.post("/api/v1/public/demande-demo/", {**self.formulaire, "site_web": "http://spam"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertFalse(DemandeDemo.objects.exists())  # robot : rien d'enregistré
        for _ in range(8):
            self.anonyme.post("/api/v1/public/demande-demo/", self.formulaire, format="json")
        self.assertEqual(self.anonyme.post("/api/v1/public/demande-demo/", self.formulaire, format="json").status_code, 429)

    def test_liste_invisible_pour_les_etablissements(self):
        etab, _, _ = creer_etablissement("ECO")
        admin = User.objects.create_user(email="a@eco.ml", password="x", role="admin", etablissement_courant=etab)
        admin.etablissements.add(etab)
        self.assertEqual(client_pour(admin).get("/api/v1/plateforme/demandes/").status_code, 404)
