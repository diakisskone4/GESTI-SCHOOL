import { useEffect, useState } from "react";
import { BookOpenCheck, School, Users } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import { useAuth } from "../../context/AuthContext";
import { enseignantsApi } from "../../api/endpoints";

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [profil, setProfil] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const moi = await enseignantsApi.moi();
        setProfil(moi);
        const dash = await enseignantsApi.tableauDeBord(moi.id);
        setStats(dash);
      } catch {
        // profil enseignant non trouvé pour ce compte
      }
    })();
  }, []);

  return (
    <div>
      <PageHeader title={`Bonjour, ${user?.first_name} 👋`} subtitle="Votre espace enseignant" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={School} tone="brand" label="Classes en charge" value={stats?.nb_classes ?? "…"} />
        <StatCard icon={BookOpenCheck} tone="sky" label="Matières enseignées" value={stats?.nb_matieres ?? "…"} />
        <StatCard icon={Users} tone="emerald" label="Total élèves" value={stats?.total_eleves ?? "…"} />
      </div>

      <div className="mt-6 card p-5">
        <p className="mb-4 text-sm font-semibold text-slate-700">Mes classes</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(stats?.classes || []).map((c) => (
            <div key={c.id} className="rounded-xl border border-slate-100 p-4">
              <p className="font-semibold text-slate-700">{c.nom}</p>
              <p className="mt-1 text-xs text-slate-400">{c.effectif} élèves</p>
            </div>
          ))}
          {(!stats || stats.classes?.length === 0) && (
            <p className="text-sm text-slate-400">Aucune affectation active pour le moment.</p>
          )}
        </div>
      </div>

      {profil && (
        <div className="mt-6 card p-5 text-sm text-slate-500">
          Connecté en tant que <span className="font-semibold text-slate-700">{profil.prenom} {profil.nom}</span> — matricule {profil.matricule}
        </div>
      )}
    </div>
  );
}
