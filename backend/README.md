# Gesti-Scolaire ERP — Backend (Django + DRF + PostgreSQL)

Backend complet d'un ERP de gestion scolaire multi-établissements, développé en
Django / Django REST Framework, avec authentification JWT, PostgreSQL comme
base de données, et génération de documents PDF (cartes scolaires A6,
bulletins A5, reçus, certificats, attestations, bulletins de paie).

## 1. Structure du projet

```
gesti_scolaire_backend/
├── config/                    # Configuration du projet Django
│   ├── settings/
│   │   ├── base.py            # Réglages communs
│   │   ├── dev.py             # Développement (DEBUG=True)
│   │   └── prod.py            # Production (SSL, HSTS, etc.)
│   ├── urls.py
│   ├── wsgi.py / asgi.py
├── apps/
│   ├── core/                  # Établissements, années scolaires, périodes,
│   │                           niveaux/séries, classes, matières, emploi du
│   │                           temps, journal d'activité, permissions, PDF utils
│   ├── accounts/               # Utilisateur personnalisé, rôles, JWT auth
│   ├── students/                # Élèves, inscriptions, absences, sanctions,
│   │                           cartes scolaires
│   ├── staff/                  # Employés, enseignants, affectations,
│   │                           présences, espace enseignant
│   ├── academics/               # Notes, moyennes, rangs, bulletins, examens
│   ├── documents_mgmt/          # Certificats, convocations, attestations
│   ├── finance/                 # Frais, bourses, factures, paiements, reçus
│   ├── payroll/                 # Salaires, primes/retenues, bulletins de paie
│   ├── communication/            # Messagerie, annonces, notifications SMS/Email
│   └── reporting/                # Statistiques, rapports, exports
├── requirements.txt
├── .env.example
└── manage.py
```

## 2. Installation

```bash
cd gesti_scolaire_backend
python3 -m venv venv
venv\Scripts\activate.bat        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env              # puis ajuster les valeurs (DB, SECRET_KEY...)
```

### Base de données PostgreSQL

```bash
sudo -u postgres psql -c "CREATE DATABASE gesti_scolaire;"
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
```

Ajustez `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` dans `.env`.

### Migrations et démarrage

```bash
python manage.py migrate
python manage.py seed_demo        # jeu de données de démonstration (optionnel)
python manage.py createsuperuser  # ou utiliser le compte créé par seed_demo
python manage.py runserver
```

Comptes créés par `seed_demo` :
- Admin : `admin@gesti-scolaire.local` / `Admin@1234`
- Enseignant : `enseignant@gesti-scolaire.local` / `Ensgt@1234`

## 3. Documentation de l'API

- Swagger UI : `http://localhost:8000/api/docs/`
- ReDoc : `http://localhost:8000/api/redoc/`
- Admin Django : `http://localhost:8000/admin/`

## 4. Authentification (JWT)

```
POST /api/v1/auth/login/          { "email": "...", "password": "..." }
POST /api/v1/auth/refresh/        { "refresh": "..." }
POST /api/v1/auth/logout/         { "refresh": "..." }   (blacklist)
POST /api/v1/auth/register/       (auto-inscription : élève/parent uniquement)
GET  /api/v1/auth/me/             (profil connecté)
POST /api/v1/auth/change-password/
```

Chaque requête protégée doit inclure l'en-tête :
`Authorization: Bearer <access_token>`

## 5. Rôles

`superadmin`, `admin`, `enseignant`, `eleve`, `parent`, `comptable`, `surveillant`.
Les permissions par rôle sont centralisées dans `apps/core/permissions.py`.
Seul un administrateur peut créer des comptes admin/enseignant/comptable
(`/api/v1/utilisateurs/`) ; l'inscription publique (`/auth/register/`) est
réservée aux élèves et parents.

## 6. Principaux endpoints par module

| Module | Base URL |
|---|---|
| Établissements/classes/EDT | `/api/v1/etablissements/`, `/classes/`, `/emplois-du-temps/`, `/journal-activite/` |
| Élèves | `/api/v1/eleves/`, `/inscriptions/`, `/absences/`, `/sanctions-recompenses/`, `/cartes-scolaires/` |
| Personnel | `/api/v1/employes/`, `/enseignants/`, `/affectations/`, `/presences-employes/`, `/documents-pedagogiques/` |
| Académique | `/api/v1/notes/`, `/bulletins/`, `/tableaux-honneur/`, `/examens/` |
| Documents | `/api/v1/documents/` (certificats, convocations, attestations) |
| Finance | `/api/v1/types-frais/`, `/factures/`, `/paiements/`, `/bourses/`, `/dashboard/` |
| Paie | `/api/v1/bulletins-paie/`, `/avances/`, `/dashboard/` |
| Communication | `/api/v1/messages/`, `/annonces/`, `/notifications/` |
| Reporting | `/api/v1/statistiques/par_classe/`, `/statistiques/export_excel/` |

### Génération de documents PDF

- `GET /api/v1/cartes-scolaires/{id}/pdf/` → carte scolaire A6 (104×148mm)
- `GET /api/v1/bulletins/{id}/pdf/` → bulletin scolaire A5
- `GET /api/v1/documents/{id}/pdf/` → certificat/attestation/convocation A4
- `GET /api/v1/paiements/{id}/recu/` → reçu de paiement A5
- `GET /api/v1/bulletins-paie/{id}/pdf/` → bulletin de paie A4

### Calcul des moyennes et bulletins

```
POST /api/v1/bulletins/calculer/   { "classe": <id>, "periode": <id> }
```
Calcule les moyennes par matière, la moyenne générale pondérée par
coefficient, les rangs, la mention, et met à jour le tableau d'honneur.

## 7. Sécurité

- Authentification JWT (access 60 min / refresh 7 jours, rotation +
  blacklist activées)
- Permissions par rôle sur chaque endpoint (`apps/core/permissions.py`)
- Journal d'activité (audit trail) : middleware + entrées créées sur les
  actions sensibles (paiements, connexions...)
- CORS restreint aux origines listées dans `.env`

## 8. Prochaines étapes suggérées

1. Frontend React (Vite + Tailwind + react-router-dom + axios) consommant
   cette API.
2. Application mobile React Native.
3. Brancher un fournisseur SMS réel dans `apps/communication/services.py`
   (actuellement en mode simulation/console).
4. Ajouter Celery + Redis pour l'envoi asynchrone des notifications et la
   génération de rapports volumineux.


postgresql://gesti_user:6lvaQyMWRXPjg5So60gmYVARy1QNFhnh@dpg-dav5fp17lnhs73aussm0-a/gesti_scolaire



postgresql://gesti_user:6lvaQyMWRXPjg5So60gmYVARy1QNFhnh@dpg-dav5fp17lnhs73aussm0-a.frankfurt-postgres.render.com/gesti_scolaire