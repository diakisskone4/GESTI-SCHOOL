import { ArrowDownRight, ArrowUpRight } from "lucide-react";

/**
 * Carte statistique de dashboard : icône, valeur, libellé, variation optionnelle.
 * `tone` pilote la couleur de l'icône (brand, emerald, amber, rose, sky).
 */
const TONES = {
  brand: "bg-brand-50 text-brand-600",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  rose: "bg-rose-50 text-rose-600",
  sky: "bg-sky-50 text-sky-600",
};

export default function StatCard({ icon: Icon, label, value, tone = "brand", trend }) {
  return (
    <div className="card card-hover p-5">
      <div className="flex items-start justify-between">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${TONES[tone]}`}>
          <Icon size={20} />
        </div>
        {trend !== undefined && trend !== null && (
          <span
            className={`badge ${
              trend >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
            }`}
          >
            {trend >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="mt-4 text-2xl font-bold text-slate-800">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </div>
  );
}
