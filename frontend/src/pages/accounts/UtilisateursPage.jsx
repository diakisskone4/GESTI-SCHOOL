import { useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import Modal from "../../components/ui/Modal";
import DataTable from "../../components/ui/DataTable";
import { useAuth } from "../../context/AuthContext";
import { useFetch } from "../../hooks/useFetch";
import { useToast, extractErrorMessage } from "../../context/ToastContext";
import { usersApi } from "../../api/endpoints";

const ROLES = [
  { value: "admin", label: "Administrateur d'établissement" },
  { value: "enseignant", label: "Enseignant" },
  { value: "eleve", label: "Élève" },
  { value: "parent", label: "Parent" },
  { value: "comptable", label: "Comptable / Caissier" },
  { value: "surveillant", label: "Surveillant général" },
  { value: "superadmin", label: "Super Administrateur", superadminOnly: true },
];
const ROLE_LABELS = Object.fromEntries(ROLES.map((r) => [r.value, r.label]));

const EMPTY_USER = {
  email: "",
  first_name: "",
  last_name: "",
  role: "parent",
  telephone: "",
  password: "",
  password_confirm: "",
  is_active: true,
};

export default function UtilisateursPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const estSuperadmin = user?.role === "superadmin" || user?.is_superuser;
  const rolesDisponibles = ROLES.filter((r) => !r.superadminOnly || estSuperadmin);

  // Liste
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const { data, loading, reload } = useFetch(
    () =>
      usersApi.list({
        search: search || undefined,
        role: roleFilter || undefined,
        page,
        ordering: "-date_joined",
      }),
    [search, roleFilter, page]
  );
  const users = data?.results || [];

  // Modal d'ajout / modification
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_USER);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_USER);
    setModalOpen(true);
  };

  const openEdit = (u) => {
    setEditing(u);
    setForm({
      email: u.email,
      first_name: u.first_name,
      last_name: u.last_name,
      role: u.role,
      telephone: u.telephone || "",
      password: "",
      password_confirm: "",
      is_active: u.is_active,
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (form.password !== form.password_confirm) {
      notify("Les deux mots de passe ne correspondent pas.", "error");
      return;
    }
    setSaving(true);
    try {
      const { password_confirm, ...payload } = form;
      if (!payload.password) delete payload.password;
      if (editing) {
        await usersApi.update(editing.id, payload);
        notify("Utilisateur modifié.", "success");
      } else {
        await usersApi.create({ ...payload, etablissement_courant: user?.etablissement_courant || null });
        notify("Utilisateur créé.", "success");
      }
      setModalOpen(false);
      reload();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`Supprimer définitivement le compte ${u.email} ?`)) return;
    try {
      await usersApi.remove(u.id);
      notify("Utilisateur supprimé.", "success");
      reload();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    }
  };

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Utilisateurs"
        subtitle="Comptes de connexion : administrateurs, enseignants, parents, élèves, comptables."
        actions={
          <button onClick={openCreate} className="btn-primary">
            <Plus size={16} /> Ajouter un utilisateur
          </button>
        }
      />

      <div className="card flex flex-wrap items-center gap-4 p-5">
        <div className="relative min-w-[260px] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Rechercher par nom, email, téléphone..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="input w-auto"
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
        >
          <option value="">Tous les rôles</option>
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <div className="ml-auto text-xs text-slate-500">
          <strong>{data?.count ?? users.length}</strong> utilisateur(s)
        </div>
      </div>

      <DataTable
        loading={loading}
        rows={users}
        columns={[
          {
            key: "nom",
            header: "Nom",
            render: (r) => <span className="font-semibold text-slate-800">{r.full_name}</span>,
          },
          { key: "email", header: "Email" },
          { key: "telephone", header: "Téléphone", render: (r) => r.telephone || <span className="text-slate-400">—</span> },
          { key: "role", header: "Rôle", render: (r) => ROLE_LABELS[r.role] || r.role },
          {
            key: "is_active",
            header: "Statut",
            render: (r) => (
              <span className={`badge ${r.is_active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                {r.is_active ? "Actif" : "Inactif"}
              </span>
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
                {r.id !== user?.id && (
                  <button
                    onClick={() => handleDelete(r)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    title="Supprimer"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ),
          },
        ]}
      />

      {(data?.previous || data?.next) && (
        <div className="flex items-center justify-end gap-2">
          <button className="btn-secondary" disabled={!data?.previous} onClick={() => setPage(page - 1)}>
            <ChevronLeft size={16} /> Précédent
          </button>
          <span className="text-sm text-slate-500">Page {page}</span>
          <button className="btn-secondary" disabled={!data?.next} onClick={() => setPage(page + 1)}>
            Suivant <ChevronRight size={16} />
          </button>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Modifier l'utilisateur" : "Ajouter un utilisateur"}
        width="max-w-xl"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>Annuler</button>
            <button className="btn-primary" disabled={saving} form="user-form">
              {saving && <Loader2 size={16} className="animate-spin" />}
              Enregistrer
            </button>
          </>
        }
      >
        <form id="user-form" onSubmit={handleSave} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Adresse email</label>
            <input required type="email" className="input" value={form.email} onChange={set("email")} />
          </div>
          <div>
            <label className="label">Prénom</label>
            <input required className="input" value={form.first_name} onChange={set("first_name")} />
          </div>
          <div>
            <label className="label">Nom</label>
            <input required className="input" value={form.last_name} onChange={set("last_name")} />
          </div>
          <div>
            <label className="label">Rôle</label>
            <select required className="input" value={form.role} onChange={set("role")}>
              {rolesDisponibles.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Téléphone</label>
            <input className="input" value={form.telephone} onChange={set("telephone")} />
          </div>
          <div>
            <label className="label">{editing ? "Nouveau mot de passe" : "Mot de passe"}</label>
            <input
              required={!editing}
              type="password"
              autoComplete="new-password"
              minLength={8}
              className="input"
              value={form.password}
              onChange={set("password")}
            />
          </div>
          <div>
            <label className="label">Confirmation du mot de passe</label>
            <input
              required={!editing || !!form.password}
              type="password"
              autoComplete="new-password"
              className="input"
              value={form.password_confirm}
              onChange={set("password_confirm")}
            />
          </div>
          <p className="text-xs text-slate-500 sm:col-span-2">
            {editing
              ? "Laissez le mot de passe vide pour le conserver. "
              : "Au moins 8 caractères, pas uniquement des chiffres. "}
            L'utilisateur devra changer ce mot de passe à sa prochaine connexion.
          </p>
          {editing && (
            <label className="flex items-center gap-2 text-sm text-slate-600 sm:col-span-2">
              <input
                type="checkbox"
                checked={form.is_active}
                disabled={editing.id === user?.id}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              Compte actif (décocher pour bloquer la connexion)
            </label>
          )}
        </form>
      </Modal>
    </div>
  );
}
