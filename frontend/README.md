# Gesti-Scolaire ERP — Frontend (React + Vite + Tailwind + Axios)

Interface web du système de gestion scolaire Gesti-Scolaire, consommant le
backend Django REST Framework. Design de type dashboard SaaS moderne
(sidebar sombre, cartes statistiques, graphiques) dans l'esprit du template
Kelaz, réalisé ici avec des composants Tailwind sur-mesure (aucun code du
template original n'est utilisé — seule l'inspiration visuelle générale a
été reprise).

## 1. Stack technique

- **Vite** + **React 19**
- **Tailwind CSS v4** (via `@tailwindcss/vite`, pas de fichier config séparé)
- **react-router-dom** pour le routage et les routes protégées par rôle
- **axios** avec intercepteurs JWT (rafraîchissement automatique du token)
- **recharts** pour les graphiques du tableau de bord
- **lucide-react** pour les icônes

## 2. Installation

```bash
cd gesti_scolaire_frontend
npm install
cp .env.example .env       # ajuster VITE_API_BASE_URL si besoin
npm run dev
```

Par défaut, le frontend attend le backend sur `http://localhost:8000/api/v1`
(voir `.env`). Lancez d'abord le backend Django (voir son propre README),
puis :

```bash
npm run dev
```

L'application est servie sur `http://localhost:5173`.

Compte de démonstration (créé par `python manage.py seed_demo` côté
backend) :
- Admin : `admin@gesti-scolaire.local` / `Admin@1234`
- Enseignant : `enseignant@gesti-scolaire.local` / `Ensgt@1234`

## 3. Structure du projet

```
src/
├── api/
│   ├── client.js         # instance axios + intercepteurs JWT (refresh auto)
│   └── endpoints.js       # un module de fonctions par domaine métier
├── context/
│   ├── AuthContext.jsx     # session utilisateur, login/logout
│   └── ToastContext.jsx    # notifications toast + extraction d'erreurs DRF
├── components/
│   ├── layout/              # Sidebar, Topbar, DashboardLayout, navConfig
│   └── ui/                  # StatCard, DataTable, Modal, CrudPage, PageHeader
├── routes/
│   └── ProtectedRoute.jsx    # garde d'authentification + rôle
├── hooks/
│   └── useFetch.js           # chargement de données avec état loading/error
├── utils/
│   └── download.js           # téléchargement de fichiers protégés par JWT
└── pages/
    ├── auth/                 # Connexion
    ├── dashboard/             # Tableaux de bord par rôle (admin/enseignant/élève-parent)
    ├── core/                  # Établissements, classes/niveaux/matières
    ├── students/               # Élèves, absences, cartes scolaires
    ├── staff/                  # Enseignants
    ├── academics/               # Notes & bulletins
    ├── documents/                # Certificats, convocations, attestations
    ├── finance/                  # Facturation & paiements
    ├── payroll/                  # Paie
    ├── communication/             # Messagerie, annonces
    ├── reporting/                 # Statistiques
    └── profile/                   # Profil utilisateur
```

## 4. Authentification

Le token JWT (`access`/`refresh`) est stocké dans `localStorage`. Chaque
requête axios ajoute automatiquement l'en-tête `Authorization: Bearer`.
Si le token d'accès expire (401), un rafraîchissement automatique est
tenté via `/auth/refresh/` ; en cas d'échec, l'utilisateur est redirigé
vers `/connexion`.

## 5. Téléchargement des documents PDF

Les documents générés par le backend (cartes scolaires, bulletins, reçus,
certificats, bulletins de paie) sont protégés par JWT : un simple lien
`<a href>` échouerait (401, pas d'en-tête d'autorisation). Le frontend
utilise donc `utils/download.js` (`downloadAuthFile`) qui récupère le
fichier via axios (avec le token) puis l'ouvre dans un nouvel onglet ou
déclenche le téléchargement.

## 6. Routes protégées par rôle

`src/routes/ProtectedRoute.jsx` restreint l'accès à certaines branches de
routes selon le rôle de l'utilisateur connecté (`admin`, `enseignant`,
`eleve`, `parent`, `comptable`...). Le menu latéral (`navConfig.js`) se
filtre automatiquement en fonction du rôle.

## 7. Le composant `CrudPage`

Pour accélérer la couverture des modules simples (établissements,
niveaux, matières...), `components/ui/CrudPage.jsx` fournit un
CRUD générique piloté par configuration (liste + création/édition +
suppression) à partir d'une définition de champs. Les modules avec une
logique métier spécifique (élèves + inscription, notes + calcul de
bulletins, factures + paiement...) ont leur propre page dédiée.

## 8. Build de production

```bash
  # génère dist/
npm run preview # sert le build localement pour vérification
```

## 9. Prochaines étapes suggérées

1. Application mobile React Native consommant la même API.
2. Pagination avancée / filtres combinés sur les tables volumineuses.
3. Un vrai gestionnaire d'emploi du temps (glisser-déposer des créneaux).
4. Notifications temps réel (WebSocket) pour la messagerie.
