import { useState, useEffect } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import PageHeader from "./PageHeader";
import DataTable from "./DataTable";
import Modal from "./Modal";
import { useFetch } from "../../hooks/useFetch";
import { useToast, extractErrorMessage } from "../../context/ToastContext";

/**
 * Page CRUD générique pilotée par configuration : liste + création/édition + suppression.
 *
 * fields: [{ name, label, type: 'text'|'number'|'date'|'select'|'checkbox'|'textarea', options?, required? }]
 * columns: colonnes DataTable (voir DataTable.jsx) — si omis, dérivées de `fields`.
 */
export default function CrudPage({ title, subtitle, apiResource, fields, columns, filters, createDefaults, canDelete = true, canCreate = true, onDataChange }) {
  const { notify } = useToast();
  const [query, setQuery] = useState(filters || {});

  useEffect(() => {
    setQuery(filters || {});
  }, [JSON.stringify(filters)]);

  const { data, loading, reload } = useFetch(() => apiResource.list(query), [JSON.stringify(query)]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const rows = data?.results ?? data ?? [];
  const cols = columns || fields.map((f) => ({ key: f.name, header: f.label }));

  const openCreate = () => {
    setEditing(null);
    const initial = { ...(filters || {}) };
    fields.forEach((f) => { initial[f.name] = f.type === "checkbox" ? false : ""; });
    setForm({ ...initial, ...(createDefaults || {}) });
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({ ...row });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Les champs numériques laissés vides doivent être omis (et non envoyés
      // en tant que ""), sinon DRF rejette la valeur avec une erreur 400
      // ("A valid number is required.") au lieu d'appliquer la valeur par défaut.
      const payload = { ...form };
      fields.forEach((f) => {
        if (f.type === "number" && payload[f.name] === "") {
          delete payload[f.name];
        }
      });

      if (editing) {
        await apiResource.update(editing.id, payload);
        notify("Modifié avec succès.", "success");
      } else {
        await apiResource.create(payload);
        notify("Créé avec succès.", "success");
      }
      setModalOpen(false);
      reload();
      onDataChange?.();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm("Confirmer la suppression ?")) return;
    try {
      await apiResource.remove(row.id);
      notify("Supprimé.", "success");
      reload();
      onDataChange?.();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    }
  };

  const actionCol = {
    key: "__actions",
    header: "",
    render: (row) => (
      <div className="flex justify-end gap-1">
        <button onClick={() => openEdit(row)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600">
          <Pencil size={15} />
        </button>
        {canDelete && (
          <button onClick={() => handleDelete(row)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
            <Trash2 size={15} />
          </button>
        )}
      </div>
    ),
  };

  return (
    <div>
      {title ? (
        <PageHeader
          title={title}
          subtitle={subtitle}
          actions={
            canCreate && (
              <button onClick={openCreate} className="btn-primary">
                <Plus size={16} /> Ajouter
              </button>
            )
          }
        />
      ) : (
        canCreate && (
          <div className="mb-4 flex justify-end">
            <button onClick={openCreate} className="btn-primary">
              <Plus size={16} /> Ajouter
            </button>
          </div>
        )
      )}

      <DataTable columns={[...cols, actionCol]} rows={rows} loading={loading} />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Modifier" : "Ajouter"}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>Annuler</button>
            <button className="btn-primary" disabled={saving} form="crud-form">Enregistrer</button>
          </>
        }
      >
        <form id="crud-form" onSubmit={handleSave} className="space-y-4">
          {fields.map((f) => (
            <div key={f.name}>
              {f.type !== "checkbox" && <label className="label">{f.label}</label>}
              {f.type === "select" ? (
                <select
                  className="input"
                  required={f.required}
                  value={form[f.name] ?? ""}
                  onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                >
                  <option value="">Sélectionner...</option>
                  {f.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  className="input"
                  rows={3}
                  required={f.required}
                  value={form[f.name] ?? ""}
                  onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                />
              ) : f.type === "checkbox" ? (
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={!!form[f.name]}
                    onChange={(e) => setForm({ ...form, [f.name]: e.target.checked })}
                  />
                  {f.label}
                </label>
              ) : (
                <input
                  type={f.type || "text"}
                  className="input"
                  required={f.required}
                  value={form[f.name] ?? ""}
                  onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                />
              )}
            </div>
          ))}
        </form>
      </Modal>
    </div>
  );
}
