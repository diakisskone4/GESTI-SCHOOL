import { useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import Modal from "../../components/ui/Modal";
import DataTable from "../../components/ui/DataTable";
import { useFetch } from "../../hooks/useFetch";
import { useToast, extractErrorMessage } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { plateformeApi } from "../../api/endpoints";
import { dateHeureFr, depuis } from "./commun";

const VIDE = { first_name: "", last_name: "", email: "", telephone: "", password: "" };

/** Membres de l'équipe développeurs : un membre peut en ajouter d'autres ou les désactiver. */
export default function ConsoleEquipe() {
  const { notify } = useToast();
  const { user } = useAuth();
  const { data, loading, reload } = useFetch(() => plateformeApi.equipe.list(), []);
  const { data: journal, loading: journalEnCours, reload: rechargerJournal } = useFetch(() => plateformeApi.journal.list({ page_size: 100 }), []);
  const membres = data?.results || [];
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const creer = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await plateformeApi.equipe.create(form);
      notify("Membre ajouté à l'équipe.", "success");
      setForm(null);
      reload();
      rechargerJournal();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const basculer = async (membre) => {
    try {
      await plateformeApi.equipe.update(membre.id, { is_active: !membre.is_active });
      notify(membre.is_active ? "Compte désactivé." : "Compte réactivé.", "success");
      reload();
      rechargerJournal();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    }
  };

  const set = (champ) => (e) => setForm({ ...form, [champ]: e.target.value });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Équipe"
        subtitle="Comptes ayant accès à cette console. Ils ne voient jamais les données internes des établissements."
        actions={<button className="btn-primary" onClick={() => setForm(VIDE)}><UserPlus size={16} /> Ajouter un membre</button>}
      />

      <DataTable
        loading={loading}
        rows={membres}
        columns={[
          { key: "full_name", header: "Nom", render: (m) => <span className="font-semibold text-slate-800">{m.full_name}{m.id === user?.id && <span className="ml-2 text-xs text-slate-400">(vous)</span>}</span> },
          { key: "email", header: "Email" },
          { key: "date_derniere_activite", header: "Dernière connexion", render: (m) => <span title={dateHeureFr(m.date_derniere_activite)}>{depuis(m.date_derniere_activite)}</span> },
          {
            key: "is_active",
            header: "Statut",
            render: (m) => (
              <span className={`badge ${m.is_active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>{m.is_active ? "Actif" : "Désactivé"}</span>
            ),
          },
          {
            key: "actions",
            header: "",
            render: (m) => m.id !== user?.id && (
              <button className="btn-ghost text-xs" onClick={() => basculer(m)}>{m.is_active ? "Désactiver" : "Réactiver"}</button>
            ),
          },
        ]}
      />

      <div>
        <h2 className="mb-1 text-base font-semibold text-slate-800">Journal de la console</h2>
        <p className="mb-3 text-sm text-slate-500">Les 100 dernières actions de l'équipe : créations, prolongations, activations, désactivations...</p>
        <DataTable
          loading={journalEnCours && !journal}
          rows={journal?.results || []}
          empty="Aucune action pour le moment."
          columns={[
            { key: "horodatage", header: "Date", render: (a) => <span className="tabular-nums text-slate-500">{dateHeureFr(a.horodatage)}</span> },
            { key: "auteur_nom", header: "Membre" },
            { key: "action_label", header: "Action", render: (a) => <span className="font-semibold text-slate-700">{a.action_label}</span> },
            { key: "etablissement_nom", header: "Établissement", render: (a) => a.etablissement_nom || <span className="text-slate-400">—</span> },
            { key: "details", header: "Détails", render: (a) => <span className="text-slate-500">{a.details}</span> },
          ]}
        />
      </div>

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title="Ajouter un membre de l'équipe"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setForm(null)}>Annuler</button>
            <button className="btn-primary" form="equipe-form" disabled={saving}>{saving && <Loader2 size={16} className="animate-spin" />} Ajouter</button>
          </>
        }
      >
        {form && (
          <form id="equipe-form" onSubmit={creer} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><label className="label">Prénom</label><input required className="input" value={form.first_name} onChange={set("first_name")} /></div>
            <div><label className="label">Nom</label><input required className="input" value={form.last_name} onChange={set("last_name")} /></div>
            <div className="sm:col-span-2"><label className="label">Email</label><input required type="email" className="input" value={form.email} onChange={set("email")} /></div>
            <div className="sm:col-span-2"><label className="label">Mot de passe</label><input required type="password" minLength={8} className="input" value={form.password} onChange={set("password")} /></div>
          </form>
        )}
      </Modal>
    </div>
  );
}
