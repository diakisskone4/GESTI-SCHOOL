import { useEffect, useMemo, useState } from "react";
import { ArrowDownUp, Loader2, Pencil, Plus, Save, Settings2, Trash2, Undo2 } from "lucide-react";
import Modal from "../../components/ui/Modal";
import { useToast, extractErrorMessage } from "../../context/ToastContext";
import { evaluationsApi, typesEvaluationApi } from "../../api/endpoints";

// Couleurs des groupes de colonnes, attribuées dans l'ordre des types
const TYPE_STYLES = [
  { head: "bg-sky-50 text-sky-700 border-sky-200", chip: "bg-sky-100 text-sky-700" },
  { head: "bg-amber-50 text-amber-700 border-amber-200", chip: "bg-amber-100 text-amber-700" },
  { head: "bg-rose-50 text-rose-700 border-rose-200", chip: "bg-rose-100 text-rose-700" },
  { head: "bg-emerald-50 text-emerald-700 border-emerald-200", chip: "bg-emerald-100 text-emerald-700" },
  { head: "bg-violet-50 text-violet-700 border-violet-200", chip: "bg-violet-100 text-violet-700" },
];

const fmtNote = (n) => (n === null || n === undefined ? "—" : Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 2 }));
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) : "");
const parseNote = (v) => (v === "" || v === null || v === undefined ? null : Number(String(v).replace(",", ".")));

/**
 * Même calcul que le backend (apps/academics/services.py › moyenne_ponderee) :
 * moyenne de chaque type d'évaluation, puis moyenne de ces moyennes pondérée par le poids du type.
 * Les anciennes notes sans évaluation forment un groupe de poids 1.
 */
function calculerMoyenne(notesParEval, evaluations, types, notesHorsEvaluation) {
  const poidsParType = Object.fromEntries(types.map((t) => [t.id, Number(t.ponderation)]));
  const groupes = {};
  evaluations.forEach((ev) => {
    const v = parseNote(notesParEval[ev.id]);
    if (v === null || Number.isNaN(v)) return;
    const g = (groupes[ev.type_evaluation] ??= { poids: poidsParType[ev.type_evaluation] ?? 1, valeurs: [] });
    g.valeurs.push((v * 20) / Number(ev.bareme));
  });
  if (notesHorsEvaluation?.length) groupes.__anciennes = { poids: 1, valeurs: notesHorsEvaluation };
  let total = 0;
  let poids = 0;
  Object.values(groupes).forEach((g) => {
    if (g.poids <= 0) return;
    total += (g.poids * g.valeurs.reduce((a, b) => a + b, 0)) / g.valeurs.length;
    poids += g.poids;
  });
  return poids ? Math.round((total / poids) * 100) / 100 : null;
}

function couleurMoyenne(m) {
  if (m === null) return "text-slate-400";
  if (m < 10) return "text-rose-600";
  if (m < 12) return "text-amber-600";
  return "text-emerald-600";
}

