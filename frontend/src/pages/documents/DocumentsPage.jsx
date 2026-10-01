import { useMemo, useState } from "react";
import { Download, Plus, Trash2 } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import DataTable from "../../components/ui/DataTable";
import Modal from "../../components/ui/Modal";
import { useFetch } from "../../hooks/useFetch";
import { useAuth } from "../../context/AuthContext";
import { useToast, extractErrorMessage } from "../../context/ToastContext";
import { documentsGeneresApi, elevesApi, employesApi } from "../../api/endpoints";
import { downloadAuthFile } from "../../utils/download";

// Documents destinés à un élève (ou son parent/tuteur).
const TYPES_ELEVE = [
  { value: "certificat_scolarite", label: "Certificat de scolarité" },
  { value: "certificat_frequentation", label: "Certificat de fréquentation" },
  { value: "convocation_examen", label: "Convocation - Examen" },
  { value: "convocation_reunion", label: "Convocation - Réunion" },
  { value: "attestation_reussite", label: "Attestation de réussite" },
  { value: "attestation_passage", label: "Attestation de passage" },
  { value: "fiche_permission", label: "Fiche de permission" },
  { value: "fiche_medicale", label: "Fiche médicale" },
  { value: "billet_entree", label: "Billet d'entrée" },
  { value: "avis_recouvrement", label: "Avis de recouvrement" },
];

// Documents internes / RH concernant un employé — jamais destinés à un élève.
const TYPES_EMPLOYE = [
  { value: "attestation_travail", label: "Attestation de travail" },
  { value: "certificat_travail", label: "Certificat de travail" },
  { value: "certificat_fin_contrat", label: "Certificat de fin de contrat" },
  { value: "attestation_fin_stage", label: "Attestation de fin de stage (stagiaire externe possible)" },
  { value: "fiche_licenciement", label: "Fiche de licenciement" },
];

const TYPE_META = {
  certificat_scolarite: { objetLabel: "Objet / précisions (optionnel)" },
  certificat_frequentation: { objetLabel: "Objet / précisions (optionnel)" },
  convocation_examen: { showDate: true, dateLabel: "Date de l'examen", showLieu: true, lieuLabel: "Lieu", objetLabel: "Objet / précisions" },
  convocation_reunion: { showDate: true, dateLabel: "Date de la réunion", showLieu: true, lieuLabel: "Lieu", objetLabel: "Objet / précisions" },
  attestation_reussite: { objetLabel: "Précisions (optionnel)" },
  attestation_passage: { objetLabel: "Précisions (optionnel)" },
  fiche_permission: {
    showDate: true, dateLabel: "Date de début de la permission",
    showFinDate: true, finDateLabel: "Date de fin (optionnel)",
    objetLabel: "Durée et motif (ex: 15 jours pour mariage)",
  },
  fiche_medicale: { showLieu: true, lieuLabel: "Lieu de consultation", objetLabel: "Motif de la consultation" },
  billet_entree: { objetLabel: "Motif d'entrée" },
  avis_recouvrement: { showDate: true, dateLabel: "Date limite de paiement", objetLabel: "Précisions (optionnel)" },
  attestation_travail: { objetLabel: "Poste occupé (qualité)", employeRequired: true },
  certificat_travail: { objetLabel: "Poste occupé (qualité)", employeRequired: true },
  certificat_fin_contrat: { objetLabel: "Poste occupé (qualité)", employeRequired: true },
  attestation_fin_stage: {
    showDate: true, dateLabel: "Date de début du stage (optionnel)",
    showFinDate: true, finDateLabel: "Date de fin du stage (optionnel)",
    showLieu: true, lieuLabel: "Établissement d'origine et spécialité (ex: Faculté des Langues (FLSL) - Anglais)",
    objetLabel: "Nom du/de la stagiaire (si non enregistré comme employé)",
  },
  fiche_licenciement: { objetLabel: "Motif du licenciement", employeRequired: true },
};

const TABS = [
  { key: "eleve", label: "Documents élèves", types: TYPES_ELEVE },
  { key: "employe", label: "Documents employés", types: TYPES_EMPLOYE },
];

const EMPTY_FORM = { type_document: "", eleve: "", employe: "", objet: "", date_evenement: "", date_fin_evenement: "", lieu_evenement: "" };
const TYPE_LABELS = Object.fromEntries([...TYPES_ELEVE, ...TYPES_EMPLOYE].map((t) => [t.value, t.label]));

