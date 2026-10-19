import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Ban, CalendarPlus, CheckCircle2, Copy, Download, KeyRound, Loader2, Plus, Power, Search, Settings2, Trash2, UserPlus,
} from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import Modal from "../../components/ui/Modal";
import DataTable from "../../components/ui/DataTable";
import { useToast, extractErrorMessage } from "../../context/ToastContext";
import { plateformeApi } from "../../api/endpoints";
import {
  BarreActualisation, ErreurChargement, STATUTS, StatutBadge, dateFr, dateHeureFr, depuis, nombreFr, statutAffiche,
  useDonneesConsole,
} from "./commun";

const DUREES = [3, 6, 12, 24];
const TYPES = [
  { value: "prescolaire", label: "Préscolaire" },
  { value: "primaire", label: "Primaire" },
  { value: "secondaire", label: "Secondaire" },
  { value: "mixte", label: "Mixte (plusieurs cycles)" },
];
const FILTRES = [
  { cle: "", label: "Tous" },
  { cle: "actif", label: "Actifs" },
  { cle: "a_renouveler", label: "À renouveler" },
  { cle: "expire", label: "Expirés" },
  { cle: "suspendu", label: "Désactivés" },
  { cle: "sans_abonnement", label: "Sans abonnement" },
];
const TRIS = [
  { cle: "nom", label: "Nom (A → Z)" },
  { cle: "abonnement__date_fin", label: "Fin d'accès la plus proche" },
  { cle: "-nb_eleves", label: "Plus d'élèves" },
  { cle: "-derniere_activite", label: "Activité la plus récente" },
  { cle: "-created_at", label: "Ajout le plus récent" },
];

const pluriel = (n, mot) => `${nombreFr(n)} ${mot}${n > 1 ? "s" : ""}`;

const ADMIN_VIDE = { first_name: "", last_name: "", email: "", telephone: "", password: "" };
const NOUVEAU = {
  nom: "", sigle: "", type_etablissement: "mixte", ville: "", pays: "Mali", telephone: "", email: "",
  duree_mois: 12, administrateur: ADMIN_VIDE,
};

/** Mot de passe provisoire lisible (l'administrateur devra le changer à sa première connexion). */
function genererMotDePasse() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const valeurs = crypto.getRandomValues(new Uint32Array(10));
  return `${Array.from(valeurs, (v) => alphabet[v % alphabet.length]).join("")}!7`;
}

