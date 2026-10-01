import { useState } from "react";
import { Plus } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import DataTable from "../../components/ui/DataTable";
import Modal from "../../components/ui/Modal";
import { useFetch } from "../../hooks/useFetch";
import { useAuth } from "../../context/AuthContext";
import { useToast, extractErrorMessage } from "../../context/ToastContext";
import { absencesApi, elevesApi, inscriptionsApi } from "../../api/endpoints";

export default function AbsencesPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const etablissementId = user?.etablissement_courant;

  const { data, loading, reload } = useFetch(() => absencesApi.list(), []);
  const { data: eleves } = useFetch(() => elevesApi.list({ etablissement: etablissementId }), [etablissementId]);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ eleve: "", type_evenement: "absence", date: "", justifiee: false, motif: "" });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const inscRes = await inscriptionsApi.list({ eleve: form.eleve, statut: "active" });
      const inscription = inscRes.results?.[0];
      if (!inscription) throw new Error("Élève sans inscription active.");
      await absencesApi.create({
        inscription: inscription.id, type_evenement: form.type_evenement, date: form.date,
        justifiee: form.justifiee, motif: form.motif,
      });
      notify("Enregistré.", "success");
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
        title="Absences & retards"
        subtitle="Suivi de l'assiduité des élèves"
        actions={
          <button onClick={() => { setForm({ eleve: "", type_evenement: "absence", date: "", justifiee: false, motif: "" }); setModalOpen(true); }} className="btn-primary">
            <Plus size={16} /> Signaler
          </button>
        }
      />

      <DataTable
        loading={loading}
        rows={data?.results || []}
        columns={[
          { key: "eleve_nom", header: "Élève" },
          { key: "date", header: "Date" },
          { key: "type_evenement", header: "Type", render: (r) => (r.type_evenement === "absence" ? "Absence" : "Retard") },
          {
            key: "justifiee", header: "Justifiée",
            render: (r) => (
              <span className={`badge ${r.justifiee ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                {r.justifiee ? "Oui" : "Non"}
              </span>
            ),
          },
          { key: "motif", header: "Motif", render: (r) => r.motif || "—" },
        ]}
      />

      <Modal
        open={modalOpen} onClose={() => setModalOpen(false)} title="Signaler une absence / un retard"
        footer={<>
          <button className="btn-secondary" onClick={() => setModalOpen(false)}>Annuler</button>
          <button className="btn-primary" disabled={saving} form="absence-form">Enregistrer</button>
        </>}
      >
        <form id="absence-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Élève</label>
            <select required className="input" value={form.eleve} onChange={(e) => setForm({ ...form, eleve: e.target.value })}>
              <option value="">Sélectionner un élève...</option>
              {(eleves?.results || []).map((el) => (
                <option key={el.id} value={el.id}>{el.nom_complet} {el.matricule ? `(${el.matricule})` : ""}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.type_evenement} onChange={(e) => setForm({ ...form, type_evenement: e.target.value })}>
              <option value="absence">Absence</option>
              <option value="retard">Retard</option>
            </select>
          </div>
          <div>
            <label className="label">Date</label>
            <input required type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <label className="label">Motif</label>
            <input className="input" value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={form.justifiee} onChange={(e) => setForm({ ...form, justifiee: e.target.checked })} />
            Justifiée
          </label>
        </form>
      </Modal>
    </div>
  );
}
