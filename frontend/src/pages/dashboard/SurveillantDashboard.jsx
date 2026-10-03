import { useNavigate } from "react-router-dom";
import { AlertTriangle, CalendarX, CheckCircle2, Clock, Gavel, Plus, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import StatCard from "../../components/ui/StatCard";
import PageHeader from "../../components/ui/PageHeader";
import DataTable from "../../components/ui/DataTable";
import { useAuth } from "../../context/AuthContext";
import { useFetch } from "../../hooks/useFetch";
import { useToast, extractErrorMessage } from "../../context/ToastContext";
import { absencesApi, classesApi, inscriptionsApi, sanctionsRecompensesApi } from "../../api/endpoints";

/** Date du jour au format AAAA-MM-JJ (fuseau local). */
function aujourdhui() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Tableau de bord du surveillant général : assiduité et discipline de son établissement. */
export default function SurveillantDashboard() {
  const { user } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const etablissementId = user?.etablissement_courant;
  const jour = aujourdhui();

  const { data: inscriptions, loading: l1 } = useFetch(() => inscriptionsApi.list({ statut: "active" }), []);
  const { data: absencesJour, loading: l2 } = useFetch(
    () => absencesApi.list({ date: jour, type_evenement: "absence" }), [jour]
  );
  const { data: retardsJour, loading: l3 } = useFetch(
    () => absencesApi.list({ date: jour, type_evenement: "retard" }), [jour]
  );
  const { data: nonJustifiees, loading: l4, reload: reloadNonJustifiees } = useFetch(
    () => absencesApi.list({ justifiee: false }), []
  );
  const { data: sanctions, loading: l5 } = useFetch(() => sanctionsRecompensesApi.list({ nature: "sanction" }), []);
  const { data: recentes, loading: l6, reload: reloadRecentes } = useFetch(() => absencesApi.list(), []);
  const { data: classes } = useFetch(() => classesApi.list({ etablissement: etablissementId }), [etablissementId]);

  const effectifsParClasse = (classes?.results || []).map((c) => ({ name: c.nom, effectif: c.effectif_actuel }));

  const justifier = async (absence) => {
    try {
      await absencesApi.update(absence.id, { justifiee: true });
      notify("Absence marquée comme justifiée.", "success");
      reloadRecentes();
      reloadNonJustifiees();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    }
  };

  const compte = (data, loading) => (loading ? "…" : data?.count ?? data?.results?.length ?? 0);

  return (
    <div>
      <PageHeader
        title={`Bonjour, ${user?.first_name} 👋`}
        subtitle="Vie scolaire : assiduité et discipline de votre établissement"
        actions={
          <button onClick={() => navigate("/absences")} className="btn-primary">
            <Plus size={16} /> Signaler une absence
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard icon={Users} tone="brand" label="Élèves inscrits" value={compte(inscriptions, l1)} />
        <StatCard icon={CalendarX} tone="rose" label="Absents aujourd'hui" value={compte(absencesJour, l2)} />
        <StatCard icon={Clock} tone="amber" label="Retards aujourd'hui" value={compte(retardsJour, l3)} />
        <StatCard icon={AlertTriangle} tone="sky" label="Absences non justifiées" value={compte(nonJustifiees, l4)} />
        <StatCard icon={Gavel} tone="emerald" label="Sanctions" value={compte(sanctions, l5)} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <p className="mb-3 text-sm font-semibold text-slate-700">Dernières absences et retards</p>
          <DataTable
            loading={l6}
            rows={(recentes?.results || []).slice(0, 10)}
            empty="Aucune absence enregistrée."
            columns={[
              { key: "eleve_nom", header: "Élève" },
              { key: "date", header: "Date", render: (r) => new Date(r.date).toLocaleDateString("fr-FR") },
              {
                key: "type_evenement",
                header: "Type",
                render: (r) => (
                  <span className={`badge ${r.type_evenement === "retard" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-600"}`}>
                    {r.type_evenement === "retard" ? "Retard" : "Absence"}
                  </span>
                ),
              },
              { key: "motif", header: "Motif", render: (r) => r.motif || <span className="text-slate-400">—</span> },
              {
                key: "justifiee",
                header: "Justification",
                render: (r) =>
                  r.justifiee ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                      <CheckCircle2 size={14} /> Justifiée
                    </span>
                  ) : (
                    <button onClick={() => justifier(r)} className="text-xs font-medium text-brand-600 hover:underline">
                      Marquer justifiée
                    </button>
                  ),
              },
            ]}
          />
        </div>

        <div className="card p-5">
          <p className="mb-4 text-sm font-semibold text-slate-700">Effectifs par classe</p>
          {effectifsParClasse.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">Aucune classe.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, effectifsParClasse.length * 28)}>
              <BarChart data={effectifsParClasse} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef0f6" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #eef0f6" }} />
                <Bar dataKey="effectif" name="Élèves" fill="#7048f0" radius={[0, 6, 6, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
