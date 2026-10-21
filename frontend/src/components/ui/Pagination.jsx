import { ChevronLeft, ChevronRight } from "lucide-react";

export const TAILLES_PAGE = [25, 50, 100, 200];

/**
 * Compteur « 1–25 sur 132 élève(s) », choix du nombre de lignes par page et navigation entre les pages.
 * `total` vient du champ `count` renvoyé par l'API (total réel, pas seulement la page affichée).
 */
export default function Pagination({ page, taille, total, onPage, onTaille, libelle = "élément(s)", chargement = false }) {
  const nbPages = Math.max(1, Math.ceil(total / taille));
  const debut = total === 0 ? 0 : (page - 1) * taille + 1;
  const fin = Math.min(page * taille, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
      <p aria-live="polite">
        {chargement && total === 0 ? "Chargement..." : (
          <>Affichage <strong className="tabular-nums text-slate-700">{debut}–{fin}</strong> sur <strong className="tabular-nums text-slate-700">{total}</strong> {libelle}</>
        )}
      </p>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs">
          Lignes par page
          <select
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700"
            value={taille}
            onChange={(e) => onTaille(Number(e.target.value))}
          >
            {TAILLES_PAGE.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <button
            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
            aria-label="Page précédente"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-20 text-center text-xs tabular-nums">Page {page} / {nbPages}</span>
          <button
            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            disabled={page >= nbPages}
            onClick={() => onPage(page + 1)}
            aria-label="Page suivante"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
