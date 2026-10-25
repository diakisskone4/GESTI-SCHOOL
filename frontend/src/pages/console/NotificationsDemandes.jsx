import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, BellRing, Hand, Loader2 } from "lucide-react";
import { useToast, extractErrorMessage } from "../../context/ToastContext";
import { plateformeApi } from "../../api/endpoints";
import { depuis } from "./commun";

const INTERVALLE = 30000; // vérification des nouvelles demandes toutes les 30 secondes
const EVENEMENT_MAJ = "console:demandes-maj";

/** À appeler après une action sur une demande pour mettre la cloche à jour immédiatement. */
export function signalerMajDemandes() {
  window.dispatchEvent(new Event(EVENEMENT_MAJ));
}

/** Prend en charge une demande ; si un collègue l'a déjà, demande confirmation avant de la reprendre. */
export async function prendreEnCharge(demande) {
  try {
    return await plateformeApi.demandes.prendreEnCharge(demande.id);
  } catch (err) {
    if (err?.response?.status === 409 && window.confirm(`${err.response.data.detail}\nLa reprendre quand même ?`)) {
      return plateformeApi.demandes.prendreEnCharge(demande.id, true);
    }
    throw err;
  }
}

/**
 * Boîte de notifications de la console : nombre de demandes non prises en charge (pastille), liste des dernières,
 * bouton « Prendre en charge ». Interroge le serveur toutes les 30 s (onglet visible) et au retour sur l'onglet ;
 * une nouvelle demande déclenche une alerte (et une notification du navigateur si elle a été autorisée).
 */
export default function NotificationsDemandes() {
  const { notify } = useToast();
  const navigate = useNavigate();
  const [donnees, setDonnees] = useState(null);
  const [ouvert, setOuvert] = useState(false);
  const [enCours, setEnCours] = useState(null);
  const [permission, setPermission] = useState(() => (typeof Notification === "undefined" ? "indisponible" : Notification.permission));
  const dejaVues = useRef(null); // identifiants déjà connus, pour détecter les nouvelles demandes
  const panneau = useRef(null);

  const charger = useCallback(async () => {
    try {
      const resultat = await plateformeApi.demandes.notifications();
      const ids = new Set(resultat.dernieres.map((d) => d.id));
      if (dejaVues.current) {
        const arrivees = resultat.dernieres.filter((d) => !dejaVues.current.has(d.id));
        arrivees.forEach((d) => {
          notify(`Nouvelle demande : ${d.etablissement} (${d.nom})`, "info");
          if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState !== "visible") {
            new Notification("Nouvelle demande de démonstration", { body: `${d.etablissement} — ${d.nom}${d.ville ? `, ${d.ville}` : ""}`, tag: `demande-${d.id}` });
          }
        });
      }
      dejaVues.current = new Set([...(dejaVues.current || []), ...ids]);
      setDonnees(resultat);
    } catch {
      // Réseau momentanément indisponible : on garde l'affichage précédent et on réessaiera
    }
  }, [notify]);

  useEffect(() => {
    charger();
    const minuterie = setInterval(() => document.visibilityState === "visible" && charger(), INTERVALLE);
    const auRetour = () => document.visibilityState === "visible" && charger();
    document.addEventListener("visibilitychange", auRetour);
    window.addEventListener(EVENEMENT_MAJ, charger);
    return () => {
      clearInterval(minuterie);
      document.removeEventListener("visibilitychange", auRetour);
      window.removeEventListener(EVENEMENT_MAJ, charger);
    };
  }, [charger]);

  // Nombre de nouvelles demandes dans le titre de l'onglet, ex. « (3) Console Gesti-Scolaire »
  const nombre = donnees?.nouvelles ?? 0;
  useEffect(() => {
    const titre = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = nombre ? `(${nombre}) ${titre}` : titre;
  }, [nombre]);

  useEffect(() => {
    if (!ouvert) return undefined;
    const fermer = (e) => panneau.current && !panneau.current.contains(e.target) && setOuvert(false);
    const echap = (e) => e.key === "Escape" && setOuvert(false);
    document.addEventListener("mousedown", fermer);
    document.addEventListener("keydown", echap);
    return () => {
      document.removeEventListener("mousedown", fermer);
      document.removeEventListener("keydown", echap);
    };
  }, [ouvert]);

  const prendre = async (demande) => {
    setEnCours(demande.id);
    try {
      await prendreEnCharge(demande);
      notify(`Vous prenez en charge la demande de ${demande.etablissement}.`, "success");
      await charger();
      signalerMajDemandes();
      setOuvert(false);
      navigate("/console/demandes?mes=1");
    } catch (err) {
      if (err?.response?.status !== 409) notify(extractErrorMessage(err), "error");
    } finally {
      setEnCours(null);
    }
  };

  const activerAlertes = async () => {
    setPermission(await Notification.requestPermission());
  };

  const Icone = nombre ? BellRing : Bell;
  return (
    <div className="relative" ref={panneau}>
      <button
        onClick={() => setOuvert(!ouvert)}
        className="relative rounded-lg bg-white/10 p-2 hover:bg-white/20"
        aria-label={nombre ? `${nombre} nouvelle(s) demande(s)` : "Notifications"}
        aria-expanded={ouvert}
      >
        <Icone size={18} className={nombre ? "text-amber-300" : ""} />
        {nombre > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold tabular-nums text-white ring-2 ring-slate-900">
            {nombre > 99 ? "99+" : nombre}
          </span>
        )}
      </button>

      {ouvert && (
        <div className="absolute right-0 z-40 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-100 bg-white text-slate-700 shadow-[var(--shadow-card-hover)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-800">Demandes à prendre en charge</p>
            {donnees?.mes_en_cours > 0 && (
              <Link to="/console/demandes?mes=1" onClick={() => setOuvert(false)} className="text-xs font-semibold text-brand-600 hover:underline">
                Mes demandes ({donnees.mes_en_cours})
              </Link>
            )}
          </div>
          {!donnees ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-slate-400" /></div>
          ) : donnees.dernieres.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">Aucune nouvelle demande. Tout est pris en charge.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {donnees.dernieres.map((d) => (
                <li key={d.id} className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rose-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{d.etablissement}</p>
                    <p className="truncate text-xs text-slate-500">{d.nom}{d.ville ? ` · ${d.ville}` : ""} · {d.telephone}</p>
                    <p className="text-xs text-slate-400">{d.reference} · {depuis(d.cree_le)}</p>
                  </div>
                  <button onClick={() => prendre(d)} disabled={!!enCours}
                    className="flex shrink-0 items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
                    {enCours === d.id ? <Loader2 size={13} className="animate-spin" /> : <Hand size={13} />} Prendre
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-2 border-t border-slate-100 px-4 py-3">
            <Link to="/console/demandes" onClick={() => setOuvert(false)} className="block text-center text-sm font-semibold text-brand-600 hover:underline">
              Voir toutes les demandes
            </Link>
            {permission === "default" && (
              <button onClick={activerAlertes} className="w-full rounded-lg bg-slate-50 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100">
                Être alerté sur cet ordinateur, même quand l'onglet est en arrière-plan
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