export default function CarnetNotes({ classeId, periodeId, matiereId, etablissementId, isAdmin }) {
  const { notify } = useToast();
  const [carnet, setCarnet] = useState(null);
  const [loading, setLoading] = useState(false);
  const [brouillon, setBrouillon] = useState({}); // { [evaluationId]: { [inscriptionId]: "valeur" } }
  const [saving, setSaving] = useState(false);
  const [filtreType, setFiltreType] = useState("tous");
  const [tri, setTri] = useState("type"); // "type" | "date"
  const [evalModal, setEvalModal] = useState(null); // null | {} (création) | evaluation (modification)
  const [typesModal, setTypesModal] = useState(false);

  const charger = async () => {
    setLoading(true);
    try {
      setCarnet(await evaluationsApi.carnet({ classe: classeId, matiere: matiereId, periode: periodeId }));
      setBrouillon({});
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classeId, periodeId, matiereId]);

  const types = useMemo(() => carnet?.types || [], [carnet]);
  const styleType = (typeId) => TYPE_STYLES[Math.max(0, types.findIndex((t) => t.id === typeId)) % TYPE_STYLES.length];

  // Colonnes affichées : filtrées par type et triées (par type puis date, ou par date)
  const colonnes = useMemo(() => {
    const ordreType = Object.fromEntries(types.map((t, i) => [t.id, i]));
    const liste = (carnet?.evaluations || []).filter((ev) => filtreType === "tous" || ev.type_evaluation === filtreType);
    const parDate = (a, b) => (a.date_evaluation || "9999").localeCompare(b.date_evaluation || "9999") || a.created_at.localeCompare(b.created_at);
    return [...liste].sort((a, b) => (tri === "type" ? ordreType[a.type_evaluation] - ordreType[b.type_evaluation] : 0) || parDate(a, b));
  }, [carnet, types, filtreType, tri]);

  // Groupes d'en-tête (une bande de couleur par type) quand le tri est par type
  const groupes = useMemo(() => {
    if (tri !== "type") return null;
    const res = [];
    colonnes.forEach((ev) => {
      const dernier = res[res.length - 1];
      if (dernier && dernier.typeId === ev.type_evaluation) dernier.span += 1;
      else res.push({ typeId: ev.type_evaluation, nom: ev.type_nom, ponderation: ev.ponderation, span: 1 });
    });
    return res;
  }, [colonnes, tri]);

  const valeurCellule = (ev, eleve) => brouillon[ev.id]?.[eleve.inscription] ?? eleve.notes[ev.id] ?? "";
  const estModifiee = (ev, eleve) => brouillon[ev.id]?.[eleve.inscription] !== undefined;
  const estInvalide = (ev, valeur) => {
    const v = parseNote(valeur);
    return v !== null && (Number.isNaN(v) || v < 0 || v > Number(ev.bareme));
  };

  const modifier = (ev, eleve, valeur) => {
    const original = eleve.notes[ev.id] ?? "";
    setBrouillon((b) => {
      const col = { ...(b[ev.id] || {}) };
      if (parseNote(valeur) === parseNote(original)) delete col[eleve.inscription];
      else col[eleve.inscription] = valeur;
      return { ...b, [ev.id]: col };
    });
  };

  const nbModifs = Object.values(brouillon).reduce((n, col) => n + Object.keys(col).length, 0);
  const aDesErreurs = (carnet?.evaluations || []).some((ev) =>
    Object.values(brouillon[ev.id] || {}).some((v) => estInvalide(ev, v))
  );

  const enregistrer = async () => {
    setSaving(true);
    try {
      const entrees = Object.entries(brouillon).filter(([, col]) => Object.keys(col).length);
      for (const [evaluationId, col] of entrees) {
        await evaluationsApi.saisirNotes(
          evaluationId,
          Object.entries(col).map(([inscription, valeur]) => ({ inscription, valeur: String(valeur).replace(",", ".") }))
        );
      }
      notify(`${nbModifs} note(s) enregistrée(s).`, "success");
      await charger();
    } catch (err) {
      notify(err?.response?.data?.detail || extractErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  // Entrée / flèches haut-bas : passer à l'élève suivant dans la même colonne
  const naviguer = (e, col, ligne) => {
    const delta = e.key === "Enter" || e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    document.getElementById(`note-${col}-${ligne + delta}`)?.focus();
  };

  const supprimerEvaluation = async (ev) => {
    if (!window.confirm(`Supprimer « ${ev.libelle} » et ses ${ev.nb_notes} note(s) ?`)) return;
    try {
      await evaluationsApi.remove(ev.id);
      notify("Évaluation supprimée.", "success");
      charger();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    }
  };

  const initialiserTypes = async () => {
    try {
      await typesEvaluationApi.initialiser(etablissementId);
      notify("Types créés : Interrogation ×1, Devoir ×1, Composition ×2.", "success");
      charger();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    }
  };

  if (loading && !carnet) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-brand-500" /></div>;
  }
  if (!carnet) return null;

  const eleves = carnet.eleves;
  const aAnciennes = eleves.some((e) => e.notes_hors_evaluation.length);
  const formule = types.length
    ? `(${types.map((t) => `moy. ${t.nom}s × ${Number(t.ponderation)}`).join(" + ")}) ÷ ${types.reduce((s, t) => s + Number(t.ponderation), 0)}`
    : "";

  if (types.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
        <p className="font-semibold text-slate-700">Aucun type d'évaluation n'est configuré</p>
        <p className="mt-1 text-sm text-slate-500">Les types (Interrogation, Devoir, Composition...) et leur poids servent au calcul des moyennes.</p>
        {isAdmin ? (
          <div className="mt-4 flex justify-center gap-2">
            <button onClick={initialiserTypes} className="btn-primary">Créer les types par défaut</button>
            <button onClick={() => setTypesModal(true)} className="btn-secondary"><Settings2 size={16} /> Personnaliser</button>
          </div>
        ) : (
          <p className="mt-3 text-sm text-amber-700">Demandez à l'administration de les configurer.</p>
        )}
        <TypesEvaluationModal open={typesModal} onClose={() => setTypesModal(false)} types={types} etablissementId={etablissementId} onChange={charger} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setFiltreType("tous")}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${filtreType === "tous" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            Toutes ({carnet.evaluations.length})
          </button>
          {types.map((t) => {
            const n = carnet.evaluations.filter((ev) => ev.type_evaluation === t.id).length;
            const actif = filtreType === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setFiltreType(t.id)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${actif ? "ring-2 ring-offset-1 ring-slate-400 " : ""}${styleType(t.id).chip}`}
              >
                {t.nom}s ({n}) · ×{Number(t.ponderation)}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button onClick={() => setTri(tri === "type" ? "date" : "type")} className="btn-secondary text-xs" title="Changer l'ordre des colonnes">
            <ArrowDownUp size={14} /> {tri === "type" ? "Groupé par type" : "Par date"}
          </button>
          {isAdmin && (
            <button onClick={() => setTypesModal(true)} className="btn-secondary text-xs">
              <Settings2 size={14} /> Types & pondérations
            </button>
          )}
          <button onClick={() => setEvalModal({})} className="btn-secondary text-xs">
            <Plus size={14} /> Nouvelle évaluation
          </button>
          {nbModifs > 0 && (
            <button onClick={() => setBrouillon({})} className="btn-ghost text-xs" title="Annuler les modifications non enregistrées">
              <Undo2 size={14} /> Annuler
            </button>
          )}
          <button onClick={enregistrer} disabled={!nbModifs || saving || aDesErreurs} className="btn-primary text-xs">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Enregistrer{nbModifs ? ` (${nbModifs})` : ""}
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Moyenne de la matière = {formule}
        {aAnciennes && " — les anciennes notes saisies sans évaluation comptent comme un groupe de poids 1."}
      </p>

      {carnet.evaluations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
          <p className="font-semibold text-slate-700">Aucune évaluation pour cette matière et cette période</p>
          <p className="mt-1 text-sm text-slate-500">Créez une interrogation, un devoir ou une composition pour commencer la saisie.</p>
          <button onClick={() => setEvalModal({})} className="btn-primary mt-4"><Plus size={16} /> Nouvelle évaluation</button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              {groupes && (
                <tr>
                  <th className="sticky left-0 z-10 bg-white" colSpan={1} />
                  {groupes.map((g, i) => (
                    <th key={i} colSpan={g.span} className={`border-b border-l px-2 py-1.5 text-center text-xs font-bold uppercase tracking-wide ${styleType(g.typeId).head}`}>
                      {g.nom}s <span className="font-medium normal-case opacity-75">· coef. {Number(g.ponderation)}</span>
                    </th>
                  ))}
                  {aAnciennes && <th className="border-l bg-white" />}
                  <th className="border-l bg-white" />
                </tr>
              )}
              <tr className="bg-slate-50 text-xs text-slate-500">
                <th className="sticky left-0 z-10 min-w-[200px] bg-slate-50 px-3 py-2 text-left font-semibold">Élève</th>
                {colonnes.map((ev) => (
                  <th key={ev.id} className="min-w-[96px] border-l border-slate-200 px-2 py-2 align-top font-medium">
                    {!groupes && (
                      <span className={`mb-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${styleType(ev.type_evaluation).chip}`}>
                        {ev.type_nom}
                      </span>
                    )}
                    <div className="font-semibold text-slate-700">{ev.libelle}</div>
                    <div className="text-[11px] text-slate-400">
                      {fmtDate(ev.date_evaluation)}{ev.date_evaluation ? " · " : ""}/{Number(ev.bareme)}
                    </div>
                    <div className="mt-1 flex justify-center gap-0.5">
                      <button onClick={() => setEvalModal(ev)} className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-brand-600" title="Modifier l'évaluation">
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => supprimerEvaluation(ev)} className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-rose-600" title="Supprimer l'évaluation">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </th>
                ))}
                {aAnciennes && <th className="border-l border-slate-200 px-2 py-2 font-medium">Anciennes notes<div className="text-[11px] text-slate-400">/20</div></th>}
                <th className="border-l border-slate-200 bg-brand-50 px-3 py-2 font-semibold text-brand-700">Moyenne<div className="text-[11px] font-medium">/20</div></th>
              </tr>
            </thead>
            <tbody>
              {eleves.map((eleve, ligne) => {
                const notesCourantes = Object.fromEntries(carnet.evaluations.map((ev) => [ev.id, valeurCellule(ev, eleve)]));
                const moyenne = calculerMoyenne(notesCourantes, carnet.evaluations, types, eleve.notes_hors_evaluation);
                return (
                  <tr key={eleve.inscription} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="sticky left-0 z-10 bg-white px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-6 text-right text-xs text-slate-400">{ligne + 1}</span>
                        <div>
                          <div className="font-medium text-slate-800">{eleve.nom}</div>
                          <div className="text-[11px] text-slate-400">{eleve.matricule}</div>
                        </div>
                      </div>
                    </td>
                    {colonnes.map((ev, col) => {
                      const valeur = valeurCellule(ev, eleve);
                      const invalide = estInvalide(ev, valeur);
                      return (
                        <td key={ev.id} className="border-l border-slate-100 px-1.5 py-1 text-center">
                          <input
                            id={`note-${col}-${ligne}`}
                            type="number" inputMode="decimal" min="0" max={Number(ev.bareme)} step="0.25"
                            value={valeur}
                            onChange={(e) => modifier(ev, eleve, e.target.value)}
                            onKeyDown={(e) => naviguer(e, col, ligne)}
                            placeholder="—"
                            title={invalide ? `Note entre 0 et ${Number(ev.bareme)}` : undefined}
                            className={`w-20 rounded-lg border px-2 py-1 text-center text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 ${
                              invalide ? "border-rose-400 bg-rose-50 text-rose-700"
                                : estModifiee(ev, eleve) ? "border-amber-300 bg-amber-50"
                                : "border-slate-200 bg-white"
                            }`}
                          />
                        </td>
                      );
                    })}
                    {aAnciennes && (
                      <td className="border-l border-slate-100 px-2 text-center text-xs text-slate-500">
                        {eleve.notes_hors_evaluation.map(fmtNote).join(" · ") || "—"}
                      </td>
                    )}
                    <td className={`border-l border-slate-100 bg-brand-50/40 px-3 text-center font-bold ${couleurMoyenne(moyenne)}`}>
                      {fmtNote(moyenne)}
                    </td>
                  </tr>
                );
              })}
              {eleves.length === 0 && (
                <tr><td colSpan={colonnes.length + 3} className="py-8 text-center text-slate-400">Aucun élève actif dans cette classe.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {nbModifs > 0 && (
        <p className="text-xs text-amber-700">
          {nbModifs} modification(s) non enregistrée(s){aDesErreurs ? " — corrigez les notes en rouge avant d'enregistrer." : "."}
        </p>
      )}

      <EvaluationModal
        evaluation={evalModal}
        onClose={() => setEvalModal(null)}
        types={types}
        evaluations={carnet.evaluations}
        context={{ classe: classeId, periode: periodeId, matiere: matiereId }}
        onSaved={charger}
      />
      <TypesEvaluationModal open={typesModal} onClose={() => setTypesModal(false)} types={types} etablissementId={etablissementId} onChange={charger} />
    </div>
  );
}

/** Création / modification d'une évaluation (colonne du carnet). */
function EvaluationModal({ evaluation, onClose, types, evaluations, context, onSaved }) {
  const { notify } = useToast();
  const edition = !!evaluation?.id;
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const libelleSuggere = (typeId) => {
    const type = types.find((t) => t.id === Number(typeId));
    if (!type) return "";
    const n = evaluations.filter((ev) => ev.type_evaluation === type.id).length;
    return n === 0 && type.nom.toLowerCase().startsWith("compo") ? type.nom : `${type.nom} ${n + 1}`;
  };

  useEffect(() => {
    if (!evaluation) return;
    if (edition) {
      setForm({
        type_evaluation: evaluation.type_evaluation, libelle: evaluation.libelle,
        date_evaluation: evaluation.date_evaluation || "", bareme: Number(evaluation.bareme),
      });
    } else {
      const premier = types[0]?.id ?? "";
      setForm({ type_evaluation: premier, libelle: libelleSuggere(premier), date_evaluation: new Date().toISOString().slice(0, 10), bareme: 20 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evaluation]);

  const changerType = (typeId) => {
    // Le libellé suit le type tant que l'utilisateur ne l'a pas personnalisé
    const auto = !form.libelle || form.libelle === libelleSuggere(form.type_evaluation);
    setForm({ ...form, type_evaluation: typeId, libelle: auto && !edition ? libelleSuggere(typeId) : form.libelle });
  };

  const enregistrer = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, date_evaluation: form.date_evaluation || null };
      if (edition) await evaluationsApi.update(evaluation.id, payload);
      else await evaluationsApi.create({ ...context, ...payload });
      notify(edition ? "Évaluation modifiée." : "Évaluation créée : vous pouvez saisir les notes.", "success");
      onClose();
      onSaved();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!evaluation}
      onClose={onClose}
      title={edition ? `Modifier « ${evaluation.libelle} »` : "Nouvelle évaluation"}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn-primary" disabled={saving} form="evaluation-form">
            {saving && <Loader2 size={16} className="animate-spin" />} Enregistrer
          </button>
        </>
      }
    >
      <form id="evaluation-form" onSubmit={enregistrer} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Type d'évaluation</label>
          <div className="grid grid-cols-3 gap-2">
            {types.map((t) => (
              <button
                key={t.id} type="button" onClick={() => changerType(t.id)}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                  Number(form.type_evaluation) === t.id ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {t.nom}
                <span className="block text-[11px] font-normal text-slate-400">coef. {Number(t.ponderation)}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Libellé</label>
          <input required maxLength={100} className="input" value={form.libelle || ""} onChange={(e) => setForm({ ...form, libelle: e.target.value })} />
        </div>
        <div>
          <label className="label">Date</label>
          <input type="date" className="input" value={form.date_evaluation || ""} onChange={(e) => setForm({ ...form, date_evaluation: e.target.value })} />
        </div>
        <div>
          <label className="label">Noté sur</label>
          <input required type="number" min="1" step="0.5" className="input" value={form.bareme ?? ""} onChange={(e) => setForm({ ...form, bareme: e.target.value })} />
          <p className="mt-1 text-xs text-slate-400">Converti automatiquement sur 20 pour la moyenne.</p>
        </div>
      </form>
    </Modal>
  );
}

/** Gestion des types d'évaluation et de leur pondération (administration). */
function TypesEvaluationModal({ open, onClose, types, etablissementId, onChange }) {
  const { notify } = useToast();
  const [lignes, setLignes] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setLignes(types.map((t) => ({ ...t, ponderation: Number(t.ponderation) })));
  }, [open, types]);

  const maj = (i, champ, valeur) => setLignes(lignes.map((l, j) => (j === i ? { ...l, [champ]: valeur } : l)));
  const ajouter = () => setLignes([...lignes, { nom: "", ponderation: 1, ordre: lignes.length + 1 }]);

  const supprimer = async (i) => {
    const ligne = lignes[i];
    if (ligne.id) {
      if (!window.confirm(`Supprimer le type « ${ligne.nom} » ?`)) return;
      try {
        await typesEvaluationApi.remove(ligne.id);
      } catch (err) {
        notify(err?.response?.data?.detail || extractErrorMessage(err), "error");
        return;
      }
      onChange();
    }
    setLignes(lignes.filter((_, j) => j !== i));
  };

  const deplacer = (i, delta) => {
    const j = i + delta;
    if (j < 0 || j >= lignes.length) return;
    const copie = [...lignes];
    [copie[i], copie[j]] = [copie[j], copie[i]];
    setLignes(copie);
  };

  const enregistrer = async () => {
    setSaving(true);
    try {
      for (const [i, l] of lignes.entries()) {
        const payload = { nom: l.nom.trim(), ponderation: l.ponderation, ordre: i + 1, etablissement: etablissementId };
        if (!payload.nom) continue;
        if (l.id) await typesEvaluationApi.update(l.id, payload);
        else await typesEvaluationApi.create(payload);
      }
      notify("Types d'évaluation enregistrés.", "success");
      onClose();
      onChange();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const total = lignes.reduce((s, l) => s + (Number(l.ponderation) || 0), 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Types d'évaluation & pondérations"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn-primary" disabled={saving} onClick={enregistrer}>
            {saving && <Loader2 size={16} className="animate-spin" />} Enregistrer
          </button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-500">
        La moyenne d'une matière est la moyenne de chaque type, pondérée par son coefficient.
        L'ordre définit l'ordre des colonnes du carnet.
      </p>
      <div className="space-y-2">
        <div className="grid grid-cols-[auto_1fr_90px_auto] items-center gap-2 px-1 text-xs font-semibold text-slate-400">
          <span className="w-12">Ordre</span><span>Nom</span><span>Coefficient</span><span />
        </div>
        {lignes.map((l, i) => (
          <div key={l.id ?? `new-${i}`} className="grid grid-cols-[auto_1fr_90px_auto] items-center gap-2">
            <div className="flex w-12 flex-col">
              <button type="button" onClick={() => deplacer(i, -1)} disabled={i === 0} className="text-xs text-slate-400 hover:text-slate-700 disabled:opacity-30">▲</button>
              <button type="button" onClick={() => deplacer(i, 1)} disabled={i === lignes.length - 1} className="text-xs text-slate-400 hover:text-slate-700 disabled:opacity-30">▼</button>
            </div>
            <input className="input" placeholder="Ex: Travaux pratiques" value={l.nom} onChange={(e) => maj(i, "nom", e.target.value)} />
            <input className="input" type="number" min="0" step="0.5" value={l.ponderation} onChange={(e) => maj(i, "ponderation", e.target.value)} />
            <button type="button" onClick={() => supprimer(i)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Supprimer">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={ajouter} className="btn-ghost mt-3 text-sm"><Plus size={15} /> Ajouter un type</button>
      {lignes.length > 0 && (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Moyenne = ({lignes.filter((l) => l.nom).map((l) => `${l.nom} × ${l.ponderation}`).join(" + ")}) ÷ {total}
        </p>
      )}
    </Modal>
  );
}
