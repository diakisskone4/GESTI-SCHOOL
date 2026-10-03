import api from "./client";

/** Petites fonctions CRUD génériques réutilisées par tous les modules. */
const resource = (path) => ({
  list: (params) => api.get(`${path}/`, { params }).then((r) => r.data),
  get: (id) => api.get(`${path}/${id}/`).then((r) => r.data),
  create: (data) => api.post(`${path}/`, data).then((r) => r.data),
  update: (id, data) => api.patch(`${path}/${id}/`, data).then((r) => r.data),
  remove: (id) => api.delete(`${path}/${id}/`),
});

// --- Auth / comptes -------------------------------------------------------
export const authApi = {
  login: (email, password) => api.post("/auth/login/", { email, password }).then((r) => r.data),
  me: () => api.get("/auth/me/").then((r) => r.data),
  updateMe: (data) => api.patch("/auth/me/", data).then((r) => r.data),
  changePassword: (data) => api.post("/auth/change-password/", data).then((r) => r.data),
  register: (data) => api.post("/auth/register/", data).then((r) => r.data),
  registerOptions: (params) => api.get("/auth/register/options/", { params }).then((r) => r.data),
  logout: (refresh) => api.post("/auth/logout/", { refresh }),
};
export const usersApi = resource("/utilisateurs");
export const liensParentEleveApi = resource("/liens-parent-eleve");

// --- Core -------------------------------------------------------------
export const etablissementsApi = resource("/etablissements");
export const anneesScolairesApi = {
  ...resource("/annees-scolaires"),
  genererPeriodes: (id, type_periode = "trimestre") =>
    api.post(`/annees-scolaires/${id}/generer_periodes/`, { type_periode }).then((r) => r.data),
};
export const periodesApi = resource("/periodes");
export const niveauxApi = resource("/niveaux");
export const seriesApi = resource("/series");
export const classesApi = resource("/classes");
export const matieresApi = resource("/matieres");
export const emploisDuTempsApi = resource("/emplois-du-temps");
export const journalActiviteApi = resource("/journal-activite");

// --- Students -----------------------------------------------------------
export const elevesApi = {
  ...resource("/eleves"),
  historique: (id) => api.get(`/eleves/${id}/historique/`).then((r) => r.data),
};
export const inscriptionsApi = resource("/inscriptions");
export const absencesApi = resource("/absences");
export const sanctionsRecompensesApi = resource("/sanctions-recompenses");
export const cartesScolairesApi = {
  ...resource("/cartes-scolaires"),
  genererPourInscription: (inscription) =>
    api.post("/cartes-scolaires/generer_pour_inscription/", { inscription }).then((r) => r.data),
  genererPourEleve: (eleve) =>
    api.post("/cartes-scolaires/generer_pour_eleve/", { eleve }).then((r) => r.data),
  genererPourClasse: (classe) =>
    api.post("/cartes-scolaires/generer_pour_classe/", { classe }).then((r) => r.data),
  pdfPath: (id) => `/cartes-scolaires/${id}/pdf/`,
};

// --- Staff ----------------------------------------------------------------
export const employesApi = resource("/employes");
export const enseignantsApi = {
  ...resource("/enseignants"),
  moi: () => api.get("/enseignants/moi/").then((r) => r.data),
  tableauDeBord: (id) => api.get(`/enseignants/${id}/tableau_de_bord/`).then((r) => r.data),
};
export const affectationsApi = resource("/affectations");
export const presencesEmployesApi = resource("/presences-employes");
export const documentsPedagogiquesApi = resource("/documents-pedagogiques");

// --- Academics --------------------------------------------------------
export const typesEvaluationApi = {
  ...resource("/types-evaluation"),
  initialiser: (etablissement) => api.post("/types-evaluation/initialiser/", { etablissement }).then((r) => r.data),
};
export const evaluationsApi = {
  ...resource("/evaluations"),
  carnet: (params) => api.get("/evaluations/carnet/", { params }).then((r) => r.data),
  saisirNotes: (id, notes) => api.post(`/evaluations/${id}/saisir_notes/`, { notes }).then((r) => r.data),
};
export const notesApi = resource("/notes");
export const moyennesMatieresApi = resource("/moyennes-matieres");
export const bulletinsApi = {
  ...resource("/bulletins"),
  calculer: (classe, periode) => api.post("/bulletins/calculer/", { classe, periode }).then((r) => r.data),
  pdfPath: (id) => `/bulletins/${id}/pdf/`,
  pdfPathA5: (id) => `/bulletins/${id}/pdf/?taille=a5`,
};
export const tableauxHonneurApi = resource("/tableaux-honneur");
export const examensApi = resource("/examens");
export const exportsApi = {
  excelPath: (classe, periode) => `/exports/excel/?classe=${classe}&periode=${periode}`,
};

// --- Documents administratifs -----------------------------------------
export const documentsGeneresApi = {
  ...resource("/documents"),
  pdfPath: (id) => `/documents/${id}/pdf/`,
};

// --- Finance --------------------------------------------------------------
export const typesFraisApi = resource("/types-frais");
export const baremesFraisApi = resource("/baremes-frais");
export const boursesApi = resource("/bourses");
export const facturesApi = resource("/factures");
export const paiementsApi = {
  ...resource("/paiements"),
  recuPath: (id) => `/paiements/${id}/recu/`,
};
export const dashboardFinancierApi = {
  get: (params) => api.get("/dashboard-financier/", { params }).then((r) => r.data),
};

// --- Paie -------------------------------------------------------------
export const elementsSalaireApi = resource("/elements-salaire");
export const contratsSalaireApi = resource("/contrats-salaire");
export const lignesBulletinPaieApi = resource("/lignes-bulletin-paie");
export const bulletinsPaieApi = {
  ...resource("/bulletins-paie"),
  recalculer: (id) => api.post(`/bulletins-paie/${id}/recalculer/`).then((r) => r.data),
  pdfPath: (id) => `/bulletins-paie/${id}/pdf/`,
};
export const avancesApi = resource("/avances");
export const dashboardPaieApi = {
  get: (params) => api.get("/dashboard-paie/", { params }).then((r) => r.data),
};

// --- Communication ----------------------------------------------------
export const messagesApi = {
  ...resource("/messages"),
  destinataires: () => api.get("/messages/destinataires/").then((r) => r.data),
  marquerLu: (id) => api.post(`/messages/${id}/marquer_lu/`).then((r) => r.data),
  nonLus: () => api.get("/messages/non_lus/").then((r) => r.data),
};
export const annoncesApi = resource("/annonces");
export const notificationsApi = {
  ...resource("/notifications"),
  marquerLu: (id) => api.post(`/notifications/${id}/marquer_lu/`).then((r) => r.data),
  toutMarquerLu: () => api.post("/notifications/tout_marquer_lu/").then((r) => r.data),
  nonLues: () => api.get("/notifications/non_lues/").then((r) => r.data),
};

// --- Reporting --------------------------------------------------------
export const statistiquesApi = {
  parClasse: (classe, periode) => api.get("/statistiques/par_classe/", { params: { classe, periode } }).then((r) => r.data),
  vueEnsemble: (params) => api.get("/statistiques/vue_ensemble_etablissement/", { params }).then((r) => r.data),
  exportExcelPath: (etablissement) => `/statistiques/export_excel/?etablissement=${etablissement}`,
  exportCsvPath: (etablissement) => `/statistiques/export_csv/?etablissement=${etablissement}`,
};
export const rapportsApi = resource("/rapports");
