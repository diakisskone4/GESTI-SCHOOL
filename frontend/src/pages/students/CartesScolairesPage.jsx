import { useState } from "react";
import { Download, IdCard, Loader2, Sparkles, Filter, QrCode, School, User, Calendar } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import DataTable from "../../components/ui/DataTable";
import Modal from "../../components/ui/Modal";
import { useAuth } from "../../context/AuthContext";
import { useFetch } from "../../hooks/useFetch";
import { useToast, extractErrorMessage } from "../../context/ToastContext";
import { cartesScolairesApi, inscriptionsApi, classesApi } from "../../api/endpoints";
import { downloadAuthFile } from "../../utils/download";

export default function CartesScolairesPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const etablissementId = user?.etablissement_courant;

  const { data, loading, reload } = useFetch(() => cartesScolairesApi.list(), []);
  const { data: inscriptions } = useFetch(() => inscriptionsApi.list({ statut: "active" }), []);
  const { data: classesData } = useFetch(() => classesApi.list({ etablissement: etablissementId }), [etablissementId]);
  const classes = classesData?.results || [];

  const [search, setSearch] = useState("");
  const [selectedClasseFilter, setSelectedClasseFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [inscriptionId, setInscriptionId] = useState("");
  const [saving, setSaving] = useState(false);

  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchClasseId, setBatchClasseId] = useState("");
  const [generatingBatch, setGeneratingBatch] = useState(false);

  // Filtrage
  const cartesList = (data?.results || []).filter((c) => {
    const matchSearch = !search ||
      (c.eleve_nom && c.eleve_nom.toLowerCase().includes(search.toLowerCase())) ||
      (c.numero_carte && c.numero_carte.toLowerCase().includes(search.toLowerCase())) ||
      (c.eleve_matricule && c.eleve_matricule.toLowerCase().includes(search.toLowerCase()));

    const matchClasse = !selectedClasseFilter || c.classe_nom === classes.find((cl) => cl.id === selectedClasseFilter)?.nom;
    return matchSearch && matchClasse;
  });

  const generate = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const card = await cartesScolairesApi.genererPourInscription(inscriptionId);
      await downloadAuthFile(cartesScolairesApi.pdfPath(card.id), `carte_${card.numero_carte}.pdf`);
      notify("Carte scolaire générée et téléchargée.", "success");
      setModalOpen(false);
      setInscriptionId("");
      reload();
    } catch (error) {
      notify(extractErrorMessage(error), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleBatchGenerate = async (e) => {
    e.preventDefault();
    if (!batchClasseId) {
      notify("Veuillez sélectionner une classe.", "error");
      return;
    }
    setGeneratingBatch(true);
    try {
      const res = await cartesScolairesApi.genererPourClasse(batchClasseId);
      notify(res.detail || "Cartes générées pour la classe.", "success");
      setBatchModalOpen(false);
      setBatchClasseId("");
      reload();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setGeneratingBatch(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cartes Scolaires"
        subtitle="Générez et téléchargez les cartes scolaires officielles au format PVC (carte de crédit) avec QR code de vérification."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setBatchModalOpen(true)} className="btn-secondary">
              <Sparkles size={16} /> Générer par classe
            </button>
            <button onClick={() => setModalOpen(true)} className="btn-primary">
              <IdCard size={16} /> Générer une carte
            </button>
          </div>
        }
      />

      {/* Aperçu du format de la carte */}
      <div className="card flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between bg-gradient-to-br from-slate-900 via-slate-800 to-brand-950 text-white shadow-xl">
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-500/20 px-3 py-1 text-xs font-semibold text-brand-300 ring-1 ring-brand-400/30">
            <IdCard size={14} /> Format officiel PVC CR80 (85,6 x 54 mm)
          </div>
          <h3 className="text-xl font-bold tracking-tight text-white">Cartes scolaires sécurisées avec QR Code</h3>
          <p className="text-sm text-slate-300 leading-relaxed">
            Chaque carte scolaire générée intègre les données de l'élève, son matricule unique, sa photo, la signature de l'établissement et un QR Code infalsifiable pour contrôle rapide.
          </p>
        </div>

        {/* Badge mockup visuel */}
        <div className="flex-shrink-0">
          <div className="w-64 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <School size={16} className="text-brand-400" />
                <span className="text-xs font-bold tracking-wide text-white">CARTE SCOLAIRE</span>
              </div>
              <span className="rounded bg-brand-500/30 px-1.5 py-0.5 text-[10px] font-bold text-brand-300">PVC</span>
            </div>
            <div className="mt-3 flex gap-3">
              <div className="flex h-14 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
                <User size={24} className="text-slate-300" />
              </div>
              <div className="flex-1 min-w-0 space-y-0.5 text-xs">
                <p className="font-bold truncate text-white">Élève Exemple</p>
                <p className="font-mono text-[11px] text-brand-300">MAT-2025-001</p>
                <p className="text-[11px] text-slate-300">Classe : 6e A</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2 text-[10px] text-slate-400">
              <span>Année en cours</span>
              <QrCode size={16} className="text-brand-300" />
            </div>
          </div>
        </div>
      </div>

      {/* Barre de recherche et filtrage */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par élève, matricule, n° de carte..."
            className="input w-72"
          />
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
            <Filter size={14} className="text-slate-400" />
            <select
              value={selectedClasseFilter}
              onChange={(e) => setSelectedClasseFilter(e.target.value)}
              className="bg-transparent font-medium text-slate-700 outline-none"
            >
              <option value="">Toutes les classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-500">
          <strong>{cartesList.length}</strong> carte(s) scolaire(s)
        </div>
      </div>

      <DataTable
        loading={loading}
        rows={cartesList}
        columns={[
          {
            key: "numero_carte",
            header: "N° Carte",
            render: (r) => (
              <span className="font-mono text-xs font-bold text-slate-800">
                {r.numero_carte}
              </span>
            ),
          },
          {
            key: "eleve_nom",
            header: "Élève",
            render: (r) => (
              <div>
                <span className="font-bold text-slate-900">{r.eleve_nom}</span>
                {r.eleve_matricule && (
                  <div className="font-mono text-xs text-brand-600">{r.eleve_matricule}</div>
                )}
              </div>
            ),
          },
          {
            key: "classe_nom",
            header: "Classe",
            render: (r) => (
              <span className="font-medium text-slate-700">
                {r.classe_nom ? `Classe ${r.classe_nom}` : "—"}
              </span>
            ),
          },
          {
            key: "date_emission",
            header: "Date d'émission",
            render: (r) => r.date_emission ? new Date(r.date_emission).toLocaleDateString("fr-FR") : "—",
          },
          {
            key: "actions",
            header: "",
            render: (r) => (
              <button
                onClick={() => downloadAuthFile(cartesScolairesApi.pdfPath(r.id), `${r.numero_carte}.pdf`)}
                className="flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100"
              >
                <Download size={14} /> Télécharger le PDF
              </button>
            ),
          },
        ]}
      />

      {/* --- MODAL GÉNÉRATION INDIVIDUELLE --- */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Générer une carte scolaire"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>Annuler</button>
            <button className="btn-primary" disabled={saving || !inscriptionId} form="card-form">
              {saving && <Loader2 size={16} className="animate-spin" />}
              Générer et télécharger
            </button>
          </>
        }
      >
        <form id="card-form" onSubmit={generate} className="space-y-4">
          <div>
            <label className="label" htmlFor="inscription-carte">Élève inscrit (avec classe active)</label>
            <select
              id="inscription-carte"
              required
              className="input"
              value={inscriptionId}
              onChange={(event) => setInscriptionId(event.target.value)}
            >
              <option value="">Sélectionner un élève...</option>
              {(inscriptions?.results || []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.eleve_nom} — Classe {item.classe_nom}
                </option>
              ))}
            </select>
          </div>
        </form>
      </Modal>

      {/* --- MODAL GÉNÉRATION GROUPÉE PAR CLASSE --- */}
      <Modal
        open={batchModalOpen}
        onClose={() => setBatchModalOpen(false)}
        title="Générer toutes les cartes d'une classe"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setBatchModalOpen(false)}>Annuler</button>
            <button className="btn-primary" disabled={generatingBatch || !batchClasseId} form="batch-card-form">
              {generatingBatch && <Loader2 size={16} className="animate-spin" />}
              Générer les cartes
            </button>
          </>
        }
      >
        <form id="batch-card-form" onSubmit={handleBatchGenerate} className="space-y-4">
          <div>
            <label className="label">Sélectionner la classe</label>
            <select
              required
              className="input"
              value={batchClasseId}
              onChange={(e) => setBatchClasseId(e.target.value)}
            >
              <option value="">-- Choisir une classe --</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.nom} {c.niveau_nom ? `(${c.niveau_nom})` : ""}</option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-slate-500">
              Toutes les inscriptions actives de cette classe recevront une carte scolaire générée avec QR Code.
            </p>
          </div>
        </form>
      </Modal>
    </div>
  );
}
