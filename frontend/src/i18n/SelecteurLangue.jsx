import { useEffect, useState } from "react";
import { Languages } from "lucide-react";
import { authApi } from "../api/endpoints";
import { useAuth } from "../context/AuthContext";
import { LANGUES, changerLangue, langueActive, surChangementLangue } from "./traduction";

/** Langue active, mise à jour quand elle change ailleurs dans l'application. */
export function useLangue() {
  const [langue, setLangue] = useState(langueActive);
  useEffect(() => surChangementLangue(setLangue), []);
  return langue;
}

/**
 * Choix de la langue de l'application (Français, English, العربية).
 * Le choix est mémorisé dans le navigateur et dans le profil de l'utilisateur connecté,
 * pour le retrouver sur ses autres appareils.
 */
export default function SelecteurLangue({ sombre = false }) {
  const { user } = useAuth();
  const langue = useLangue();

  // À la connexion, la langue enregistrée dans le profil s'applique
  useEffect(() => {
    const preferee = user?.langue_preferee;
    if (preferee && preferee !== langueActive() && LANGUES.some((l) => l.code === preferee)) changerLangue(preferee);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const choisir = (code) => {
    changerLangue(code);
    if (user) authApi.updateMe({ langue_preferee: code }).catch(() => {});
  };

  return (
    <div>
      <p className={`flex items-center gap-1.5 px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider ${sombre ? "text-slate-500" : "text-slate-400"}`}>
        <Languages size={13} /> Langue
      </p>
      <div
        role="radiogroup"
        aria-label="Choisir la langue de l'application"
        className={`grid grid-cols-3 gap-1 rounded-xl p-1 ${sombre ? "bg-white/5" : "bg-slate-100"}`}
      >
        {LANGUES.map((l) => {
          const actif = l.code === langue;
          return (
            <button
              key={l.code}
              type="button"
              role="radio"
              aria-checked={actif}
              lang={l.code}
              translate="no"
              onClick={() => choisir(l.code)}
              className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${
                actif
                  ? "bg-brand-500 text-white shadow-sm"
                  : sombre ? "text-slate-400 hover:bg-white/10 hover:text-white" : "text-slate-600 hover:bg-white"
              }`}
            >
              {l.libelle}
            </button>
          );
        })}
      </div>
    </div>
  );
}
