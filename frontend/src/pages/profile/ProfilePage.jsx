import { useState } from "react";
import PageHeader from "../../components/ui/PageHeader";
import { useAuth, ROLE_LABELS } from "../../context/AuthContext";
import { useFetch } from "../../hooks/useFetch";
import { useToast, extractErrorMessage } from "../../context/ToastContext";
import { authApi, etablissementsApi } from "../../api/endpoints";

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { notify } = useToast();
  const [form, setForm] = useState({ first_name: user?.first_name, last_name: user?.last_name, telephone: user?.telephone || "" });
  const [saving, setSaving] = useState(false);

  const estPersonnel = !user?.est_eleve && !user?.est_parent;
  const { data: etablissementsData } = useFetch(
    () => (estPersonnel ? etablissementsApi.list() : Promise.resolve({ results: [] })),
    [estPersonnel],
  );
  const etablissements = etablissementsData?.results || [];
  const [etablissementCourant, setEtablissementCourant] = useState(user?.etablissement_courant || "");
  const [savingEtab, setSavingEtab] = useState(false);

  const handleSaveEtablissement = async (e) => {
    e.preventDefault();
    setSavingEtab(true);
    try {
      await authApi.updateMe({ etablissement_courant: etablissementCourant || null });
      await refreshUser();
      notify("Établissement courant mis à jour.", "success");
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setSavingEtab(false);
    }
  };

  const [pwdForm, setPwdForm] = useState({ ancien_mot_de_passe: "", nouveau_mot_de_passe: "" });
  const [pwdSaving, setPwdSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await authApi.updateMe(form);
      await refreshUser();
      notify("Profil mis à jour.", "success");
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const handlePwd = async (e) => {
    e.preventDefault();
    setPwdSaving(true);
    try {
      await authApi.changePassword(pwdForm);
      notify("Mot de passe changé.", "success");
      setPwdForm({ ancien_mot_de_passe: "", nouveau_mot_de_passe: "" });
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setPwdSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title="Mon profil" subtitle={ROLE_LABELS[user?.role]} />

      {estPersonnel && (
        <form onSubmit={handleSaveEtablissement} className="card mb-6 space-y-4 p-6">
          <p className="text-sm font-semibold text-slate-700">Établissement courant</p>
          {!user?.etablissement_courant && (
            <div className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-700">
              Aucun établissement sélectionné : la création de classes, niveaux, types de frais, etc. échouera tant que ce champ n'est pas renseigné.
            </div>
          )}
          <div>
            <label className="label">Établissement</label>
            <select className="input" value={etablissementCourant} onChange={(e) => setEtablissementCourant(e.target.value)}>
              <option value="">Sélectionner...</option>
              {etablissements.map((etab) => <option key={etab.id} value={etab.id}>{etab.nom}</option>)}
            </select>
          </div>
          <button className="btn-primary" disabled={savingEtab}>Enregistrer</button>
        </form>
      )}

      <form onSubmit={handleSave} className="card mb-6 space-y-4 p-6">
        <p className="text-sm font-semibold text-slate-700">Informations personnelles</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Prénom</label>
            <input className="input" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
          </div>
          <div>
            <label className="label">Nom</label>
            <input className="input" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">Téléphone</label>
          <input className="input" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
        </div>
        <div>
          <label className="label">Email</label>
          <input disabled className="input opacity-60" value={user?.email} />
        </div>
        <button className="btn-primary" disabled={saving}>Enregistrer</button>
      </form>

      <form onSubmit={handlePwd} className="card space-y-4 p-6">
        <p className="text-sm font-semibold text-slate-700">Changer le mot de passe</p>
        <div>
          <label className="label">Mot de passe actuel</label>
          <input required type="password" className="input" value={pwdForm.ancien_mot_de_passe} onChange={(e) => setPwdForm({ ...pwdForm, ancien_mot_de_passe: e.target.value })} />
        </div>
        <div>
          <label className="label">Nouveau mot de passe</label>
          <input required type="password" className="input" value={pwdForm.nouveau_mot_de_passe} onChange={(e) => setPwdForm({ ...pwdForm, nouveau_mot_de_passe: e.target.value })} />
        </div>
        <button className="btn-primary" disabled={pwdSaving}>Changer le mot de passe</button>
      </form>
    </div>
  );
}
