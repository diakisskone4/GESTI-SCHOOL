import { useState } from "react";
import { Mail, MessageCircle, Phone, Search } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import { useToast, extractErrorMessage } from "../../context/ToastContext";
import { plateformeApi } from "../../api/endpoints";
import { BarreActualisation, ErreurChargement, Squelette, dateHeureFr, depuis, useDonneesConsole } from "./commun";

const STATUTS = [
  { cle: "nouvelle", label: "Nouvelles", badge: "bg-brand-50 text-brand-700" },
  { cle: "en_cours", label: "En cours", badge: "bg-amber-50 text-amber-700" },
  { cle: "convertie", label: "Devenues clientes", badge: "bg-emerald-50 text-emerald-700" },
  { cle: "abandonnee", label: "Sans suite", badge: "bg-slate-100 text-slate-600" },
];
const BADGES = Object.fromEntries(STATUTS.map((s) => [s.cle, s.badge]));

/** Numéro au format WhatsApp (chiffres seuls, indicatif 223 ajouté aux numéros maliens à 8 chiffres). */
const whatsapp = (tel) => {
  const chiffres = (tel || "").replace(/\D/g, "").replace(/^00/, "");
  return chiffres.length === 8 ? `223${chiffres}` : chiffres;
};

function CarteDemande({ demande, onModifier }) {
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
          <p className="mt-0.5 text-xs text-slate-400" title={dateHeureFr(demande.cree_le)}>Reçue {depuis(demande.cree_le)}</p>
        </div>
        <select
          className={`rounded-full border-0 px-3 py-1.5 text-xs font-semibold ${BADGES[demande.statut]}`}
          value={demande.statut}
          onChange={(e) => onModifier(demande, { statut: e.target.value })}
          aria-label="Statut de la demande"
        >
          {STATUTS.map((s) => <option key={s.cle} value={s.cle}>{s.label.replace(/s$/, "").replace("Devenues clientes", "Devenue cliente")}</option>)}
        </select>
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
  const [statut, setStatut] = useState("nouvelle");
  const [recherche, setRecherche] = useState("");
  const { data, erreur, enCours, majLe, actualiser } = useDonneesConsole(
    () => plateformeApi.demandes.list({ statut: statut || undefined, search: recherche || undefined, page_size: 200 }),
    [statut, recherche],
  );
  const demandes = data?.results || [];

  const modifier = async (demande, changements) => {
    try {
      await plateformeApi.demandes.update(demande.id, changements);
      notify(changements.statut ? "Statut mis à jour." : "Notes enregistrées.", "success");
      actualiser();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    }
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
          {demandes.map((d) => <CarteDemande key={`${d.id}-${d.modifie_le}`} demande={d} onModifier={modifier} />)}
        </div>
      )}
    </div>
  );
}
