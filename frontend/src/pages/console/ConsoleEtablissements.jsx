import { useState } from "react";
import {
  Ban, CalendarPlus, CheckCircle2, ChevronLeft, ChevronRight, KeyRound, Loader2, Plus, Power, Search, Settings2, Trash2, UserPlus,
} from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import Modal from "../../components/ui/Modal";
import DataTable from "../../components/ui/DataTable";
import { useFetch } from "../../hooks/useFetch";
import { useToast, extractErrorMessage } from "../../context/ToastContext";
import { plateformeApi } from "../../api/endpoints";

const DUREES = [3, 6, 12, 24];
const TYPES = [
  { value: "prescolaire", label: "Préscolaire" },
  { value: "primaire", label: "Primaire" },
  { value: "secondaire", label: "Secondaire" },
  { value: "mixte", label: "Mixte (plusieurs cycles)" },
];
const STATUTS = {
  actif: { label: "Actif", classe: "bg-emerald-50 text-emerald-600" },
  expire: { label: "Expiré", classe: "bg-amber-50 text-amber-700" },
  suspendu: { label: "Désactivé", classe: "bg-rose-50 text-rose-600" },
};

const ADMIN_VIDE = { first_name: "", last_name: "", email: "", telephone: "", password: "" };
const NOUVEAU = {
  nom: "", sigle: "", type_etablissement: "mixte", ville: "", pays: "Mali", telephone: "", email: "",
  duree_mois: 12, administrateur: ADMIN_VIDE,
};

const dateFr = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");

/** Mot de passe provisoire lisible (l'administrateur devra le changer à sa première connexion). */
function genererMotDePasse() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const valeurs = crypto.getRandomValues(new Uint32Array(10));
  return `${Array.from(valeurs, (v) => alphabet[v % alphabet.length]).join("")}!7`;
}

