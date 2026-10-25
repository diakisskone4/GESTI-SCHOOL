import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Hand, Mail, MessageCircle, Phone, Search, Undo2, UserCheck } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import { useToast, extractErrorMessage } from "../../context/ToastContext";
import { plateformeApi } from "../../api/endpoints";
import { BarreActualisation, ErreurChargement, Squelette, dateHeureFr, depuis, useDonneesConsole } from "./commun";
import { prendreEnCharge, signalerMajDemandes } from "./NotificationsDemandes";

const STATUTS = [
  { cle: "nouvelle", label: "Nouvelles", singulier: "Nouvelle", badge: "bg-brand-50 text-brand-700" },
  { cle: "en_cours", label: "En cours", singulier: "En cours", badge: "bg-amber-50 text-amber-700" },
  { cle: "convertie", label: "Devenues clientes", singulier: "Devenue cliente", badge: "bg-emerald-50 text-emerald-700" },
  { cle: "abandonnee", label: "Sans suite", singulier: "Sans suite", badge: "bg-slate-100 text-slate-600" },
];
const BADGES = Object.fromEntries(STATUTS.map((s) => [s.cle, s.badge]));

/** Numéro au format WhatsApp (chiffres seuls, indicatif 223 ajouté aux numéros maliens à 8 chiffres). */
const whatsapp = (tel) => {
  const chiffres = (tel || "").replace(/\D/g, "").replace(/^00/, "");
  return chiffres.length === 8 ? `223${chiffres}` : chiffres;
};

