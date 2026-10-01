import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, IdCard, Loader2 } from "lucide-react";
import { useFetch } from "../../hooks/useFetch";
import { useToast, extractErrorMessage } from "../../context/ToastContext";
import { elevesApi, cartesScolairesApi, inscriptionsApi } from "../../api/endpoints";
import { downloadAuthFile } from "../../utils/download";

export default function EleveDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notify } = useToast();
  const { data, loading } = useFetch(() => elevesApi.historique(id), [id]);

  const eleve = data?.eleve;
  const parcours = data?.parcours || [];

  if (loading) {
    return <Loader2 className="mx-auto mt-20 animate-spin text-brand-500" size={28} />;
  }

  return (
    <div>
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ArrowLeft size={16} /> Retour
      </button>

      <div className="card mb-6 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100 text-lg font-bold text-brand-700">
            {eleve?.prenom?.[0]}{eleve?.nom?.[0]}
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">{eleve?.prenom} {eleve?.nom}</h1>
            <p className="text-sm text-slate-500">
              Matricule {eleve?.matricule} · {eleve?.sexe === "M" ? "Masculin" : "Féminin"} · Né(e) le {eleve?.date_naissance}
            </p>
          </div>
        </div>
        <CarteScolaireButton eleveId={id} notify={notify} />
      </div>

      <div className="card p-5">
        <p className="mb-4 text-sm font-semibold text-slate-700">Parcours scolaire</p>
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Année scolaire</th>
                <th>Classe</th>
                <th>Statut</th>
                <th>Absences</th>
                <th>Retards</th>
                <th>Sanctions</th>
                <th>Récompenses</th>
              </tr>
            </thead>
            <tbody>
              {parcours.map((p, idx) => (
                <tr key={idx}>
                  <td>{p.annee_scolaire}</td>
                  <td>{p.classe}</td>
                  <td>{p.statut}{p.redoublant ? " (redoublant)" : ""}</td>
                  <td>{p.nb_absences}</td>
                  <td>{p.nb_retards}</td>
                  <td>{p.sanctions}</td>
                  <td>{p.recompenses}</td>
                </tr>
              ))}
              {parcours.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-slate-400">Aucune inscription enregistrée.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** Bouton dédié : retrouve/pose l'inscription courante puis génère la carte scolaire PDF. */
function CarteScolaireButton({ eleveId, notify }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const inscriptions = await inscriptionsApi.list({ eleve: eleveId, statut: "active" });
      const inscription = inscriptions.results?.[0];
      if (!inscription) {
        notify("Cet élève n'a pas d'inscription active.", "error");
        return;
      }
      const carte = await cartesScolairesApi.genererPourInscription(inscription.id);
      await downloadAuthFile(cartesScolairesApi.pdfPath(carte.id), `carte_${eleveId}.pdf`);
      notify("Carte scolaire générée.", "success");
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleClick} disabled={loading} className="btn-secondary">
      {loading ? <Loader2 size={16} className="animate-spin" /> : <IdCard size={16} />}
      Carte scolaire (A6)
    </button>
  );
}
