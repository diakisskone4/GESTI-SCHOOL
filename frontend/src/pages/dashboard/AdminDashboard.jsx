import { Users, GraduationCap, Wallet, TrendingUp } from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import StatCard from "../../components/ui/StatCard";
import PageHeader from "../../components/ui/PageHeader";
import { useAuth } from "../../context/AuthContext";
import { useFetch } from "../../hooks/useFetch";
import { statistiquesApi, elevesApi, classesApi, dashboardFinancierApi } from "../../api/endpoints";

const fmtFCFA = (n) => `${Number(n || 0).toLocaleString("fr-FR")} FCFA`;

export default function AdminDashboard() {
  const { user } = useAuth();
  const etablissementId = user?.etablissement_courant;

  const { data: vueEnsemble, loading: l1 } = useFetch(
    () => statistiquesApi.vueEnsemble({ etablissement: etablissementId }),
    [etablissementId]
  );
  const { data: finance, loading: l2 } = useFetch(
    () => dashboardFinancierApi.get({ etablissement: etablissementId }),
    [etablissementId]
  );
  const { data: classes } = useFetch(() => classesApi.list({ etablissement: etablissementId }), [etablissementId]);
  const { data: elevesRecents } = useFetch(() => elevesApi.list({ etablissement: etablissementId, ordering: "-created_at" }), [etablissementId]);

  const repartitionSexe = vueEnsemble
    ? [
        { name: "Filles", value: vueEnsemble.total_filles, color: "#a894ff" },
        { name: "Garçons", value: vueEnsemble.total_garcons, color: "#5f34dd" },
      ]
    : [];

  const effectifsParClasse = (classes?.results || []).slice(0, 8).map((c) => ({
    name: c.nom,
    effectif: c.effectif_actuel,
  }));

  return (
    <div>
      <PageHeader
        title={`Bonjour, ${user?.first_name} 👋`}
        subtitle="Vue d'ensemble de votre établissement"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} tone="brand" label="Élèves inscrits" value={l1 ? "…" : vueEnsemble?.total_eleves ?? 0} />
        <StatCard icon={GraduationCap} tone="sky" label="Boursiers" value={l1 ? "…" : vueEnsemble?.total_boursiers ?? 0} />
        <StatCard icon={TrendingUp} tone="amber" label="Redoublants" value={l1 ? "…" : vueEnsemble?.total_redoublants ?? 0} />
        <StatCard icon={Wallet} tone="emerald" label="Total encaissé" value={l2 ? "…" : fmtFCFA(finance?.total_encaisse)} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <p className="mb-4 text-sm font-semibold text-slate-700">Effectifs par classe</p>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={effectifsParClasse}>
              <defs>
                <linearGradient id="colorEffectif" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7048f0" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#7048f0" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f6" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #eef0f6" }} />
              <Area type="monotone" dataKey="effectif" stroke="#7048f0" strokeWidth={2.5} fill="url(#colorEffectif)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <p className="mb-4 text-sm font-semibold text-slate-700">Répartition par sexe</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={repartitionSexe} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={3}>
                {repartitionSexe.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #eef0f6" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 flex justify-center gap-4 text-xs text-slate-500">
            {repartitionSexe.map((r) => (
              <span key={r.name} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} /> {r.name} ({r.value})
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 card p-5">
        <p className="mb-4 text-sm font-semibold text-slate-700">Élèves récemment inscrits</p>
        <div className="divide-y divide-slate-100">
          {(elevesRecents?.results || []).slice(0, 6).map((e) => (
            <div key={e.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                  {e.prenom?.[0]}{e.nom?.[0]}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">{e.prenom} {e.nom}</p>
                  <p className="text-xs text-slate-400">{e.matricule}</p>
                </div>
              </div>
              <span className="badge bg-brand-50 text-brand-700">{e.classe_actuelle || "Non inscrit"}</span>
            </div>
          ))}
          {(!elevesRecents || elevesRecents.results?.length === 0) && (
            <p className="py-6 text-center text-sm text-slate-400">Aucun élève enregistré pour le moment.</p>
          )}
        </div>
      </div>
    </div>
  );
}
