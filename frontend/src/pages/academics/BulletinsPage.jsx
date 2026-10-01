import { useEffect, useState } from "react";
import { Calculator, Download, Loader2, Save } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import DataTable from "../../components/ui/DataTable";
import { useAuth } from "../../context/AuthContext";
import { useFetch } from "../../hooks/useFetch";
import { useToast, extractErrorMessage } from "../../context/ToastContext";
import {
  classesApi, periodesApi, matieresApi, inscriptionsApi, notesApi, bulletinsApi,
} from "../../api/endpoints";
import { downloadAuthFile } from "../../utils/download";

export default function BulletinsPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const etablissementId = user?.etablissement_courant;

  const { data: classes } = useFetch(() => classesApi.list({ etablissement: etablissementId }), [etablissementId]);
  const { data: matieres } = useFetch(() => matieresApi.list({ etablissement: etablissementId }), [etablissementId]);

  const [classeId, setClasseId] = useState("");
  const [periodeId, setPeriodeId] = useState("");
  const [matiereId, setMatiereId] = useState("");
  const [inscriptions, setInscriptions] = useState([]);
  const [notesSaisies, setNotesSaisies] = useState({});
  const [loadingInscriptions, setLoadingInscriptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [bulletins, setBulletins] = useState([]);
  const selectedClass = (classes?.results || []).find((item) => String(item.id) === String(classeId));
  const { data: periodes } = useFetch(
    () => (selectedClass ? periodesApi.list({ annee_scolaire: selectedClass.annee_scolaire }) : Promise.resolve({ results: [] })),
    [selectedClass?.annee_scolaire],
  );

  useEffect(() => {
    if (classeId) {
      setLoadingInscriptions(true);
      inscriptionsApi.list({ classe: classeId, statut: "active" })
        .then((r) => setInscriptions(r.results || []))
        .finally(() => setLoadingInscriptions(false));
    } else {
      setInscriptions([]);
    }
  }, [classeId]);

  useEffect(() => {
    if (classeId && periodeId) {
      bulletinsApi.list({ inscription__classe: classeId, periode: periodeId }).then((r) => setBulletins(r.results || []));
    }
  }, [classeId, periodeId]);

  const handleSaveNotes = async () => {
    if (!matiereId || !periodeId) {
      notify("Sélectionnez une matière et une période.", "error");
      return;
    }
    setSaving(true);
    try {
      const entries = Object.entries(notesSaisies).filter(([, v]) => v !== "" && v !== undefined);
      await Promise.all(
        entries.map(([inscriptionId, valeur]) =>
          notesApi.create({ inscription: inscriptionId, matiere: matiereId, periode: periodeId, valeur, bareme: 20 })
        )
      );
      notify(`${entries.length} note(s) enregistrée(s).`, "success");
      setNotesSaisies({});
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleCalculer = async () => {
    if (!classeId || !periodeId) {
      notify("Sélectionnez une classe et une période.", "error");
      return;
    }
    setCalculating(true);
    try {
      const res = await bulletinsApi.calculer(classeId, periodeId);
      setBulletins(res.bulletins || []);
      notify(res.detail, "success");
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setCalculating(false);
    }
  };

  return (
    <div>
      <PageHeader title="Notes & Bulletins" subtitle="Saisie des notes, calcul des moyennes et génération des bulletins" />

      <div className="card mb-6 grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
        <div>
          <label className="label">Classe</label>
          <select className="input" value={classeId} onChange={(e) => setClasseId(e.target.value)}>
            <option value="">Sélectionner...</option>
            {(classes?.results || []).map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Période</label>
          <select className="input" value={periodeId} onChange={(e) => setPeriodeId(e.target.value)}>
            <option value="">Sélectionner...</option>
            {(periodes?.results || []).map((p) => <option key={p.id} value={p.id}>{p.libelle}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Matière (pour la saisie de notes)</label>
          <select className="input" value={matiereId} onChange={(e) => setMatiereId(e.target.value)}>
            <option value="">Sélectionner...</option>
            {(matieres?.results || []).map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
          </select>
        </div>
      </div>

      {classeId && matiereId && periodeId && (
        <div className="card mb-6 p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Saisie des notes / 20</p>
            <button onClick={handleSaveNotes} disabled={saving} className="btn-primary">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Enregistrer les notes
            </button>
          </div>
          {loadingInscriptions ? (
            <Loader2 className="animate-spin text-brand-500" />
          ) : (
            <div className="space-y-2">
              {inscriptions.map((insc) => (
                <div key={insc.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-2.5">
                  <span className="text-sm text-slate-700">{insc.eleve_nom}</span>
                  <input
                    type="number" min="0" max="20" step="0.25"
                    className="input w-28"
                    value={notesSaisies[insc.id] ?? ""}
                    onChange={(e) => setNotesSaisies({ ...notesSaisies, [insc.id]: e.target.value })}
                    placeholder="—"
                  />
                </div>
              ))}
              {inscriptions.length === 0 && <p className="text-sm text-slate-400">Aucun élève actif dans cette classe.</p>}
            </div>
          )}
        </div>
      )}

      {classeId && periodeId && (
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Bulletins de la classe</p>
            <button onClick={handleCalculer} disabled={calculating} className="btn-secondary">
              {calculating ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />}
              Calculer moyennes & rangs
            </button>
          </div>
          <DataTable
            rows={bulletins}
            columns={[
              { key: "eleve_nom", header: "Élève" },
              { key: "moyenne_generale", header: "Moyenne générale" },
              { key: "rang", header: "Rang", render: (r) => (r.rang ? `${r.rang}/${r.effectif_classe}` : "—") },
              { key: "mention", header: "Mention" },
              {
                key: "pdf", header: "",
                render: (r) => (
                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={() => downloadAuthFile(bulletinsApi.pdfPath(r.id), `bulletin_${r.eleve_nom}.pdf`)}
                      className="flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline"
                    >
                      <Download size={14} /> PDF (A4)
                    </button>
                    <button
                      onClick={() => downloadAuthFile(bulletinsApi.pdfPathA5(r.id), `bulletin_${r.eleve_nom}_A5.pdf`)}
                      className="flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline"
                    >
                      <Download size={14} /> PDF (A5)
                    </button>
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}
    </div>
  );
}
