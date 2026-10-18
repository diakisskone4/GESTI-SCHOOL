"""Crée un compte de l'équipe développeurs (accès à la console /console).

    python manage.py creer_developpeur --email moi@exemple.com --prenom Diakaria --nom Kone

Le mot de passe est demandé de façon masquée (ou via --mot-de-passe / la variable
DEVELOPPEUR_MOT_DE_PASSE pour un usage non interactif, ex. sur Render).
"""
import getpass
import os

from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import User


class Command(BaseCommand):
    help = "Crée un compte développeur (console de gestion des établissements)."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True)
        parser.add_argument("--prenom", default="")
        parser.add_argument("--nom", default="")
        parser.add_argument("--mot-de-passe", dest="mot_de_passe", default=os.environ.get("DEVELOPPEUR_MOT_DE_PASSE"))

    def handle(self, *args, email, prenom, nom, mot_de_passe, **options):
        if User.objects.filter(email__iexact=email).exists():
            raise CommandError(f"Un compte existe déjà avec l'email {email}.")
        if not mot_de_passe:
            mot_de_passe = getpass.getpass("Mot de passe : ")
            if mot_de_passe != getpass.getpass("Confirmation : "):
                raise CommandError("Les mots de passe ne correspondent pas.")
        try:
            password_validation.validate_password(mot_de_passe)
        except ValidationError as exc:
            raise CommandError(" ".join(exc.messages))
        user = User(email=email, first_name=prenom, last_name=nom, role=User.Role.DEVELOPPEUR)
        user.set_password(mot_de_passe)
        user.save()
        self.stdout.write(self.style.SUCCESS(f"Compte développeur créé : {email}. Connectez-vous puis ouvrez /console."))
