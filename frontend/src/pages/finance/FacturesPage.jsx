import { useState } from "react";
import { CreditCard, Download, Plus, Wallet, X } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import DataTable from "../../components/ui/DataTable";
import Modal from "../../components/ui/Modal";
import StatCard from "../../components/ui/StatCard";
import { useFetch } from "../../hooks/useFetch";
import { useAuth } from "../../context/AuthContext";
import { useToast, extractErrorMessage } from "../../context/ToastContext";
import { facturesApi, paiementsApi, typesFraisApi, elevesApi, inscriptionsApi, dashboardFinancierApi } from "../../api/endpoints";
import { downloadAuthFile } from "../../utils/download";

const fmt = (n) => `${Number(n || 0).toLocaleString("fr-FR")} FCFA`;

const STATUT_STYLES = {
  payee: "bg-emerald-50 text-emerald-600",
  partielle: "bg-amber-50 text-amber-600",
  impayee: "bg-rose-50 text-rose-600",
  annulee: "bg-slate-100 text-slate-500",
};

export default function FacturesPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const etablissementId = user?.etablissement_courant;

  const { data: factures, loading, reload } = useFetch(() => facturesApi.list(), []);
  const { data: finance } = useFetch(() => dashboardFinancierApi.get({ etablissement: etablissementId }), [etablissementId]);
  const { data: typesFrais, reload: reloadTypesFrais } = useFetch(() => typesFraisApi.list({ etablissement: etablissementId }), [etablissementId]);
  const { data: eleves } = useFetch(() => elevesApi.list({ etablissement: etablissementId }), [etablissementId]);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ eleve: "", type_frais: "", montant_du: "", date_echeance: "", libelle: "" });
  const [saving, setSaving] = useState(false);

  const [newTypeOpen, setNewTypeOpen] = useState(false);
  const [newTypeNom, setNewTypeNom] = useState("");
  const [savingType, setSavingType] = useState(false);

  const handleCreateTypeFrais = async () => {
    if (!newTypeNom.trim()) return;
    setSavingType(true);
    try {
      const created = await typesFraisApi.create({
        nom: newTypeNom.trim(),
        etablissement: etablissementId,
        periodicite: "trimestriel",
        obligatoire: true,
      });
      notify("Type de frais créé.", "success");
      setNewTypeNom("");
      setNewTypeOpen(false);
      await reloadTypesFrais();
      setForm((f) => ({ ...f, type_frais: created.id }));
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setSavingType(false);
    }
  };

  const [payModal, setPayModal] = useState(null);
  const [payForm, setPayForm] = useState({ montant: "", mode_paiement: "especes" });
  const [paying, setPaying] = useState(false);

  const handleCreateFacture = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const inscRes = await inscriptionsApi.list({ eleve: form.eleve, statut: "active" });
      const inscription = inscRes.results?.[0];
      if (!inscription) throw new Error("Cet élève n'a pas d'inscription active.");
      await facturesApi.create({
        inscription: inscription.id, type_frais: form.type_frais, montant_du: form.montant_du,
        date_echeance: form.date_echeance, libelle: form.libelle,
      });
      notify("Facture créée.", "success");
      setModalOpen(false);
      reload();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const handlePay = async (e) => {
    e.preventDefault();
    setPaying(true);
    try {
      const paiement = await paiementsApi.create({
        facture: payModal.id, montant: payForm.montant, mode_paiement: payForm.mode_paiement,
      });
      notify("Paiement enregistré.", "success");
      await downloadAuthFile(paiementsApi.recuPath(paiement.id), `recu_${paiement.id}.pdf`);
      setPayModal(null);
      reload();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setPaying(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Facturation & frais scolaires"
        subtitle="Frais de scolarité, factures et paiements"
        actions={
          <button onClick={() => { setForm({ eleve: "", type_frais: "", montant_du: "", date_echeance: "", libelle: "" }); setModalOpen(true); }} className="btn-primary">
            <Plus size={16} /> Nouvelle facture
          </button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Wallet} tone="emerald" label="Total encaissé" value={fmt(finance?.total_encaisse)} />
        <StatCard icon={CreditCard} tone="rose" label="Total impayé" value={fmt(finance?.total_impaye)} />
        <StatCard icon={Wallet} tone="brand" label="Nombre de factures" value={finance?.nb_factures ?? "…"} />
      </div>

      <DataTable
        loading={loading}
        rows={factures?.results || []}
        columns={[
          { key: "eleve_nom", header: "Élève" },
          { key: "libelle", header: "Motif", render: (r) => r.libelle || "—" },
          { key: "montant_net", header: "Montant dû", render: (r) => fmt(r.montant_net) },
          { key: "montant_paye", header: "Payé", render: (r) => fmt(r.montant_paye) },
          { key: "solde", header: "Solde", render: (r) => fmt(r.solde) },
          {
            key: "statut", header: "Statut",
            render: (r) => <span className={`badge ${STATUT_STYLES[r.statut]}`}>{r.statut}</span>,
          },
          {
            key: "action", header: "",
            render: (r) => r.statut !== "payee" && (
              <button
                onClick={() => { setPayModal(r); setPayForm({ montant: r.solde, mode_paiement: "especes" }); }}
                className="text-sm font-semibold text-brand-600 hover:underline"
              >
                Encaisser
              </button>
            ),
          },
        ]}
      />

      <Modal
        open={modalOpen} onClose={() => setModalOpen(false)} title="Nouvelle facture de frais"
        footer={<>
          <button className="btn-secondary" onClick={() => setModalOpen(false)}>Annuler</button>
          <button className="btn-primary" disabled={saving} form="facture-form">Créer</button>
        </>}
      >
        <form id="facture-form" onSubmit={handleCreateFacture} className="space-y-4">
          <div>
            <label className="label">Élève</label>
            <select required className="input" value={form.eleve} onChange={(e) => setForm({ ...form, eleve: e.target.value })}>
              <option value="">Sélectionner...</option>
              {(eleves?.results || []).map((el) => <option key={el.id} value={el.id}>{el.nom_complet} ({el.matricule})</option>)}
            </select>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="label mb-0">Type de frais</label>
              <button
                type="button"
                className="text-xs font-semibold text-brand-600 hover:underline"
                onClick={() => setNewTypeOpen((v) => !v)}
              >
                {newTypeOpen ? "Annuler" : "+ Nouveau type"}
              </button>
            </div>
            {newTypeOpen && (
              <div className="mb-2 flex items-center gap-2">
                <input
                  className="input"
                  placeholder="Ex: Scolarité, Cantine, Transport..."
                  value={newTypeNom}
                  onChange={(e) => setNewTypeNom(e.target.value)}
                />
                <button type="button" className="btn-secondary" disabled={savingType} onClick={handleCreateTypeFrais}>
                  Ajouter
                </button>
                <button type="button" className="text-slate-400" onClick={() => setNewTypeOpen(false)}>
                  <X size={16} />
                </button>
              </div>
            )}
            <select required className="input" value={form.type_frais} onChange={(e) => setForm({ ...form, type_frais: e.target.value })}>
              <option value="">Sélectionner...</option>
              {(typesFrais?.results || []).map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
            </select>
            {(typesFrais?.results || []).length === 0 && !newTypeOpen && (
              <p className="mt-1 text-xs text-slate-400">Aucun type de frais configuré. Cliquez sur « + Nouveau type » pour en créer un.</p>
            )}
          </div>
          <div>
            <label className="label">Libellé (optionnel)</label>
            <input className="input" value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })} placeholder="Ex: Scolarité Trimestre 1" />
          </div>
          <div>
            <label className="label">Montant dû (FCFA)</label>
            <input required type="number" className="input" value={form.montant_du} onChange={(e) => setForm({ ...form, montant_du: e.target.value })} />
          </div>
          <div>
            <label className="label">Date d'échéance</label>
            <input required type="date" className="input" value={form.date_echeance} onChange={(e) => setForm({ ...form, date_echeance: e.target.value })} />
          </div>
        </form>
      </Modal>

      <Modal
        open={!!payModal} onClose={() => setPayModal(null)} title="Encaisser un paiement"
        footer={<>
          <button className="btn-secondary" onClick={() => setPayModal(null)}>Annuler</button>
          <button className="btn-primary" disabled={paying} form="pay-form">
            <Download size={15} /> Encaisser & imprimer le reçu
          </button>
        </>}
      >
        <form id="pay-form" onSubmit={handlePay} className="space-y-4">
          <p className="text-sm text-slate-500">
            Solde restant : <span className="font-semibold text-slate-700">{fmt(payModal?.solde)}</span>
          </p>
          <div>
            <label className="label">Montant payé</label>
            <input required type="number" className="input" value={payForm.montant} onChange={(e) => setPayForm({ ...payForm, montant: e.target.value })} />
          </div>
          <div>
            <label className="label">Mode de paiement</label>
            <select className="input" value={payForm.mode_paiement} onChange={(e) => setPayForm({ ...payForm, mode_paiement: e.target.value })}>
              <option value="especes">Espèces</option>
              <option value="mobile_money">Mobile Money</option>
              <option value="virement">Virement bancaire</option>
              <option value="cheque">Chèque</option>
              <option value="carte">Carte bancaire</option>
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
}
