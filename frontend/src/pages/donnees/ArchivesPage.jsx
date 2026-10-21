import { useState } from "react";
import { Archive, Building2, Download, GraduationCap, Loader2, RefreshCw } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import { useFetch } from "../../hooks/useFetch";
import { useToast, extractErrorMessage } from "../../context/ToastContext";
import { archivesElevesApi } from "../../api/endpoints";
import { downloadAuthFile } from "../../utils/download";

const OPERATIONS = {
  creation: "Inscription",
  modification: "Modification",
  inscription: "Affectation à une classe",
  changement_classe: "Changement de classe",
  suppression: "Suppression",
  manuelle: "Archive manuelle",
  restauration: "Restauration",
  etablissement: "Archive complète",
};
const FILTRES = [
  { cle: "", label: "Toutes" },
  { cle: "etablissement", label: "Établissement complet" },
  { cle: "eleves", label: "Données élèves" },
];

const taille = (octets) => (octets >= 1024 * 1024 ? `${(octets / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(octets / 1024))} Ko`);
const dateHeure = (d) => new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/**
 * Archives ZIP de l'établissement :
 * - « Établissement complet » : toutes les données (classes, élèves, notes, absences, factures, paie...) à la demande ;
 * - « Données élèves » : créées automatiquement après chaque opération sur les élèves.
 */
export default function ArchivesPage() {
  const { notify } = useToast();
  const [portee, setPortee] = useState("");
  const { data, loading, reload } = useFetch(
    () => archivesElevesApi.list({ page_size: 100, portee: portee || undefined }),
    [portee],
  );
  const archives = data?.results || [];
  const [creation, setCreation] = useState(null);
  const [telechargement, setTelechargement] = useState(null);

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

  const archiver = async (type) => {
    setCreation(type);
    try {
      const archive = await archivesElevesApi.creer(type);
      notify(type === "etablissement" ? "Archive complète créée : téléchargement en cours." : "Archive des élèves créée.", "success");
      reload();
      if (type === "etablissement") await telecharger(archive);
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setCreation(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Archives"
        subtitle="Sauvegardes ZIP des données de l'établissement, à télécharger et à conserver en lieu sûr."
        actions={
          <>
            <button className="btn-secondary" onClick={() => archiver("eleves")} disabled={!!creation}>
              {creation === "eleves" ? <Loader2 size={16} className="animate-spin" /> : <GraduationCap size={16} />} Archiver les élèves
            </button>
            <button className="btn-primary" onClick={() => archiver("etablissement")} disabled={!!creation}>
              {creation === "etablissement" ? <Loader2 size={16} className="animate-spin" /> : <Archive size={16} />} Archiver tout l'établissement
            </button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card flex gap-3 p-4 text-sm text-slate-600">
          <Building2 size={20} className="shrink-0 text-brand-600" />
          <p>
            <strong className="text-slate-800">Établissement complet</strong> : toutes les données (années, classes, élèves,
            enseignants, notes, absences, factures, paie...) dans un fichier Excel avec un onglet par type, plus la liste des
            élèves par classe. Les mots de passe ne sont jamais inclus. Les 10 dernières sont conservées.
          </p>
        </div>
        <div className="card flex gap-3 p-4 text-sm text-slate-600">
          <GraduationCap size={20} className="shrink-0 text-brand-600" />
          <p>
            <strong className="text-slate-800">Données élèves</strong> : créées automatiquement après chaque inscription,
            modification, changement de classe ou suppression d'élève, avec le détail de l'opération. Les 50 dernières sont conservées.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTRES.map((f) => (
            <button
              key={f.cle}
              onClick={() => setPortee(f.cle)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                portee === f.cle ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button className="btn-secondary px-3 py-2 text-xs" onClick={reload} disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Actualiser
        </button>
      </div>

      <div className="card divide-y divide-slate-100">
        {loading && !data ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-slate-400" /></div>
        ) : archives.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">Aucune archive pour le moment.</p>
        ) : archives.map((a) => (
          <div key={a.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
            <div className="flex min-w-0 flex-1 gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                a.portee === "etablissement" ? "bg-brand-50 text-brand-600" : "bg-slate-100 text-slate-500"
              }`}>
                {a.portee === "etablissement" ? <Building2 size={18} /> : <GraduationCap size={18} />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">
                  {a.portee === "etablissement" ? "Établissement complet" : "Données élèves"}
                  <span className="font-normal text-slate-400"> · {dateHeure(a.modifie_le)} · {a.auteur_nom}</span>
                </p>
                {a.portee === "eleves" && (
                  <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                    {a.operations.slice(-3).map((o, i) => (
                      <li key={i}><span className="font-semibold text-slate-700">{OPERATIONS[o.type] || o.type}</span> — {o.description}</li>
                    ))}
                    {a.operations.length > 3 && <li className="text-slate-400">+ {a.operations.length - 3} autre(s) opération(s)</li>}
                  </ul>
                )}
                <p className="mt-1 text-xs text-slate-400">{a.nb_eleves} élève(s) · {taille(a.taille)} · {a.nom_fichier}</p>
              </div>
            </div>
            <button className="btn-secondary px-3 py-2 text-xs" onClick={() => telecharger(a)} disabled={telechargement === a.id}>
              {telechargement === a.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Télécharger
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
