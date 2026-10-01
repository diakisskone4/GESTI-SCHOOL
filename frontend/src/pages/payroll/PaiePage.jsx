import { useState } from "react";
import { Banknote, Download, Plus, Users } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import DataTable from "../../components/ui/DataTable";
import Modal from "../../components/ui/Modal";
import StatCard from "../../components/ui/StatCard";
import { useFetch } from "../../hooks/useFetch";
import { useToast, extractErrorMessage } from "../../context/ToastContext";
import { bulletinsPaieApi, employesApi, dashboardPaieApi } from "../../api/endpoints";
import { downloadAuthFile } from "../../utils/download";

const fmt = (n) => `${Number(n || 0).toLocaleString("fr-FR")} FCFA`;
const now = new Date();

export default function PaiePage() {
  const { notify } = useToast();
  const [mois, setMois] = useState(now.getMonth() + 1);
  const [annee, setAnnee] = useState(now.getFullYear());

  const { data: bulletins, loading, reload } = useFetch(() => bulletinsPaieApi.list({ mois, annee }), [mois, annee]);
  const { data: dashboard } = useFetch(() => dashboardPaieApi.get({ mois, annee }), [mois, annee]);
  const { data: employes } = useFetch(() => employesApi.list(), []);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ employe: "", salaire_base: "" });
  const [saving, setSaving] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await bulletinsPaieApi.create({ ...form, mois, annee });
      notify("Bulletin de paie généré.", "success");
      setModalOpen(false);
      reload();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Gestion de la paie"
        subtitle="Salaires, primes, retenues et bulletins de paie"
        actions={
          <button onClick={() => { setForm({ employe: "", salaire_base: "" }); setModalOpen(true); }} className="btn-primary">
            <Plus size={16} /> Nouveau bulletin
          </button>
        }
      />

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Mois</label>
          <select className="input w-32" value={mois} onChange={(e) => setMois(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m.toString().padStart(2, "0")}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Année</label>
          <input type="number" className="input w-28" value={annee} onChange={(e) => setAnnee(Number(e.target.value))} />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Users} tone="brand" label="Employés payés" value={dashboard?.nb_employes_payes ?? "…"} />
        <StatCard icon={Banknote} tone="emerald" label="Masse salariale nette" value={fmt(dashboard?.masse_salariale_nette)} />
        <StatCard icon={Banknote} tone="sky" label="Masse salariale brute" value={fmt(dashboard?.masse_salariale_brute)} />
      </div>

      <DataTable
        loading={loading}
        rows={bulletins?.results || []}
        columns={[
          { key: "employe_nom", header: "Employé" },
          { key: "salaire_brut", header: "Salaire brut", render: (r) => fmt(r.salaire_brut) },
          { key: "total_retenues", header: "Retenues", render: (r) => fmt(r.total_retenues) },
          { key: "net_a_payer", header: "Net à payer", render: (r) => <span className="font-semibold text-slate-800">{fmt(r.net_a_payer)}</span> },
          { key: "statut", header: "Statut" },
          {
            key: "pdf", header: "",
            render: (r) => (
              <button
                onClick={() => downloadAuthFile(bulletinsPaieApi.pdfPath(r.id), `paie_${r.employe_nom}.pdf`)}
                className="flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline"
              >
                <Download size={14} /> PDF
              </button>
            ),
          },
        ]}
      />

      <Modal
        open={modalOpen} onClose={() => setModalOpen(false)} title="Nouveau bulletin de paie"
        footer={<>
          <button className="btn-secondary" onClick={() => setModalOpen(false)}>Annuler</button>
          <button className="btn-primary" disabled={saving} form="paie-form">Générer</button>
        </>}
      >
        <form id="paie-form" onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Employé</label>
            <select required className="input" value={form.employe} onChange={(e) => setForm({ ...form, employe: e.target.value })}>
              <option value="">Sélectionner...</option>
              {(employes?.results || []).map((emp) => <option key={emp.id} value={emp.id}>{emp.nom_complet}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Salaire de base (FCFA)</label>
            <input required type="number" className="input" value={form.salaire_base} onChange={(e) => setForm({ ...form, salaire_base: e.target.value })} />
          </div>
          <p className="text-xs text-slate-400">
            Période : {mois.toString().padStart(2, "0")}/{annee}. Ajoutez ensuite primes/retenues via le module dédié pour un calcul détaillé.
          </p>
        </form>
      </Modal>
    </div>
  );
}
