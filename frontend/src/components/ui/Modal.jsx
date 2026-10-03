import { useEffect } from "react";
import { X } from "lucide-react";

/**
 * Fenêtre modale. Sur mobile, elle s'ouvre comme un panneau qui glisse depuis le bas
 * (« bottom sheet ») ; sur tablette et ordinateur, elle reste centrée.
 */
export default function Modal({ open, onClose, title, children, footer, width = "max-w-lg" }) {
  // Bloque le défilement de la page derrière la fenêtre
  useEffect(() => {
    if (!open) return;
    const precedent = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = precedent; };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="sheet-backdrop absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div
        className={`sheet-panel relative flex max-h-[92vh] w-full ${width} flex-col rounded-t-3xl bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-2xl`}
      >
        <div className="flex justify-center pt-2.5 sm:hidden"><span className="h-1.5 w-10 rounded-full bg-slate-300" /></div>
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5 sm:py-4">
          <h3 className="text-base font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
