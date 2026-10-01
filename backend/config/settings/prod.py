from .base import *  # noqa
from decouple import Csv, config

DEBUG = False

# --- Hébergement derrière un proxy HTTPS (Render, Railway, Nginx...) -------------
# Le proxy termine le TLS : sans cet en-tête, SECURE_SSL_REDIRECT boucle à l'infini.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Render fournit automatiquement le nom d'hôte public du service.
RENDER_EXTERNAL_HOSTNAME = config("RENDER_EXTERNAL_HOSTNAME", default="")
if RENDER_EXTERNAL_HOSTNAME and "*" not in ALLOWED_HOSTS:  # noqa: F405
    ALLOWED_HOSTS.append(RENDER_EXTERNAL_HOSTNAME)  # noqa: F405

CSRF_TRUSTED_ORIGINS = config("CSRF_TRUSTED_ORIGINS", default="", cast=Csv())
if RENDER_EXTERNAL_HOSTNAME:
    CSRF_TRUSTED_ORIGINS.append(f"https://{RENDER_EXTERNAL_HOSTNAME}")

# --- Fichiers statiques (admin Django, Swagger) servis par WhiteNoise -------------
MIDDLEWARE.insert(  # noqa: F405
    MIDDLEWARE.index("django.middleware.security.SecurityMiddleware") + 1,  # noqa: F405
    "whitenoise.middleware.WhiteNoiseMiddleware",
)
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

# --- Fichiers uploadés (logos, photos, pièces jointes) ----------------------------
# Sur Render, MEDIA_ROOT doit pointer vers un disque persistant (ex: /var/data/media),
# sinon les fichiers sont perdus à chaque redéploiement.
MEDIA_ROOT = config("MEDIA_ROOT", default=str(MEDIA_ROOT))  # noqa: F405
SERVE_MEDIA = config("SERVE_MEDIA", default=False, cast=bool)

SECURE_SSL_REDIRECT = config("SECURE_SSL_REDIRECT", default=True, cast=bool)
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
