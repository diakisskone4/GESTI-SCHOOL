import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, CalendarClock, GraduationCap, Loader2, BookOpen } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import DataTable from "../../components/ui/DataTable";
import Modal from "../../components/ui/Modal";
import { useFetch } from "../../hooks/useFetch";
import { useAuth } from "../../context/AuthContext";
import { useToast, extractErrorMessage } from "../../context/ToastContext";
import { enseignantsApi, usersApi, matieresApi } from "../../api/endpoints";

const EMPTY_FORM = {
  email: "",
  nom: "",
  prenom: "",
  sexe: "M",
  telephone: "",
  adresse: "",
  diplome: "",
  specialite: "",
  grade_academique: "",
  type_contrat: "CDI",
  matieres_enseignees: [],
};

export default function EnseignantsPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const etablissementId = user?.etablissement_courant;

  const { data, loading, reload } = useFetch(() => enseignantsApi.list({ etablissement: etablissementId }), [etablissementId]);
  const { data: matieresData } = useFetch(() => matieresApi.list({ etablissement: etablissementId }), [etablissementId]);
  const matieres = matieresData?.results || [];

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const toggleMatiere = (id) => {
    setForm((f) => ({
      ...f,
      matieres_enseignees: f.matieres_enseignees.includes(id)
        ? f.matieres_enseignees.filter((m) => m !== id)
        : [...f.matieres_enseignees, id],
    }));
  };

  const openCreate = () => {
    setEditingTeacher(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (ens) => {
    setEditingTeacher(ens);
    setForm({
      email: ens.email || ens.user_email || "",
      nom: ens.nom || "",
      prenom: ens.prenom || "",
      sexe: ens.sexe || "M",
      telephone: ens.telephone || "",
      adresse: ens.adresse || "",
      diplome: ens.diplome || "",
      specialite: ens.specialite || "",
      grade_academique: ens.grade_academique || "",
      type_contrat: ens.type_contrat || "CDI",
      matieres_enseignees: ens.matieres_enseignees || [],
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingTeacher) {
        await enseignantsApi.update(editingTeacher.id, {
          nom: form.nom,
          prenom: form.prenom,
          sexe: form.sexe,
          telephone: form.telephone,
          adresse: form.adresse,
          diplome: form.diplome,
          specialite: form.specialite,
          grade_academique: form.grade_academique,
          type_contrat: form.type_contrat,
          matieres_enseignees: form.matieres_enseignees,
        });
        notify("Enseignant modifié avec succès.", "success");
      } else {
        const newUser = await usersApi.create({
          email: form.email,
          first_name: form.prenom,
          last_name: form.nom,
          role: "enseignant",
          etablissement_courant: etablissementId,
        });

        await enseignantsApi.create({
          user: newUser.id,
          etablissement: etablissementId,
          nom: form.nom,
          prenom: form.prenom,
          sexe: form.sexe,
          telephone: form.telephone,
          adresse: form.adresse,
          diplome: form.diplome,
          specialite: form.specialite,
          grade_academique: form.grade_academique,
          type_contrat: form.type_contrat,
          matieres_enseignees: form.matieres_enseignees,
        });
        notify("Enseignant créé et compte utilisateur généré.", "success");
      }
      setModalOpen(false);
      reload();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ens) => {
    if (!window.confirm(`Supprimer l'enseignant ${ens.nom_complet} ?`)) return;
    try {
      await enseignantsApi.remove(ens.id);
      notify("Enseignant supprimé.", "success");
      reload();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enseignants"
        subtitle="Gestion du corps enseignant, matières dispensées, plannings et contrats."
        actions={
          <button onClick={openCreate} className="btn-primary">
            <Plus size={16} /> Ajouter un enseignant
          </button>
        }
      />

      <DataTable
        loading={loading}
        rows={data?.results || []}
        columns={[
          {
            key: "matricule",
            header: "Matricule",
            render: (r) => (
              <span className="font-mono text-xs font-semibold text-brand-700">
                {r.matricule}
              </span>
            ),
          },
          {
            key: "nom_complet",
            header: "Nom & Prénom",
            render: (r) => (
              <div>
                <span className="font-bold text-slate-900">{r.nom_complet}</span>
                <span className="ml-2 text-xs text-slate-400">
                  {r.sexe === "M" ? "Masculin" : "Féminin"}
                </span>
                {r.telephone && <div className="text-xs text-slate-500">{r.telephone}</div>}
              </div>
            ),
          },
          {
            key: "grade_academique",
            header: "Grade / Diplôme",
            render: (r) => (
              <div>
                <span className="font-medium text-slate-800">{r.grade_academique || "—"}</span>
                {r.diplome && <div className="text-xs text-slate-400">{r.diplome}</div>}
              </div>
            ),
          },
          {
            key: "matieres",
            header: "Matières enseignées",
            render: (r) => (
              <div className="flex flex-wrap gap-1">
                {(r.matieres_enseignees_noms || []).map((m, idx) => (
                  <span key={idx} className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
                    {m}
                  </span>
                ))}
                {(!r.matieres_enseignees_noms || r.matieres_enseignees_noms.length === 0) && (
                  <span className="text-xs text-slate-400">Non affecté</span>
                )}
              </div>
            ),
          },
          {
            key: "actions",
            header: "Actions",
            render: (r) => (
              <div className="flex items-center justify-end gap-1">
                <button
                  onClick={() => navigate(`/emploi-du-temps`)}
                  className="flex items-center gap-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
                  title="Consulter l'emploi du temps"
                >
                  <CalendarClock size={16} />
                </button>
                <button
                  onClick={() => openEdit(r)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
                  title="Modifier l'enseignant"
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

      {/* MODAL AJOUT / MODIFICATION ENSEIGNANT */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTeacher ? `Modifier l'enseignant : ${editingTeacher.nom_complet}` : "Ajouter un enseignant"}
        width="max-w-2xl"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>Annuler</button>
            <button className="btn-primary" disabled={saving} form="ens-form">
              {saving && <Loader2 size={16} className="animate-spin" />}
              {editingTeacher ? "Enregistrer les modifications" : "Créer l'enseignant"}
            </button>
          </>
        }
      >
        <form id="ens-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Nom de famille</label>
              <input
                required
                className="input"
                value={form.nom}
                onChange={(e) => setForm({ ...form, nom: e.target.value })}
                placeholder="Ex: Traoré"
              />
            </div>
            <div>
              <label className="label">Prénom</label>
              <input
                required
                className="input"
                value={form.prenom}
                onChange={(e) => setForm({ ...form, prenom: e.target.value })}
                placeholder="Ex: Awa"
              />
            </div>

            {!editingTeacher && (
              <div className="sm:col-span-2">
                <label className="label">Email de connexion (authentification)</label>
                <input
                  required
                  type="email"
                  className="input"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="Ex: a.traore@etablissement.ml"
                />
              </div>
            )}

            <div>
              <label className="label">Sexe</label>
              <select
                className="input"
                value={form.sexe}
                onChange={(e) => setForm({ ...form, sexe: e.target.value })}
              >
                <option value="F">Féminin</option>
                <option value="M">Masculin</option>
              </select>
            </div>

            <div>
              <label className="label">Numéro de téléphone</label>
              <input
                className="input"
                value={form.telephone}
                onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                placeholder="Ex: +223 70 00 00 00"
              />
            </div>

            <div>
              <label className="label">Grade académique</label>
              <input
                className="input"
                value={form.grade_academique}
                onChange={(e) => setForm({ ...form, grade_academique: e.target.value })}
                placeholder="Ex: Professeur certifié, Maître-assistant"
              />
            </div>

            <div>
              <label className="label">Type de contrat</label>
              <select
                className="input"
                value={form.type_contrat}
                onChange={(e) => setForm({ ...form, type_contrat: e.target.value })}
              >
                <option value="CDI">CDI (Contrat à durée indéterminée)</option>
                <option value="CDD">CDD (Contrat à durée déterminée)</option>
                <option value="Vacataire">Vacataire / Prestataire horaire</option>
                <option value="Stagiaire">Stagiaire</option>
              </select>
            </div>

            <div>
              <label className="label">Dernier diplôme</label>
              <input
                className="input"
                value={form.diplome}
                onChange={(e) => setForm({ ...form, diplome: e.target.value })}
                placeholder="Ex: Master en Mathématiques, CAPES"
              />
            </div>

            <div>
              <label className="label">Spécialité</label>
              <input
                className="input"
                value={form.specialite}
                onChange={(e) => setForm({ ...form, specialite: e.target.value })}
                placeholder="Ex: Algèbre & Géométrie, Littérature"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="label">Adresse de résidence</label>
              <input
                className="input"
                value={form.adresse}
                onChange={(e) => setForm({ ...form, adresse: e.target.value })}
                placeholder="Ex: Commune IV, Bamako"
              />
            </div>
          </div>

          <div>
            <label className="label">Matières enseignées (sélection multiple)</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-3">
              {matieres.map((m) => {
                const checked = form.matieres_enseignees.includes(m.id);
                return (
                  <label
                    key={m.id}
                    className={`flex items-center gap-2 rounded-lg border p-2 text-xs font-medium transition-colors cursor-pointer ${
                      checked
                        ? "border-brand-300 bg-brand-50 text-brand-900 shadow-2xs"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMatiere(m.id)}
                      className="rounded text-brand-600"
                    />
                    <span className="truncate">{m.nom}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
