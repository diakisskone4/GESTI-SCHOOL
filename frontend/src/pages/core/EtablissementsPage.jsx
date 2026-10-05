import { useState } from "react";
import { ArrowRightLeft, CheckCircle2, ImagePlus, Loader2, Pencil, Plus, School, Search, Trash2, X } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import Modal from "../../components/ui/Modal";
import DataTable from "../../components/ui/DataTable";
import { useFetch } from "../../hooks/useFetch";
import { useToast, extractErrorMessage } from "../../context/ToastContext";
import { etablissementsApi } from "../../api/endpoints";
import { useAuth } from "../../context/AuthContext";
import { basculerVersEtablissement } from "../../components/layout/EtablissementSwitcher";

const TYPES = [
  { value: "prescolaire", label: "Préscolaire" },
  { value: "primaire", label: "Primaire" },
  { value: "secondaire", label: "Secondaire" },
  { value: "mixte", label: "Mixte (plusieurs cycles)" },
];
const TYPE_LABELS = Object.fromEntries(TYPES.map((t) => [t.value, t.label]));

const TITRES_DIRECTEUR = ["Le Directeur", "La Directrice", "Le Proviseur", "La Proviseure", "Le Principal", "La Principale"];

const IMAGE_FIELDS = ["logo", "directeur_signature", "cachet"];

const EMPTY_ETABLISSEMENT = {
  nom: "",
  sigle: "",
  type_etablissement: "mixte",
  adresse: "",
  ville: "",
  pays: "Mali",
  telephone: "",
  email: "",
  devise: "",
  arrete_creation: "",
  arrete_ouverture: "",
  academie: "",
  cap: "",
  directeur_nom: "",
  directeur_titre: "Le Directeur",
  actif: true,
};

