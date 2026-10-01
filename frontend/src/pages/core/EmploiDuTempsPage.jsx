import { useState, useMemo } from "react";
import {
  CalendarClock, Plus, Pencil, Trash2, Printer, Users,
  GraduationCap, DoorOpen, Clock, AlertTriangle, Loader2, BookOpen
} from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import Modal from "../../components/ui/Modal";
import DataTable from "../../components/ui/DataTable";
import { useAuth } from "../../context/AuthContext";
import { useFetch } from "../../hooks/useFetch";
import { useToast, extractErrorMessage } from "../../context/ToastContext";
import { classesApi, emploisDuTempsApi, enseignantsApi, matieresApi } from "../../api/endpoints";

const DAYS = [
  { index: 0, label: "Lundi" },
  { index: 1, label: "Mardi" },
  { index: 2, label: "Mercredi" },
  { index: 3, label: "Jeudi" },
  { index: 4, label: "Vendredi" },
  { index: 5, label: "Samedi" },
];

const SUBJECT_COLORS = [
  { bg: "bg-blue-50 border-blue-200 text-blue-800", badge: "bg-blue-100 text-blue-700" },
  { bg: "bg-emerald-50 border-emerald-200 text-emerald-800", badge: "bg-emerald-100 text-emerald-700" },
  { bg: "bg-violet-50 border-violet-200 text-violet-800", badge: "bg-violet-100 text-violet-700" },
  { bg: "bg-amber-50 border-amber-200 text-amber-800", badge: "bg-amber-100 text-amber-700" },
  { bg: "bg-rose-50 border-rose-200 text-rose-800", badge: "bg-rose-100 text-rose-700" },
  { bg: "bg-cyan-50 border-cyan-200 text-cyan-800", badge: "bg-cyan-100 text-cyan-700" },
  { bg: "bg-indigo-50 border-indigo-200 text-indigo-800", badge: "bg-indigo-100 text-indigo-700" },
  { bg: "bg-teal-50 border-teal-200 text-teal-800", badge: "bg-teal-100 text-teal-700" },
];

