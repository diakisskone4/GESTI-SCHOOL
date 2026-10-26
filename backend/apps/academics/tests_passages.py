"""Tests du passage en classe supérieure : décisions de fin d'année, bulletin, transfert vers l'année suivante."""
import datetime
from decimal import Decimal

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.academics.models import Bulletin, DecisionPassage, MoyenneMatiere
from apps.academics.passages import libelle_decision
from apps.accounts.models import User
from apps.core.models import AnneeScolaire, Classe, Etablissement, Matiere, Niveau, Periode
from apps.students.models import Eleve, Inscription

STOCKAGE_TEST = {
    "default": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}


@override_settings(STORAGES=STOCKAGE_TEST)
class PassagesTests(TestCase):
    def setUp(self):
        self.etab = Etablissement.objects.create(nom="Collège Mama Dembélé", sigle="CMD")
        self.annee = AnneeScolaire.objects.create(etablissement=self.etab, libelle="2026-2027", est_courante=True,
                                                  date_debut=datetime.date(2026, 10, 1), date_fin=datetime.date(2027, 7, 31))
        self.periodes = [
            Periode.objects.create(annee_scolaire=self.annee, numero=n, date_debut=datetime.date(2026, 10, 1) + datetime.timedelta(days=90 * (n - 1)),
                                   date_fin=datetime.date(2026, 12, 20) + datetime.timedelta(days=90 * (n - 1)))
            for n in (1, 2, 3)
        ]
        self.n6 = Niveau.objects.create(etablissement=self.etab, nom="6e", cycle="secondaire_1", ordre=1)
        self.n5 = Niveau.objects.create(etablissement=self.etab, nom="5e", cycle="secondaire_1", ordre=2)
        self.tle = Niveau.objects.create(etablissement=self.etab, nom="Terminale", cycle="secondaire_2", ordre=9)
        self.c6a = Classe.objects.create(etablissement=self.etab, annee_scolaire=self.annee, niveau=self.n6, nom="6e A")
        self.ctle = Classe.objects.create(etablissement=self.etab, annee_scolaire=self.annee, niveau=self.tle, nom="Terminale SE")
        self.maths = Matiere.objects.create(etablissement=self.etab, nom="Maths")
        # Moyennes par trimestre : (T1, T2, T3) -> moyenne annuelle
        self.eleves = {}
        for nom, classe, notes in [("ADMISE", self.c6a, (11, 12, 13)), ("JUSTE", self.c6a, (10, 9, 11)),
                                   ("REDOUBLE", self.c6a, (8, 9, 7.5)), ("BACHELIER", self.ctle, (14, 12, 13))]:
            eleve = Eleve.objects.create(etablissement=self.etab, nom=nom, prenom="Awa", sexe="F", date_naissance=datetime.date(2012, 1, 1))
            insc = Inscription.objects.create(eleve=eleve, classe=classe, annee_scolaire=self.annee)
            for periode, note in zip(self.periodes, notes):
                MoyenneMatiere.objects.create(inscription=insc, matiere=self.maths, periode=periode, moyenne=Decimal(str(note)))
            self.eleves[nom] = insc

        self.admin = User.objects.create_user(email="admin@cmd.ml", password="x", role="admin", etablissement_courant=self.etab)
        self.admin.etablissements.add(self.etab)
        self.client = APIClient(HTTP_HOST="localhost")
        self.client.force_authenticate(self.admin)

    def calculer(self, periode):
        for classe in (self.c6a, self.ctle):
            r = self.client.post("/api/v1/bulletins/calculer/", {"classe": classe.pk, "periode": periode.pk}, format="json")
            self.assertEqual(r.status_code, 200, r.data)

    def decision(self, nom):
        return DecisionPassage.objects.get(inscription=self.eleves[nom])

    def test_decisions_automatiques_a_la_fin_du_3e_trimestre(self):
        self.calculer(self.periodes[0])
        self.calculer(self.periodes[1])
        self.assertFalse(DecisionPassage.objects.exists())  # pas avant la dernière période
        self.calculer(self.periodes[2])
        self.assertEqual(self.decision("ADMISE").moyenne_annuelle, Decimal("12.00"))
        self.assertEqual((self.decision("ADMISE").decision, self.decision("ADMISE").niveau_suivant), ("admis", "5e"))
        self.assertEqual(self.decision("JUSTE").decision, "admis")  # 10/20 pile : admis
        self.assertEqual(self.decision("REDOUBLE").decision, "redouble")
        self.assertEqual(self.decision("BACHELIER").decision, "fin_cycle")  # dernier niveau
        self.assertEqual(libelle_decision(self.decision("ADMISE")), "ADMIS(E) EN 5e")
        self.assertEqual(libelle_decision(self.decision("REDOUBLE")), "REDOUBLE LA 6e")
        self.assertEqual(self.decision("ADMISE").rang_annuel, 1)

    def test_seuil_et_decision_du_conseil(self):
        for p in self.periodes:
            self.calculer(p)
        self.etab.moyenne_passage = Decimal("10.50")
        self.etab.save()
        self.client.post("/api/v1/passages/calculer/", {}, format="json")
        self.assertEqual(self.decision("JUSTE").decision, "redouble")
        # Le conseil de classe repêche l'élève : la décision n'est plus recalculée
        r = self.client.patch(f"/api/v1/passages/{self.decision('JUSTE').pk}/", {"decision": "admis", "motif": "Conseil de classe"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.client.post("/api/v1/passages/calculer/", {}, format="json")
        self.assertEqual((self.decision("JUSTE").decision, self.decision("JUSTE").manuelle), ("admis", True))
        self.client.patch(f"/api/v1/passages/{self.decision('JUSTE').pk}/", {"decision": "auto"}, format="json")
        self.assertEqual((self.decision("JUSTE").decision, self.decision("JUSTE").manuelle), ("redouble", False))

    def test_vue_d_ensemble(self):
        for p in self.periodes:
            self.calculer(p)
        data = self.client.get("/api/v1/passages/").data
        self.assertEqual(data["totaux"], {"admis": 2, "redouble": 1, "fin_cycle": 1, "sans_resultat": 0, "transferes": 0})
        sixieme = next(c for c in data["classes"] if c["nom"] == "6e A")
        self.assertEqual(sixieme["niveau_suivant"], "5e")
        premier = sixieme["eleves"][0]
        self.assertEqual(premier["moyennes"], [Decimal("11.00"), Decimal("12.00"), Decimal("13.00")])
        self.assertEqual(premier["decision"]["libelle"], "ADMIS(E) EN 5e")

    def test_bulletin_du_3e_trimestre_avec_la_decision(self):
        from apps.academics.passages import decision_pour_bulletin

        for p in self.periodes:
            self.calculer(p)
        b1 = Bulletin.objects.get(inscription=self.eleves["REDOUBLE"], periode=self.periodes[0])
        b3 = Bulletin.objects.get(inscription=self.eleves["REDOUBLE"], periode=self.periodes[2])
        self.assertIsNone(decision_pour_bulletin(b1))
        self.assertEqual(decision_pour_bulletin(b3), {"texte": "REDOUBLE LA 6e", "admis": False, "moyenne_annuelle": 8.17, "nb_periodes": 3})
        for taille in ("a4", "a5"):
            r = self.client.get(f"/api/v1/bulletins/{b3.pk}/pdf/", {"taille": taille})
            self.assertEqual(r.status_code, 200)
            contenu = b"".join(r.streaming_content) if hasattr(r, "streaming_content") else r.content
            self.assertTrue(contenu.startswith(b"%PDF"))

    def test_transfert_vers_l_annee_suivante_puis_annulation(self):
        for p in self.periodes:
            self.calculer(p)
        r = self.client.post("/api/v1/passages/transferer/", {}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual((r.data["admis"], r.data["redoublants"], r.data["fin_cycle"]), (2, 1, 1))
        suivante = AnneeScolaire.objects.get(libelle="2027-2028")
        self.assertEqual(suivante.date_debut, datetime.date(2027, 10, 1))
        self.assertFalse(suivante.est_courante)

        def classe_suivante(nom):
            return Inscription.objects.get(eleve=self.eleves[nom].eleve, annee_scolaire=suivante)

        self.assertEqual(classe_suivante("ADMISE").classe.nom, "5e A")      # 6e A -> 5e A (classe créée)
        self.assertFalse(classe_suivante("ADMISE").redoublant)
        self.assertEqual(classe_suivante("REDOUBLE").classe.nom, "6e A")    # reste dans sa classe
        self.assertTrue(classe_suivante("REDOUBLE").redoublant)
        self.assertFalse(Inscription.objects.filter(eleve=self.eleves["BACHELIER"].eleve, annee_scolaire=suivante).exists())
        # L'année qui se termine est conservée telle quelle
        self.assertEqual(self.eleves["ADMISE"].classe.nom, "6e A")
        self.assertEqual(Inscription.objects.get(pk=self.eleves["ADMISE"].pk).statut, "active")
        # Un deuxième transfert ne crée rien de plus
        r = self.client.post("/api/v1/passages/transferer/", {}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(Inscription.objects.filter(annee_scolaire=suivante).count(), 3)
        # Annulation
        r = self.client.post("/api/v1/passages/annuler/", {}, format="json")
        self.assertEqual(r.data["annulees"], 3)
        self.assertFalse(Inscription.objects.filter(annee_scolaire=suivante).exists())

    def test_transfert_impossible_sans_decision_et_droits(self):
        r = self.client.post("/api/v1/passages/transferer/", {}, format="json")
        self.assertEqual(r.status_code, 400)
        prof = User.objects.create_user(email="p@cmd.ml", password="x", role="enseignant", etablissement_courant=self.etab)
        prof.etablissements.add(self.etab)
        client = APIClient(HTTP_HOST="localhost")
        client.force_authenticate(prof)
        self.assertEqual(client.get("/api/v1/passages/").status_code, 200)
        self.assertEqual(client.post("/api/v1/passages/transferer/", {}, format="json").status_code, 403)
