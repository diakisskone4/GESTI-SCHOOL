import { Link } from "react-router-dom";
import { AlertTriangle, Ban, CheckCircle2, Clock, GraduationCap, Loader2, School, Users } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import { useFetch } from "../../hooks/useFetch";
import { plateformeApi } from "../../api/endpoints";

export default function ConsoleDashboard() {
  const { data: stats, loading } = useFetch(() => plateformeApi.statistiques(), []);

  if (loading || !stats) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-600" /></div>;
  }

  const remplissage = Math.min(100, Math.round((stats.total_etablissements / stats.limite) * 100));

  return (
    <div className="space-y-6">
      <PageHeader title="Tableau de bord" subtitle="Vue d'ensemble des établissements qui utilisent l'application." />

      <div className="card p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-sm text-slate-500">Établissements sur ce déploiement</p>
            <p className="text-3xl font-bold text-slate-800">
              {stats.total_etablissements} <span className="text-lg font-medium text-slate-400">/ {stats.limite}</span>
            </p>
          </div>
          <p className="text-sm text-slate-500"><strong>{stats.places_restantes}</strong> place(s) restante(s)</p>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${remplissage >= 90 ? "bg-rose-500" : remplissage >= 70 ? "bg-amber-500" : "bg-brand-600"}`}
            style={{ width: `${remplissage}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={CheckCircle2} tone="emerald" label="Accès actifs" value={stats.par_statut.actif} />
        <StatCard icon={Clock} tone="amber" label="Abonnements expirés" value={stats.par_statut.expire} />
        <StatCard icon={Ban} tone="rose" label="Désactivés" value={stats.par_statut.suspendu} />
        <StatCard icon={School} tone="sky" label="Nouveaux ce mois" value={stats.nouveaux_ce_mois} />
        <StatCard icon={GraduationCap} label="Élèves (total)" value={stats.total_eleves.toLocaleString("fr-FR")} />
        <StatCard icon={Users} tone="sky" label="Comptes utilisateurs" value={stats.total_utilisateurs.toLocaleString("fr-FR")} />
        <StatCard icon={Users} tone="emerald" label="Membres de l'équipe" value={stats.nb_developpeurs} />
      </div>

      <div className="card p-5">
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
          <AlertTriangle size={17} className="text-amber-500" /> Expirent dans les 30 jours
        </h2>
        {stats.expirent_bientot.length === 0 ? (
          <p className="text-sm text-slate-400">Aucun abonnement n'arrive à échéance.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {stats.expirent_bientot.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="font-medium text-slate-700">{e.nom}</span>
                <span className="text-slate-500">
                  le {new Date(e.date_fin).toLocaleDateString("fr-FR")} ·{" "}
                  <strong className={e.jours_restants <= 7 ? "text-rose-600" : "text-amber-600"}>{e.jours_restants} j</strong>
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link to="/console/etablissements" className="btn-secondary mt-4 text-sm">Gérer les établissements</Link>
      </div>
    </div>
  );
}
