#!/usr/bin/env bash
# Script de build exécuté par Render à chaque déploiement du backend.
set -o errexit

pip install -r requirements.txt
python manage.py collectstatic --no-input
python manage.py migrate --no-input

# Crée le compte administrateur au premier déploiement (ignoré s'il existe déjà).
if [ -n "$DJANGO_SUPERUSER_EMAIL" ] && [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
  python manage.py createsuperuser --no-input || echo "Superutilisateur déjà existant."
fi
