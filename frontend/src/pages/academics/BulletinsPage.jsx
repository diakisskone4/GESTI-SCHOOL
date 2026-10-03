import { useEffect, useState } from "react";
import { BookOpenCheck, Calculator, Download, FileText, Loader2 } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import DataTable from "../../components/ui/DataTable";
import { useAuth } from "../../context/AuthContext";
import { useFetch } from "../../hooks/useFetch";
import { useToast, extractErrorMessage } from "../../context/ToastContext";
import {
  classesApi, periodesApi, matieresApi, bulletinsApi,
} from "../../api/endpoints";
import { downloadAuthFile } from "../../utils/download";
import CarnetNotes from "./CarnetNotes";

export default function BulletinsPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const etablissementId = user?.etablissement_courant;

  const { data: classes } = useFetch(() => classesApi.list({ etablissement: etablissementId }), [etablissementId]);
  const { data: matieres } = useFetch(() => matieresApi.list({ etablissement: etablissementId }), [etablissementId]);

  const [classeId, setClasseId] = useState("");
  const [periodeId, setPeriodeId] = useState("");
  const [matiereId, setMatiereId] = useState("");
  const [onglet, setOnglet] = useState("notes");
  const isAdmin = ["admin", "superadmin"].includes(user?.role);
  const [calculating, setCalculating] = useState(false);
  const [bulletins, setBulletins] = useState([]);
  const selectedClass = (classes?.results || []).find((item) => String(item.id) === String(classeId));
  const { data: periodes } = useFetch(
    () => (selectedClass ? periodesApi.list({ annee_scolaire: selectedClass.annee_scolaire }) : Promise.resolve({ results: [] })),
    [selectedClass?.annee_scolaire],
  );

  useEffect(() => {
    if (classeId && periodeId) {
      bulletinsApi.list({ inscription__classe: classeId, periode: periodeId }).then((r) => setBulletins(r.results || []));
    }
  }, [classeId, periodeId]);

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
      <PageHeader title="Notes & Bulletins" subtitle="Interrogations, devoirs et compositions : saisie des notes, moyennes et bulletins" />

      <div className="card mb-6 grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
        <div>
          <label className="label">Classe</label>
          <select className="input" value={classeId} onChange={(e) => { setClasseId(e.target.value); setPeriodeId(""); }}>
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
          <label className="label">Matière</label>
          <select className="input" value={matiereId} onChange={(e) => setMatiereId(e.target.value)}>
            <option value="">Sélectionner...</option>
            {(matieres?.results || []).map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
          </select>
        </div>
      </div>

      <div className="mb-4 inline-flex rounded-xl bg-slate-100 p-1">
        {[
          { key: "notes", label: "Carnet de notes", icon: BookOpenCheck },
          { key: "bulletins", label: "Bulletins", icon: FileText },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setOnglet(key)}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition-all ${
              onglet === key ? "bg-white text-brand-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {onglet === "notes" && (
        <div className="card p-5">
          {classeId && matiereId && periodeId ? (
            <CarnetNotes
              classeId={classeId}
              periodeId={periodeId}
              matiereId={matiereId}
              etablissementId={etablissementId}
              isAdmin={isAdmin}
            />
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">
              Choisissez une classe, une période et une matière pour ouvrir le carnet de notes.
            </p>
          )}
        </div>
      )}

      {onglet === "bulletins" && !(classeId && periodeId) && (
        <div className="card p-5">
          <p className="py-8 text-center text-sm text-slate-400">Choisissez une classe et une période pour voir les bulletins.</p>
        </div>
      )}

      {onglet === "bulletins" && classeId && periodeId && (
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Bulletins de la classe</p>
            {isAdmin && (
              <button onClick={handleCalculer} disabled={calculating} className="btn-secondary">
                {calculating ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />}
                Calculer moyennes & rangs
              </button>
            )}
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
