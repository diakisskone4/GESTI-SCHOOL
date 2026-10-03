import { useEffect, useState } from "react";
import { Download, PlusSquare, Share, X } from "lucide-react";

const DISMISS_KEY = "gs_install_prompt_dismissed";

function estDejaInstallee() {
  return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function estIOS() {
  const ua = window.navigator.userAgent;
  // iPadOS se présente comme un Mac, mais avec un écran tactile
  return /iphone|ipad|ipod/i.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

function lireRefus() {
  try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
}

/**
 * Bandeau « Installer l'application ».
 * - Android / Chrome / Edge (PC, tablette) : bouton qui ouvre la fenêtre d'installation du navigateur.
 * - iPhone / iPad (Safari) : pas d'installation automatique possible, on explique la manipulation.
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [ios] = useState(() => estIOS() && !estDejaInstallee());
  const [masque, setMasque] = useState(() => estDejaInstallee() || lireRefus());

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => setMasque(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const fermer = () => {
    setMasque(true);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* navigation privée */ }
  };

  const installer = async () => {
    if (!deferred) return;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === "accepted") setMasque(true);
  };

  if (masque || (!deferred && !ios)) return null;

  return (
    <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-50 p-3 sm:left-auto sm:right-4 sm:w-96 sm:p-0 lg:bottom-4">
      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
        <img src="/icons/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800">Installer Gesti-Scolaire</p>
          {ios ? (
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Touchez <Share size={13} className="inline -mt-0.5 text-brand-600" /> <strong>Partager</strong> dans Safari,
              puis <PlusSquare size={13} className="inline -mt-0.5 text-brand-600" /> <strong>Sur l'écran d'accueil</strong>.
            </p>
          ) : (
            <>
              <p className="mt-1 text-xs text-slate-500">Accédez à l'application depuis votre écran d'accueil ou votre bureau, en plein écran.</p>
              <button onClick={installer} className="btn-primary mt-3 px-3 py-1.5 text-xs">
                <Download size={14} /> Installer l'application
              </button>
            </>
          )}
        </div>
        <button onClick={fermer} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Fermer">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
