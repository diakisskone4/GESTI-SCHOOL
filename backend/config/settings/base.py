"""
Réglages communs de Gesti-Scolaire ERP.
Compatible développement local (.env) et production sur Render.
"""
from pathlib import Path
from datetime import timedelta
from decouple import config, Csv
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = config("SECRET_KEY", default="django-insecure-change-me-in-prod")
DEBUG = config("DEBUG", default=True, cast=bool)

# ---------------------------------------------------------------------------
# Hôtes autorisés (Render fournit RENDER_EXTERNAL_HOSTNAME automatiquement)
# ---------------------------------------------------------------------------
ALLOWED_HOSTS = config("ALLOWED_HOSTS", default="localhost,127.0.0.1", cast=Csv())
RENDER_EXTERNAL_HOSTNAME = config("RENDER_EXTERNAL_HOSTNAME", default="")
if RENDER_EXTERNAL_HOSTNAME:
    ALLOWED_HOSTS.append(RENDER_EXTERNAL_HOSTNAME)

# Application definition
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "drf_yasg",
]

LOCAL_APPS = [
    "apps.core",
    "apps.accounts",
    "apps.students",
    "apps.staff",
    "apps.academics",
    "apps.documents_mgmt",
    "apps.finance",
    "apps.payroll",
    "apps.communication",
    "apps.reporting",
    "apps.plateforme",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

AUTH_USER_MODEL = "accounts.User"

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "apps.core.middleware.EntetesSecuriteMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",  # fichiers statiques en production
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.core.middleware.ActivityLogMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# ---------------------------------------------------------------------------
# Base de données (PostgreSQL)
# - Sur Render : variable DATABASE_URL (Internal Database URL)
# - En local   : variables DB_* du fichier .env
# ---------------------------------------------------------------------------
DATABASE_URL = config("DATABASE_URL", default="")

if DATABASE_URL:
    DATABASES = {
        "default": dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=600,
            conn_health_checks=True,
        )
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": config("DB_NAME", default="gesti_scolaire"),
            "USER": config("DB_USER", default="postgres"),
            "PASSWORD": config("DB_PASSWORD", default=""),  # dans backend/.env, jamais dans le code
            "HOST": config("DB_HOST", default="localhost"),
            "PORT": config("DB_PORT", default="5432"),
        }
    }

# Authentification par e-mail avec blocage temporaire après trop d'échecs (apps/accounts/protection.py)
AUTHENTICATION_BACKENDS = ["apps.accounts.protection.AuthentificationProtegee"]
CONNEXION_ECHECS_MAX = config("CONNEXION_ECHECS_MAX", default=8, cast=int)
CONNEXION_BLOCAGE_MINUTES = config("CONNEXION_BLOCAGE_MINUTES", default=15, cast=int)

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "fr-fr"
TIME_ZONE = "Africa/Bamako"
USE_I18N = True
USE_TZ = True

LANGUAGES = [
    ("fr", "Français"),
    ("en", "English"),
    ("bm", "Bamanankan"),
]
LOCALE_PATHS = [BASE_DIR / "locale"]

# ---------------------------------------------------------------------------
# Fichiers statiques et médias
# ---------------------------------------------------------------------------
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

STORAGES = {
    "default": {
        # Adresses /media/ signées et temporaires (apps/core/media_securise.py)
        "BACKEND": "apps.core.media_securise.StockageSigne",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

# Durée de validité des liens vers les fichiers (/media/) renvoyés par l'API
MEDIA_LIEN_DUREE_HEURES = config("MEDIA_LIEN_DUREE_HEURES", default=24, cast=int)

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Adresse de l'administration Django (ex. « gestion-7f3k/ ») : évite d'exposer la classique « admin/ »
ADMIN_URL = config("ADMIN_URL", default="admin/").strip("/") + "/"

# Requêtes : taille maximale hors fichiers (formulaires, JSON) et nombre de champs
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024
DATA_UPLOAD_MAX_NUMBER_FIELDS = 5000

# ---------------------------------------------------------------------------
# Django REST Framework
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        # JWT + vérification de l'abonnement de l'établissement (apps/plateforme/acces.py)
        "apps.plateforme.acces.JWTAuthentificationAbonnement",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
    "DATETIME_FORMAT": "%Y-%m-%dT%H:%M:%S%z",
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.ScopedRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "auth": "20/min",
        # Formulaire de contact du site vitrine (par adresse IP)
        "contact": "10/hour",
    },
    "EXCEPTION_HANDLER": "apps.core.exceptions.exception_handler",
    # Nombre de proxys devant l'API (Render : à confirmer) ; sans réglage, l'adresse IP utilisée par la
    # limitation de débit peut être falsifiée par l'en-tête X-Forwarded-For.
    "NUM_PROXIES": config("NUM_PROXIES", default=None, cast=lambda v: int(v) if v not in (None, "") else None),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=config("JWT_ACCESS_MIN", default=30, cast=int)),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=config("JWT_REFRESH_DAYS", default=7, cast=int)),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