function ChoixDuree({ value, onChange }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {DUREES.map((d) => (
        <button
          type="button"
          key={d}
          onClick={() => onChange(d)}
          className={`rounded-xl border px-2 py-2.5 text-sm font-semibold ${
            value === d ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          {d} mois
        </button>
      ))}
    </div>
  );
}

function ChampsAdministrateur({ admin, onChange }) {
  const set = (champ) => (e) => onChange({ ...admin, [champ]: e.target.value });
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div><label className="label">Prénom</label><input required className="input" value={admin.first_name} onChange={set("first_name")} /></div>
      <div><label className="label">Nom</label><input required className="input" value={admin.last_name} onChange={set("last_name")} /></div>
      <div><label className="label">Email (identifiant de connexion)</label><input required type="email" className="input" value={admin.email} onChange={set("email")} /></div>
      <div><label className="label">Téléphone</label><input className="input" value={admin.telephone} onChange={set("telephone")} /></div>
      <div className="sm:col-span-2">
        <label className="label">Mot de passe provisoire</label>
        <div className="flex gap-2">
          <input required minLength={8} className="input font-mono" value={admin.password} onChange={set("password")} />
          <button type="button" className="btn-secondary shrink-0" onClick={() => onChange({ ...admin, password: genererMotDePasse() })}>
            <KeyRound size={15} /> Générer
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-400">Communiquez-le à l'administrateur : il devra le changer à sa première connexion.</p>
      </div>
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

export default function ConsoleEtablissements() {
  const { notify } = useToast();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, loading, reload } = useFetch(
    () => plateformeApi.etablissements.list({ search: search || undefined, page }),
    [search, page],
  );
  const etablissements = data?.results || [];

  const [creation, setCreation] = useState(null);       // formulaire de création
  const [identifiants, setIdentifiants] = useState(null); // identifiants à transmettre après création
  const [renouvellement, setRenouvellement] = useState(null); // { etab, duree }
  const [detail, setDetail] = useState(null);           // établissement ouvert dans le panneau « Gérer »
  const [occupe, setOccupe] = useState(null);

  const executer = async (cle, action, message) => {
    setOccupe(cle);
    try {
      const resultat = await action();
      if (message) notify(message, "success");
      reload();
      return resultat;
    } catch (err) {
      notify(extractErrorMessage(err), "error");
      return null;
    } finally {
      setOccupe(null);
    }
  };

  const creer = async (e) => {
    e.preventDefault();
    const etab = await executer("creation", () => plateformeApi.etablissements.create(creation), "Établissement créé.");
    if (etab) {
      setIdentifiants({ etablissement: etab.nom, email: creation.administrateur.email, password: creation.administrateur.password });
      setCreation(null);
    }
  };

  const basculerAcces = (etab) => {
    const actif = etab.abonnement?.actif !== false;
    if (actif && !window.confirm(`Désactiver « ${etab.nom} » ? Tous ses utilisateurs perdront l'accès immédiatement.`)) return;
    executer(
      `acces-${etab.id}`,
      () => (actif ? plateformeApi.etablissements.desactiver(etab.id) : plateformeApi.etablissements.activer(etab.id)),
      actif ? "Accès désactivé." : "Accès réactivé.",
    );
  };

  const renouveler = async () => {
    const { etab, duree } = renouvellement;
    const ok = await executer("renouveler", () => plateformeApi.etablissements.renouveler(etab.id, duree), `Accès prolongé de ${duree} mois.`);
    if (ok) setRenouvellement(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Établissements clients"
        subtitle="Créez les établissements et leur administrateur, gérez la durée d'accès et activez ou désactivez-les."
        actions={
          <button onClick={() => setCreation(NOUVEAU)} className="btn-primary">
            <Plus size={16} /> Nouvel établissement
          </button>
        }
      />

      <div className="card flex flex-wrap items-center gap-4 p-5">
        <div className="relative min-w-[240px] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Rechercher par nom, sigle, ville, email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="ml-auto text-xs text-slate-500"><strong>{data?.count ?? 0}</strong> établissement(s)</div>
      </div>

      <DataTable
        loading={loading}
        rows={etablissements}
        empty="Aucun établissement. Créez le premier avec « Nouvel établissement »."
        columns={[
          {
            key: "nom",
            header: "Établissement",
            render: (r) => (
              <div>
                <div className="font-semibold text-slate-800">{r.nom}</div>
                <div className="text-xs text-slate-400">{[r.sigle, r.ville].filter(Boolean).join(" · ")}</div>
              </div>
            ),
          },
          {
            key: "administrateurs",
            header: "Administrateur",
            render: (r) => r.administrateurs.length
              ? r.administrateurs.map((a) => <div key={a.id} className="text-sm">{a.nom}<div className="text-xs text-slate-400">{a.email}</div></div>)
              : <span className="text-slate-400">—</span>,
          },
          {
            key: "volumes",
            header: "Volumes",
            render: (r) => <span className="text-sm text-slate-600">{r.nb_eleves} élèves · {r.nb_utilisateurs} comptes</span>,
          },
          {
            key: "abonnement",
            header: "Accès",
            render: (r) => {
              const ab = r.abonnement;
              if (!ab) return <span className="badge bg-slate-100 text-slate-500">Sans abonnement</span>;
              const s = STATUTS[ab.statut];
              return (
                <div>
                  <span className={`badge ${s.classe}`}>{s.label}</span>
                  <div className="mt-1 text-xs text-slate-500">
                    jusqu'au {dateFr(ab.date_fin)}
                    {ab.statut === "actif" && <span className={ab.jours_restants <= 30 ? " font-semibold text-amber-600" : ""}> ({ab.jours_restants} j)</span>}
                  </div>
                </div>
              );
            },
          },
          {
            key: "actions",
            header: "",
            render: (r) => {
              const actif = r.abonnement?.actif !== false;
              return (
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => setRenouvellement({ etab: r, duree: r.abonnement?.duree_mois || 12 })}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-600"
                    title="Prolonger l'accès (3, 6, 12 ou 24 mois)"
                  >
                    <CalendarPlus size={16} />
                  </button>
                  <button
                    onClick={() => basculerAcces(r)}
                    disabled={occupe === `acces-${r.id}`}
                    className={`rounded-lg p-1.5 ${actif ? "text-slate-400 hover:bg-rose-50 hover:text-rose-600" : "text-emerald-600 hover:bg-emerald-50"}`}
                    title={actif ? "Désactiver l'accès" : "Réactiver l'accès"}
                  >
                    {occupe === `acces-${r.id}` ? <Loader2 size={16} className="animate-spin" /> : actif ? <Ban size={16} /> : <Power size={16} />}
                  </button>
                  <button onClick={() => setDetail(r)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600" title="Gérer">
                    <Settings2 size={16} />
                  </button>
                </div>
              );
            },
          },
        ]}
      />

      {(data?.previous || data?.next) && (
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" disabled={!data?.previous} onClick={() => setPage(page - 1)}><ChevronLeft size={15} /> Précédent</button>
          <button className="btn-secondary" disabled={!data?.next} onClick={() => setPage(page + 1)}>Suivant <ChevronRight size={15} /></button>
        </div>
      )}

      {/* --- Création ------------------------------------------------------ */}
      <Modal
        open={!!creation}
        onClose={() => setCreation(null)}
        title="Nouvel établissement"
        width="max-w-3xl"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setCreation(null)}>Annuler</button>
            <button className="btn-primary" form="console-creation" disabled={occupe === "creation"}>
              {occupe === "creation" && <Loader2 size={16} className="animate-spin" />} Créer l'établissement
            </button>
          </>
        }
      >
        {creation && (
          <form id="console-creation" onSubmit={creer} className="space-y-5">
            <Section title="Établissement">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2"><label className="label">Nom</label><input required maxLength={200} className="input" value={creation.nom} onChange={(e) => setCreation({ ...creation, nom: e.target.value })} /></div>
                <div><label className="label">Sigle</label><input required maxLength={20} className="input uppercase" value={creation.sigle} onChange={(e) => setCreation({ ...creation, sigle: e.target.value.toUpperCase() })} /></div>
                <div>
                  <label className="label">Type</label>
                  <select className="input" value={creation.type_etablissement} onChange={(e) => setCreation({ ...creation, type_etablissement: e.target.value })}>
                    {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div><label className="label">Ville</label><input className="input" value={creation.ville} onChange={(e) => setCreation({ ...creation, ville: e.target.value })} /></div>
                <div><label className="label">Pays</label><input className="input" value={creation.pays} onChange={(e) => setCreation({ ...creation, pays: e.target.value })} /></div>
                <div><label className="label">Téléphone</label><input className="input" value={creation.telephone} onChange={(e) => setCreation({ ...creation, telephone: e.target.value })} /></div>
                <div><label className="label">Email</label><input type="email" className="input" value={creation.email} onChange={(e) => setCreation({ ...creation, email: e.target.value })} /></div>
              </div>
            </Section>
            <Section title="Durée d'accès">
              <ChoixDuree value={creation.duree_mois} onChange={(d) => setCreation({ ...creation, duree_mois: d })} />
            </Section>
            <Section title="Compte administrateur de l'établissement">
              <ChampsAdministrateur admin={creation.administrateur} onChange={(a) => setCreation({ ...creation, administrateur: a })} />
            </Section>
          </form>
        )}
      </Modal>

      {/* --- Identifiants à transmettre --------------------------------------- */}
      <Modal
        open={!!identifiants}
        onClose={() => setIdentifiants(null)}
        title="Établissement créé"
        footer={<button className="btn-primary" onClick={() => setIdentifiants(null)}>J'ai noté les identifiants</button>}
      >
        {identifiants && (
          <div className="space-y-3 text-sm">
            <p className="flex items-center gap-2 text-emerald-600"><CheckCircle2 size={17} /> « {identifiants.etablissement} » est prêt.</p>
            <p className="text-slate-600">Transmettez ces identifiants à l'administrateur. Le mot de passe ne sera plus affiché.</p>
            <div className="rounded-xl bg-slate-50 p-4 font-mono text-sm">
              <div>Email : {identifiants.email}</div>
              <div>Mot de passe : {identifiants.password}</div>
            </div>
            <button
              className="btn-secondary text-xs"
              onClick={() => navigator.clipboard?.writeText(`Email : ${identifiants.email}\nMot de passe : ${identifiants.password}`)
                .then(() => notify("Copié.", "success"))}
            >
              Copier
            </button>
          </div>
        )}
      </Modal>

      {/* --- Renouvellement ------------------------------------------------- */}
      <Modal
        open={!!renouvellement}
        onClose={() => setRenouvellement(null)}
        title={renouvellement ? `Prolonger l'accès de « ${renouvellement.etab.nom} »` : ""}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setRenouvellement(null)}>Annuler</button>
            <button className="btn-primary" onClick={renouveler} disabled={occupe === "renouveler"}>
              {occupe === "renouveler" && <Loader2 size={16} className="animate-spin" />} Prolonger
            </button>
          </>
        }
      >
        {renouvellement && (
          <div className="space-y-4 text-sm text-slate-600">
            <ChoixDuree value={renouvellement.duree} onChange={(d) => setRenouvellement({ ...renouvellement, duree: d })} />
            <p>
              {renouvellement.etab.abonnement?.statut === "actif"
                ? `La durée s'ajoute à la fin de l'accès en cours (${dateFr(renouvellement.etab.abonnement.date_fin)}).`
                : "L'accès repart d'aujourd'hui et l'établissement est réactivé."}
            </p>
          </div>
        )}
      </Modal>

      <PanneauGestion
        etablissement={detail}
        onClose={() => setDetail(null)}
        onChange={(etab) => { setDetail(etab); reload(); }}
        onDeleted={() => { setDetail(null); reload(); }}
      />
    </div>
  );
}

/** Panneau « Gérer » : informations, notes internes, administrateurs, suppression définitive. */
function PanneauGestion({ etablissement, onClose, onChange, onDeleted }) {
  const { notify } = useToast();
  const [infos, setInfos] = useState(null);
  const [notes, setNotes] = useState("");
  const [admin, setAdmin] = useState(null);
  const [confirmation, setConfirmation] = useState("");
  const [occupe, setOccupe] = useState(null);
  const [courant, setCourant] = useState(null);

  // Réinitialise le panneau à chaque ouverture sur un autre établissement
  if (etablissement && etablissement.id !== courant) {
    setCourant(etablissement.id);
    setInfos({
      nom: etablissement.nom, sigle: etablissement.sigle, ville: etablissement.ville,
      pays: etablissement.pays, telephone: etablissement.telephone, email: etablissement.email,
    });
    setNotes(etablissement.abonnement?.notes || "");
    setAdmin(null);
    setConfirmation("");
  }
  if (!etablissement && courant) setCourant(null);

  const executer = async (cle, action, message) => {
    setOccupe(cle);
    try {
      const resultat = await action();
      notify(message, "success");
      return resultat;
    } catch (err) {
      notify(extractErrorMessage(err), "error");
      return null;
    } finally {
      setOccupe(null);
    }
  };

  const enregistrerInfos = async (e) => {
    e.preventDefault();
    const etab = await executer("infos", () => plateformeApi.etablissements.update(etablissement.id, infos), "Informations enregistrées.");
    if (etab) onChange(etab);
  };
  const enregistrerNotes = async () => {
    const etab = await executer("notes", () => plateformeApi.etablissements.notes(etablissement.id, notes), "Notes enregistrées.");
    if (etab) onChange(etab);
  };
  const ajouterAdmin = async (e) => {
    e.preventDefault();
    const etab = await executer("admin", () => plateformeApi.etablissements.ajouterAdministrateur(etablissement.id, admin), "Administrateur ajouté.");
    if (etab) {
      window.alert(`Identifiants à transmettre :\nEmail : ${admin.email}\nMot de passe : ${admin.password}`);
      setAdmin(null);
      onChange(etab);
    }
  };
  const supprimer = async () => {
    const ok = await executer("suppression", () => plateformeApi.etablissements.remove(etablissement.id, confirmation), "Établissement supprimé.");
    if (ok) onDeleted();
  };

  const set = (champ) => (e) => setInfos({ ...infos, [champ]: e.target.value });

  return (
    <Modal open={!!etablissement} onClose={onClose} title={etablissement ? `Gérer « ${etablissement.nom} »` : ""} width="max-w-3xl">
      {etablissement && infos && (
        <div className="space-y-5">
          <form onSubmit={enregistrerInfos}>
            <Section title="Informations">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2"><label className="label">Nom</label><input required className="input" value={infos.nom} onChange={set("nom")} /></div>
                <div><label className="label">Sigle</label><input required className="input" value={infos.sigle} onChange={set("sigle")} /></div>
                <div><label className="label">Ville</label><input className="input" value={infos.ville} onChange={set("ville")} /></div>
                <div><label className="label">Téléphone</label><input className="input" value={infos.telephone} onChange={set("telephone")} /></div>
                <div><label className="label">Email</label><input type="email" className="input" value={infos.email} onChange={set("email")} /></div>
              </div>
              <button className="btn-primary text-sm" disabled={occupe === "infos"}>
                {occupe === "infos" && <Loader2 size={15} className="animate-spin" />} Enregistrer
              </button>
            </Section>
          </form>

          <Section title="Notes internes de l'équipe">
            <textarea rows={3} className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Contact, paiements, contrat..." />
            <button className="btn-secondary text-sm" onClick={enregistrerNotes} disabled={occupe === "notes"}>Enregistrer les notes</button>
          </Section>

          <Section title="Administrateurs">
            <ul className="space-y-1 text-sm">
              {etablissement.administrateurs.map((a) => (
                <li key={a.id}>{a.nom} — <span className="text-slate-500">{a.email}</span>{!a.actif && <span className="badge ml-2 bg-slate-100 text-slate-500">inactif</span>}</li>
              ))}
            </ul>
            {admin ? (
              <form onSubmit={ajouterAdmin} className="space-y-3">
                <ChampsAdministrateur admin={admin} onChange={setAdmin} />
                <div className="flex gap-2">
                  <button className="btn-primary text-sm" disabled={occupe === "admin"}>Créer le compte</button>
                  <button type="button" className="btn-secondary text-sm" onClick={() => setAdmin(null)}>Annuler</button>
                </div>
              </form>
            ) : (
              <button className="btn-secondary text-sm" onClick={() => setAdmin({ ...ADMIN_VIDE, password: genererMotDePasse() })}>
                <UserPlus size={15} /> Ajouter un administrateur
              </button>
            )}
          </Section>

          <fieldset className="space-y-3 rounded-xl border border-rose-200 bg-rose-50/40 p-4">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-rose-600">Zone dangereuse</legend>
            <p className="text-sm text-slate-600">
              La suppression efface définitivement <strong>toutes</strong> les données de l'établissement (élèves, notes, finances...).
              Pour simplement couper l'accès, utilisez plutôt « Désactiver ».
            </p>
            <label className="label">Tapez le sigle <strong>{etablissement.sigle}</strong> pour confirmer</label>
            <div className="flex gap-2">
              <input className="input" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
              <button
                className="btn-danger shrink-0"
                onClick={supprimer}
                disabled={confirmation.trim().toUpperCase() !== etablissement.sigle.toUpperCase() || occupe === "suppression"}
              >
                <Trash2 size={15} /> Supprimer
              </button>
            </div>
          </fieldset>
        </div>
      )}
    </Modal>
  );
}
