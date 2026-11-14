"""Tests de l'import de listes d'élèves (Excel, CSV, PDF)."""
import datetime
import io

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from openpyxl import Workbook

from apps.students.importation import cle_classe, lire_date, separer_nom_complet
from apps.students.models import ArchiveEleves, Eleve, Inscription
from apps.students.tests import ElevesTestsBase


def fichier_excel(onglets):
    classeur = Workbook()
    classeur.remove(classeur.active)
    for titre, lignes in onglets.items():
        onglet = classeur.create_sheet(titre)
        for ligne in lignes:
            onglet.append(ligne)
    flux = io.BytesIO()
    classeur.save(flux)
    return SimpleUploadedFile("liste.xlsx", flux.getvalue())


def fichier_pdf(titre, lignes):
    from reportlab.lib.pagesizes import A4
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet

    flux = io.BytesIO()
    tableau = Table(lignes)
    tableau.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.5, "black")]))
    SimpleDocTemplate(flux, pagesize=A4).build([Paragraph(titre, getSampleStyleSheet()["Title"]), tableau])
    return SimpleUploadedFile("liste.pdf", flux.getvalue())


class OutilsImportTests(ElevesTestsBase):
    def test_noms_dates_et_classes(self):
        self.assertEqual(separer_nom_complet("TRAORE Awa Maïmouna"), ("TRAORE", "Awa Maïmouna"))
        self.assertEqual(separer_nom_complet("Ansoumane Aly BANGOURA"), ("BANGOURA", "Ansoumane Aly"))
        self.assertEqual(separer_nom_complet("Moussa Diarra"), ("Diarra", "Moussa"))
        self.assertEqual(lire_date("05/03/2013"), "2013-03-05")
        self.assertEqual(lire_date("2013-03-05"), "2013-03-05")
        self.assertEqual(lire_date(datetime.date(2013, 3, 5)), "2013-03-05")
        self.assertEqual(lire_date("41338"), "2013-03-05")  # numéro de série Excel
        self.assertEqual(lire_date("31/02/2013"), "")
        self.assertEqual(cle_classe("Classe 6ème A"), cle_classe("6e A"))
        self.assertEqual(cle_classe("1ère année"), "1e annee")


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class ImportElevesTests(ElevesTestsBase):
    URL_ANALYSE = "/api/v1/eleves/importer/analyser/"

    def analyser(self, fichier, **extra):
        r = self.client.post(self.URL_ANALYSE, {"fichier": fichier, **extra}, format="multipart")
        self.assertEqual(r.status_code, 200, r.data)
        return r.data

    def test_excel_un_onglet_par_classe(self):
        entete = ["N°", "Nom", "Prénom(s)", "Sexe", "Date de naissance", "Lieu de naissance"]
        fichier = fichier_excel({
            "6ème CSM": [["COMPLEXE SCOLAIRE"], [], entete,
                         [1, "Coulibaly", "Fanta", "F", datetime.datetime(2013, 4, 2), "Bamako"],
                         [2, "Keita", "Oumar", "Garçon", "12/09/2012", "Kati"],
                         ["Total : 2"]],
            "5e B": [entete, [1, "Sangare", "Issa", "M", "2011-01-20", ""]],
        })
        apercu = self.analyser(fichier)
        lignes = apercu["lignes"]
        self.assertEqual([(l["nom"], l["prenom"], l["sexe"], l["date_naissance"]) for l in lignes], [
            ("COULIBALY", "Fanta", "F", "2013-04-02"), ("KEITA", "Oumar", "M", "2012-09-12"),
            ("SANGARE", "Issa", "M", "2011-01-20")])
        self.assertEqual([l["classe"] for l in lignes], [self.classe_a.id, self.classe_a.id, self.classe_b.id])
        self.assertEqual(apercu["resume"], {"nouveau": 3})
        self.assertEqual(Eleve.objects.filter(nom="COULIBALY").count(), 0)  # l'aperçu n'enregistre rien

        with self.captureOnCommitCallbacks(execute=True):  # l'archive ZIP est créée après validation en base
            r = self.client.post("/api/v1/eleves/importer/", {"lignes": lignes}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual((r.data["crees"], r.data["inscrits"]), (3, 3))
        self.assertEqual(r.data["par_classe"], {"6e CSM": 2, "5e B": 1})
        fanta = Eleve.objects.get(nom="COULIBALY", prenom="Fanta")
        self.assertEqual(fanta.lieu_naissance, "Bamako")
        self.assertTrue(fanta.matricule)
        self.assertEqual(Inscription.objects.get(eleve=fanta).classe, self.classe_a)
        self.assertTrue(ArchiveEleves.objects.filter(etablissement=self.etab).exists())

        # Un second import du même fichier ne crée aucun doublon
        apercu = self.analyser(fichier_excel({"6ème CSM": [entete, [1, "Coulibaly", "Fanta", "F", "02/04/2013", ""]]}))
        self.assertEqual(apercu["lignes"][0]["statut"], "deja_inscrit")
        r = self.client.post("/api/v1/eleves/importer/", {"lignes": apercu["lignes"]}, format="json")
        self.assertEqual((r.data["inscrits"], r.data["ignores"]), (0, 1))

    def test_csv_colonne_classe_et_nom_complet(self):
        contenu = (
            "Matricule;Nom et Prénom;Genre;Né(e) le;Classe;Téléphone parent\n"
            ";TRAORE Awa;F;05/03/2013;6e CSM;76 00 00 00\n"
            ";Ibrahim DIALLO;M;10/10/2011;Classe 5ème B;\n"
            ";Mariam Sylla;F;;7e Z;\n"
            ";TRAORE Awa;F;05/03/2013;6e CSM;\n"
        ).encode("cp1252")
        apercu = self.analyser(SimpleUploadedFile("liste.csv", contenu))
        lignes = apercu["lignes"]
        self.assertEqual([(l["nom"], l["prenom"]) for l in lignes],
                         [("TRAORE", "Awa"), ("DIALLO", "Ibrahim"), ("SYLLA", "Mariam"), ("TRAORE", "Awa")])
        self.assertEqual(lignes[0]["contact_urgence_telephone"], "76 00 00 00")
        self.assertEqual(lignes[1]["classe"], self.classe_b.id)
        self.assertEqual(lignes[2]["statut"], "erreur")  # classe inconnue et date manquante
        self.assertIn("Classe à choisir", lignes[2]["erreurs"])
        self.assertEqual(apercu["classes_non_reconnues"], ["7e Z"])
        self.assertEqual(lignes[3]["statut"], "doublon")

        # L'administrateur complète la ligne en erreur dans l'aperçu
        lignes[2].update({"classe": self.classe_b.id, "date_naissance": "2012-06-01"})
        r = self.client.post("/api/v1/eleves/importer/", {"lignes": lignes}, format="json")
        self.assertEqual((r.data["inscrits"], r.data["ignores"], r.data["erreurs"]), (3, 1, []))
        self.assertEqual(Eleve.objects.filter(nom="TRAORE", prenom="Awa").count(), 1)

    def test_pdf_avec_titre_de_classe(self):
        fichier = fichier_pdf("Liste des eleves - Classe : 5e B", [
            ["N°", "Nom", "Prénom", "Sexe", "Date de naissance"],
            ["1", "Konate", "Salif", "M", "03/02/2011"],
            ["2", "Dembele", "Nana", "F", "14/07/2011"],
        ])
        lignes = self.analyser(fichier)["lignes"]
        self.assertEqual([(l["nom"], l["prenom"], l["classe"]) for l in lignes],
                         [("KONATE", "Salif", self.classe_b.id), ("DEMBELE", "Nana", self.classe_b.id)])

    def test_eleve_existant_reinscrit_et_classe_par_defaut(self):
        existant = Eleve.objects.get(nom="SANSCLASSE")
        contenu = f"Nom;Prénom;Sexe;Date de naissance\nSansclasse;Ali;M;{existant.date_naissance:%d/%m/%Y}\n".encode()
        apercu = self.analyser(SimpleUploadedFile("l.csv", contenu), classe=self.classe_b.id)
        ligne = apercu["lignes"][0]
        self.assertEqual((ligne["statut"], ligne["classe"]), ("existant", self.classe_b.id))
        r = self.client.post("/api/v1/eleves/importer/", {"lignes": apercu["lignes"]}, format="json")
        self.assertEqual((r.data["crees"], r.data["inscrits"]), (0, 1))
        self.assertEqual(Inscription.objects.get(eleve=existant).type_inscription, "reinscription")

    def test_fichiers_refuses_et_droits(self):
        r = self.client.post(self.URL_ANALYSE, {"fichier": SimpleUploadedFile("a.xls", b"x")}, format="multipart")
        self.assertEqual(r.status_code, 400)
        self.assertIn(".xlsx", str(r.data["fichier"]))
        r = self.client.post(self.URL_ANALYSE, {"fichier": SimpleUploadedFile("a.csv", b"bonjour\n")}, format="multipart")
        self.assertEqual(r.status_code, 400)
        # Une classe d'un autre établissement ne peut pas recevoir les élèves importés
        from apps.core.tests import creer_etablissement

        _, autre_classe, _ = creer_etablissement("AUT")
        ligne = {"nom": "X", "prenom": "Y", "sexe": "M", "date_naissance": "2012-01-01", "classe": autre_classe.id}
        r = self.client.post("/api/v1/eleves/importer/", {"lignes": [ligne]}, format="json")
        self.assertEqual(r.data["inscrits"], 0)
        self.assertFalse(Eleve.objects.filter(nom="X").exists())
