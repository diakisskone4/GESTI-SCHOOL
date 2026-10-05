import { useNavigate } from "react-router-dom";
import { AlertTriangle, Banknote, CalendarCheck, Percent, Plus, Receipt, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import StatCard from "../../components/ui/StatCard";
import PageHeader from "../../components/ui/PageHeader";
import DataTable from "../../components/ui/DataTable";
import { useAuth } from "../../context/AuthContext";
import { useFetch } from "../../hooks/useFetch";
import { dashboardFinancierApi, dashboardPaieApi, facturesApi, paiementsApi } from "../../api/endpoints";
import { downloadAuthFile } from "../../utils/download";

const fmt = (n) => `${Number(n || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} FCFA`;
const fmtCourt = (n) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M`;
  if (v >= 1_000) return `${(v / 1_000).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} k`;
  return v.toLocaleString("fr-FR");
};
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

const STATUTS = [
  { key: "payee", label: "Payées", color: "#10b981" },
  { key: "partielle", label: "Partielles", color: "#f59e0b" },
  { key: "impayee", label: "Impayées", color: "#f43f5e" },
  { key: "annulee", label: "Annulées", color: "#94a3b8" },
];

/** Tableau de bord du comptable : recettes, recouvrement, retards et masse salariale. */
export default function ComptableDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const etablissementId = user?.etablissement_courant;
  const now = new Date();

  const { data: fin, loading } = useFetch(() => dashboardFinancierApi.get({ etablissement: etablissementId }), [etablissementId]);
  const { data: paie } = useFetch(
    () => dashboardPaieApi.get({ mois: now.getMonth() + 1, annee: now.getFullYear() }).catch(() => null), []
  );
  const { data: paiements, loading: lp } = useFetch(() => paiementsApi.list({ annule: false }), []);
  const { data: impayees, loading: li } = useFetch(() => facturesApi.list({ statut: "impayee" }), []);
  const { data: partielles } = useFetch(() => facturesApi.list({ statut: "partielle" }), []);

  const v = (x) => (loading ? "…" : x);
  const repartition = STATUTS.map((s) => ({ ...s, value: fin?.repartition_par_statut?.[s.key] || 0 })).filter((s) => s.value > 0);
  const parMois = (fin?.encaissements_par_mois || []).map((m) => ({
    name: MOIS[Number(m.mois.slice(5, 7)) - 1], total: m.total,
  }));
  const aRecouvrer = [...(impayees?.results || []), ...(partielles?.results || [])]
    .sort((a, b) => (a.date_echeance || "").localeCompare(b.date_echeance || ""))
    .slice(0, 8);
  const aujourdhui = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <PageHeader
        title={`Bonjour, ${user?.first_name} 👋`}
        subtitle="Comptabilité : recettes, recouvrement des frais scolaires et paie"
        actions={
          <button onClick={() => navigate("/finance/factures")} className="btn-primary">
            <Plus size={16} /> Encaisser un paiement
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Wallet} tone="emerald" label="Total encaissé" value={v(fmt(fin?.total_encaisse))} />
        <StatCard icon={AlertTriangle} tone="rose" label="Reste à recouvrer" value={v(fmt(fin?.total_impaye))} />
        <StatCard icon={Percent} tone="brand" label="Taux de recouvrement" value={v(`${fin?.taux_recouvrement ?? 0} %`)} />
        <StatCard icon={CalendarCheck} tone="sky" label="Encaissé aujourd'hui" value={v(fmt(fin?.encaisse_aujourdhui))} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs font-medium text-slate-500">Total facturé (net de remises)</p>
          <p className="mt-1 text-lg font-bold text-slate-800">{v(fmt(fin?.total_net))}</p>
          <p className="text-xs text-slate-400">{fin?.nb_factures ?? 0} facture(s) · {fin?.nb_paiements ?? 0} paiement(s)</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-slate-500">Factures en retard</p>
          <p className={`mt-1 text-lg font-bold ${fin?.nb_factures_en_retard ? "text-rose-600" : "text-slate-800"}`}>
            {v(fmt(fin?.montant_en_retard))}
          </p>
          <p className="text-xs text-slate-400">{fin?.nb_factures_en_retard ?? 0} facture(s) dont l'échéance est dépassée</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-slate-500">Masse salariale du mois</p>
          <p className="mt-1 text-lg font-bold text-slate-800">{paie ? fmt(paie.masse_salariale_nette) : "—"}</p>
          <p className="text-xs text-slate-400">{paie ? `${paie.nb_employes_payes} bulletin(s) de paie · net à payer` : "Aucune donnée de paie"}</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <p className="mb-4 text-sm font-semibold text-slate-700">Encaissements des 6 derniers mois</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={parMois}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f6" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtCourt} tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={48} />
              <Tooltip formatter={(val) => fmt(val)} contentStyle={{ borderRadius: 12, border: "1px solid #eef0f6" }} />
              <Bar dataKey="total" name="Encaissé" fill="#7048f0" radius={[6, 6, 0, 0]} barSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <p className="mb-2 text-sm font-semibold text-slate-700">Factures par statut</p>
          {repartition.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">Aucune facture.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={repartition} dataKey="value" nameKey="label" innerRadius={48} outerRadius={72} paddingAngle={3}>
                    {repartition.map((s) => <Cell key={s.key} fill={s.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #eef0f6" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 flex flex-wrap justify-center gap-3 text-xs text-slate-500">
                {repartition.map((s) => (
                  <span key={s.key} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} /> {s.label} ({s.value})
                  </span>
                ))}
              </div>
            </>
          )}
          {(fin?.encaissements_par_mode || []).length > 0 && (
            <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3">
              <p className="text-xs font-semibold text-slate-500">Par mode de paiement</p>
              {fin.encaissements_par_mode.map((m) => (
                <div key={m.mode} className="flex justify-between text-sm">
                  <span className="text-slate-600">{m.libelle}</span>
                  <span className="font-semibold text-slate-800">{fmt(m.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Derniers encaissements</p>
            <button onClick={() => navigate("/finance/factures")} className="text-xs font-semibold text-brand-600 hover:underline">Tout voir</button>
          </div>
          <DataTable
            loading={lp}
            rows={(paiements?.results || []).slice(0, 8)}
            empty="Aucun paiement enregistré."
            columns={[
              { key: "date_paiement", header: "Date", render: (r) => new Date(r.date_paiement).toLocaleDateString("fr-FR") },
              { key: "eleve_nom", header: "Élève", render: (r) => <span className="font-medium text-slate-800">{r.eleve_nom}</span> },
              { key: "montant", header: "Montant", render: (r) => <span className="font-semibold text-emerald-600">{fmt(r.montant)}</span> },
              {
                key: "recu", header: "",
                render: (r) => (
                  <button
                    onClick={() => downloadAuthFile(paiementsApi.recuPath(r.id), `recu_${r.numero_recu}.pdf`)}
                    className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
                  >
                    <Receipt size={13} /> Reçu
                  </button>
                ),
              },
            ]}
          />
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Factures à recouvrer</p>
            <span className="flex items-center gap-1 text-xs text-slate-400"><Banknote size={13} /> par échéance</span>
          </div>
          <DataTable
            loading={li}
            rows={aRecouvrer}
            empty="Aucune facture en attente de paiement. 🎉"
            columns={[
              { key: "eleve_nom", header: "Élève", render: (r) => <span className="font-medium text-slate-800">{r.eleve_nom}</span> },
              { key: "libelle", header: "Motif", render: (r) => r.libelle || "—" },
              {
                key: "date_echeance", header: "Échéance",
                render: (r) => (
                  <span className={r.date_echeance < aujourdhui ? "font-semibold text-rose-600" : "text-slate-600"}>
                    {new Date(r.date_echeance).toLocaleDateString("fr-FR")}
                  </span>
                ),
              },
              { key: "solde", header: "Reste", render: (r) => <span className="font-semibold text-slate-800">{fmt(r.solde)}</span> },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