function CarteDemande({ demande, onModifier, onPrendre, onLiberer }) {
  const [notes, setNotes] = useState(demande.notes);
  return (
    <article className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-bold text-slate-800">{demande.etablissement}</p>
          <p className="text-sm text-slate-500">
            {demande.nom}{demande.fonction ? ` · ${demande.fonction}` : ""}{demande.ville ? ` · ${demande.ville}` : ""}
            {demande.nb_eleves ? ` · ${demande.nb_eleves} élèves` : ""}
          </p>
          <p className="mt-0.5 text-xs text-slate-400" title={dateHeureFr(demande.cree_le)}>{demande.reference} · reçue {depuis(demande.cree_le)}</p>
        </div>
        <select
          className={`rounded-full border-0 px-3 py-1.5 text-xs font-semibold ${BADGES[demande.statut]}`}
          value={demande.statut}
          onChange={(e) => onModifier(demande, { statut: e.target.value })}
          aria-label="Statut de la demande"
        >
          {STATUTS.map((s) => <option key={s.cle} value={s.cle}>{s.singulier}</option>)}
        </select>
      </div>

      <div className={`mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm ${
        demande.pris_en_charge_par ? (demande.est_a_moi ? "bg-emerald-50 text-emerald-800" : "bg-slate-50 text-slate-600") : "bg-rose-50 text-rose-700"
      }`}>
        <span className="flex items-center gap-2">
          <UserCheck size={16} className="shrink-0" />
          {demande.pris_en_charge_par
            ? <>{demande.est_a_moi ? "Vous suivez cette demande" : <>Suivie par <strong>{demande.pris_en_charge_par_nom}</strong></>} · depuis {depuis(demande.pris_en_charge_le)}</>
            : "Personne ne s'en occupe encore"}
        </span>
        {demande.est_a_moi ? (
          <button className="flex items-center gap-1 text-xs font-semibold hover:underline" onClick={() => onLiberer(demande)}>
            <Undo2 size={13} /> Rendre à l'équipe
          </button>
        ) : (
          <button className="flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
            onClick={() => onPrendre(demande)}>
            <Hand size={13} /> {demande.pris_en_charge_par ? "Reprendre" : "Prendre en charge"}
          </button>
        )}
      </div>

      {demande.message && <p className="mt-3 whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{demande.message}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        <a href={`tel:${demande.telephone}`} className="btn-secondary px-3 py-1.5 text-xs"><Phone size={14} /> {demande.telephone}</a>
        <a href={`https://wa.me/${whatsapp(demande.telephone)}`} target="_blank" rel="noreferrer" className="btn-secondary px-3 py-1.5 text-xs">
          <MessageCircle size={14} /> WhatsApp
        </a>
        {demande.email && (
          <a href={`mailto:${demande.email}?subject=Démonstration Gesti-Scolaire`} className="btn-secondary px-3 py-1.5 text-xs">
            <Mail size={14} /> {demande.email}
          </a>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <input className="input text-sm" placeholder="Notes internes (rappel, prix proposé, rendez-vous...)" value={notes}
          onChange={(e) => setNotes(e.target.value)} />
        <button className="btn-secondary shrink-0 px-3 text-xs" disabled={notes === demande.notes}
          onClick={() => onModifier(demande, { notes })}>
          Enregistrer
        </button>
      </div>
    </article>
  );
}

/** Demandes de démonstration envoyées depuis le site vitrine. */
export default function ConsoleDemandes() {
  const { notify } = useToast();
  const [params, setParams] = useSearchParams();
  const mes = params.get("mes") === "1";
  const [statut, setStatut] = useState(mes ? "" : "nouvelle");
  const [recherche, setRecherche] = useState("");
  const { data, erreur, enCours, majLe, actualiser } = useDonneesConsole(
    () => plateformeApi.demandes.list({ statut: statut || undefined, search: recherche || undefined, mes: mes ? 1 : undefined, page_size: 200 }),
    [statut, recherche, mes],
    30000,
  );
  const demandes = data?.results || [];

  const modifier = async (demande, changements) => {
    try {
      await plateformeApi.demandes.update(demande.id, changements);
      notify(changements.statut ? "Statut mis à jour." : "Notes enregistrées.", "success");
      actualiser();
      signalerMajDemandes();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    }
  };

  const prendre = async (demande) => {
    try {
      await prendreEnCharge(demande);
      notify(`Vous prenez en charge la demande de ${demande.etablissement}.`, "success");
      actualiser();
      signalerMajDemandes();
    } catch (err) {
      if (err?.response?.status !== 409) notify(extractErrorMessage(err), "error");
    }
  };

  const liberer = async (demande) => {
    try {
      await plateformeApi.demandes.liberer(demande.id);
      notify("Demande rendue à l'équipe.", "success");
      actualiser();
      signalerMajDemandes();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    }
  };

  const choisirMes = (valeur) => {
    setParams(valeur ? { mes: "1" } : {}, { replace: true });
    if (valeur) setStatut("");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Demandes de démonstration"
        subtitle="Envoyées depuis le site vitrine. Rappelez vite les nouvelles demandes !"
        actions={<BarreActualisation enCours={enCours} majLe={majLe} erreur={erreur} onActualiser={actualiser} />}
      />
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => choisirMes(!mes)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${mes ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
            <UserCheck size={13} /> Mes demandes
          </button>
          <span className="mx-1 w-px self-stretch bg-slate-200" aria-hidden="true" />
          {[{ cle: "", label: "Toutes" }, ...STATUTS].map((s) => (
            <button key={s.cle} onClick={() => setStatut(s.cle)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${statut === s.cle ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto min-w-56 flex-1 sm:max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Rechercher..." value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </div>
      </div>

      {erreur && !data ? <ErreurChargement onReessayer={actualiser} /> : !data ? (
        <div className="space-y-3"><Squelette className="h-40" /><Squelette className="h-40" /></div>
      ) : demandes.length === 0 ? (
        <p className="card p-10 text-center text-sm text-slate-400">Aucune demande {statut ? "dans cette catégorie" : "pour le moment"}.</p>
      ) : (
        <div className="space-y-3">
          {demandes.map((d) => <CarteDemande key={`${d.id}-${d.modifie_le}`} demande={d} onModifier={modifier} onPrendre={prendre} onLiberer={liberer} />)}
        </div>
      )}
    </div>
  );
}
