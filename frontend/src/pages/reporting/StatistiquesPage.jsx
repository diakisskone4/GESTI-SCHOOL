import { Download } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import { useAuth } from "../../context/AuthContext";
import { useFetch } from "../../hooks/useFetch";
import { statistiquesApi } from "../../api/endpoints";
import { downloadAuthFile } from "../../utils/download";
import { Users, TrendingUp, Wallet, GraduationCap } from "lucide-react";

const fmt = (n) => `${Number(n || 0).toLocaleString("fr-FR")} FCFA`;

export default function StatistiquesPage() {
  const { user } = useAuth();
  const etablissementId = user?.etablissement_courant;
  const { data } = useFetch(() => statistiquesApi.vueEnsemble({ etablissement: etablissementId }), [etablissementId]);

  return (
    <div>
      <PageHeader
        title="Statistiques & rapports"
        subtitle="Vue d'ensemble de l'établissement"
        actions={
          <>
            <button
              onClick={() => downloadAuthFile(statistiquesApi.exportExcelPath(etablissementId), "effectifs.xlsx")}
              className="btn-secondary"
            >
              <Download size={16} /> Excel
            </button>
            <button
              onClick={() => downloadAuthFile(statistiquesApi.exportCsvPath(etablissementId), "effectifs.csv")}
              className="btn-secondary"
            >
              <Download size={16} /> CSV
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} tone="brand" label="Total élèves" value={data?.total_eleves ?? "…"} />
        <StatCard icon={GraduationCap} tone="sky" label="Filles / Garçons" value={`${data?.total_filles ?? 0} / ${data?.total_garcons ?? 0}`} />
        <StatCard icon={TrendingUp} tone="amber" label="Redoublants" value={data?.total_redoublants ?? "…"} />
        <StatCard icon={Wallet} tone="emerald" label="Total encaissé" value={fmt(data?.total_encaisse)} />
      </div>

      <div className="mt-6 card p-5 text-sm text-slate-500">
        Pour des statistiques détaillées par classe (taux de réussite, moyenne, absences), rendez-vous sur la
        page « Notes & bulletins », sélectionnez une classe et une période.
      </div>
    </div>
  );
}