export default function DocumentsPage() {
  const { notify } = useToast();
  const { user } = useAuth();
  const etablissementId = user?.etablissement_courant;

  const [tab, setTab] = useState("eleve");
  const { data, loading, reload } = useFetch(() => documentsGeneresApi.list(), []);
  const { data: eleves } = useFetch(() => elevesApi.list({ etablissement: etablissementId }), [etablissementId]);
  const { data: employes } = useFetch(() => employesApi.list({ etablissement: etablissementId }), [etablissementId]);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const activeTab = TABS.find((t) => t.key === tab);
  const meta = TYPE_META[form.type_document] || {};

  const documents = data?.results || [];
  const documentsEleve = useMemo(() => documents.filter((d) => d.eleve || TYPES_ELEVE.some((t) => t.value === d.type_document)), [documents]);
  const documentsEmploye = useMemo(() => documents.filter((d) => !d.eleve && (d.employe || TYPES_EMPLOYE.some((t) => t.value === d.type_document))), [documents]);
  const rows = tab === "eleve" ? documentsEleve : documentsEmploye;

  const openCreate = (tabKey) => {
    setForm({ ...EMPTY_FORM });
    setTab(tabKey);
    setModalOpen(true);
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Supprimer définitivement le document ${doc.reference} ?`)) return;
    setDeletingId(doc.id);
    try {
      await documentsGeneresApi.remove(doc.id);
      notify("Document supprimé.", "success");
      reload();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const doc = await documentsGeneresApi.create({
        type_document: form.type_document,
        eleve: tab === "eleve" ? (form.eleve || null) : null,
        employe: tab === "employe" ? (form.employe || null) : null,
        objet: form.objet,
        date_evenement: form.date_evenement || null,
        date_fin_evenement: form.date_fin_evenement || null,
        lieu_evenement: form.lieu_evenement,
      });
      notify("Document créé, génération du PDF...", "success");
      await downloadAuthFile(documentsGeneresApi.pdfPath(doc.id), `${doc.reference}.pdf`);
      setModalOpen(false);
      reload();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Documents administratifs"
        subtitle="Certificats, convocations, fiches et attestations — élèves et personnel"
        actions={
          <button onClick={() => openCreate(tab)} className="btn-primary">
            <Plus size={16} /> Générer un document
          </button>
        }
      />

      <div className="mb-5 inline-flex flex-wrap rounded-xl bg-slate-100 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
              tab === t.key ? "bg-white text-brand-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <DataTable
        loading={loading}
        rows={rows}
        columns={[
          { key: "reference", header: "Référence" },
          { key: "type_document", header: "Type", render: (r) => TYPE_LABELS[r.type_document] || r.type_document },
          tab === "eleve"
            ? { key: "eleve_nom", header: "Élève", render: (r) => r.eleve_nom || "—" }
            : { key: "employe_nom", header: "Employé", render: (r) => r.employe_nom || r.objet || "—" },
          { key: "created_at", header: "Créé le", render: (r) => new Date(r.created_at).toLocaleDateString("fr-FR") },
          {
            key: "actions", header: "",
            render: (r) => (
              <div className="flex items-center justify-end gap-1.5">
                <button
                  onClick={() => downloadAuthFile(documentsGeneresApi.pdfPath(r.id), `${r.reference}.pdf`)}
                  className="flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline"
                >
                  <Download size={14} /> PDF
                </button>
                <button
                  onClick={() => handleDelete(r)}
                  disabled={deletingId === r.id}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  title="Supprimer"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ),
          },
        ]}
      />

      <Modal
        open={modalOpen} onClose={() => setModalOpen(false)}
        title={tab === "eleve" ? "Générer un document élève" : "Générer un document employé"}
        footer={<>
          <button className="btn-secondary" onClick={() => setModalOpen(false)}>Annuler</button>
          <button className="btn-primary" disabled={saving} form="doc-form">Générer</button>
        </>}
      >
        <form id="doc-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Type de document</label>
            <select
              required className="input" value={form.type_document}
              onChange={(e) => setForm({ ...EMPTY_FORM, type_document: e.target.value })}
            >
              <option value="">Sélectionner...</option>
              {activeTab.types.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {tab === "eleve" ? (
            <div>
              <label className="label">Élève concerné</label>
              <select required className="input" value={form.eleve} onChange={(e) => setForm({ ...form, eleve: e.target.value })}>
                <option value="">Sélectionner un élève...</option>
                {(eleves?.results || []).map((el) => (
                  <option key={el.id} value={el.id}>{el.nom_complet} {el.matricule ? `(${el.matricule})` : ""}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="label">Employé concerné{!meta.employeRequired && form.type_document && " (optionnel pour un stagiaire externe)"}</label>
              <select
                required={!!meta.employeRequired} className="input" value={form.employe}
                onChange={(e) => setForm({ ...form, employe: e.target.value })}
              >
                <option value="">Sélectionner un employé...</option>
                {(employes?.results || []).map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.prenom} {emp.nom} {emp.matricule ? `(${emp.matricule})` : ""}</option>
                ))}
              </select>
            </div>
          )}

          {meta.showDate && (
            <div>
              <label className="label">{meta.dateLabel}</label>
              <input type="date" className="input" value={form.date_evenement} onChange={(e) => setForm({ ...form, date_evenement: e.target.value })} />
            </div>
          )}
          {meta.showFinDate && (
            <div>
              <label className="label">{meta.finDateLabel}</label>
              <input type="date" className="input" value={form.date_fin_evenement} onChange={(e) => setForm({ ...form, date_fin_evenement: e.target.value })} />
            </div>
          )}
          {meta.showLieu && (
            <div>
              <label className="label">{meta.lieuLabel}</label>
              <input className="input" value={form.lieu_evenement} onChange={(e) => setForm({ ...form, lieu_evenement: e.target.value })} />
            </div>
          )}
          <div>
            <label className="label">{meta.objetLabel || "Objet / précisions"}</label>
            <textarea className="input" rows={3} value={form.objet} onChange={(e) => setForm({ ...form, objet: e.target.value })} />
          </div>
        </form>
      </Modal>
    </div>
  );
}
