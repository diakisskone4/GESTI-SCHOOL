import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/** Bandeau affiché quand l'appareil perd la connexion Internet. */
export default function OfflineBanner() {
  const [horsLigne, setHorsLigne] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);

  useEffect(() => {
    const off = () => setHorsLigne(true);
    const on = () => setHorsLigne(false);
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    return () => {
      window.removeEventListener("offline", off);
      window.removeEventListener("online", on);
    };
  }, []);

  if (!horsLigne) return null;
  return (
    <div className="flex items-center justify-center gap-2 bg-slate-800 px-4 py-2 text-xs font-medium text-white">
      <WifiOff size={14} /> Hors connexion : les données affichées peuvent ne pas être à jour.
    </div>
  );
}
