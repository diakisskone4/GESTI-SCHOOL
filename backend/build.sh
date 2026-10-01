#!/usr/bin/env bash
# Script de build exécuté par Render à chaque déploiement du backend.
set -o errexit

pip install -r requirements.txt
python manage.py collectstatic --no-input
python manage.py migrate --no-input

# Crée (ou répare) le compte administrateur
if [ -n "$DJANGO_SUPERUSER_EMAIL" ] && [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
python manage.py shell <<'EOF'
import os
from django.contrib.auth import get_user_model

User = get_user_model()
email = os.environ["DJANGO_SUPERUSER_EMAIL"]
password = os.environ["DJANGO_SUPERUSER_PASSWORD"]
username = os.environ.get("DJANGO_SUPERUSER_USERNAME", "admin")

try:
    user = User.objects.filter(email=email).first()
    if user is None:
        extra = {}
        field_names = [f.name for f in User._meta.get_fields()]
        if User.USERNAME_FIELD != "username" and "username" in field_names:
            extra["username"] = username
        User.objects.create_superuser(
            **{User.USERNAME_FIELD: email if User.USERNAME_FIELD == "email" else username},
            email=email,
            password=password,
            **extra,
        ) if User.USERNAME_FIELD != "email" else User.objects.create_superuser(
            email=email, password=password, **extra
        )
        print(f"✅ Superutilisateur créé : {email}")
    else:
        user.is_staff = True
        user.is_superuser = True
        user.is_active = True
        user.save()
        print(f"ℹ️ Superutilisateur déjà existant : {email} (droits vérifiés)")
except Exception as e:
    print(f"❌ Échec création superutilisateur : {type(e).__name__}: {e}")
EOF
fi