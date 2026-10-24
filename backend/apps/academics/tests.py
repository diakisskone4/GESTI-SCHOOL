"""Tests du tableau d'honneur des premiers de classe et de son affiche."""
import datetime
import io
from decimal import Decimal

from django.test import TestCase
from PIL import Image
from rest_framework.test import APIClient

from apps.academics.models import Bulletin, MoyenneMatiere
from apps.accounts.models import User
from apps.communication.models import Annonce, ImageAnnonce
from apps.core.models import Classe, Matiere, Niveau, Periode
from apps.core.tests import creer_etablissement
from apps.students.models import Eleve, Inscription


class TableauHonneurTests(TestCase):
    def setUp(self):
        self.etab, self.classe_a, _ = creer_etablissement("CSM")
        self.annee = self.classe_a.annee_scolaire
        niveau = Niveau.objects.create(etablissement=self.etab, nom="5e", cycle="secondaire_1", ordre=2)
        self.classe_b = Classe.objects.create(etablissement=self.etab, annee_scolaire=self.annee, niveau=niveau, nom="5e B")
        self.classe_vide = Classe.objects.create(etablissement=self.etab, annee_scolaire=self.annee, niveau=niveau, nom="5e C")
        self.periode = Periode.objects.create(annee_scolaire=self.annee, numero=1, date_debut=datetime.date(2026, 10, 1),
                                              date_fin=datetime.date(2026, 12, 20))
        self.maths = Matiere.objects.create(etablissement=self.etab, nom="Maths")
        self.inscriptions = {}
        for classe, notes in ((self.classe_a, [15.5, 17.25, 12]), (self.classe_b, [13, 16, 11])):
            for i, moyenne in enumerate(notes):
                eleve = Eleve.objects.create(etablissement=self.etab, nom=f"NOM{classe.pk}{i}", prenom=f"Awa{i}", sexe="F",
                                             date_naissance=datetime.date(2012, 1, 1) + datetime.timedelta(days=i))
                insc = Inscription.objects.create(eleve=eleve, classe=classe, annee_scolaire=self.annee)
                MoyenneMatiere.objects.create(inscription=insc, matiere=self.maths, periode=self.periode, moyenne=Decimal(str(moyenne)))
                self.inscriptions[(classe.pk, moyenne)] = insc
        # Une inscription dans 5e C sans aucune note : classe « sans résultats »
        e = Eleve.objects.create(etablissement=self.etab, nom="SANSNOTE", prenom="Ali", sexe="M", date_naissance=datetime.date(2011, 1, 1))
        Inscription.objects.create(eleve=e, classe=self.classe_vide, annee_scolaire=self.annee)

        self.admin = User.objects.create_user(email="admin@csm.ml", password="x", role="admin", first_name="Awa",
                                              last_name="Directrice", etablissement_courant=self.etab)
        self.admin.etablissements.add(self.etab)
        self.client = APIClient(HTTP_HOST="localhost")
        self.client.force_authenticate(self.admin)

    def calculer(self):
        r = self.client.post("/api/v1/tableau-honneur/calculer/", {"periode": self.periode.pk}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        return r

    def test_premiers_de_chaque_classe(self):
        avant = self.client.get("/api/v1/tableau-honneur/laureats/", {"periode": self.periode.pk}).data
        self.assertEqual(avant["classes"], [])
        self.assertEqual(len(avant["classes_sans_resultats"]), 3)

        self.assertIn("2 classe(s)", self.calculer().data["detail"])
        data = self.client.get("/api/v1/tableau-honneur/laureats/", {"periode": self.periode.pk}).data
        premiers = {c["nom"]: (c["laureats"][0]["prenom"], str(c["laureats"][0]["moyenne"])) for c in data["classes"]}
        self.assertEqual(premiers, {self.classe_a.nom: ("Awa1", "17.25"), "5e B": ("Awa1", "16.00")})
        self.assertEqual([c["nom"] for c in data["classes_sans_resultats"]], ["5e C"])
        self.assertEqual(data["classes"][0]["laureats"][0]["mention"], "Excellent")

        trois = self.client.get("/api/v1/tableau-honneur/laureats/", {"periode": self.periode.pk, "nombre": 3}).data
        self.assertEqual([l["rang"] for l in trois["classes"][0]["laureats"]], [1, 2, 3])

    def test_affiche_png_et_pdf(self):
        self.calculer()
        r = self.client.get("/api/v1/tableau-honneur/affiche/", {"periode": self.periode.pk})
        self.assertEqual(r["Content-Type"], "image/png")
        image = Image.open(io.BytesIO(r.content))
        self.assertEqual(image.width, 1240)
        self.assertGreaterEqual(image.height, 1754)
        pdf = self.client.get("/api/v1/tableau-honneur/affiche/", {"periode": self.periode.pk, "fichier": "pdf"})
        self.assertEqual(pdf["Content-Type"], "application/pdf")
        self.assertTrue(pdf.content.startswith(b"%PDF"))

    def test_affiche_avec_photo_d_eleve(self):
        from django.core.files.uploadedfile import SimpleUploadedFile

        tampon = io.BytesIO()
        Image.new("RGB", (300, 400), (10, 120, 200)).save(tampon, format="JPEG")
        premier = self.inscriptions[(self.classe_a.pk, 17.25)].eleve
        premier.photo = SimpleUploadedFile("photo.jpg", tampon.getvalue(), content_type="image/jpeg")
        premier.save()
        self.calculer()
        data = self.client.get("/api/v1/tableau-honneur/laureats/", {"periode": self.periode.pk}).data
        self.assertTrue(data["classes"][0]["laureats"][0]["photo"].endswith(".jpg"))
        self.assertEqual(self.client.get("/api/v1/tableau-honneur/affiche/", {"periode": self.periode.pk}).status_code, 200)
        premier.photo.delete(save=False)

    def test_publication_en_annonce(self):
        r = self.client.post("/api/v1/tableau-honneur/publier/", {"periode": self.periode.pk}, format="json")
        self.assertEqual(r.status_code, 400)  # aucun résultat encore
        self.calculer()
        r = self.client.post("/api/v1/tableau-honneur/publier/", {
            "periode": self.periode.pk, "public_cible": "tous", "message": "Bravo à tous !",
        }, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        annonce = Annonce.objects.get()
        self.assertTrue(annonce.titre.startswith("Tableau d'honneur"))
        self.assertTrue(annonce.epinglee)
        self.assertIn("Bravo à tous !", annonce.contenu)
        self.assertIn("NOM", annonce.contenu)
        self.assertIn("17,25/20", annonce.contenu)
        image = ImageAnnonce.objects.get(annonce=annonce)
        self.assertEqual(image.type_mime, "image/jpeg")
        self.assertEqual(Image.open(io.BytesIO(bytes(image.contenu))).width, 1240)  # pleine résolution
        self.assertEqual(len(r.data["images"]), 1)

    def test_droits_et_cloisonnement(self):
        self.calculer()
        prof = User.objects.create_user(email="prof@csm.ml", password="x", role="enseignant", etablissement_courant=self.etab)
        prof.etablissements.add(self.etab)
        client_prof = APIClient(HTTP_HOST="localhost")
        client_prof.force_authenticate(prof)
        self.assertEqual(client_prof.get("/api/v1/tableau-honneur/laureats/", {"periode": self.periode.pk}).status_code, 200)
        self.assertEqual(client_prof.post("/api/v1/tableau-honneur/publier/", {"periode": self.periode.pk}, format="json").status_code, 403)

        autre, _, _ = creer_etablissement("AUT")
        admin_b = User.objects.create_user(email="b@aut.ml", password="x", role="admin", etablissement_courant=autre)
        admin_b.etablissements.add(autre)
        client_b = APIClient(HTTP_HOST="localhost")
        client_b.force_authenticate(admin_b)
        self.assertEqual(client_b.get("/api/v1/tableau-honneur/laureats/", {"periode": self.periode.pk}).status_code, 404)
        self.assertFalse(Bulletin.objects.filter(inscription__classe__etablissement=autre).exists())