function getSubjectColor(idOrName = "") {
  let hash = 0;
  for (let i = 0; i < idOrName.length; i++) {
    hash = idOrName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % SUBJECT_COLORS.length;
  return SUBJECT_COLORS[index];
}

const EMPTY_CRENEAU = {
  classe: "",
  matiere: "",
  enseignant: "",
  jour: 0,
  heure_debut: "08:00",
  heure_fin: "10:00",
  salle: "",
};

export default function EmploiDuTempsPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const etablissementId = user?.etablissement_courant;

  const { data: classesData } = useFetch(() => classesApi.list({ etablissement: etablissementId }), [etablissementId]);
  const classes = classesData?.results || [];

  const { data: matieresData } = useFetch(() => matieresApi.list({ etablissement: etablissementId }), [etablissementId]);
  const matieres = matieresData?.results || [];

  const { data: enseignantsData } = useFetch(() => enseignantsApi.list({ etablissement: etablissementId }), [etablissementId]);
  const enseignants = enseignantsData?.results || [];

  // Modes de filtrage : 'classe' | 'enseignant' | 'salle'
  const [filterMode, setFilterMode] = useState("classe");
  const [selectedClasseId, setSelectedClasseId] = useState("");
  const [selectedEnseignantId, setSelectedEnseignantId] = useState("");
  const [selectedSalle, setSelectedSalle] = useState("");

  // Vue : 'grille' | 'tableau'
  const [viewType, setViewType] = useState("grille");

  // Initialisation par défaut de la première classe
  if (!selectedClasseId && classes.length > 0) {
    setSelectedClasseId(classes[0].id);
  }

  // Requête des créneaux
  const queryParams = useMemo(() => {
    if (filterMode === "classe") {
      return selectedClasseId ? { classe: selectedClasseId } : null;
    } else if (filterMode === "enseignant") {
      return selectedEnseignantId ? { enseignant: selectedEnseignantId } : null;
    } else if (filterMode === "salle") {
      return selectedSalle ? { salle: selectedSalle } : null;
    }
    return null;
  }, [filterMode, selectedClasseId, selectedEnseignantId, selectedSalle]);

  const { data: creneauxData, loading, reload } = useFetch(
    () => (queryParams ? emploisDuTempsApi.list(queryParams) : Promise.resolve({ results: [] })),
    [JSON.stringify(queryParams)]
  );
  const creneaux = creneauxData?.results || [];

  // Liste de toutes les salles uniques disponibles
  const salles = useMemo(() => {
    const list = new Set();
    classes.forEach((c) => c.salle && list.add(c.salle));
    creneaux.forEach((cr) => cr.salle && list.add(cr.salle));
    return Array.from(list).filter(Boolean);
  }, [classes, creneaux]);

  // Modal d'ajout / modification
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_CRENEAU);
  const [saving, setSaving] = useState(false);

  const openCreate = (defaultJour = 0, defaultHeure = "08:00") => {
    setEditing(null);
    setForm({
      ...EMPTY_CRENEAU,
      classe: filterMode === "classe" && selectedClasseId ? selectedClasseId : (classes[0]?.id || ""),
      enseignant: filterMode === "enseignant" && selectedEnseignantId ? selectedEnseignantId : "",
      salle: filterMode === "salle" && selectedSalle ? selectedSalle : "",
      jour: defaultJour,
      heure_debut: defaultHeure,
      heure_fin: defaultHeure === "08:00" ? "10:00" : "12:00",
    });
    setModalOpen(true);
  };

  const openEdit = (cr) => {
    setEditing(cr);
    setForm({
      classe: cr.classe,
      matiere: cr.matiere,
      enseignant: cr.enseignant || "",
      jour: cr.jour,
      heure_debut: cr.heure_debut?.substring(0, 5) || "08:00",
      heure_fin: cr.heure_fin?.substring(0, 5) || "10:00",
      salle: cr.salle || "",
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (form.heure_debut >= form.heure_fin) {
      notify("L'heure de début doit être antérieure à l'heure de fin.", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        classe: form.classe,
        matiere: form.matiere,
        enseignant: form.enseignant || null,
        jour: parseInt(form.jour, 10),
        heure_debut: form.heure_debut,
        heure_fin: form.heure_fin,
        salle: form.salle || "",
      };
      if (editing) {
        await emploisDuTempsApi.update(editing.id, payload);
        notify("Créneau d'emploi du temps modifié.", "success");
      } else {
        await emploisDuTempsApi.create(payload);
        notify("Créneau ajouté avec succès.", "success");
      }
      setModalOpen(false);
      reload();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer ce cours de l'emploi du temps ?")) return;
    try {
      await emploisDuTempsApi.remove(id);
      notify("Créneau supprimé.", "success");
      reload();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Groupement des créneaux par jour pour la grille
  const creneauxParJour = useMemo(() => {
    const map = {};
    DAYS.forEach((d) => { map[d.index] = []; });
    creneaux.forEach((cr) => {
      if (map[cr.jour]) {
        map[cr.jour].push(cr);
      }
    });
    // Tri par heure de début
    Object.values(map).forEach((list) => {
      list.sort((a, b) => a.heure_debut.localeCompare(b.heure_debut));
    });
    return map;
  }, [creneaux]);

  const currentTitle = useMemo(() => {
    if (filterMode === "classe") {
      const c = classes.find((i) => i.id === selectedClasseId);
      return c ? `Classe ${c.nom}` : "Emploi du temps par classe";
    } else if (filterMode === "enseignant") {
      const ens = enseignants.find((i) => i.id === selectedEnseignantId);
      return ens ? `Enseignant ${ens.nom_complet}` : "Emploi du temps par enseignant";
    } else {
      return selectedSalle ? `Salle ${selectedSalle}` : "Emploi du temps par salle";
    }
  }, [filterMode, selectedClasseId, selectedEnseignantId, selectedSalle, classes, enseignants]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Emploi du Temps"
        subtitle="Organisation des cours, planning hebdomadaire, suivi des matières, salles et enseignants."
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <button onClick={handlePrint} className="btn-secondary">
              <Printer size={16} /> Imprimer / PDF
            </button>
            <button onClick={() => openCreate(0, "08:00")} className="btn-primary">
              <Plus size={16} /> Ajouter un créneau
            </button>
          </div>
        }
      />

      {/* Barre de filtre et de configuration */}
      <div className="card space-y-4 p-5 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          {/* Mode de consultation */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Filtrer par :</span>
            <div className="inline-flex rounded-xl bg-slate-100 p-1">
              <button
                onClick={() => setFilterMode("classe")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  filterMode === "classe" ? "bg-white text-brand-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Users size={14} /> Classe
              </button>
              <button
                onClick={() => setFilterMode("enseignant")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  filterMode === "enseignant" ? "bg-white text-brand-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <GraduationCap size={14} /> Enseignant
              </button>
              <button
                onClick={() => setFilterMode("salle")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  filterMode === "salle" ? "bg-white text-brand-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <DoorOpen size={14} /> Salle
              </button>
            </div>
          </div>

          {/* Type d'affichage */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Affichage :</span>
            <div className="inline-flex rounded-xl bg-slate-100 p-1">
              <button
                onClick={() => setViewType("grille")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  viewType === "grille" ? "bg-white text-brand-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Grille hebdomadaire
              </button>
              <button
                onClick={() => setViewType("tableau")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  viewType === "tableau" ? "bg-white text-brand-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Tableau détaillé
              </button>
            </div>
          </div>
        </div>

        {/* Sélecteur dynamique selon le mode */}
        <div className="flex flex-wrap items-center gap-4">
          {filterMode === "classe" && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-slate-700">Sélectionner la classe :</label>
              <select
                className="input min-w-[240px]"
                value={selectedClasseId}
                onChange={(e) => setSelectedClasseId(e.target.value)}
              >
                <option value="">-- Choisir une classe --</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom} {c.niveau_nom ? `(${c.niveau_nom})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {filterMode === "enseignant" && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-slate-700">Sélectionner l'enseignant :</label>
              <select
                className="input min-w-[260px]"
                value={selectedEnseignantId}
                onChange={(e) => setSelectedEnseignantId(e.target.value)}
              >
                <option value="">-- Choisir un enseignant --</option>
                {enseignants.map((ens) => (
                  <option key={ens.id} value={ens.id}>
                    {ens.nom_complet} {ens.grade_academique ? `(${ens.grade_academique})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {filterMode === "salle" && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-slate-700">Sélectionner la salle :</label>
              <select
                className="input min-w-[200px]"
                value={selectedSalle}
                onChange={(e) => setSelectedSalle(e.target.value)}
              >
                <option value="">-- Choisir une salle --</option>
                {salles.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}

          <div className="ml-auto text-xs text-slate-500">
            <strong>{creneaux.length}</strong> créneau(x) planifié(s)
          </div>
        </div>
      </div>

      {/* Titre d'impression (visible à l'impression uniquement) */}
      <div className="hidden text-center print:block print:pb-4">
        <h1 className="text-2xl font-bold text-slate-900">{currentTitle}</h1>
        <p className="text-sm text-slate-600">Emploi du temps officiel — Année scolaire en cours</p>
      </div>

      {/* --- VUE 1 : GRILLE HEBDOMADAIRE INTERACTIVE --- */}
      {viewType === "grille" && (
        <div className="space-y-3">
          {loading && (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="animate-spin text-brand-600" size={32} />
            </div>
          )}

          {!loading && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {DAYS.map((day) => {
                const dayCreneaux = creneauxParJour[day.index] || [];
                return (
                  <div key={day.index} className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50/50 p-3 shadow-sm transition-all hover:bg-slate-50">
                    {/* Entête du jour */}
                    <div className="mb-3 flex items-center justify-between border-b border-slate-200/80 pb-2">
                      <div className="font-bold text-slate-800">{day.label}</div>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500 shadow-2xs">
                        {dayCreneaux.length} cours
                      </span>
                    </div>

                    {/* Liste des cours du jour */}
                    <div className="flex-1 space-y-2.5">
                      {dayCreneaux.map((cr) => {
                        const style = getSubjectColor(cr.matiere_nom || cr.matiere);
                        return (
                          <div
                            key={cr.id}
                            className={`group relative rounded-xl border p-3 shadow-2xs transition-all hover:shadow-md ${style.bg}`}
                          >
                            <div className="flex items-start justify-between gap-1">
                              <span className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${style.badge}`}>
                                {cr.matiere_code || "COURS"}
                              </span>
                              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 print:hidden">
                                <button
                                  onClick={() => openEdit(cr)}
                                  className="rounded p-1 text-slate-500 hover:bg-white/80 hover:text-brand-600"
                                  title="Modifier"
                                >
                                  <Pencil size={12} />
                                </button>
                                <button
                                  onClick={() => handleDelete(cr.id)}
                                  className="rounded p-1 text-slate-500 hover:bg-white/80 hover:text-rose-600"
                                  title="Supprimer"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>

                            <p className="mt-1 text-sm font-bold leading-tight text-slate-900">
                              {cr.matiere_nom}
                            </p>

                            <div className="mt-2 space-y-1 text-xs text-slate-600">
                              <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                                <Clock size={12} className="text-slate-400" />
                                <span>{cr.heure_debut?.substring(0, 5)} - {cr.heure_fin?.substring(0, 5)}</span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <GraduationCap size={12} className="text-slate-400" />
                                <span className="truncate">{cr.enseignant_nom || "Enseignant non assigné"}</span>
                              </div>

                              {cr.salle && (
                                <div className="flex items-center gap-1.5">
                                  <DoorOpen size={12} className="text-slate-400" />
                                  <span>Salle : <strong>{cr.salle}</strong></span>
                                </div>
                              )}

                              {filterMode !== "classe" && (
                                <div className="flex items-center gap-1.5 font-medium text-brand-700">
                                  <Users size={12} />
                                  <span>{cr.classe_nom}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {dayCreneaux.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-8 text-center text-xs text-slate-400">
                          <p>Aucun cours</p>
                          <button
                            onClick={() => openCreate(day.index, "08:00")}
                            className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-brand-600 hover:underline print:hidden"
                          >
                            <Plus size={12} /> Planifier
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Bouton bas de colonne */}
                    <button
                      onClick={() => openCreate(day.index, "08:00")}
                      className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 py-1.5 text-xs font-medium text-slate-500 hover:border-brand-500 hover:bg-white hover:text-brand-600 print:hidden"
                    >
                      <Plus size={13} /> Ajouter
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* --- VUE 2 : TABLEAU DÉTAILLÉ --- */}
      {viewType === "tableau" && (
        <DataTable
          loading={loading}
          rows={creneaux}
          columns={[
            {
              key: "jour",
              header: "Jour",
              render: (r) => <span className="font-semibold text-slate-800">{r.jour_label}</span>,
            },
            {
              key: "horaire",
              header: "Horaire",
              render: (r) => `${r.heure_debut?.substring(0, 5)} - ${r.heure_fin?.substring(0, 5)}`,
            },
            {
              key: "matiere",
              header: "Matière",
              render: (r) => (
                <div>
                  <span className="font-semibold text-slate-800">{r.matiere_nom}</span>
                  {r.matiere_code && <span className="ml-2 text-xs text-slate-400">({r.matiere_code})</span>}
                </div>
              ),
            },
            {
              key: "classe",
              header: "Classe",
              render: (r) => r.classe_nom || "—",
            },
            {
              key: "enseignant",
              header: "Enseignant",
              render: (r) => r.enseignant_nom || <span className="text-slate-400">Non affecté</span>,
            },
            {
              key: "salle",
              header: "Salle",
              render: (r) => r.salle || <span className="text-slate-400">—</span>,
            },
            {
              key: "actions",
              header: "",
              render: (r) => (
                <div className="flex justify-end gap-1">
                  <button
                    onClick={() => openEdit(r)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ),
            },
          ]}
        />
      )}

      {/* --- MODAL AJOUT / MODIFICATION CRÉNEAU --- */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Modifier le créneau de cours" : "Planifier un cours dans l'emploi du temps"}
        width="max-w-xl"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>Annuler</button>
            <button className="btn-primary" disabled={saving} form="edt-form">
              {saving && <Loader2 size={16} className="animate-spin" />}
              Enregistrer
            </button>
          </>
        }
      >
        <form id="edt-form" onSubmit={handleSave} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Classe concernée</label>
            <select
              required
              className="input"
              value={form.classe}
              onChange={(e) => setForm({ ...form, classe: e.target.value })}
            >
              <option value="">Sélectionner une classe...</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.nom} {c.niveau_nom ? `— Niveau ${c.niveau_nom}` : ""}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="label">Matière</label>
            <select
              required
              className="input"
              value={form.matiere}
              onChange={(e) => setForm({ ...form, matiere: e.target.value })}
            >
              <option value="">Sélectionner une matière...</option>
              {matieres.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nom} {m.code ? `(${m.code})` : ""} {m.coefficient_defaut ? `— Coeff: ${m.coefficient_defaut}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="label">Enseignant (Professeur)</label>
            <select
              className="input"
              value={form.enseignant}
              onChange={(e) => setForm({ ...form, enseignant: e.target.value })}
            >
              <option value="">-- Non affecté pour le moment --</option>
              {enseignants.map((ens) => (
                <option key={ens.id} value={ens.id}>
                  {ens.nom_complet} {ens.grade_academique ? `(${ens.grade_academique})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Jour de la semaine</label>
            <select
              required
              className="input"
              value={form.jour}
              onChange={(e) => setForm({ ...form, jour: parseInt(e.target.value, 10) })}
            >
              {DAYS.map((d) => (
                <option key={d.index} value={d.index}>{d.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Salle de classe</label>
            <input
              placeholder="Ex: Salle 01, Labo..."
              className="input"
              value={form.salle}
              onChange={(e) => setForm({ ...form, salle: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Heure de début</label>
            <input
              required
              type="time"
              className="input"
              value={form.heure_debut}
              onChange={(e) => setForm({ ...form, heure_debut: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Heure de fin</label>
            <input
              required
              type="time"
              className="input"
              value={form.heure_fin}
              onChange={(e) => setForm({ ...form, heure_fin: e.target.value })}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}