import { useState } from "react";
import { Archive, Download, Loader2, RefreshCw } from "lucide-react";
import Modal from "../../components/ui/Modal";
import { useFetch } from "../../hooks/useFetch";
import { useToast, extractErrorMessage } from "../../context/ToastContext";
import { archivesElevesApi } from "../../api/endpoints";
import { downloadAuthFile } from "../../utils/download";

const TYPES = {
  creation: "Inscription",
  modification: "Modification",
  inscription: "Affectation à une classe",
  changement_classe: "Changement de classe",
  suppression: "Suppression",
  manuelle: "Archive manuelle",
};

const taille = (octets) => (octets >= 1024 * 1024 ? `${(octets / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(octets / 1024))} Ko`);
const dateHeure = (d) => new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/**
 * Archives ZIP des données élèves : une archive est créée automatiquement après chaque opération
 * (inscription, modification, changement de classe, suppression). Chacune contient la liste Excel
 * complète, les données brutes (JSON) et le détail des opérations.
 */
export default function ArchivesElevesModal({ open, onClose }) {
  const { notify } = useToast();
  const { data, loading, reload } = useFetch(
    () => (open ? archivesElevesApi.list({ page_size: 100 }) : Promise.resolve(null)),
    [open],
  );
  const archives = data?.results || [];
  const [creation, setCreation] = useState(false);
  const [telechargement, setTelechargement] = useState(null);

  const archiverMaintenant = async () => {
    setCreation(true);
    try {
      await archivesElevesApi.creer();
      notify("Archive créée.", "success");
      reload();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setCreation(false);
    }
  };

  const telecharger = async (archive) => {
    setTelechargement(archive.id);
    try {
      await downloadAuthFile(archivesElevesApi.telechargerPath(archive.id), archive.nom_fichier, { open: false });
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setTelechargement(null);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Archives des données élèves"
      width="max-w-3xl"
      footer={
        <>
          <button className="btn-secondary" onClick={reload} disabled={loading}>
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Actualiser
          </button>
          <button className="btn-primary" onClick={archiverMaintenant} disabled={creation}>
            {creation ? <Loader2 size={16} className="animate-spin" /> : <Archive size={16} />} Archiver maintenant
          </button>
        </>
      }
    >
      <p className="mb-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
        Une archive ZIP est créée automatiquement après chaque opération sur les élèves (inscription, modification,
        changement de classe, suppression). Elle contient la liste Excel par classe, toutes les données et le détail
        des opérations, y compris les informations d'un élève supprimé. Les 50 dernières archives sont conservées.
      </p>

      {loading && !data ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-400" /></div>
      ) : archives.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">Aucune archive pour le moment. Elle sera créée à la prochaine opération.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {archives.map((a) => (
            <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">
                  {dateHeure(a.modifie_le)} <span className="font-normal text-slate-400">· {a.auteur_nom}</span>
                </p>
                <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                  {a.operations.slice(-4).map((o, i) => (
                    <li key={i}>
                      <span className="font-semibold text-slate-700">{TYPES[o.type] || o.type}</span> — {o.description}
                    </li>
                  ))}
                  {a.operations.length > 4 && <li className="text-slate-400">+ {a.operations.length - 4} autre(s) opération(s)</li>}
                </ul>
                <p className="mt-1 text-xs text-slate-400">{a.nb_eleves} élève(s) · {taille(a.taille)}</p>
              </div>
              <button className="btn-secondary px-3 py-2 text-xs" onClick={() => telecharger(a)} disabled={telechargement === a.id}>
                {telechargement === a.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} ZIP
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
