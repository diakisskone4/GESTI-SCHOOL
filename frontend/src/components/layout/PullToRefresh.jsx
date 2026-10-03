import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

const SEUIL = 80;      // distance (px) à tirer pour déclencher l'actualisation
const MAX = 120;

function estApplicationInstallee() {
  return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

/**
 * « Tirer pour actualiser » en haut de page, comme dans une application native.
 * Actif seulement dans l'application installée (le navigateur a déjà son propre geste),
 * sur écran tactile, quand la page est tout en haut et hors des fenêtres/panneaux ouverts.
 */
export default function PullToRefresh() {
  const [distance, setDistance] = useState(0);
  const [actualisation, setActualisation] = useState(false);
  const depart = useRef(null);
  const distanceRef = useRef(0);

  useEffect(() => {
    if (!estApplicationInstallee() || !("ontouchstart" in window)) return;

    const onStart = (e) => {
      const dansPanneau = e.target.closest?.('[role="dialog"], .overflow-y-auto, .overflow-auto');
      depart.current = window.scrollY <= 0 && !dansPanneau ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
    };
    const onMove = (e) => {
      if (!depart.current) return;
      const dy = e.touches[0].clientY - depart.current.y;
      const dx = Math.abs(e.touches[0].clientX - depart.current.x);
      // Geste vers le haut ou horizontal : on laisse faire le défilement normal
      distanceRef.current = dy <= 0 || dx > dy ? 0 : Math.min(MAX, dy * 0.5);
      setDistance(distanceRef.current);
    };
    const onEnd = () => {
      if (!depart.current) return;
      depart.current = null;
      const declencher = distanceRef.current >= SEUIL;
      distanceRef.current = 0;
      setDistance(0);
      if (declencher) {
        setActualisation(true);
        navigator.vibrate?.(12);
        window.location.reload();
      }
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, []);

  if (!distance && !actualisation) return null;
  const pret = distance >= SEUIL || actualisation;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-30 flex justify-center"
      style={{ top: `calc(env(safe-area-inset-top) + ${Math.max(8, distance - 24)}px)` }}
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg ${pret ? "text-brand-600" : "text-slate-400"}`}>
        <RefreshCw
          size={18}
          className={actualisation ? "animate-spin" : ""}
          style={{ transform: actualisation ? undefined : `rotate(${distance * 3}deg)` }}
        />
      </div>
    </div>
  );
}
