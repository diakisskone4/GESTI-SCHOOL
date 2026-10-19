"""Crée ou met à jour le compte d'administration technique (/admin) à partir des variables d'environnement.

    DJANGO_SUPERUSER_EMAIL=... DJANGO_SUPERUSER_PASSWORD=... python manage.py assurer_superutilisateur

Exécutée à chaque déploiement (build.sh) : le compte existe toujours, avec exactement le mot de passe
défini sur l'hébergeur. Changer la variable puis redéployer suffit donc à réinitialiser le mot de passe.
"""
import os

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.accounts.models import User


class Command(BaseCommand):
    help = "Crée ou met à jour le superutilisateur défini par DJANGO_SUPERUSER_EMAIL / DJANGO_SUPERUSER_PASSWORD."

    @transaction.atomic
    def handle(self, *args, **options):
        email = (os.environ.get("DJANGO_SUPERUSER_EMAIL") or "").strip()
        password = os.environ.get("DJANGO_SUPERUSER_PASSWORD") or ""
        if not email or not password:
            self.stdout.write("DJANGO_SUPERUSER_EMAIL / DJANGO_SUPERUSER_PASSWORD absents : rien à faire.")
            return
        if "@" not in email:
            raise CommandError(f"DJANGO_SUPERUSER_EMAIL invalide : « {email} ».")

        user = User.objects.filter(email__iexact=email).first()
        cree = user is None
        if cree:
            user = User(email=email, username=email, role=User.Role.ADMIN)
        user.first_name = os.environ.get("DJANGO_SUPERUSER_FIRST_NAME", user.first_name or "")
        user.last_name = os.environ.get("DJANGO_SUPERUSER_LAST_NAME", user.last_name or "")
        user.is_staff = user.is_superuser = user.is_active = True
        user.set_password(password)
        user.save()
        etat = "créé" if cree else "mis à jour (droits et mot de passe)"
        self.stdout.write(self.style.SUCCESS(f"Superutilisateur {etat} : {user.email}"))
