#!/usr/bin/env bash
# Script de build exécuté par Render à chaque déploiement du backend.
set -o errexit

pip install -r requirements.txt
python manage.py collectstatic --no-input
python manage.py migrate --no-input

# Crée ou met à jour le compte d'administration (/admin) avec le mot de passe défini sur Render.
# En cas d'échec, le déploiement s'arrête (au lieu de continuer avec un compte inutilisable).
python manage.py assurer_superutilisateur
