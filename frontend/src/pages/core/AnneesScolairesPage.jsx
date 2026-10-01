import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Calendar, Plus, Pencil, Trash2, CheckCircle2, Wand2,
  Clock, Lock, Unlock, School, Loader2, Sparkles, AlertCircle
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useFetch } from "../../hooks/useFetch";
import { useToast, extractErrorMessage } from "../../context/ToastContext";
import PageHeader from "../../components/ui/PageHeader";
import DataTable from "../../components/ui/DataTable";
import Modal from "../../components/ui/Modal";
import { anneesScolairesApi, periodesApi, etablissementsApi } from "../../api/endpoints";

const EMPTY_ANNEE = { libelle: "", date_debut: "", date_fin: "", est_courante: true, auto_periodes: true, etablissement: "" };
const EMPTY_PERIODE = { annee_scolaire: "", type_periode: "trimestre", numero: 1, libelle: "", date_debut: "", date_fin: "", est_courante: false, cloturee: false };

export default function AnneesScolairesPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "annees";

  const { data: etablissementsData } = useFetch(() => etablissementsApi.list(), []);
  const etablissements = etablissementsData?.results || [];

  const [selectedEtablissement, setSelectedEtablissement] = useState(user?.etablissement_courant || "");

  useEffect(() => {
    if (!selectedEtablissement && etablissements.length > 0) {
      setSelectedEtablissement(user?.etablissement_courant || etablissements[0].id);
    }
  }, [etablissements, user]);

  const { data: anneesData, loading: loadingAnnees, reload: reloadAnnees } = useFetch(
    () => (selectedEtablissement ? anneesScolairesApi.list({ etablissement: selectedEtablissement }) : Promise.resolve({ results: [] })),
    [selectedEtablissement]
  );
  const annees = anneesData?.results || [];

  const [selectedAnneeId, setSelectedAnneeId] = useState("");

  useEffect(() => {
    if (annees.length > 0 && !selectedAnneeId) {
      const courante = annees.find((a) => a.est_courante) || annees[0];
      setSelectedAnneeId(courante.id);
    }
  }, [annees, selectedAnneeId]);

  const { data: periodesData, loading: loadingPeriodes, reload: reloadPeriodes } = useFetch(
    () => (selectedAnneeId ? periodesApi.list({ annee_scolaire: selectedAnneeId }) : Promise.resolve({ results: [] })),
    [selectedAnneeId]
  );
  const periodes = periodesData?.results || [];

  // Modals state
  const [anneeModalOpen, setAnneeModalOpen] = useState(false);
  const [anneeEditing, setAnneeEditing] = useState(null);
  const [anneeForm, setAnneeForm] = useState(EMPTY_ANNEE);
  const [savingAnnee, setSavingAnnee] = useState(false);

  const [periodeModalOpen, setPeriodeModalOpen] = useState(false);
  const [periodeEditing, setPeriodeEditing] = useState(null);
  const [periodeForm, setPeriodeForm] = useState(EMPTY_PERIODE);
  const [savingPeriode, setSavingPeriode] = useState(false);
  const [generatingPeriodes, setGeneratingPeriodes] = useState(false);

  const setTab = (tab) => {
    setSearchParams({ tab });
  };

  // --- Handlers Année ---
  const openCreateAnnee = () => {
    setAnneeEditing(null);
    setAnneeForm({
      ...EMPTY_ANNEE,
      etablissement: selectedEtablissement || etablissements[0]?.id || "",
    });
    setAnneeModalOpen(true);
  };

  const openEditAnnee = (annee) => {
    setAnneeEditing(annee);
    setAnneeForm({
      libelle: annee.libelle,
      date_debut: annee.date_debut,
      date_fin: annee.date_fin,
      est_courante: annee.est_courante,
      etablissement: annee.etablissement,
      auto_periodes: false,
    });
    setAnneeModalOpen(true);
  };

  const handleSaveAnnee = async (e) => {
    e.preventDefault();
    if (!anneeForm.etablissement) {
      notify("Veuillez sélectionner un établissement.", "error");
      return;
    }
    setSavingAnnee(true);
    try {
      const payload = {
        etablissement: anneeForm.etablissement,
        libelle: anneeForm.libelle,
        date_debut: anneeForm.date_debut,
        date_fin: anneeForm.date_fin,
        est_courante: anneeForm.est_courante,
      };
      let anneeRes;
      if (anneeEditing) {
        anneeRes = await anneesScolairesApi.update(anneeEditing.id, payload);
        notify("Année scolaire modifiée avec succès.", "success");
      } else {
        anneeRes = await anneesScolairesApi.create(payload);
        notify("Année scolaire enregistrée.", "success");
        if (anneeForm.auto_periodes) {
          try {
            await anneesScolairesApi.genererPeriodes(anneeRes.id, "trimestre");
            notify("3 trimestres ont été automatiquement générés pour cette année !", "success");
          } catch {
            // non-bloquant
          }
        }
      }
      setAnneeModalOpen(false);
      reloadAnnees();
      if (anneeRes?.id) {
        setSelectedAnneeId(anneeRes.id);
      }
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setSavingAnnee(false);
    }
  };

  const handleDeleteAnnee = async (annee) => {
    if (!window.confirm(`Supprimer l'année scolaire "${annee.libelle}" ainsi que ses périodes associées ?`)) return;
    try {
      await anneesScolairesApi.remove(annee.id);
      notify("Année scolaire supprimée.", "success");
      reloadAnnees();
      if (selectedAnneeId === annee.id) {
        setSelectedAnneeId("");
      }
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    }
  };

  const handleGenererPeriodes = async (anneeId, type = "trimestre") => {
    setGeneratingPeriodes(true);
    try {
      const res = await anneesScolairesApi.genererPeriodes(anneeId, type);
      notify(res.detail || "Périodes générées avec succès !", "success");
      reloadAnnees();
      reloadPeriodes();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setGeneratingPeriodes(false);
    }
  };

  // --- Handlers Période ---
  const openCreatePeriode = () => {
    if (!selectedAnneeId) {
      notify("Veuillez d'abord sélectionner une année scolaire.", "error");
      return;
    }
    const currentAnnee = annees.find((a) => a.id === selectedAnneeId);
    setPeriodeEditing(null);
    setPeriodeForm({
      ...EMPTY_PERIODE,
      annee_scolaire: selectedAnneeId,
      date_debut: currentAnnee?.date_debut || "",
      date_fin: currentAnnee?.date_fin || "",
      numero: (periodes.length || 0) + 1,
      libelle: `${(periodes.length || 0) + 1}er Trimestre`,
    });
    setPeriodeModalOpen(true);
  };

  const openEditPeriode = (periode) => {
    setPeriodeEditing(periode);
    setPeriodeForm({
      annee_scolaire: periode.annee_scolaire,
      type_periode: periode.type_periode,
      numero: periode.numero,
      libelle: periode.libelle,
      date_debut: periode.date_debut,
      date_fin: periode.date_fin,
      est_courante: periode.est_courante,
      cloturee: periode.cloturee,
    });
    setPeriodeModalOpen(true);
  };

  const handleSavePeriode = async (e) => {
    e.preventDefault();
    setSavingPeriode(true);
    try {
      if (periodeEditing) {
        await periodesApi.update(periodeEditing.id, periodeForm);
        notify("Période modifiée.", "success");
      } else {
        await periodesApi.create(periodeForm);
        notify("Période créée avec succès.", "success");
      }
      setPeriodeModalOpen(false);
      reloadPeriodes();
      reloadAnnees();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setSavingPeriode(false);
    }
  };

  const handleDeletePeriode = async (periode) => {
    if (!window.confirm(`Supprimer la période "${periode.libelle}" ?`)) return;
    try {
      await periodesApi.remove(periode.id);
      notify("Période supprimée.", "success");
      reloadPeriodes();
      reloadAnnees();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    }
  };

  const handleToggleCloture = async (periode) => {
    try {
      await periodesApi.update(periode.id, { cloturee: !periode.cloturee });
      notify(`Période ${periode.cloturee ? "réouverte" : "clôturée"}.`, "success");
      reloadPeriodes();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    }
  };

  return (
    <div>
      <PageHeader
        title="Années & Périodes Scolaires"
        subtitle="Configurez le calendrier scolaire, les trimestres ou semestres utilisés pour les notes et bulletins."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {etablissements.length > 1 && (
              <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs">
                <School size={15} className="text-brand-600" />
                <select
                  value={selectedEtablissement}
                  onChange={(e) => setSelectedEtablissement(e.target.value)}
                  className="bg-transparent font-medium text-slate-700 outline-none"
                >
                  {etablissements.map((etab) => (
                    <option key={etab.id} value={etab.id}>{etab.nom} ({etab.sigle})</option>
                  ))}
                </select>
              </div>
            )}
            {activeTab === "annees" ? (
              <button onClick={openCreateAnnee} className="btn-primary">
                <Plus size={16} /> Nouvelle année scolaire
              </button>
            ) : (
              <button onClick={openCreatePeriode} className="btn-primary" disabled={!selectedAnneeId}>
                <Plus size={16} /> Ajouter une période
              </button>
            )}
          </div>
        }
      />

      {/* Onglets de navigation */}
      <div className="mb-6 flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setTab("annees")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === "annees"
              ? "border-brand-600 text-brand-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Calendar size={18} />
          <span>Années scolaires</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
            {annees.length}
          </span>
        </button>

        <button
          onClick={() => setTab("periodes")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === "periodes"
              ? "border-brand-600 text-brand-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Clock size={18} />
          <span>Périodes (Trimestres / Semestres)</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
            {periodes.length}
          </span>
        </button>
      </div>

      {/* --- ONGLET 1 : ANNÉES SCOLAIRES --- */}
      {activeTab === "annees" && (
        <div className="space-y-4">
          <DataTable
            loading={loadingAnnees}
            rows={annees}
            columns={[
              {
                key: "libelle",
                header: "Année scolaire",
                render: (r) => (
                  <div className="flex items-center gap-2.5 font-semibold text-slate-800">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${r.est_courante ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      <Calendar size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span>{r.libelle}</span>
                        {r.est_courante && (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-600 ring-1 ring-emerald-500/20">
                            Courante
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400">{r.etablissement_nom || "Établissement"}</span>
                    </div>
                  </div>
                ),
              },
              { key: "date_debut", header: "Date de début" },
              { key: "date_fin", header: "Date de fin" },
              {
                key: "periodes",
                header: "Périodes",
                render: (r) => (
                  <button
                    onClick={() => {
                      setSelectedAnneeId(r.id);
                      setTab("periodes");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100"
                  >
                    <span>{r.nb_periodes ?? 0} période(s)</span>
                    <span className="text-brand-500">→</span>
                  </button>
                ),
              },
              {
                key: "actions",
                header: "Actions",
                render: (r) => (
                  <div className="flex items-center justify-end gap-1.5">
                    {(!r.nb_periodes || r.nb_periodes === 0) && (
                      <button
                        onClick={() => handleGenererPeriodes(r.id, "trimestre")}
                        disabled={generatingPeriodes}
                        className="flex items-center gap-1 rounded-lg border border-brand-200 bg-white px-2.5 py-1 text-xs font-medium text-brand-700 shadow-sm hover:bg-brand-50"
                        title="Créer automatiquement 3 trimestres"
                      >
                        <Sparkles size={13} className="text-brand-500" />
                        Générer 3 trimestres
                      </button>
                    )}
                    <button
                      onClick={() => openEditAnnee(r)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
                      title="Modifier"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleDeleteAnnee(r)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      title="Supprimer"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ),
              },
            ]}
          />

          {annees.length === 0 && !loadingAnnees && (
            <div className="card p-8 text-center">
              <Calendar className="mx-auto text-slate-300" size={40} />
              <p className="mt-2 font-medium text-slate-700">Aucune année scolaire enregistrée</p>
              <p className="mt-1 text-sm text-slate-400">
                Commencez par créer l'année scolaire en cours (ex: 2025-2026).
              </p>
              <button onClick={openCreateAnnee} className="btn-primary mt-4">
                <Plus size={16} /> Enregistrer la première année
              </button>
            </div>
          )}
        </div>
      )}

      {/* --- ONGLET 2 : PÉRIODES (TRIMESTRES / SEMESTRES) --- */}
      {activeTab === "periodes" && (
        <div className="space-y-5">
          {/* Sélecteur d'année scolaire pour les périodes */}
          <div className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-semibold text-slate-700">Année scolaire :</label>
              <select
                value={selectedAnneeId}
                onChange={(e) => setSelectedAnneeId(e.target.value)}
                className="input min-w-[200px]"
              >
                {annees.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.libelle} {a.est_courante ? "(Année courante)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {selectedAnneeId && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleGenererPeriodes(selectedAnneeId, "trimestre")}
                  disabled={generatingPeriodes}
                  className="btn-secondary text-xs"
                >
                  <Wand2 size={14} /> Générer 3 trimestres
                </button>
                <button
                  onClick={() => handleGenererPeriodes(selectedAnneeId, "semestre")}
                  disabled={generatingPeriodes}
                  className="btn-secondary text-xs"
                >
                  <Wand2 size={14} /> Générer 2 semestres
                </button>
              </div>
            )}
          </div>

          {!selectedAnneeId && (
            <div className="card p-8 text-center text-slate-400">
              <AlertCircle size={32} className="mx-auto mb-2 text-amber-500" />
              <p>Veuillez d'abord créer une année scolaire avant de gérer ses périodes.</p>
              <button onClick={openCreateAnnee} className="btn-primary mt-4">
                <Plus size={16} /> Créer une année scolaire
              </button>
            </div>
          )}

          {selectedAnneeId && (
            <DataTable
              loading={loadingPeriodes}
              rows={periodes}
              columns={[
                {
                  key: "libelle",
                  header: "Période",
                  render: (r) => (
                    <div className="font-semibold text-slate-800">
                      <span>{r.libelle}</span>
                      <div className="text-xs text-slate-400">
                        {r.type_periode === "trimestre" ? "Trimestre" : "Semestre"} N° {r.numero}
                      </div>
                    </div>
                  ),
                },
                { key: "date_debut", header: "Date de début" },
                { key: "date_fin", header: "Date de fin" },
                {
                  key: "statut",
                  header: "Statut",
                  render: (r) => (
                    <div className="flex items-center gap-2">
                      {r.est_courante ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-600 ring-1 ring-emerald-500/20">
                          En cours
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                      {r.cloturee && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                          Clôturée
                        </span>
                      )}
                    </div>
                  ),
                },
                {
                  key: "actions",
                  header: "Actions",
                  render: (r) => (
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleToggleCloture(r)}
                        className={`rounded-lg p-1.5 ${r.cloturee ? "text-amber-600 hover:bg-amber-50" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"}`}
                        title={r.cloturee ? "Réouvrir cette période" : "Clôturer cette période"}
                      >
                        {r.cloturee ? <Lock size={15} /> : <Unlock size={15} />}
                      </button>
                      <button
                        onClick={() => openEditPeriode(r)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
                        title="Modifier"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDeletePeriode(r)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        title="Supprimer"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ),
                },
              ]}
            />
          )}
        </div>
      )}

      {/* --- MODAL CRÉATION / MODIFICATION ANNÉE SCOLAIRE --- */}
      <Modal
        open={anneeModalOpen}
        onClose={() => setAnneeModalOpen(false)}
        title={anneeEditing ? "Modifier l'année scolaire" : "Enregistrer une année scolaire"}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setAnneeModalOpen(false)}>Annuler</button>
            <button className="btn-primary" disabled={savingAnnee} form="annee-form">
              {savingAnnee && <Loader2 size={16} className="animate-spin" />}
              {anneeEditing ? "Enregistrer" : "Créer l'année"}
            </button>
          </>
        }
      >
        <form id="annee-form" onSubmit={handleSaveAnnee} className="space-y-4">
          <div>
            <label className="label">Établissement</label>
            <select
              required
              className="input"
              value={anneeForm.etablissement}
              onChange={(e) => setAnneeForm({ ...anneeForm, etablissement: e.target.value })}
            >
              <option value="">Sélectionner un établissement...</option>
              {etablissements.map((e) => (
                <option key={e.id} value={e.id}>{e.nom} ({e.sigle})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Libellé de l'année scolaire</label>
            <input
              required
              placeholder="Ex : 2025-2026"
              className="input"
              value={anneeForm.libelle}
              onChange={(e) => setAnneeForm({ ...anneeForm, libelle: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date de début</label>
              <input
                required
                type="date"
                className="input"
                value={anneeForm.date_debut}
                onChange={(e) => setAnneeForm({ ...anneeForm, date_debut: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Date de fin</label>
              <input
                required
                type="date"
                className="input"
                value={anneeForm.date_fin}
                onChange={(e) => setAnneeForm({ ...anneeForm, date_fin: e.target.value })}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={anneeForm.est_courante}
              onChange={(e) => setAnneeForm({ ...anneeForm, est_courante: e.target.checked })}
            />
            Définir comme année scolaire courante (active)
          </label>

          {!anneeEditing && (
            <label className="flex items-center gap-2 rounded-xl bg-brand-50 p-3 text-sm font-medium text-brand-900 ring-1 ring-brand-200">
              <input
                type="checkbox"
                checked={anneeForm.auto_periodes}
                onChange={(e) => setAnneeForm({ ...anneeForm, auto_periodes: e.target.checked })}
              />
              Générer automatiquement les 3 trimestres (recommandé)
            </label>
          )}
        </form>
      </Modal>

      {/* --- MODAL CRÉATION / MODIFICATION PÉRIODE --- */}
      <Modal
        open={periodeModalOpen}
        onClose={() => setPeriodeModalOpen(false)}
        title={periodeEditing ? "Modifier la période" : "Ajouter une période"}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setPeriodeModalOpen(false)}>Annuler</button>
            <button className="btn-primary" disabled={savingPeriode} form="periode-form">
              {savingPeriode && <Loader2 size={16} className="animate-spin" />}
              Enregistrer
            </button>
          </>
        }
      >
        <form id="periode-form" onSubmit={handleSavePeriode} className="space-y-4">
          <div>
            <label className="label">Année scolaire</label>
            <select
              required
              className="input"
              value={periodeForm.annee_scolaire}
              onChange={(e) => setPeriodeForm({ ...periodeForm, annee_scolaire: e.target.value })}
            >
              {annees.map((a) => (
                <option key={a.id} value={a.id}>{a.libelle}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select
                required
                className="input"
                value={periodeForm.type_periode}
                onChange={(e) => {
                  const type = e.target.value;
                  const num = periodeForm.numero || 1;
                  const label = `${num}${num === 1 ? "er" : "ème"} ${type === "trimestre" ? "Trimestre" : "Semestre"}`;
                  setPeriodeForm({ ...periodeForm, type_periode: type, libelle: label });
                }}
              >
                <option value="trimestre">Trimestre</option>
                <option value="semestre">Semestre</option>
              </select>
            </div>
            <div>
              <label className="label">Numéro</label>
              <input
                required
                type="number"
                min="1"
                max="6"
                className="input"
                value={periodeForm.numero}
                onChange={(e) => {
                  const num = parseInt(e.target.value, 10) || 1;
                  const type = periodeForm.type_periode;
                  const label = `${num}${num === 1 ? "er" : "ème"} ${type === "trimestre" ? "Trimestre" : "Semestre"}`;
                  setPeriodeForm({ ...periodeForm, numero: num, libelle: label });
                }}
              />
            </div>
          </div>

          <div>
            <label className="label">Libellé de la période</label>
            <input
              required
              className="input"
              value={periodeForm.libelle}
              onChange={(e) => setPeriodeForm({ ...periodeForm, libelle: e.target.value })}
              placeholder="Ex: 1er Trimestre"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date de début</label>
              <input
                required
                type="date"
                className="input"
                value={periodeForm.date_debut}
                onChange={(e) => setPeriodeForm({ ...periodeForm, date_debut: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Date de fin</label>
              <input
                required
                type="date"
                className="input"
                value={periodeForm.date_fin}
                onChange={(e) => setPeriodeForm({ ...periodeForm, date_fin: e.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={periodeForm.est_courante}
                onChange={(e) => setPeriodeForm({ ...periodeForm, est_courante: e.target.checked })}
              />
              Définir comme période courante
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={periodeForm.cloturee}
                onChange={(e) => setPeriodeForm({ ...periodeForm, cloturee: e.target.checked })}
              />
              Période clôturée (les notes ne peuvent plus être modifiées)
            </label>
          </div>
        </form>
      </Modal>
    </div>
  );
}