# Site vitrine Gesti-Scolaire

Site de présentation (publicité) de Gesti-Scolaire : HTML, CSS et JavaScript simples, sans étape de construction.

| Fichier | Rôle |
|---|---|
| `index.html` | Contenu de la page (textes, sections, formulaire) |
| `css/style.css` | Mise en page et couleurs (celles de l'application) |
| `js/config.js` | **Seul fichier à régler** : adresse de l'application, de l'API, téléphone, WhatsApp, email |
| `js/main.js` | Menu mobile et envoi du formulaire |
| `images/` | Captures de l'application (données fictives), affiche, image de partage |

## Formulaire « Demander une démonstration »
Les demandes sont envoyées à l'API (`POST /api/v1/public/demande-demo/`) et apparaissent dans la console de l'équipe,
onglet **Demandes**. Pour que le navigateur accepte l'envoi, l'adresse du site doit figurer dans la variable
`CORS_ALLOWED_ORIGINS` du service API sur Render.

## Voir le site en local
```
cd site
python -m http.server 8080
```
puis ouvrir http://localhost:8080

## Déploiement (Render, site statique)
Service `gesti-school-site` dans `render.yaml` : dossier racine `site`, aucune commande de construction, dossier publié `.`.
