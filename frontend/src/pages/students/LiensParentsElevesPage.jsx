import { useState } from "react";
import { Loader2, Pencil, Plus, Search, Star, Trash2 } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import Modal from "../../components/ui/Modal";
import DataTable from "../../components/ui/DataTable";
import { useAuth } from "../../context/AuthContext";
import { useFetch } from "../../hooks/useFetch";
import { useToast, extractErrorMessage } from "../../context/ToastContext";
import { elevesApi, liensParentEleveApi, usersApi } from "../../api/endpoints";

const RELATIONS = [
  { value: "pere", label: "Père" },
  { value: "mere", label: "Mère" },
  { value: "tuteur", label: "Tuteur/Tutrice" },
  { value: "autre", label: "Autre" },
];

const EMPTY_LIEN = { parent: "", eleve: "", relation: "tuteur", est_contact_principal: false };

export default function LiensParentsElevesPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const etablissementId = user?.etablissement_courant;

  // Liste des liens
  const [search, setSearch] = useState("");
  const [relationFilter, setRelationFilter] = useState("");
  const { data, loading, reload } = useFetch(
    () =>
      liensParentEleveApi.list({
        eleve__etablissement: etablissementId || undefined,
        search: search || undefined,
        relation: relationFilter || undefined,
      }),
    [etablissementId, search, relationFilter]
  );
  const liens = data?.results || [];

  // Modal d'ajout / modification
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_LIEN);
  const [saving, setSaving] = useState(false);

  // Recherche des parents et élèves dans le formulaire (l'API pagine à 25 résultats)
  const [parentSearch, setParentSearch] = useState("");
  const [eleveSearch, setEleveSearch] = useState("");
  const { data: parentsData } = useFetch(
    () => (modalOpen ? usersApi.list({ role: "parent", search: parentSearch || undefined }) : Promise.resolve(null)),
    [modalOpen, parentSearch]
  );
  const { data: elevesData } = useFetch(
    () =>
      modalOpen
        ? elevesApi.list({ etablissement: etablissementId || undefined, search: eleveSearch || undefined })
        : Promise.resolve(null),
    [modalOpen, eleveSearch, etablissementId]
  );
  const parents = parentsData?.results || [];
  const eleves = elevesData?.results || [];

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_LIEN);
    setParentSearch("");
    setEleveSearch("");
    setModalOpen(true);
  };

  const openEdit = (lien) => {
    setEditing(lien);
    setForm({
      parent: lien.parent,
      eleve: lien.eleve,
      relation: lien.relation,
      est_contact_principal: lien.est_contact_principal,
    });
    setParentSearch("");
    setEleveSearch("");
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await liensParentEleveApi.update(editing.id, form);
        notify("Lien parent-élève modifié.", "success");
      } else {
        await liensParentEleveApi.create(form);
        notify("Lien parent-élève créé.", "success");
      }
      setModalOpen(false);
      reload();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (lien) => {
    if (!window.confirm(`Supprimer le lien entre ${lien.parent_nom} et ${lien.eleve_nom} ?`)) return;
    try {
      await liensParentEleveApi.remove(lien.id);
      notify("Lien supprimé.", "success");
      reload();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    }
  };

  // En modification, garder le parent / l'élève actuel dans la liste même s'il n'est pas dans les résultats
  const parentOptions =
    editing && !parents.some((p) => p.id === editing.parent)
      ? [{ id: editing.parent, full_name: editing.parent_nom, email: editing.parent_email }, ...parents]
      : parents;
  const eleveOptions =
    editing && !eleves.some((el) => el.id === editing.eleve)
      ? [{ id: editing.eleve, prenom: "", nom: editing.eleve_nom, matricule: editing.eleve_matricule }, ...eleves]
      : eleves;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Liens parents-élèves"
        subtitle="Associez les comptes parents à leurs enfants pour leur donner accès au suivi scolaire."
        actions={
          <button onClick={openCreate} className="btn-primary">
            <Plus size={16} /> Ajouter un lien
          </button>
        }
      />

      <div className="card flex flex-wrap items-center gap-4 p-5">
        <div className="relative min-w-[260px] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Rechercher un parent, un élève, un matricule..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input w-auto" value={relationFilter} onChange={(e) => setRelationFilter(e.target.value)}>
          <option value="">Toutes les relations</option>
          {RELATIONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <div className="ml-auto text-xs text-slate-500">
          <strong>{data?.count ?? liens.length}</strong> lien(s)
        </div>
      </div>

      <DataTable
        loading={loading}
        rows={liens}
        columns={[
          {
            key: "parent",
            header: "Parent",
            render: (r) => (
              <div>
                <div className="font-semibold text-slate-800">{r.parent_nom || r.parent_email}</div>
                <div className="text-xs text-slate-400">
                  {[r.parent_email, r.parent_telephone].filter(Boolean).join(" — ")}
                </div>
              </div>
            ),
          },
          {
            key: "eleve",
            header: "Élève",
            render: (r) => (
              <div>
                <div className="font-semibold text-slate-800">{r.eleve_nom}</div>
                <div className="text-xs text-slate-400">{r.eleve_matricule}</div>
              </div>
            ),
          },
          { key: "relation", header: "Relation", render: (r) => r.relation_label },
          {
            key: "est_contact_principal",
            header: "Contact principal",
            render: (r) =>
              r.est_contact_principal ? (
                <span className="badge inline-flex items-center gap-1 bg-amber-50 text-amber-700">
                  <Star size={12} /> Principal
                </span>
              ) : (
                <span className="text-slate-400">—</span>
              ),
          },
          {
            key: "actions",
            header: "",
            render: (r) => (
              <div className="flex justify-end gap-1">
                <button
                  onClick={() => openEdit(r)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
                  title="Modifier"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => handleDelete(r)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  title="Supprimer"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ),
          },
        ]}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Modifier le lien parent-élève" : "Lier un parent à un élève"}
        width="max-w-xl"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>Annuler</button>
            <button className="btn-primary" disabled={saving} form="lien-form">
              {saving && <Loader2 size={16} className="animate-spin" />}
              Enregistrer
            </button>
          </>
        }
      >
        <form id="lien-form" onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Compte parent</label>
            <input
              className="input mb-2"
              placeholder="Rechercher par nom ou email..."
              value={parentSearch}
              onChange={(e) => setParentSearch(e.target.value)}
            />
            <select
              required
              className="input"
              value={form.parent}
              onChange={(e) => setForm({ ...form, parent: e.target.value })}
            >
              <option value="">Sélectionner un parent...</option>
              {parentOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name || p.email} {p.full_name && p.email ? `(${p.email})` : ""}
                </option>
              ))}
            </select>
            {parentsData && parents.length === 0 && (
              <p className="mt-1 text-xs text-slate-500">
                Aucun compte parent trouvé. Créez-le d'abord dans « Utilisateurs » avec le rôle « Parent ».
              </p>
            )}
          </div>

          <div>
            <label className="label">Élève</label>
            <input
              className="input mb-2"
              placeholder="Rechercher par nom ou matricule..."
              value={eleveSearch}
              onChange={(e) => setEleveSearch(e.target.value)}
            />
            <select
              required
              className="input"
              value={form.eleve}
              onChange={(e) => setForm({ ...form, eleve: e.target.value })}
            >
              <option value="">Sélectionner un élève...</option>
              {eleveOptions.map((el) => (
                <option key={el.id} value={el.id}>
                  {`${el.prenom} ${el.nom}`.trim()} {el.matricule ? `(${el.matricule})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Relation</label>
            <select
              required
              className="input"
              value={form.relation}
              onChange={(e) => setForm({ ...form, relation: e.target.value })}
            >
              {RELATIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={form.est_contact_principal}
              onChange={(e) => setForm({ ...form, est_contact_principal: e.target.checked })}
            />
            Contact principal de l'élève
          </label>
        </form>
      </Modal>
    </div>
  );
}