/** Champ d'image avec aperçu : choisir un fichier, le remplacer ou le retirer. */
function ImageField({ label, help, current, file, removed, onSelect, onRemove }) {
  const preview = file ? URL.createObjectURL(file) : removed ? null : current;
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">
          {preview ? (
            <img src={preview} alt={label} className="h-full w-full object-contain" />
          ) : (
            <ImagePlus size={22} className="text-slate-300" />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="btn-secondary cursor-pointer text-xs">
            {preview ? "Remplacer" : "Choisir une image"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onSelect(e.target.files[0])}
            />
          </label>
          {preview && (
            <button type="button" onClick={onRemove} className="inline-flex items-center gap-1 text-xs text-rose-600 hover:underline">
              <X size={12} /> Retirer
            </button>
          )}
        </div>
      </div>
      {help && <p className="mt-1 text-xs text-slate-400">{help}</p>}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <fieldset className="space-y-4 rounded-xl border border-slate-200 p-4">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</legend>
      {children}
    </fieldset>
  );
}

export default function EtablissementsPage() {
  const { notify } = useToast();
  const { user } = useAuth();
  const [bascule, setBascule] = useState(null);

  const gerer = async (etab) => {
    setBascule(etab.id);
    try {
      await basculerVersEtablissement(etab.id);
    } catch (err) {
      notify(extractErrorMessage(err), "error");
      setBascule(null);
    }
  };

  const [search, setSearch] = useState("");
  const { data, loading, reload } = useFetch(
    () => etablissementsApi.list({ search: search || undefined }),
    [search]
  );
  const etablissements = data?.results || [];

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_ETABLISSEMENT);
  const [files, setFiles] = useState({});      // { logo: File, ... } nouveaux fichiers choisis
  const [removed, setRemoved] = useState({});  // { logo: true, ... } images à supprimer
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_ETABLISSEMENT);
    setFiles({});
    setRemoved({});
    setModalOpen(true);
  };

  const openEdit = (etab) => {
    setEditing(etab);
    setForm(Object.fromEntries(Object.keys(EMPTY_ETABLISSEMENT).map((k) => [k, etab[k] ?? EMPTY_ETABLISSEMENT[k]])));
    setFiles({});
    setRemoved({});
    setModalOpen(true);
  };

  const selectImage = (field, file) => {
    setFiles({ ...files, [field]: file });
    setRemoved({ ...removed, [field]: false });
  };
  const removeImage = (field) => {
    setFiles({ ...files, [field]: undefined });
    setRemoved({ ...removed, [field]: true });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const newFiles = IMAGE_FIELDS.filter((f) => files[f]);
      const toClear = IMAGE_FIELDS.filter((f) => removed[f] && !files[f]);

      // Avec des images : envoi multipart ; sinon JSON classique.
      let payload = { ...form };
      if (newFiles.length) {
        const fd = new FormData();
        Object.entries(form).forEach(([key, value]) => fd.append(key, value ?? ""));
        newFiles.forEach((f) => fd.append(f, files[f]));
        payload = fd;
      } else {
        toClear.forEach((f) => { payload[f] = null; });
      }

      const saved = editing
        ? await etablissementsApi.update(editing.id, payload)
        : await etablissementsApi.create(payload);

      // Une suppression d'image ne peut pas passer dans un FormData : PATCH JSON séparé.
      if (newFiles.length && toClear.length) {
        await etablissementsApi.update(saved.id, Object.fromEntries(toClear.map((f) => [f, null])));
      }

      setModalOpen(false);
      reload();
      if (editing) {
        notify("Établissement modifié.", "success");
      } else if (window.confirm(
        `« ${saved.nom} » a été créé.

Chaque établissement a ses propres données (années, classes, élèves, finances...).
` +
        "Basculer maintenant vers ce nouvel établissement pour le configurer ?"
      )) {
        await gerer(saved);
      } else {
        notify("Établissement créé. Utilisez « Gérer » pour basculer vers lui.", "success");
      }
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (etab) => {
    if (!window.confirm(`Supprimer l'établissement « ${etab.nom} » ? Toutes ses données (élèves, classes...) seront supprimées.`)) return;
    try {
      await etablissementsApi.remove(etab.id);
      notify("Établissement supprimé.", "success");
      reload();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    }
  };

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Établissements"
        subtitle="Chaque établissement a ses propres données. « Gérer » bascule l'application vers l'établissement choisi."
        actions={
          <button onClick={openCreate} className="btn-primary">
            <Plus size={16} /> Ajouter un établissement
          </button>
        }
      />

      <div className="card flex flex-wrap items-center gap-4 p-5">
        <div className="relative min-w-[260px] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Rechercher par nom, sigle, ville..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="ml-auto text-xs text-slate-500">
          <strong>{data?.count ?? etablissements.length}</strong> établissement(s)
        </div>
      </div>

      <DataTable
        loading={loading}
        rows={etablissements}
        columns={[
          {
            key: "nom",
            header: "Établissement",
            render: (r) => (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                  {r.logo ? <img src={r.logo} alt="" className="h-full w-full object-contain" /> : <School size={18} className="text-slate-300" />}
                </div>
                <div>
                  <div className="font-semibold text-slate-800">{r.nom}</div>
                  {r.devise && <div className="text-xs italic text-slate-400">{r.devise}</div>}
                </div>
              </div>
            ),
          },
          { key: "sigle", header: "Sigle" },
          { key: "type_etablissement", header: "Type", render: (r) => TYPE_LABELS[r.type_etablissement] || r.type_etablissement },
          { key: "ville", header: "Ville", render: (r) => [r.ville, r.pays].filter(Boolean).join(", ") || "—" },
          { key: "directeur_nom", header: "Direction", render: (r) => r.directeur_nom ? `${r.directeur_titre} ${r.directeur_nom}` : <span className="text-slate-400">—</span> },
          {
            key: "actif",
            header: "Statut",
            render: (r) => (
              <div className="flex flex-wrap gap-1.5">
                {r.id === user?.etablissement_courant && (
                  <span className="badge bg-brand-600 text-white"><CheckCircle2 size={12} /> En cours de gestion</span>
                )}
                <span className={`badge ${r.actif ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                  {r.actif ? "Actif" : "Inactif"}
                </span>
              </div>
            ),
          },
          {
            key: "actions",
            header: "",
            render: (r) => (
              <div className="flex items-center justify-end gap-1">
                {r.id !== user?.etablissement_courant && (
                  <button
                    onClick={() => gerer(r)}
                    disabled={!!bascule}
                    className="mr-1 flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50/70 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100"
                    title="Basculer vers cet établissement : toutes les pages afficheront ses données"
                  >
                    {bascule === r.id ? <Loader2 size={13} className="animate-spin" /> : <ArrowRightLeft size={13} />}
                    Gérer
                  </button>
                )}
                <button onClick={() => openEdit(r)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600" title="Modifier">
                  <Pencil size={15} />
                </button>
                <button onClick={() => handleDelete(r)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Supprimer">
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
        title={editing ? `Modifier « ${editing.nom} »` : "Ajouter un établissement"}
        width="max-w-3xl"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>Annuler</button>
            <button className="btn-primary" disabled={saving} form="etab-form">
              {saving && <Loader2 size={16} className="animate-spin" />}
              Enregistrer
            </button>
          </>
        }
      >
        <form id="etab-form" onSubmit={handleSave} className="space-y-5">
          <Section title="Informations générales">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label">Nom de l'établissement</label>
                <input required maxLength={200} className="input" value={form.nom} onChange={set("nom")} />
              </div>
              <div>
                <label className="label">Sigle</label>
                <input required maxLength={20} className="input" value={form.sigle} onChange={set("sigle")} />
                <p className="mt-1 text-xs text-slate-400">Code court utilisé dans les matricules</p>
              </div>
              <div>
                <label className="label">Type d'établissement</label>
                <select className="input" value={form.type_etablissement} onChange={set("type_etablissement")}>
                  {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={!!form.actif} onChange={(e) => setForm({ ...form, actif: e.target.checked })} />
              Établissement actif
            </label>
          </Section>

          <Section title="Coordonnées">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label">Adresse</label>
                <input maxLength={255} className="input" value={form.adresse} onChange={set("adresse")} />
              </div>
              <div>
                <label className="label">Ville</label>
                <input maxLength={100} className="input" value={form.ville} onChange={set("ville")} />
              </div>
              <div>
                <label className="label">Pays</label>
                <input maxLength={100} className="input" value={form.pays} onChange={set("pays")} />
              </div>
              <div>
                <label className="label">Téléphone</label>
                <input maxLength={30} className="input" value={form.telephone} onChange={set("telephone")} />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" value={form.email} onChange={set("email")} />
              </div>
            </div>
          </Section>

          <Section title="Identité visuelle">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ImageField
                label="Logo"
                current={editing?.logo}
                file={files.logo}
                removed={removed.logo}
                onSelect={(f) => selectImage("logo", f)}
                onRemove={() => removeImage("logo")}
              />
              <div>
                <label className="label">Devise / slogan</label>
                <input maxLength={255} className="input" value={form.devise} onChange={set("devise")} placeholder="Ex: Un Peuple - Un But - Une Foi" />
              </div>
            </div>
          </Section>

          <Section title="Informations officielles">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Académie d'enseignement</label>
                <input maxLength={150} className="input" value={form.academie} onChange={set("academie")} placeholder="Ex: Académie d'Enseignement de Bamako Rive Droite" />
              </div>
              <div>
                <label className="label">CAP (optionnel)</label>
                <input maxLength={150} className="input" value={form.cap} onChange={set("cap")} />
                <p className="mt-1 text-xs text-slate-400">Centre d'Animation Pédagogique (primaire/collège)</p>
              </div>
              <div>
                <label className="label">Arrêté de création</label>
                <input maxLength={100} className="input" value={form.arrete_creation} onChange={set("arrete_creation")} placeholder="Ex: N° 10-2235/MEALN-SG du 21/07/2010" />
              </div>
              <div>
                <label className="label">Arrêté d'ouverture</label>
                <input maxLength={100} className="input" value={form.arrete_ouverture} onChange={set("arrete_ouverture")} placeholder="Ex: N° 2011-4993/MEALN-SG du 07/12/2011" />
              </div>
            </div>
          </Section>

          <Section title="Direction">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Nom du directeur / proviseur</label>
                <input maxLength={150} className="input" value={form.directeur_nom} onChange={set("directeur_nom")} />
              </div>
              <div>
                <label className="label">Titre</label>
                <select className="input" value={form.directeur_titre} onChange={set("directeur_titre")}>
                  {[...new Set([...TITRES_DIRECTEUR, form.directeur_titre].filter(Boolean))].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <ImageField
                label="Signature du directeur"
                help="Image apposée sur les bulletins et documents officiels"
                current={editing?.directeur_signature}
                file={files.directeur_signature}
                removed={removed.directeur_signature}
                onSelect={(f) => selectImage("directeur_signature", f)}
                onRemove={() => removeImage("directeur_signature")}
              />
              <ImageField
                label="Cachet de l'établissement"
                current={editing?.cachet}
                file={files.cachet}
                removed={removed.cachet}
                onSelect={(f) => selectImage("cachet", f)}
                onRemove={() => removeImage("cachet")}
              />
            </div>
          </Section>
        </form>
      </Modal>
    </div>
  );
}
