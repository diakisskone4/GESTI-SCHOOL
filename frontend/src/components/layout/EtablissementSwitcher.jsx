import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, School } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { authApi, etablissementsApi } from "../../api/endpoints";
import { useToast, extractErrorMessage } from "../../context/ToastContext";

/** Change l'établissement actif puis recharge l'application : toutes les pages affichent alors
 *  uniquement les données de ce nouvel établissement. */
export async function basculerVersEtablissement(etablissementId) {
  await authApi.updateMe({ etablissement_courant: etablissementId });
  window.location.assign("/");
}

/**
 * Sélecteur de l'établissement actif (personnel ayant accès à plusieurs établissements).
 * `variante` : "barre" (barre du haut, ordinateur) ou "liste" (panneau Menu, mobile).
 */
export default function EtablissementSwitcher({ variante = "barre" }) {
  const { user } = useAuth();
  const { notify } = useToast();
  const [etablissements, setEtablissements] = useState([]);
  const [ouvert, setOuvert] = useState(false);
  const [enCours, setEnCours] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    etablissementsApi.list({ page_size: 100 })
      .then((r) => setEtablissements(r.results ?? r ?? []))
      .catch(() => setEtablissements([]));
  }, []);

  useEffect(() => {
    if (!ouvert) return;
    const fermer = (e) => ref.current && !ref.current.contains(e.target) && setOuvert(false);
    document.addEventListener("mousedown", fermer);
    return () => document.removeEventListener("mousedown", fermer);
  }, [ouvert]);

  if (["eleve", "parent"].includes(user?.role)) return null;
  const actif = etablissements.find((e) => e.id === user?.etablissement_courant);
  if (!actif && etablissements.length === 0) return null;

  const choisir = async (etab) => {
    if (etab.id === user?.etablissement_courant) {
      setOuvert(false);
      return;
    }
    setEnCours(etab.id);
    try {
      await basculerVersEtablissement(etab.id);
    } catch (err) {
      notify(extractErrorMessage(err), "error");
      setEnCours(null);
    }
  };

  const plusieurs = etablissements.length > 1;

  const liste = (
    <div className="space-y-1">
      {etablissements.map((etab) => {
        const estActif = etab.id === user?.etablissement_courant;
        return (
          <button
            key={etab.id}
            onClick={() => choisir(etab)}
            disabled={!!enCours}
            className={`press flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ${
              estActif ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg ${estActif ? "bg-white" : "bg-slate-100"}`}>
              {etab.logo ? <img src={etab.logo} alt="" className="h-full w-full object-contain" /> : <School size={16} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{etab.nom}</span>
              <span className="block truncate text-xs text-slate-400">{[etab.sigle, etab.ville].filter(Boolean).join(" · ")}</span>
            </span>
            {enCours === etab.id ? <Loader2 size={16} className="animate-spin" /> : estActif && <Check size={16} />}
          </button>
        );
      })}
    </div>
  );

  if (variante === "liste") {
    return (
      <div>
        <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          {plusieurs ? "Établissement actif" : "Établissement"}
        </p>
        <div className="rounded-2xl bg-white p-1.5 shadow-sm">{liste}</div>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => plusieurs && setOuvert(!ouvert)}
        className={`flex max-w-64 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm ${plusieurs ? "hover:bg-slate-50" : "cursor-default"}`}
        title={plusieurs ? "Changer d'établissement" : actif?.nom}
      >
        <School size={16} className="shrink-0 text-brand-600" />
        <span className="truncate font-semibold text-slate-700">{actif?.nom || "Choisir un établissement"}</span>
        {plusieurs && <ChevronDown size={15} className="shrink-0 text-slate-400" />}
      </button>
      {ouvert && (
        <div className="absolute left-0 z-30 mt-2 w-80 rounded-xl border border-slate-100 bg-white p-1.5 shadow-[var(--shadow-card-hover)]">
          <p className="px-3 pb-1.5 pt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Changer d'établissement</p>
          {liste}
        </div>
      )}
    </div>
  );
}
