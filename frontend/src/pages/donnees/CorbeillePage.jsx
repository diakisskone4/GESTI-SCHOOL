import { useEffect, useState } from "react";
import { Loader2, RotateCcw, Search, Trash2, X } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import DataTable from "../../components/ui/DataTable";
import Modal from "../../components/ui/Modal";
import { useFetch } from "../../hooks/useFetch";
import { useToast, extractErrorMessage } from "../../context/ToastContext";
import { corbeilleApi } from "../../api/endpoints";

const dateHeure = (d) => new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const joursRestants = (d) => Math.max(0, Math.ceil((new Date(d) - Date.now()) / 86400000));

/** Éléments liés supprimés en même temps, ex. « 2 inscriptions, 5 notes » (l'élément lui-même exclu). */
function liesEnCascade(element) {
  const resume = { ...element.resume };
  const principal = Object.keys(resume).find((k) => k.toLowerCase() === element.type_objet.toLowerCase());
  if (principal) resume[principal] -= 1;
  return Object.entries(resume).filter(([, n]) => n > 0).map(([type, n]) => `${n} ${type.toLowerCase()}`).join(", ");
}

/**
 * Corbeille : tout ce qui est supprimé dans l'application (élèves, classes, notes, factures, comptes...)
 * arrive ici avec les éléments supprimés en même temps, et peut être restauré pendant 30 jours.
 */
export default function CorbeillePage() {
  const { notify } = useToast();
  const [saisie, setSaisie] = useState("");
  const [recherche, setRecherche] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [confirmation, setConfirmation] = useState(null); // { action: "supprimer" | "vider", element? }
  const [enCours, setEnCours] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => { setRecherche(saisie.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [saisie]);

  const { data, loading, reload } = useFetch(
    () => corbeilleApi.list({ search: recherche || undefined, modele: type || undefined, page }),
    [recherche, type, page],
  );
  const elements = data?.results || [];
  // Types présents (pour le filtre), mémorisés à partir des résultats non filtrés
  const [types, setTypes] = useState([]);
  useEffect(() => {
    if (!type && !recherche && data?.results) {
      setTypes([...new Map(data.results.map((e) => [e.modele, e.type_objet])).entries()]);
    }
  }, [data, type, recherche]);

  const restaurer = async (element) => {
    setEnCours(element.id);
    try {
      const r = await corbeilleApi.restaurer(element.id);
      notify(r.detail, "success");
      reload();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setEnCours(null);
    }
  };

  const confirmer = async () => {
    const { action, element } = confirmation;
    setEnCours(action);
    try {
      if (action === "vider") {
        const r = await corbeilleApi.vider();
        notify(r.detail, "success");
      } else {
        await corbeilleApi.supprimer(element.id);
        notify("Élément supprimé définitivement.", "success");
      }
      setConfirmation(null);
      setPage(1);
      reload();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setEnCours(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Corbeille"
        subtitle="Les éléments supprimés sont conservés 30 jours. Une restauration remet aussi en place tout ce qui avait été supprimé avec eux."
        actions={
          <button className="btn-secondary text-rose-600" onClick={() => setConfirmation({ action: "vider" })} disabled={!data?.count}>
            <Trash2 size={16} /> Vider la corbeille
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Rechercher un élément supprimé..." value={saisie} onChange={(e) => setSaisie(e.target.value)} />
        </div>
        <select className="input w-auto" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} aria-label="Type">
          <option value="">Tous les types</option>
          {types.map(([modele, libelle]) => <option key={modele} value={modele}>{libelle}</option>)}
        </select>
        <span className="text-xs text-slate-500"><strong className="text-slate-700">{data?.count ?? 0}</strong> élément(s)</span>
      </div>

      <DataTable
        loading={loading && !data}
        rows={elements}
        empty="La corbeille est vide."
        columns={[
          {
            key: "libelle",
            header: "Élément supprimé",
            render: (e) => (
              <div>
                <span className="badge mb-1 bg-slate-100 text-slate-600">{e.type_objet}</span>
                <div className="font-semibold text-slate-800">{e.libelle}</div>
                {liesEnCascade(e) && <div className="text-xs text-slate-400">avec {liesEnCascade(e)}</div>}
              </div>
            ),
          },
          {
            key: "supprime_le",
            header: "Supprimé",
            render: (e) => <span className="text-sm text-slate-600">{dateHeure(e.supprime_le)}<div className="text-xs text-slate-400">par {e.supprime_par_nom}</div></span>,
          },
          {
            key: "expire_le",
            header: "Effacé dans",
            render: (e) => {
              const j = joursRestants(e.expire_le);
              return <span className={`text-sm tabular-nums ${j <= 3 ? "font-semibold text-rose-600" : "text-slate-600"}`}>{j} jour{j > 1 ? "s" : ""}</span>;
            },
          },
          {
            key: "actions",
            header: "",
            render: (e) => (
              <div className="flex items-center justify-end gap-1.5">
                <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => restaurer(e)} disabled={enCours === e.id}>
                  {enCours === e.id ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />} Restaurer
                </button>
                <button
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  onClick={() => setConfirmation({ action: "supprimer", element: e })}
                  title="Supprimer définitivement"
                  aria-label="Supprimer définitivement"
                >
                  <X size={16} />
                </button>
              </div>
            ),
          },
        ]}
      />

      {(data?.previous || data?.next) && (
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" disabled={!data?.previous} onClick={() => setPage(page - 1)}>Précédent</button>
          <button className="btn-secondary" disabled={!data?.next} onClick={() => setPage(page + 1)}>Suivant</button>
        </div>
      )}

      <Modal
        open={!!confirmation}
        onClose={() => setConfirmation(null)}
        title={confirmation?.action === "vider" ? "Vider la corbeille" : "Supprimer définitivement"}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setConfirmation(null)}>Annuler</button>
            <button className="btn-danger" onClick={confirmer} disabled={!!enCours}>
              {enCours && <Loader2 size={16} className="animate-spin" />}
              {confirmation?.action === "vider" ? "Vider" : "Supprimer"}
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          {confirmation?.action === "vider"
            ? `Les ${data?.count ?? 0} élément(s) de la corbeille seront effacés définitivement. Ils ne pourront plus être restaurés.`
            : `« ${confirmation?.element?.libelle} » sera effacé définitivement et ne pourra plus être restauré.`}
        </p>
      </Modal>
    </div>
  );
}
