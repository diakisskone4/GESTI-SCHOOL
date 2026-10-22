"""Tests des images d'annonce : envoi, redimensionnement, affichage pour tous, corbeille."""
import io

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.communication.models import Annonce, ImageAnnonce
from apps.core.tests import creer_etablissement


def fichier_image(nom="photo.jpg", taille=(800, 600), format="JPEG", mode="RGB"):
    tampon = io.BytesIO()
    Image.new(mode, taille, (200, 80, 40, 128) if mode == "RGBA" else (200, 80, 40)).save(tampon, format=format)
    return SimpleUploadedFile(nom, tampon.getvalue(), content_type=f"image/{format.lower()}")


class ImagesAnnonceTests(TestCase):
    def setUp(self):
        self.etab, self.classe, self.eleve = creer_etablissement("CSM")
        self.admin = User.objects.create_user(email="admin@csm.ml", password="x", role="admin", etablissement_courant=self.etab)
        self.admin.etablissements.add(self.etab)
        self.client = APIClient(HTTP_HOST="localhost")
        self.client.force_authenticate(self.admin)

    def publier(self, images, **champs):
        donnees = {"titre": "Journée portes ouvertes", "contenu": "Samedi à 9 h", "public_cible": "tous", **champs}
        return self.client.post("/api/v1/annonces/", {**donnees, "images": images}, format="multipart")

    def test_publication_avec_images_visibles_par_tous(self):
        r = self.publier([fichier_image("a.jpg"), fichier_image("b.png", format="PNG")])
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(len(r.data["images"]), 2)
        self.assertEqual(r.data["images"][0]["nom_fichier"], "a.jpg")

        # Un élève de l'établissement voit l'annonce et ses images
        user_eleve = User.objects.create_user(email="eleve@csm.ml", password="x", role="eleve")
        self.eleve.user = user_eleve
        self.eleve.save()
        client_eleve = APIClient(HTTP_HOST="localhost")
        client_eleve.force_authenticate(user_eleve)
        [annonce] = client_eleve.get("/api/v1/annonces/").data["results"]
        self.assertEqual(len(annonce["images"]), 2)

        # L'image s'affiche sans jeton de connexion (balise <img>)
        url = annonce["images"][0]["url"].replace("http://localhost", "")
        image = APIClient(HTTP_HOST="localhost").get(url)
        self.assertEqual(image.status_code, 200)
        self.assertEqual(image["Content-Type"], "image/jpeg")
        self.assertEqual(Image.open(io.BytesIO(image.content)).size, (800, 600))

    def test_grande_photo_reduite_et_transparence_conservee(self):
        r = self.publier([fichier_image("grande.jpg", taille=(4000, 3000)), fichier_image("logo.png", format="PNG", mode="RGBA")])
        grande, logo = ImageAnnonce.objects.order_by("ordre")
        self.assertEqual((grande.largeur, grande.hauteur), (1600, 1200))
        self.assertEqual(logo.type_mime, "image/png")
        self.assertEqual(r.data["images"][0]["largeur"], 1600)

    def test_fichier_refuse_rien_n_est_publie(self):
        faux = SimpleUploadedFile("virus.jpg", b"ceci n'est pas une image", content_type="image/jpeg")
        r = self.publier([fichier_image(), faux])
        self.assertEqual(r.status_code, 400)
        self.assertIn("n'est pas une image valide", str(r.data))
        self.assertFalse(Annonce.objects.exists())

    @override_settings(ANNONCES_IMAGES_MAX=2)
    def test_nombre_maximum_d_images(self):
        r = self.publier([fichier_image("1.jpg"), fichier_image("2.jpg"), fichier_image("3.jpg")])
        self.assertEqual(r.status_code, 400)
        self.assertIn("2 images au maximum", str(r.data))

    def test_ajout_et_retrait_d_images_en_modification(self):
        annonce_id = self.publier([fichier_image("a.jpg"), fichier_image("b.jpg")]).data["id"]
        a_retirer = ImageAnnonce.objects.get(nom_fichier="a.jpg").pk
        r = self.client.patch(f"/api/v1/annonces/{annonce_id}/", {
            "images": [fichier_image("c.jpg")], "images_a_retirer": [str(a_retirer)],
        }, format="multipart")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual([i["nom_fichier"] for i in r.data["images"]], ["b.jpg", "c.jpg"])

    def test_publication_sans_image_toujours_possible(self):
        r = self.client.post("/api/v1/annonces/", {"titre": "Info", "contenu": "Texte", "public_cible": "tous"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["images"], [])

    def test_annonce_supprimee_puis_restauree_avec_ses_images(self):
        annonce_id = self.publier([fichier_image("a.jpg")]).data["id"]
        self.assertEqual(self.client.delete(f"/api/v1/annonces/{annonce_id}/").status_code, 204)
        self.assertFalse(ImageAnnonce.objects.exists())
        [element] = self.client.get("/api/v1/corbeille/").data["results"]
        self.assertEqual(self.client.post(f"/api/v1/corbeille/{element['id']}/restaurer/").status_code, 200)
        image = ImageAnnonce.objects.get()
        self.assertEqual(Image.open(io.BytesIO(bytes(image.contenu))).size, (800, 600))

    def test_image_inexistante(self):
        import uuid

        self.assertEqual(APIClient(HTTP_HOST="localhost").get(f"/api/v1/annonces/images/{uuid.uuid4()}/").status_code, 404)