/** Export CSV (séparateur « ; » et BOM pour une ouverture correcte dans Excel). */
function exporterCsv(etablissements) {
  const entetes = ["Nom", "Sigle", "Ville", "Statut", "Durée (mois)", "Fin d'accès", "Jours restants",
    "Élèves", "Comptes", "Dernière connexion", "Administrateurs", "Ajouté le"];
  const lignes = etablissements.map((e) => [
    e.nom, e.sigle, e.ville, STATUTS[statutAffiche(e.abonnement)].label, e.abonnement?.duree_mois ?? "",
    e.abonnement?.date_fin ?? "", e.abonnement?.jours_restants ?? "", e.nb_eleves, e.nb_utilisateurs,
    e.derniere_activite ? new Date(e.derniere_activite).toLocaleString("fr-FR") : "",
    e.administrateurs.map((a) => `${a.nom} <${a.email}>`).join(", "),
    new Date(e.created_at).toLocaleDateString("fr-FR"),
  ]);
  const csv = [entetes, ...lignes]
    .map((l) => l.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const lien = Object.assign(document.createElement("a"), {
    href: url, download: `etablissements-${new Date().toISOString().slice(0, 10)}.csv`,
  });
  lien.click();
  URL.revokeObjectURL(url);
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

function IdentifiantsCrees({ identifiants }) {
  const { notify } = useToast();
  const texte = `Gesti-Scolaire — ${identifiants.etablissement}\nAdresse : ${window.location.origin}/connexion\nEmail : ${identifiants.email}\nMot de passe provisoire : ${identifiants.password}`;
  return (
    <div className="space-y-3 text-sm">
      <p className="flex items-center gap-2 font-semibold text-emerald-700"><CheckCircle2 size={17} /> {identifiants.titre}</p>
      <p className="text-slate-600">Transmettez ces identifiants à l'administrateur. Le mot de passe ne sera plus affiché.</p>
      <pre className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4 font-mono text-xs text-slate-700">{texte}</pre>
      <button
        className="btn-secondary text-xs"
        onClick={() => navigator.clipboard?.writeText(texte).then(() => notify("Identifiants copiés.", "success"))}
      >
        <Copy size={14} /> Copier
      </button>
    </div>
  );
}

export default function ConsoleEtablissements() {
  const { notify } = useToast();
  const [params, setParams] = useSearchParams();
  const statut = params.get("statut") || "";
  const tri = params.get("tri") || "nom";
  const [saisie, setSaisie] = useState(params.get("q") || "");
  const [recherche, setRecherche] = useState(saisie);

  // Recherche lancée 300 ms après la dernière frappe
  useEffect(() => {
    const t = setTimeout(() => setRecherche(saisie.trim()), 300);
    return () => clearTimeout(t);
  }, [saisie]);

  const changerParam = (cle, valeur) => {
    const suivants = new URLSearchParams(params);
    if (valeur) suivants.set(cle, valeur); else suivants.delete(cle);
    setParams(suivants, { replace: true });
  };

  const { data, erreur, enCours, majLe, actualiser } = useDonneesConsole(
    () => plateformeApi.etablissements.list({ search: recherche || undefined, statut: statut || undefined, ordering: tri, page_size: 200 }),
    [recherche, statut, tri],
  );
  const { data: stats, actualiser: actualiserStats } = useDonneesConsole(() => plateformeApi.statistiques(), [], 0);
  const etablissements = useMemo(() => data?.results || [], [data]);
  const recharger = () => { actualiser(); actualiserStats(); };

  const [creation, setCreation] = useState(null);
  const [identifiants, setIdentifiants] = useState(null);
  const [renouvellement, setRenouvellement] = useState(null); // { etab, duree }
  const [desactivation, setDesactivation] = useState(null);   // { etab, motif }
  const [detail, setDetail] = useState(null);
  const [occupe, setOccupe] = useState(null);

  // Le panneau ouvert suit les données rechargées (après une prolongation, une désactivation...)
  useEffect(() => {
    setDetail((courant) => (courant && etablissements.find((e) => e.id === courant.id)) || courant);
  }, [etablissements]);

  // Ouverture directe du panneau depuis le tableau de bord (?ouvrir=<id>)
  const aOuvrir = params.get("ouvrir");
  useEffect(() => {
    if (!aOuvrir) return;
    plateformeApi.etablissements.get(aOuvrir)
      .then(setDetail)
      .catch(() => notify("Établissement introuvable.", "error"))
      .finally(() => changerParam("ouvrir", null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aOuvrir]);

  const executer = async (cle, action, message) => {
    setOccupe(cle);
    try {
      const resultat = await action();
      if (message) notify(message, "success");
      recharger();
      return resultat ?? true;
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
      setIdentifiants({ titre: `« ${etab.nom} » est prêt.`, etablissement: etab.nom, email: creation.administrateur.email, password: creation.administrateur.password });
      setCreation(null);
    }
  };

  const activer = (etab) => executer(`acces-${etab.id}`, () => plateformeApi.etablissements.activer(etab.id), "Accès réactivé.");

  const desactiver = async () => {
    const { etab, motif } = desactivation;
    const ok = await executer("desactiver", () => plateformeApi.etablissements.desactiver(etab.id, motif), "Accès désactivé.");
    if (ok) setDesactivation(null);
  };

  const renouveler = async () => {
    const { etab, duree } = renouvellement;
    const ok = await executer("renouveler", () => plateformeApi.etablissements.renouveler(etab.id, duree), `Accès prolongé de ${duree} mois.`);
    if (ok) setRenouvellement(null);
  };

  const actionsLigne = (r, { dansPanneau = false } = {}) => {
    const actif = r.abonnement?.actif !== false;
    return (
      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setRenouvellement({ etab: r, duree: r.abonnement?.duree_mois || 12 })}
          className="rounded-lg p-2 text-slate-400 hover:bg-brand-50 hover:text-brand-600"
          title="Prolonger l'accès (3, 6, 12 ou 24 mois)"
          aria-label="Prolonger l'accès"
        >
          <CalendarPlus size={16} />
        </button>
        <button
          onClick={() => (actif ? setDesactivation({ etab: r, motif: "" }) : activer(r))}
          disabled={occupe === `acces-${r.id}`}
          className={`rounded-lg p-2 ${actif ? "text-slate-400 hover:bg-rose-50 hover:text-rose-600" : "text-emerald-600 hover:bg-emerald-50"}`}
          title={actif ? "Désactiver l'accès" : "Réactiver l'accès"}
          aria-label={actif ? "Désactiver l'accès" : "Réactiver l'accès"}
        >
          {occupe === `acces-${r.id}` ? <Loader2 size={16} className="animate-spin" /> : actif ? <Ban size={16} /> : <Power size={16} />}
        </button>
        {!dansPanneau && (
          <button onClick={() => setDetail(r)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-brand-600" title="Gérer" aria-label="Gérer">
            <Settings2 size={16} />
          </button>
        )}
      </div>
    );
  };

  const limiteAtteinte = stats && stats.places_restantes === 0;
  const compteurs = stats && {
    "": stats.total_etablissements,
    actif: stats.par_statut.actif,
    a_renouveler: stats.a_renouveler,
    expire: stats.par_statut.expire,
    suspendu: stats.par_statut.suspendu,
    sans_abonnement: stats.par_statut.sans_abonnement,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Établissements clients"
        subtitle={stats ? `${stats.total_etablissements} sur ${stats.limite} · ${stats.places_restantes} place(s) disponible(s)` : "Établissements, comptes administrateurs et durées d'accès."}
        actions={
          <>
            <BarreActualisation enCours={enCours} majLe={majLe} erreur={erreur} onActualiser={recharger} />
            <button onClick={() => exporterCsv(etablissements)} disabled={!etablissements.length} className="btn-secondary">
              <Download size={16} /> Exporter
            </button>
            <button
              onClick={() => setCreation(NOUVEAU)}
              disabled={limiteAtteinte}
              title={limiteAtteinte ? "Limite d'établissements atteinte" : undefined}
              className="btn-primary"
            >
              <Plus size={16} /> Nouvel établissement
            </button>
          </>
        }
      />

      <div className="card space-y-4 p-4">
        <div className="flex flex-wrap gap-2">
          {FILTRES.map((f) => (
            <button
              key={f.cle}
              onClick={() => changerParam("statut", f.cle)}
              className={`press flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                statut === f.cle ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {f.label}
              {compteurs && <span className={`tabular-nums ${statut === f.cle ? "text-white/80" : "text-slate-400"}`}>{compteurs[f.cle]}</span>}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Rechercher par nom, sigle, ville, email..." value={saisie} onChange={(e) => setSaisie(e.target.value)} />
          </div>
          <select className="input w-auto" value={tri} onChange={(e) => changerParam("tri", e.target.value)} aria-label="Trier">
            {TRIS.map((t) => <option key={t.cle} value={t.cle}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {erreur && !data ? <ErreurChargement onReessayer={actualiser} /> : (
        <>
        {/* Mobile : une fiche par établissement */}
        <div className="space-y-3 lg:hidden">
          {enCours && !data && <Loader2 className="mx-auto animate-spin text-slate-400" />}
          {data && etablissements.length === 0 && <p className="card p-6 text-center text-sm text-slate-400">Aucun établissement ne correspond.</p>}
          {etablissements.map((r) => (
            <article key={r.id} className="card p-4" onClick={() => setDetail(r)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-800">{r.nom}</p>
                  <p className="text-xs text-slate-400">{[r.sigle, r.ville].filter(Boolean).join(" · ")}</p>
                </div>
                <StatutBadge statut={statutAffiche(r.abonnement)} />
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div><dt className="text-slate-400">Fin d'accès</dt><dd className="font-medium tabular-nums text-slate-700">{r.abonnement ? dateFr(r.abonnement.date_fin) : "—"}</dd></div>
                <div><dt className="text-slate-400">Élèves</dt><dd className="font-medium tabular-nums text-slate-700">{nombreFr(r.nb_eleves)}</dd></div>
                <div><dt className="text-slate-400">Connexion</dt><dd className="font-medium text-slate-700">{depuis(r.derniere_activite)}</dd></div>
              </dl>
              <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
                <span className="truncate text-xs text-slate-500">{r.administrateurs[0]?.email || "Aucun administrateur"}</span>
                {actionsLigne(r)}
              </div>
            </article>
          ))}
        </div>
        <div className="hidden lg:block">
        <DataTable
          loading={enCours && !data}
          rows={etablissements}
          onRowClick={setDetail}
          empty={statut || recherche ? "Aucun établissement ne correspond à ces critères." : "Aucun établissement. Créez le premier avec « Nouvel établissement »."}
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
                ? <div className="text-sm">{r.administrateurs[0].nom}<div className="text-xs text-slate-400">{r.administrateurs[0].email}{r.administrateurs.length > 1 && ` +${r.administrateurs.length - 1}`}</div></div>
                : <span className="text-slate-400">—</span>,
            },
            {
              key: "volumes",
              header: "Volumes",
              render: (r) => <span className="text-sm tabular-nums text-slate-600">{pluriel(r.nb_eleves, "élève")}<div className="text-xs text-slate-400">{pluriel(r.nb_utilisateurs, "compte")}</div></span>,
            },
            {
              key: "derniere_activite",
              header: "Dernière connexion",
              render: (r) => <span className="text-sm text-slate-600" title={dateHeureFr(r.derniere_activite)}>{depuis(r.derniere_activite)}</span>,
            },
            {
              key: "abonnement",
              header: "Accès",
              render: (r) => {
                const ab = r.abonnement;
                return (
                  <div>
                    <StatutBadge statut={statutAffiche(ab)} />
                    {ab && (
                      <div className="mt-1 text-xs tabular-nums text-slate-500">
                        {ab.duree_mois} mois · fin {dateFr(ab.date_fin)}
                        {ab.statut === "actif" && ` (J-${ab.jours_restants})`}
                      </div>
                    )}
                  </div>
                );
              },
            },
            { key: "actions", header: "", render: (r) => actionsLigne(r) },
          ]}
        />
        </div>
        </>
      )}

      {/* Panneau « Gérer » rendu avant les autres fenêtres : celles-ci s'ouvrent par-dessus */}
      <PanneauGestion
        etablissement={detail}
        actions={detail && actionsLigne(detail, { dansPanneau: true })}
        onClose={() => setDetail(null)}
        onChange={(etab) => { setDetail(etab); recharger(); }}
        onDeleted={() => { setDetail(null); recharger(); }}
      />

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
                <div>
                  <label className="label">Sigle</label>
                  <input required maxLength={20} className="input uppercase" value={creation.sigle} onChange={(e) => setCreation({ ...creation, sigle: e.target.value.toUpperCase() })} />
                  <p className="mt-1 text-xs text-slate-400">Code court unique, utilisé dans les matricules.</p>
                </div>
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

      <Modal
        open={!!identifiants}
        onClose={() => setIdentifiants(null)}
        title="Identifiants de l'administrateur"
        footer={<button className="btn-primary" onClick={() => setIdentifiants(null)}>J'ai transmis les identifiants</button>}
      >
        {identifiants && <IdentifiantsCrees identifiants={identifiants} />}
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
              {occupe === "renouveler" && <Loader2 size={16} className="animate-spin" />} Prolonger de {renouvellement?.duree} mois
            </button>
          </>
        }
      >
        {renouvellement && (
          <div className="space-y-4 text-sm text-slate-600">
            <ChoixDuree value={renouvellement.duree} onChange={(d) => setRenouvellement({ ...renouvellement, duree: d })} />
            <p className="rounded-xl bg-slate-50 p-3">
              {renouvellement.etab.abonnement?.statut === "actif"
                ? `La durée s'ajoute à la fin de l'accès en cours (${dateFr(renouvellement.etab.abonnement.date_fin)}).`
                : "L'accès repart d'aujourd'hui et l'établissement est réactivé."}
            </p>
          </div>
        )}
      </Modal>

      {/* --- Désactivation ---------------------------------------------------- */}
      <Modal
        open={!!desactivation}
        onClose={() => setDesactivation(null)}
        title={desactivation ? `Désactiver « ${desactivation.etab.nom} »` : ""}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setDesactivation(null)}>Annuler</button>
            <button className="btn-danger" onClick={desactiver} disabled={occupe === "desactiver"}>
              {occupe === "desactiver" && <Loader2 size={16} className="animate-spin" />} Désactiver l'accès
            </button>
          </>
        }
      >
        {desactivation && (
          <div className="space-y-4 text-sm text-slate-600">
            <p>Tous les utilisateurs de l'établissement perdent l'accès <strong>immédiatement</strong>. Leurs données sont conservées et l'accès peut être réactivé à tout moment.</p>
            <div>
              <label className="label">Motif (visible dans l'historique de l'équipe)</label>
              <input className="input" placeholder="Ex. : paiement en attente" maxLength={200}
                value={desactivation.motif} onChange={(e) => setDesactivation({ ...desactivation, motif: e.target.value })} />
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}

/** Panneau « Gérer » : résumé, informations, notes internes, administrateurs, historique, suppression définitive. */
function PanneauGestion({ etablissement, actions, onClose, onChange, onDeleted }) {
  const { notify } = useToast();
  const [infos, setInfos] = useState(null);
  const [notes, setNotes] = useState("");
  const [admin, setAdmin] = useState(null);
  const [identifiants, setIdentifiants] = useState(null);
  const [confirmation, setConfirmation] = useState("");
  const [occupe, setOccupe] = useState(null);
  const [courant, setCourant] = useState(null);
  const [historique, setHistorique] = useState(null);

  // Réinitialise le panneau à chaque ouverture sur un autre établissement
  if (etablissement && etablissement.id !== courant) {
    setCourant(etablissement.id);
    setInfos({
      nom: etablissement.nom, sigle: etablissement.sigle, ville: etablissement.ville,
      telephone: etablissement.telephone, email: etablissement.email,
    });
    setNotes(etablissement.abonnement?.notes || "");
    setAdmin(null);
    setIdentifiants(null);
    setConfirmation("");
    setHistorique(null);
  }
  if (!etablissement && courant) setCourant(null);

  const etablissementId = etablissement?.id;
  const majLe = etablissement?.abonnement?.date_fin;
  useEffect(() => {
    if (!etablissementId) return;
    let annule = false;
    plateformeApi.etablissements.historique(etablissementId)
      .then((h) => !annule && setHistorique(h))
      .catch(() => !annule && setHistorique([]));
    return () => { annule = true; };
  }, [etablissementId, majLe]);

  const executer = async (cle, action, message) => {
    setOccupe(cle);
    try {
      const resultat = await action();
      notify(message, "success");
      return resultat ?? true;
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
      setIdentifiants({ titre: "Compte administrateur créé.", etablissement: etablissement.nom, email: admin.email, password: admin.password });
      setAdmin(null);
      onChange(etab);
    }
  };
  const supprimer = async () => {
    const ok = await executer("suppression", () => plateformeApi.etablissements.remove(etablissement.id, confirmation), "Établissement supprimé.");
    if (ok) onDeleted();
  };

  const set = (champ) => (e) => setInfos({ ...infos, [champ]: e.target.value });
  const ab = etablissement?.abonnement;

  return (
    <Modal open={!!etablissement} onClose={onClose} title={etablissement ? etablissement.nom : ""} width="max-w-3xl">
      {etablissement && infos && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Accès", <StatutBadge key="s" statut={statutAffiche(ab)} />],
              ["Fin d'accès", ab ? `${dateFr(ab.date_fin)}${ab.statut === "actif" ? ` (J-${ab.jours_restants})` : ""}` : "—"],
              ["Élèves · comptes", `${nombreFr(etablissement.nb_eleves)} · ${nombreFr(etablissement.nb_utilisateurs)}`],
              ["Dernière connexion", depuis(etablissement.derniere_activite)],
            ].map(([libelle, valeur]) => (
              <div key={libelle} className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-400">{libelle}</p>
                <div className="mt-1 text-sm font-semibold text-slate-700">{valeur}</div>
              </div>
            ))}
          </div>

          {actions && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2">
              <span className="text-sm text-slate-500">Prolonger, désactiver ou réactiver l'accès</span>
              {actions}
            </div>
          )}

          <Section title="Historique">
            {historique === null ? <Loader2 size={16} className="animate-spin text-slate-400" /> : historique.length === 0 ? (
              <p className="text-sm text-slate-400">Aucune action enregistrée.</p>
            ) : (
              <ol className="max-h-56 space-y-2.5 overflow-y-auto text-sm">
                {historique.map((h) => (
                  <li key={h.id} className="flex gap-3">
                    <span className="w-28 shrink-0 text-xs tabular-nums text-slate-400">{dateHeureFr(h.horodatage)}</span>
                    <span className="text-slate-600">
                      <span className="font-semibold text-slate-700">{h.action_label}</span>
                      {h.details && <> — {h.details}</>}
                      <span className="text-slate-400"> · {h.auteur_nom}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Section>

          <Section title="Administrateurs">
            <ul className="space-y-1 text-sm">
              {etablissement.administrateurs.map((a) => (
                <li key={a.id}>{a.nom} — <span className="text-slate-500">{a.email}</span>{!a.actif && <span className="badge ml-2 bg-slate-100 text-slate-500">inactif</span>}</li>
              ))}
            </ul>
            {identifiants && <IdentifiantsCrees identifiants={identifiants} />}
            {admin ? (
              <form onSubmit={ajouterAdmin} className="space-y-3">
                <ChampsAdministrateur admin={admin} onChange={setAdmin} />
                <div className="flex gap-2">
                  <button className="btn-primary text-sm" disabled={occupe === "admin"}>Créer le compte</button>
                  <button type="button" className="btn-secondary text-sm" onClick={() => setAdmin(null)}>Annuler</button>
                </div>
              </form>
            ) : (
              <button className="btn-secondary text-sm" onClick={() => { setIdentifiants(null); setAdmin({ ...ADMIN_VIDE, password: genererMotDePasse() }); }}>
                <UserPlus size={15} /> Ajouter un administrateur
              </button>
            )}
          </Section>

          <Section title="Notes internes de l'équipe">
            <textarea rows={3} className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Contact, paiements, contrat..." />
            <button className="btn-secondary text-sm" onClick={enregistrerNotes} disabled={occupe === "notes"}>Enregistrer les notes</button>
          </Section>

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
