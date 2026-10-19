import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Ban, CheckCircle2, CircleDashed, Clock, RefreshCw } from "lucide-react";

/** Statuts d'accès d'un établissement. Couleurs d'état fixes, toujours accompagnées d'une icône et d'un libellé. */
export const STATUTS = {
  actif: { label: "Actif", icon: CheckCircle2, couleur: "#0ca30c", badge: "bg-emerald-50 text-emerald-700" },
  a_renouveler: { label: "À renouveler", icon: Clock, couleur: "#fab219", badge: "bg-amber-50 text-amber-700" },
  expire: { label: "Expiré", icon: AlertTriangle, couleur: "#ec835a", badge: "bg-orange-50 text-orange-700" },
  suspendu: { label: "Désactivé", icon: Ban, couleur: "#d03b3b", badge: "bg-rose-50 text-rose-700" },
  sans_abonnement: { label: "Sans abonnement", icon: CircleDashed, couleur: "#94a3b8", badge: "bg-slate-100 text-slate-600" },
};

export const SEUIL_ECHEANCE_JOURS = 30;

/** Statut affiché : un accès actif qui se termine dans 30 jours ou moins devient « À renouveler ». */
export function statutAffiche(abonnement) {
  if (!abonnement) return "sans_abonnement";
  if (abonnement.statut === "actif" && abonnement.jours_restants <= SEUIL_ECHEANCE_JOURS) return "a_renouveler";
  return abonnement.statut;
}

export function StatutBadge({ statut }) {
  const s = STATUTS[statut] || STATUTS.sans_abonnement;
  const Icon = s.icon;
  return <span className={`badge ${s.badge}`}><Icon size={12} /> {s.label}</span>;
}

export const dateFr = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—");
export const dateHeureFr = (d) => (d ? new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
export const nombreFr = (n) => (n ?? 0).toLocaleString("fr-FR");

/** « il y a 3 j », « il y a 2 h »... ; « Jamais » si aucune date. */
export function depuis(date) {
  if (!date) return "Jamais";
  const secondes = Math.max(0, (Date.now() - new Date(date).getTime()) / 1000);
  if (secondes < 60) return "à l'instant";
  if (secondes < 3600) return `il y a ${Math.floor(secondes / 60)} min`;
  if (secondes < 86400) return `il y a ${Math.floor(secondes / 3600)} h`;
  const jours = Math.floor(secondes / 86400);
  if (jours < 60) return `il y a ${jours} j`;
  return `il y a ${Math.floor(jours / 30)} mois`;
}

/**
 * Chargement robuste pour la console : garde les dernières données affichées pendant une actualisation
 * ou en cas d'erreur réseau, et s'actualise toute seule (toutes les `intervalle` ms) quand l'onglet est visible.
 */
export function useDonneesConsole(chargeur, deps = [], intervalle = 60000) {
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [enCours, setEnCours] = useState(true);
  const [majLe, setMajLe] = useState(null);
  const chargeurRef = useRef(chargeur);
  chargeurRef.current = chargeur;
  const requete = useRef(0);

  const actualiser = useCallback(async () => {
    const numero = ++requete.current;
    setEnCours(true);
    try {
      const resultat = await chargeurRef.current();
      if (numero !== requete.current) return; // une requête plus récente a été lancée entre-temps
      setData(resultat);
      setErreur(null);
      setMajLe(new Date());
    } catch (err) {
      if (numero === requete.current) setErreur(err);
    } finally {
      if (numero === requete.current) setEnCours(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    actualiser();
    if (!intervalle) return undefined;
    const minuterie = setInterval(() => {
      if (document.visibilityState === "visible") actualiser();
    }, intervalle);
    const auRetour = () => document.visibilityState === "visible" && actualiser();
    document.addEventListener("visibilitychange", auRetour);
    return () => {
      clearInterval(minuterie);
      document.removeEventListener("visibilitychange", auRetour);
    };
  }, [actualiser, intervalle]);

  return { data, erreur, enCours, majLe, actualiser, setData };
}

/** Bouton « Actualiser » + heure de la dernière mise à jour + alerte discrète si la dernière tentative a échoué. */
export function BarreActualisation({ enCours, majLe, erreur, onActualiser }) {
  return (
    <div className="flex items-center gap-3 text-xs text-slate-500">
      {erreur && majLe && <span className="text-amber-700">Connexion instable — données du {dateHeureFr(majLe)}</span>}
      {!erreur && majLe && <span>Mis à jour à {majLe.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>}
      <button onClick={onActualiser} disabled={enCours} className="btn-secondary px-3 py-2 text-xs">
        <RefreshCw size={14} className={enCours ? "animate-spin" : ""} /> Actualiser
      </button>
    </div>
  );
}

/** Message d'erreur plein cadre (aucune donnée encore chargée) avec bouton « Réessayer ». */
export function ErreurChargement({ onReessayer }) {
  return (
    <div className="card flex flex-col items-center gap-3 p-10 text-center">
      <AlertTriangle className="text-amber-500" />
      <p className="font-semibold text-slate-700">Impossible de charger les données</p>
      <p className="text-sm text-slate-500">Vérifiez votre connexion. Le serveur gratuit peut aussi mettre quelques secondes à se réveiller.</p>
      <button onClick={onReessayer} className="btn-primary text-sm"><RefreshCw size={15} /> Réessayer</button>
    </div>
  );
}

export function Squelette({ className = "" }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/70 ${className}`} />;
}
