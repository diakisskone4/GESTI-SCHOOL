"""Commande de démonstration : crée un jeu de données minimal pour tester l'ERP.

Usage: python manage.py seed_demo
"""
import datetime
from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = "Crée un établissement, une année scolaire, des classes, un admin, un enseignant et des élèves de démonstration."

    @transaction.atomic
    def handle(self, *args, **options):
        from django.contrib.auth import get_user_model
        from apps.core.models import AnneeScolaire, Classe, Matiere, Niveau, Periode, Etablissement
        from apps.staff.models import Enseignant
        from apps.students.models import Eleve, Inscription

        User = get_user_model()

        etab, _ = Etablissement.objects.get_or_create(
            sigle="LBF", defaults=dict(
                nom="Lycée Baladji Faladiè", type_etablissement="mixte",
                ville="Faladiè", pays="Mali", telephone="+223 70 00 00 00",
                email="contact@lbf-edu.ml",
            ),
        )
        self.stdout.write(self.style.SUCCESS(f"Établissement: {etab}"))

        annee, _ = AnneeScolaire.objects.get_or_create(
            etablissement=etab, libelle="2025-2026",
            defaults=dict(date_debut="2025-10-01", date_fin="2026-07-31", est_courante=True),
        )

        periode, _ = Periode.objects.get_or_create(
            annee_scolaire=annee, type_periode="trimestre", numero=1,
            defaults=dict(date_debut="2025-10-01", date_fin="2025-12-20", est_courante=True),
        )

        niveau_6e, _ = Niveau.objects.get_or_create(etablissement=etab, nom="6e", defaults=dict(cycle="secondaire_1", ordre=7))
        niveau_tle, _ = Niveau.objects.get_or_create(etablissement=etab, nom="Terminale", defaults=dict(cycle="secondaire_2", ordre=13))

        classe_6e_a, _ = Classe.objects.get_or_create(
            etablissement=etab, annee_scolaire=annee, niveau=niveau_6e, nom="6e A",
            defaults=dict(effectif_max=50, salle="Salle 1"),
        )

        matiere_maths, _ = Matiere.objects.get_or_create(etablissement=etab, nom="Mathématiques", defaults=dict(code="MATH", coefficient_defaut=4))
        matiere_francais, _ = Matiere.objects.get_or_create(etablissement=etab, nom="Français", defaults=dict(code="FR", coefficient_defaut=4))

        # Admin
        if not User.objects.filter(email="admin@gesti-scolaire.local").exists():
            admin = User.objects.create_superuser(
                email="admin@gesti-scolaire.local", password="Admin@1234",
                first_name="Super", last_name="Admin",
            )
            admin.etablissement_courant = etab
            admin.etablissements.add(etab)
            admin.save()
            self.stdout.write(self.style.SUCCESS("Admin créé: admin@gesti-scolaire.local / Admin@1234"))

        # Enseignant
        if not User.objects.filter(email="enseignant@gesti-scolaire.local").exists():
            user_ens = User.objects.create_user(
                email="enseignant@gesti-scolaire.local", password="Ensgt@1234",
                first_name="Awa", last_name="Traoré", role=User.Role.ENSEIGNANT,
            )
            user_ens.etablissements.add(etab)
            enseignant = Enseignant.objects.create(
                user=user_ens, etablissement=etab, nom="Traoré", prenom="Awa", sexe="F",
                grade_academique="Professeur certifié",
            )
            enseignant.matieres_enseignees.add(matiere_maths)
            classe_6e_a.professeur_principal = enseignant
            classe_6e_a.save()
            self.stdout.write(self.style.SUCCESS("Enseignant créé: enseignant@gesti-scolaire.local / Ensgt@1234"))

        # Élève
        if not Eleve.objects.filter(nom="Diallo", prenom="Ibrahim").exists():
            eleve = Eleve.objects.create(
                etablissement=etab, nom="Diallo", prenom="Ibrahim", sexe="M",
                date_naissance=datetime.date(2012, 5, 14), lieu_naissance="Bamako",
            )
            Inscription.objects.create(eleve=eleve, classe=classe_6e_a, annee_scolaire=annee)
            self.stdout.write(self.style.SUCCESS(f"Élève créé: {eleve} - {eleve.matricule}"))

        self.stdout.write(self.style.SUCCESS("Jeu de données de démonstration créé avec succès."))
