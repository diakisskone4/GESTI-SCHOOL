import { useState } from "react";
import { Link } from "react-router-dom";
import { Layers, Calendar, ArrowRight, Building2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useFetch } from "../../hooks/useFetch";
import CrudPage from "../../components/ui/CrudPage";
import PageHeader from "../../components/ui/PageHeader";
import { classesApi, niveauxApi, anneesScolairesApi, matieresApi, seriesApi, enseignantsApi } from "../../api/endpoints";

const TABS = [
  { key: "classes", label: "Classes" },
  { key: "niveaux", label: "Niveaux" },
  { key: "matieres", label: "Matières" },
  { key: "series", label: "Séries (Lycée)" },
];

export default function ClassesPage() {
  const { user } = useAuth();
  const etablissementId = user?.etablissement_courant;
  const [tab, setTab] = useState("classes");
  // Incrémenté à chaque création/modification/suppression dans n'importe quel onglet,
  // pour forcer le rechargement des listes utilisées par les menus déroulants
  // (ex: la liste des niveaux doit se mettre à jour dès qu'on en ajoute un,
  // sans avoir besoin de recharger complètement la page).
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);

  const { data: niveaux } = useFetch(() => niveauxApi.list({ etablissement: etablissementId }), [etablissementId, refreshKey]);
  const { data: annees } = useFetch(() => anneesScolairesApi.list({ etablissement: etablissementId }), [etablissementId, refreshKey]);
  const { data: series } = useFetch(() => seriesApi.list(), [etablissementId, refreshKey]);
  const { data: enseignants } = useFetch(() => enseignantsApi.list({ etablissement: etablissementId }), [etablissementId, refreshKey]);

  const niveauOptions = (niveaux?.results || []).map((n) => ({ value: n.id, label: n.nom }));
  const anneeOptions = (annees?.results || []).map((a) => ({
    value: a.id,
    label: `${a.libelle} ${a.est_courante ? "(Année courante)" : ""}`,
  }));
  const serieOptions = (series?.results || []).map((s) => ({ value: s.id, label: `${s.nom} (${s.code || ""})` }));
  const enseignantOptions = (enseignants?.results || []).map((ens) => ({
    value: ens.id,
    label: `${ens.nom_complet} ${ens.grade_academique ? `— ${ens.grade_academique}` : ""}`,
  }));

  const anneeCourante = (annees?.results || []).find((a) => a.est_courante) || (annees?.results || [])[0];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Classes & Niveaux"
        subtitle="Structure pédagogique : niveaux d'études, séries, classes et matières enseignées."
      />

      {/* Alerte : sans établissement courant, toute création (niveaux, classes...) échoue */}
      {!etablissementId && (
        <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-rose-900 shadow-2xs">
          <div className="flex items-center gap-3">
            <Building2 className="text-rose-600" size={20} />
            <p className="text-sm">
              <strong>Aucun établissement courant :</strong> votre compte n'est rattaché à aucun établissement actif. Configurez-le avant de créer des niveaux, classes ou matières.
            </p>
          </div>
          <Link
            to="/etablissements"
            className="flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 transition-colors"
          >
            <span>Gérer les établissements</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* Raccourci vers les Années et Périodes */}
      {annees?.results?.length === 0 && (
        <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-amber-900 shadow-2xs">
          <div className="flex items-center gap-3">
            <Calendar className="text-amber-600" size={20} />
            <p className="text-sm">
              <strong>Aucune année scolaire active :</strong> Pour créer des classes, veuillez d'abord enregistrer une année scolaire.
            </p>
          </div>
          <Link
            to="/annees-scolaires"
            className="flex items-center gap-1 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-amber-700 transition-colors"
          >
            <span>Créer l'année scolaire</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* Onglets */}
      <div className="inline-flex rounded-xl bg-slate-100 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key ? "bg-white text-brand-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "classes" && (
        <CrudPage
          title=""
          apiResource={classesApi}
          filters={{ etablissement: etablissementId }}
          createDefaults={{
            etablissement: etablissementId,
            annee_scolaire: anneeCourante?.id || "",
          }}
          fields={[
            { name: "nom", label: "Nom de la classe (ex: 6e A, Tle Sciences)", required: true },
            { name: "niveau", label: "Niveau", type: "select", options: niveauOptions, required: true },
            { name: "annee_scolaire", label: "Année scolaire", type: "select", options: anneeOptions, required: true },
            { name: "serie", label: "Série (optionnel pour le secondaire / lycée)", type: "select", options: serieOptions },
            { name: "professeur_principal", label: "Professeur principal", type: "select", options: enseignantOptions },
            { name: "effectif_max", label: "Effectif maximum", type: "number" },
            { name: "salle", label: "Salle de classe attribuée" },
          ]}
          columns={[
            { key: "nom", header: "Classe", render: (r) => <span className="font-bold text-slate-900">{r.nom}</span> },
            { key: "niveau_nom", header: "Niveau" },
            { key: "annee_scolaire_libelle", header: "Année scolaire", render: (r) => r.annee_scolaire_libelle || "—" },
            { key: "professeur_principal_nom", header: "Professeur principal", render: (r) => r.professeur_principal_nom || <span className="text-slate-400">Non affecté</span> },
            { key: "effectif_actuel", header: "Effectif", render: (r) => <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">{r.effectif_actuel ?? 0} élèves</span> },
            { key: "salle", header: "Salle", render: (r) => r.salle || <span className="text-slate-400">—</span> },
          ]}
        />
      )}

      {tab === "niveaux" && (
        <CrudPage
          title=""
          apiResource={niveauxApi}
          filters={{ etablissement: etablissementId }}
          createDefaults={{ etablissement: etablissementId }}
          fields={[
            { name: "nom", label: "Nom (ex: 6e, Terminale, CP1)", required: true },
            {
              name: "cycle", label: "Cycle d'enseignement", type: "select", required: true,
              options: [
                { value: "prescolaire", label: "Préscolaire (Maternelle)" },
                { value: "primaire", label: "Primaire (Fondamental 1er cycle)" },
                { value: "secondaire_1", label: "Secondaire 1er cycle (Collège)" },
                { value: "secondaire_2", label: "Secondaire 2nd cycle (Lycée)" },
              ],
            },
            { name: "ordre", label: "Ordre hiérarchique d'affichage", type: "number" },
          ]}
          columns={[
            { key: "nom", header: "Niveau", render: (r) => <span className="font-bold text-slate-900">{r.nom}</span> },
            { key: "cycle", header: "Cycle" },
            { key: "ordre", header: "Ordre" },
          ]}
        />
      )}

      {tab === "matieres" && (
        <CrudPage
          title=""
          apiResource={matieresApi}
          filters={{ etablissement: etablissementId }}
          createDefaults={{ etablissement: etablissementId }}
          fields={[
            { name: "nom", label: "Nom complet de la matière", required: true },
            { name: "code", label: "Code court (ex: MATH, FR, SVT)" },
            { name: "coefficient_defaut", label: "Coefficient par défaut", type: "number" },
          ]}
          columns={[
            { key: "nom", header: "Matière", render: (r) => <span className="font-bold text-slate-900">{r.nom}</span> },
            { key: "code", header: "Code", render: (r) => r.code ? <span className="font-mono text-xs font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded">{r.code}</span> : "—" },
            { key: "coefficient_defaut", header: "Coefficient", render: (r) => <span className="font-bold text-slate-700">{r.coefficient_defaut}</span> },
          ]}
        />
      )}

      {tab === "series" && (
        <CrudPage
          title=""
          apiResource={seriesApi}
          fields={[
            { name: "niveau", label: "Niveau associé", type: "select", options: niveauOptions, required: true },
            { name: "nom", label: "Nom de la série (ex: Sciences Exactes, Littérature)", required: true },
            { name: "code", label: "Code (ex: SE, L, SES, TSE)" },
          ]}
          columns={[
            { key: "nom", header: "Série", render: (r) => <span className="font-bold text-slate-900">{r.nom}</span> },
            { key: "code", header: "Code", render: (r) => r.code ? <span className="font-mono text-xs font-semibold text-brand-700">{r.code}</span> : "—" },
            { key: "niveau_nom", header: "Niveau", render: (r) => niveauOptions.find((n) => n.value === r.niveau)?.label || "—" },
          ]}
        />
      )}
    </div>
  );
}
