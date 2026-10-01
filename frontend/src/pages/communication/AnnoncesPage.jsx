import { useState } from "react";
import { Megaphone, Pin, Plus, Trash2 } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import Modal from "../../components/ui/Modal";
import { useFetch } from "../../hooks/useFetch";
import { useAuth } from "../../context/AuthContext";
import { useToast, extractErrorMessage } from "../../context/ToastContext";
import { annoncesApi } from "../../api/endpoints";

export default function AnnoncesPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const { data, loading, reload } = useFetch(() => annoncesApi.list(), []);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ titre: "", contenu: "", public_cible: "tous" });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const canPublish = user?.est_admin || user?.role === "enseignant";

  const handleDelete = async (annonce) => {
    if (!window.confirm(`Supprimer définitivement l'annonce "${annonce.titre}" ?`)) return;
    setDeletingId(annonce.id);
    try {
      await annoncesApi.remove(annonce.id);
      notify("Annonce supprimée.", "success");
      reload();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await annoncesApi.create({ ...form, etablissement: user?.etablissement_courant });
      notify("Annonce publiée.", "success");
      setModalOpen(false);
      setForm({ titre: "", contenu: "", public_cible: "tous" });
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
        title="Annonces"
        subtitle="Publications de l'administration et des enseignants"
        actions={
          canPublish && (
            <button onClick={() => setModalOpen(true)} className="btn-primary">
              <Plus size={16} /> Publier une annonce
            </button>
          )
        }
      />

      <div className="space-y-4">
        {loading && <p className="text-sm text-slate-400">Chargement...</p>}
        {(data?.results || []).map((a) => (
          <div key={a.id} className="card p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Megaphone size={16} />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{a.titre}</p>
                  <p className="text-xs text-slate-400">
                    Par {a.auteur_nom} · {new Date(a.date_publication).toLocaleDateString("fr-FR")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {a.epinglee && <Pin size={16} className="text-amber-500" />}
                {(user?.est_admin || a.auteur === user?.id) && (
                  <button
                    onClick={() => handleDelete(a)}
                    disabled={deletingId === a.id}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    title="Supprimer"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600">{a.contenu}</p>
          </div>
        ))}
        {!loading && (data?.results || []).length === 0 && (
          <div className="card p-8 text-center text-sm text-slate-400">Aucune annonce publiée.</div>
        )}
      </div>

      <Modal
        open={modalOpen} onClose={() => setModalOpen(false)} title="Publier une annonce"
        footer={<>
          <button className="btn-secondary" onClick={() => setModalOpen(false)}>Annuler</button>
          <button className="btn-primary" disabled={saving} form="annonce-form">Publier</button>
        </>}
      >
        <form id="annonce-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Titre</label>
            <input required className="input" value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} />
          </div>
          <div>
            <label className="label">Public cible</label>
            <select className="input" value={form.public_cible} onChange={(e) => setForm({ ...form, public_cible: e.target.value })}>
              <option value="tous">Tout le monde</option>
              <option value="enseignants">Enseignants</option>
              <option value="eleves">Élèves</option>
              <option value="parents">Parents</option>
            </select>
          </div>
          <div>
            <label className="label">Contenu</label>
            <textarea required rows={4} className="input" value={form.contenu} onChange={(e) => setForm({ ...form, contenu: e.target.value })} />
          </div>
        </form>
      </Modal>
    </div>
  );
}