# ---------------------------------------------------------------------------
# CORS / CSRF
# ---------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000",
    cast=Csv(),
)
CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = config("CSRF_TRUSTED_ORIGINS", default="", cast=Csv())

# ---------------------------------------------------------------------------
# Sécurité en production (actif quand DEBUG=False)
# Render termine le HTTPS devant l'application et redirige déjà HTTP -> HTTPS.
# ---------------------------------------------------------------------------
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin"
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
X_FRAME_OPTIONS = "DENY"

if not DEBUG:
    # Clé secrète obligatoire : avec la clé par défaut, n'importe qui pourrait fabriquer des jetons
    # de connexion ou des liens de fichiers valides.
    if SECRET_KEY.startswith("django-insecure") or SECRET_KEY in ("change-me-in-production", "") or len(SECRET_KEY) < 32:
        from django.core.exceptions import ImproperlyConfigured

        raise ImproperlyConfigured("SECRET_KEY absente ou trop faible : définissez une clé longue et aléatoire.")
    # Cache partagé entre les processus du serveur (blocages de connexion, limitation de débit)
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.db.DatabaseCache", "LOCATION": "gs_cache"}}
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 3600
    SECURE_CONTENT_TYPE_NOSNIFF = True

# ---------------------------------------------------------------------------
# Gesti-Scolaire: options métier
# ---------------------------------------------------------------------------
# Préfixe utilisé pour la génération automatique des matricules élèves
MATRICULE_PREFIX = config("MATRICULE_PREFIX", default="GS")

# Archives ZIP des données élèves : nombre d'archives conservées par établissement (apps/students/archives.py)
ARCHIVES_ELEVES_MAX = config("ARCHIVES_ELEVES_MAX", default=50, cast=int)
# Archives complètes de l'établissement (bouton « Archiver tout l'établissement ») conservées
ARCHIVES_ETABLISSEMENT_MAX = config("ARCHIVES_ETABLISSEMENT_MAX", default=10, cast=int)
# Images des annonces : nombre maximum par annonce et poids maximum de chaque fichier envoyé (Mo)
ANNONCES_IMAGES_MAX = config("ANNONCES_IMAGES_MAX", default=6, cast=int)
ANNONCES_IMAGE_MAX_MO = config("ANNONCES_IMAGE_MAX_MO", default=8, cast=int)
# Corbeille : durée de conservation des éléments supprimés avant effacement définitif (jours)
CORBEILLE_DUREE_JOURS = config("CORBEILLE_DUREE_JOURS", default=30, cast=int)

# Fournisseur SMS (à brancher : Orange, Twilio, etc.)
SMS_BACKEND = config("SMS_BACKEND", default="console")

EMAIL_BACKEND = config("EMAIL_BACKEND", default="django.core.mail.backends.console.EmailBackend")
EMAIL_HOST = config("EMAIL_HOST", default="localhost")
EMAIL_PORT = config("EMAIL_PORT", default=25, cast=int)
EMAIL_HOST_USER = config("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = config("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = config("EMAIL_USE_TLS", default=False, cast=bool)
DEFAULT_FROM_EMAIL = config("DEFAULT_FROM_EMAIL", default="no-reply@gesti-scolaire.local")

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
}

# ---------------------------------------------------------------------------
# Plateforme (console développeurs)
# ---------------------------------------------------------------------------
# Nombre maximum d'établissements clients sur ce déploiement
PLATEFORME_MAX_ETABLISSEMENTS = config("PLATEFORME_MAX_ETABLISSEMENTS", default=50, cast=int)
# Code d'invitation de l'inscription privée de l'équipe (/equipe/inscription). Vide = inscription fermée.
PLATEFORME_CODE_INVITATION = config("PLATEFORME_CODE_INVITATION", default="")
