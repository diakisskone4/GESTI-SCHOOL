import { useMemo, useState } from "react";
import { ArrowRightLeft, Calculator, CheckCircle2, CircleArrowUp, GraduationCap, Info, Loader2, Repeat, Undo2, XCircle } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import Modal from "../../components/ui/Modal";
import { useFetch } from "../../hooks/useFetch";
import { useAuth } from "../../context/AuthContext";
import { useToast, extractErrorMessage } from "../../context/ToastContext";
import { anneesScolairesApi, etablissementsApi, passagesApi } from "../../api/endpoints";

const STYLES = {
  admis: { badge: "bg-emerald-600 text-white", icone: CheckCircle2, ligne: "" },
  fin_cycle: { badge: "bg-emerald-700 text-white", icone: GraduationCap, ligne: "" },
  redouble: { badge: "bg-rose-600 text-white", icone: XCircle, ligne: "bg-rose-50/40" },
};
const note = (v) => (v === null || v === undefined ? "—" : Number(v).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

function Tuile({ libelle, valeur, ton }) {
  return (
    <div className={`rounded-2xl border p-4 ${ton}`}>
      <p className="text-2xl font-bold tabular-nums">{valeur}</p>
      <p className="text-sm">{libelle}</p>
    </div>
  );
}

/**
 * Passage en classe supérieure : à la fin de la dernière période (3e trimestre), chaque élève est déclaré
 * admis (vert) ou redoublant (rouge) d'après sa moyenne annuelle ; la direction peut corriger une décision,
 * puis transférer tous les élèves vers l'année suivante en un clic.
 */
export default function PassagesPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const estAdmin = user?.est_admin;

  const { data: anneesData } = useFetch(() => anneesScolairesApi.list({ page_size: 50 }), []);
  const annees = useMemo(() => anneesData?.results || [], [anneesData]);
  const [anneeChoisie, setAnnee] = useState("");
  const anneeParDefaut = annees.find((a) => a.est_courante) || annees[0];
  const annee = anneeChoisie || (anneeParDefaut ? String(anneeParDefaut.id) : "");

  const { data, loading, reload } = useFetch(() => (annee ? passagesApi.vue({ annee }) : Promise.resolve(null)), [annee]);
  const [occupe, setOccupe] = useState(null);
  const [confirmation, setConfirmation] = useState(null); // "transferer" | "annuler"
  const [seuil, setSeuil] = useState(null);

  const executer = async (cle, action) => {
    setOccupe(cle);
    try {
      const r = await action();
      if (r?.detail) notify(r.detail, "success");
      reload();
      return true;
    } catch (err) {
      notify(extractErrorMessage(err), "error");
      return false;
    } finally {
      setOccupe(null);
    }
  };

  const enregistrerSeuil = async () => {
    const valeur = Number(String(seuil).replace(",", "."));
    if (Number.isNaN(valeur) || valeur < 0 || valeur > 20) {
      notify("Le seuil doit être compris entre 0 et 20.", "error");
      return;
    }
    const ok = await executer("seuil", async () => {
      await etablissementsApi.update(data.etablissement, { moyenne_passage: valeur.toFixed(2) });
      return passagesApi.calculer(annee);
    });
    if (ok) setSeuil(null);
  };

  const confirmer = async () => {
    const ok = await executer(confirmation, () => (confirmation === "transferer" ? passagesApi.transferer(annee) : passagesApi.annuler(annee)));
    if (ok) setConfirmation(null);
  };

  const totaux = data?.totaux;
  const aDesDecisions = totaux && totaux.admis + totaux.redouble + totaux.fin_cycle > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Passages de classe"
        subtitle="Décisions de fin d'année d'après la moyenne annuelle, puis passage automatique des élèves dans l'année suivante."
        actions={estAdmin && data && (
          <>
            <button className="btn-secondary" onClick={() => executer("calcul", () => passagesApi.calculer(annee))} disabled={!!occupe}>
              {occupe === "calcul" ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />} Recalculer
            </button>
            {totaux?.transferes > 0 && (
              <button className="btn-secondary" onClick={() => setConfirmation("annuler")} disabled={!!occupe}>
                <Undo2 size={16} /> Annuler le transfert
              </button>
            )}
            <button className="btn-primary" onClick={() => setConfirmation("transferer")} disabled={!aDesDecisions || !!occupe}>
              <ArrowRightLeft size={16} /> Transférer vers {data.annee_suivante || "l'année suivante"}
            </button>
          </>
        )}
      />

      <div className="card flex flex-wrap items-end gap-4 p-4">
        <div>
          <label className="label">Année scolaire</label>
          <select className="input w-auto min-w-44" value={annee} onChange={(e) => setAnnee(e.target.value)}>
            {annees.map((a) => <option key={a.id} value={a.id}>{a.libelle}{a.est_courante ? " (en cours)" : ""}</option>)}
          </select>
        </div>
        {data && (
          <div>
            <label className="label">Moyenne de passage</label>
            {seuil === null ? (
              <p className="flex items-center gap-2 py-2.5 text-sm">
                <strong className="text-lg tabular-nums text-slate-800">{note(data.seuil)}</strong> / 20
                {estAdmin && <button className="text-xs font-semibold text-brand-600 hover:underline" onClick={() => setSeuil(String(data.seuil))}>Modifier</button>}
              </p>
            ) : (
              <div className="flex gap-2">
                <input className="input w-24" inputMode="decimal" value={seuil} onChange={(e) => setSeuil(e.target.value)} />
                <button className="btn-primary px-3 text-xs" onClick={enregistrerSeuil} disabled={occupe === "seuil"}>Appliquer</button>
                <button className="btn-secondary px-3 text-xs" onClick={() => setSeuil(null)}>Annuler</button>
              </div>
            )}
          </div>
        )}
        {data && (
          <p className="ml-auto flex max-w-md items-start gap-2 text-xs text-slate-500">
            <Info size={14} className="mt-0.5 shrink-0" />
            Moyenne annuelle = moyenne des {data.periodes.length} période(s). Les décisions se calculent automatiquement dès que
            les bulletins du « {data.derniere_periode || "dernier trimestre"} » sont calculés.
          </p>
        )}
      </div>

      {totaux && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Tuile libelle="Admis en classe supérieure" valeur={totaux.admis} ton="border-emerald-200 bg-emerald-50 text-emerald-800" />
          <Tuile libelle="Redoublants" valeur={totaux.redouble} ton="border-rose-200 bg-rose-50 text-rose-800" />
          <Tuile libelle="Fin de cycle" valeur={totaux.fin_cycle} ton="border-emerald-200 bg-white text-emerald-800" />
          <Tuile libelle="Sans résultat" valeur={totaux.sans_resultat} ton="border-slate-200 bg-white text-slate-600" />
          <Tuile libelle={`Transférés${data.annee_suivante ? ` (${data.annee_suivante})` : ""}`} valeur={totaux.transferes} ton="border-brand-200 bg-brand-50 text-brand-800" />
        </div>
      )}

      {loading && !data ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-slate-400" /></div>
      ) : data && !aDesDecisions ? (
        <div className="card flex flex-col items-center gap-2 p-10 text-center">
          <CircleArrowUp size={32} className="text-brand-400" />
          <p className="font-semibold text-slate-700">Pas encore de décisions pour {data.annee.libelle}</p>
          <p className="max-w-lg text-sm text-slate-500">
            Elles apparaîtront automatiquement quand les bulletins du « {data.derniere_periode || "dernier trimestre"} » seront calculés
            (Notes &amp; bulletins → Calculer).
          </p>
        </div>
      ) : (
        data?.classes.filter((c) => c.eleves.length).map((classe) => {
          const admis = classe.eleves.filter((e) => e.decision?.admis).length;
          const redoublants = classe.eleves.filter((e) => e.decision?.decision === "redouble").length;
          return (
            <section key={classe.id} className="card overflow-hidden">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
                <h2 className="font-semibold text-slate-800">
                  {classe.nom}
                  <span className="ml-2 text-sm font-normal text-slate-500">
                    → {classe.niveau_suivant ? `${classe.niveau_suivant} l'an prochain` : "fin de cycle"}
                  </span>
                </h2>
                <p className="text-sm">
                  <span className="font-semibold text-emerald-700">{admis} admis</span>
                  <span className="mx-2 text-slate-300">|</span>
                  <span className="font-semibold text-rose-700">{redoublants} redoublant(s)</span>
                </p>
              </header>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Rang</th>
                      <th className="px-4 py-2">Élève</th>
                      {data.periodes.map((p) => <th key={p.id} className="px-3 py-2 text-right">{p.libelle}</th>)}
                      <th className="px-4 py-2 text-right">Moy. annuelle</th>
                      <th className="px-4 py-2">Décision</th>
                      {estAdmin && <th className="px-4 py-2">Conseil de classe</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {classe.eleves.map((e) => {
                      const d = e.decision;
                      const style = d ? STYLES[d.decision] : null;
                      const Icone = style?.icone;
                      return (
                        <tr key={e.inscription} className={`border-t border-slate-100 ${style?.ligne || ""}`}>
                          <td className="px-4 py-2.5 tabular-nums text-slate-500">{d?.rang ?? "—"}</td>
                          <td className="px-4 py-2.5">
                            <span className="font-semibold text-slate-800">{e.eleve}</span>
                            <span className="block text-xs text-slate-400">{e.matricule}</span>
                          </td>
                          {e.moyennes.map((m, i) => <td key={i} className="px-3 py-2.5 text-right tabular-nums text-slate-600">{note(m)}</td>)}
                          <td className={`px-4 py-2.5 text-right font-bold tabular-nums ${d ? (d.admis ? "text-emerald-700" : "text-rose-700") : "text-slate-400"}`}>
                            {d ? note(d.moyenne_annuelle) : "—"}
                          </td>
                          <td className="px-4 py-2.5">
                            {d ? (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className={`badge ${style.badge}`}><Icone size={12} /> {d.libelle}</span>
                                {d.manuelle && <span className="badge bg-amber-100 text-amber-800" title={d.motif || "Décision du conseil de classe"}>Conseil</span>}
                                {d.transfere_vers && <span className="badge bg-brand-50 text-brand-700"><ArrowRightLeft size={11} /> {d.transfere_vers}</span>}
                              </div>
                            ) : <span className="text-xs text-slate-400">Pas de moyenne</span>}
                          </td>
                          {estAdmin && (
                            <td className="px-4 py-2.5">
                              {d && (
                                <select
                                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                                  value={d.manuelle ? d.decision : "auto"}
                                  disabled={!!d.transfere_vers || occupe === d.id}
                                  title={d.transfere_vers ? "Annulez le transfert pour modifier" : "Décision du conseil de classe"}
                                  onChange={(ev) => executer(d.id, () => passagesApi.modifier(d.id, ev.target.value, "Décision du conseil de classe"))}
                                >
                                  <option value="auto">Automatique</option>
                                  <option value="admis">{classe.niveau_suivant ? "Admis(e)" : "Admis(e) — fin de cycle"}</option>
                                  <option value="redouble">Redouble</option>
                                </select>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      )}

      <Modal
        open={!!confirmation}
        onClose={() => setConfirmation(null)}
        title={confirmation === "annuler" ? "Annuler le transfert" : `Transférer vers ${data?.annee_suivante || "l'année suivante"}`}
        footer={<>
          <button className="btn-secondary" onClick={() => setConfirmation(null)}>Retour</button>
          <button className={confirmation === "annuler" ? "btn-danger" : "btn-primary"} onClick={confirmer} disabled={!!occupe}>
            {occupe && <Loader2 size={16} className="animate-spin" />} {confirmation === "annuler" ? "Annuler le transfert" : "Transférer"}
          </button>
        </>}
      >
        {confirmation === "transferer" && totaux && (
          <div className="space-y-3 text-sm text-slate-600">
            <ul className="space-y-2">
              <li className="flex items-center gap-2"><CircleArrowUp size={16} className="text-emerald-600" />
                <span><strong>{totaux.admis}</strong> élève(s) inscrit(s) dans la classe du niveau supérieur (ex. 6e A → 5e A)</span></li>
              <li className="flex items-center gap-2"><Repeat size={16} className="text-rose-600" />
                <span><strong>{totaux.redouble}</strong> redoublant(s) réinscrit(s) dans la même classe</span></li>
              <li className="flex items-center gap-2"><GraduationCap size={16} className="text-emerald-700" />
                <span><strong>{totaux.fin_cycle}</strong> élève(s) en fin de cycle, sans réinscription</span></li>
            </ul>
            <p className="rounded-xl bg-slate-50 p-3">
              {data.annee_suivante
                ? `Les élèves seront inscrits en ${data.annee_suivante}.`
                : "L'année scolaire suivante sera créée automatiquement, avec ses classes."}{" "}
              Les classes manquantes sont créées. L'année {data.annee.libelle} reste consultable (notes, bulletins, tableau d'honneur).
            </p>
            {totaux.sans_resultat > 0 && (
              <p className="rounded-xl bg-amber-50 p-3 text-amber-800">{totaux.sans_resultat} élève(s) sans moyenne ne seront pas transférés.</p>
            )}
          </div>
        )}
        {confirmation === "annuler" && (
          <p className="text-sm text-slate-600">
            Les inscriptions créées dans l'année suivante par le transfert seront supprimées (sauf celles qui ont déjà des notes).
            Vous pourrez ensuite corriger les décisions et transférer à nouveau.
          </p>
        )}
      </Modal>
    </div>
  );
}
