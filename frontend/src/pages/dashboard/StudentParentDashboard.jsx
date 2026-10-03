import { useEffect, useMemo, useState } from "react";
import {
  Award, BookOpenCheck, IdCard, MessageSquareWarning, GraduationCap, Users,
  FileText, Wallet, Eye, Clock, DoorOpen, CheckCircle2, XCircle, Loader2, Receipt,
} from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import DataTable from "../../components/ui/DataTable";
import Modal from "../../components/ui/Modal";
import { useAuth } from "../../context/AuthContext";
import { useFetch } from "../../hooks/useFetch";
import { useToast, extractErrorMessage } from "../../context/ToastContext";
import {
  elevesApi, bulletinsApi, inscriptionsApi, periodesApi, moyennesMatieresApi,
  emploisDuTempsApi, absencesApi, cartesScolairesApi, documentsGeneresApi, facturesApi, paiementsApi,
} from "../../api/endpoints";
import api from "../../api/client";
import { fetchAuthBlobUrl } from "../../utils/download";

const TABS = [
  { key: "vue", label: "Vue d'ensemble" },
  { key: "notes", label: "Notes" },
  { key: "bulletins", label: "Bulletins" },
  { key: "emploi", label: "Emploi du temps" },
  { key: "absences", label: "Absences" },
  { key: "carte", label: "Carte scolaire" },
  { key: "documents", label: "Documents" },
  { key: "recus", label: "Reçus & factures" },
];

const DAYS = [
  { index: 0, label: "Lundi" }, { index: 1, label: "Mardi" }, { index: 2, label: "Mercredi" },
  { index: 3, label: "Jeudi" }, { index: 4, label: "Vendredi" }, { index: 5, label: "Samedi" },
];

const fmt = (n) => `${Number(n || 0).toLocaleString("fr-FR")} FCFA`;

const STATUT_LABELS = { payee: "Payée", partielle: "Partielle", impayee: "Impayée", annulee: "Annulée" };

const STATUT_STYLES = {
  payee: "bg-emerald-50 text-emerald-600",
  partielle: "bg-amber-50 text-amber-600",
  impayee: "bg-rose-50 text-rose-600",
  annulee: "bg-slate-100 text-slate-500",
};

export default function StudentParentDashboard() {
  const { user } = useAuth();
  const { notify } = useToast();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState(null);
  const [viewerTitle, setViewerTitle] = useState("");
  const [viewerLoading, setViewerLoading] = useState(false);

  const handleView = async (path, titre) => {
    setViewerTitle(titre);
    setViewerOpen(true);
    setViewerLoading(true);
    setViewerUrl(null);
    try {
      const url = await fetchAuthBlobUrl(path);
      setViewerUrl(url);
    } catch (err) {
      notify(extractErrorMessage(err), "error");
      setViewerOpen(false);
    } finally {
      setViewerLoading(false);
    }
  };

  const closeViewer = () => {
    if (viewerUrl) window.URL.revokeObjectURL(viewerUrl);
    setViewerUrl(null);
    setViewerOpen(false);
  };

  const [enfants, setEnfants] = useState([]);
  const [selectedEleveId, setSelectedEleveId] = useState("");
  const [eleve, setEleve] = useState(null);
  const [inscription, setInscription] = useState(null);
  const [historique, setHistorique] = useState(null);
  const [bulletins, setBulletins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingEnfant, setLoadingEnfant] = useState(true);
  const [tab, setTab] = useState("vue");
  const [selectedPeriodeId, setSelectedPeriodeId] = useState("");

  const estParent = user?.role === "parent";

  // Étape 1 : déterminer le(s) enfant(s) liés à ce compte (un seul pour un élève, un ou plusieurs pour un parent)
  useEffect(() => {
    (async () => {
      try {
        if (user.role === "eleve") {
          const res = await elevesApi.list({ user: user.id });
          const cibleEleve = res.results?.[0];
          setEnfants(cibleEleve ? [cibleEleve] : []);
          setSelectedEleveId(cibleEleve?.id || "");
        } else if (user.role === "parent") {
          const { data } = await api.get("/liens-parent-eleve/mes_enfants/");
          const eleves = await Promise.all((data || []).map((lien) => elevesApi.get(lien.eleve)));
          setEnfants(eleves);
          setSelectedEleveId(eleves[0]?.id || "");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // Étape 2 : charger le profil complet de l'enfant sélectionné (rejoué si le parent change d'enfant)
  useEffect(() => {
    if (!selectedEleveId) {
      setLoadingEnfant(false);
      return;
    }
    (async () => {
      setLoadingEnfant(true);
      try {
        const cibleEleve = enfants.find((e) => e.id === selectedEleveId) || await elevesApi.get(selectedEleveId);
        setEleve(cibleEleve);
        const [hist, inscRes, bul] = await Promise.all([
          elevesApi.historique(selectedEleveId),
          inscriptionsApi.list({ eleve: selectedEleveId, statut: "active" }),
          bulletinsApi.list({ inscription__eleve: selectedEleveId }),
        ]);
        setHistorique(hist);
        setInscription(inscRes.results?.[0] || null);
        setBulletins(bul.results || []);
      } finally {
        setLoadingEnfant(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEleveId]);

  const dernier = historique?.parcours?.[0];

  const { data: periodesData } = useFetch(
    () => (inscription ? periodesApi.list({ annee_scolaire: inscription.annee_scolaire }) : Promise.resolve({ results: [] })),
    [inscription?.annee_scolaire],
  );
  const periodes = periodesData?.results || [];

  useEffect(() => {
    if (!selectedPeriodeId && periodes.length > 0) {
      const courante = periodes.find((p) => p.est_courante) || periodes[0];
      setSelectedPeriodeId(courante.id);
    }
  }, [periodes, selectedPeriodeId]);

  const { data: moyennesData, loading: loadingNotes } = useFetch(
    () => (inscription && selectedPeriodeId
      ? moyennesMatieresApi.list({ inscription: inscription.id, periode: selectedPeriodeId })
      : Promise.resolve({ results: [] })),
    [inscription?.id, selectedPeriodeId],
  );
  const moyennes = moyennesData?.results || [];

  const { data: creneauxData, loading: loadingEmploi } = useFetch(
    () => (inscription ? emploisDuTempsApi.list({ classe: inscription.classe }) : Promise.resolve({ results: [] })),
    [inscription?.classe],
  );
  const creneauxParJour = useMemo(() => {
    const map = {};
    DAYS.forEach((d) => { map[d.index] = []; });
    (creneauxData?.results || []).forEach((cr) => { if (map[cr.jour]) map[cr.jour].push(cr); });
    Object.values(map).forEach((list) => list.sort((a, b) => a.heure_debut.localeCompare(b.heure_debut)));
    return map;
  }, [creneauxData]);

  const { data: absencesData, loading: loadingAbsences } = useFetch(
    () => (inscription ? absencesApi.list({ inscription: inscription.id }) : Promise.resolve({ results: [] })),
    [inscription?.id],
  );
  const absences = absencesData?.results || [];

  const { data: cartesData, loading: loadingCarte } = useFetch(
    () => (inscription ? cartesScolairesApi.list({ inscription: inscription.id }) : Promise.resolve({ results: [] })),
    [inscription?.id],
  );
  const carte = cartesData?.results?.[0];

  const { data: documentsData, loading: loadingDocuments } = useFetch(
    () => (selectedEleveId ? documentsGeneresApi.list({ eleve: selectedEleveId }) : Promise.resolve({ results: [] })),
    [selectedEleveId],
  );
  const documents = documentsData?.results || [];

  const { data: facturesData, loading: loadingFactures } = useFetch(
    () => (selectedEleveId ? facturesApi.list({ inscription__eleve: selectedEleveId }) : Promise.resolve({ results: [] })),
    [selectedEleveId],
  );
  const factures = facturesData?.results || [];

  return (
    <div>
      <PageHeader
        title={`Bonjour, ${user?.first_name} 👋`}
        subtitle={estParent ? "Suivi scolaire de vos enfants" : eleve ? `Suivi de ${eleve.prenom} ${eleve.nom}` : "Votre portail scolaire"}
      />

      {!loading && enfants.length === 0 && (
        <div className="card p-6 text-sm text-slate-500">
          {estParent
            ? "Aucun profil élève n'est encore lié à votre compte parent. Contactez l'administration de votre établissement."
            : "Aucun profil élève n'est encore lié à ce compte. Contactez l'administration de votre établissement."}
        </div>
      )}

      {enfants.length > 1 && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <Users size={16} className="text-brand-500" />
          <label className="text-sm font-semibold text-slate-700">Enfant :</label>
          <select className="input w-64" value={selectedEleveId} onChange={(e) => setSelectedEleveId(e.target.value)}>
            {enfants.map((e) => (
              <option key={e.id} value={e.id}>{e.nom_complet || `${e.prenom} ${e.nom}`} {e.matricule ? `(${e.matricule})` : ""}</option>
            ))}
          </select>
        </div>
      )}

      {loadingEnfant && (
        <div className="flex items-center justify-center p-12"><Loader2 className="animate-spin text-brand-600" size={28} /></div>
      )}

      {!loadingEnfant && eleve && (
        <>
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

          {tab === "vue" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={IdCard} tone="brand" label="Classe actuelle" value={eleve.classe_actuelle || "—"} />
              <StatCard icon={BookOpenCheck} tone="sky" label="Absences" value={dernier?.nb_absences ?? 0} />
              <StatCard icon={MessageSquareWarning} tone="amber" label="Retards" value={dernier?.nb_retards ?? 0} />
              <StatCard icon={Award} tone="emerald" label="Récompenses" value={dernier?.recompenses ?? 0} />
            </div>
          )}

          {tab === "notes" && (
            <div className="card p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-700">{estParent ? `Notes de ${eleve.prenom}` : "Mes notes par matière"}</p>
                <select className="input w-56" value={selectedPeriodeId} onChange={(e) => setSelectedPeriodeId(e.target.value)}>
                  {periodes.map((p) => <option key={p.id} value={p.id}>{p.libelle}</option>)}
                </select>
              </div>
              <DataTable
                loading={loadingNotes}
                rows={moyennes}
                columns={[
                  { key: "matiere_nom", header: "Matière" },
                  { key: "moyenne", header: "Moyenne/20", render: (r) => Number(r.moyenne).toFixed(2) },
                  { key: "coefficient", header: "Coefficient" },
                  { key: "rang", header: "Rang", render: (r) => (r.rang ? `${r.rang}ème` : "—") },
                  { key: "appreciation", header: "Appréciation", render: (r) => r.appreciation || "—" },
                ]}
              />
            </div>
          )}

          {tab === "bulletins" && (
            <div className="card p-5">
              <p className="mb-3 text-sm font-semibold text-slate-700">{estParent ? `Bulletins de ${eleve.prenom}` : "Mes bulletins"}</p>
              <DataTable
                loading={loading}
                rows={bulletins}
                columns={[
                  { key: "periode", header: "Période", render: (r) => r.periode_libelle || `Période #${r.periode}` },
                  { key: "moyenne_generale", header: "Moyenne générale", render: (r) => r.moyenne_generale ?? "—" },
                  { key: "rang", header: "Rang", render: (r) => (r.rang ? `${r.rang}/${r.effectif_classe}` : "—") },
                  { key: "mention", header: "Mention" },
                  {
                    key: "pdf", header: "",
                    render: (r) => (
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => handleView(bulletinsApi.pdfPath(r.id), `Bulletin — ${r.periode_libelle || ""}`)}
                          className="flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline"
                        >
                          <Eye size={14} /> Voir (A4)
                        </button>
                        <button
                          onClick={() => handleView(bulletinsApi.pdfPathA5(r.id), `Bulletin — ${r.periode_libelle || ""}`)}
                          className="flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline"
                        >
                          <Eye size={14} /> Voir (A5)
                        </button>
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          )}

          {tab === "emploi" && (
            <div>
              {loadingEmploi ? (
                <div className="flex items-center justify-center p-12"><Loader2 className="animate-spin text-brand-600" size={28} /></div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  {DAYS.map((day) => {
                    const dayCreneaux = creneauxParJour[day.index] || [];
                    return (
                      <div key={day.index} className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50/50 p-3">
                        <div className="mb-3 flex items-center justify-between border-b border-slate-200/80 pb-2">
                          <div className="font-bold text-slate-800">{day.label}</div>
                          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500 shadow-2xs">
                            {dayCreneaux.length} cours
                          </span>
                        </div>
                        <div className="flex-1 space-y-2.5">
                          {dayCreneaux.map((cr) => (
                            <div key={cr.id} className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                              <p className="text-sm font-bold leading-tight text-slate-900">{cr.matiere_nom}</p>
                              <div className="mt-2 space-y-1 text-xs text-slate-600">
                                <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                                  <Clock size={12} className="text-slate-400" />
                                  <span>{cr.heure_debut?.substring(0, 5)} - {cr.heure_fin?.substring(0, 5)}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <GraduationCap size={12} className="text-slate-400" />
                                  <span className="truncate">{cr.enseignant_nom || "Enseignant non assigné"}</span>
                                </div>
                                {cr.salle && (
                                  <div className="flex items-center gap-1.5">
                                    <DoorOpen size={12} className="text-slate-400" />
                                    <span>Salle : <strong>{cr.salle}</strong></span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                          {dayCreneaux.length === 0 && (
                            <p className="py-8 text-center text-xs text-slate-400">Aucun cours</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === "absences" && (
            <div className="card p-5">
              <p className="mb-3 text-sm font-semibold text-slate-700">{estParent ? `Absences & retards de ${eleve.prenom}` : "Mes absences & retards"}</p>
              <DataTable
                loading={loadingAbsences}
                rows={absences}
                columns={[
                  { key: "date", header: "Date" },
                  { key: "type_evenement", header: "Type", render: (r) => (r.type_evenement === "absence" ? "Absence" : "Retard") },
                  {
                    key: "justifiee", header: "Justifiée",
                    render: (r) => (
                      <span className={`badge flex w-fit items-center gap-1 ${r.justifiee ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                        {r.justifiee ? <CheckCircle2 size={12} /> : <XCircle size={12} />} {r.justifiee ? "Oui" : "Non"}
                      </span>
                    ),
                  },
                  { key: "motif", header: "Motif", render: (r) => r.motif || "—" },
                ]}
              />
            </div>
          )}

          {tab === "carte" && (
            <div className="card p-6">
              {loadingCarte ? (
                <Loader2 className="animate-spin text-brand-500" />
              ) : carte ? (
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Carte scolaire — {carte.numero_carte}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Émise le {new Date(carte.date_emission).toLocaleDateString("fr-FR")}
                      {carte.date_expiration && ` · Expire le ${new Date(carte.date_expiration).toLocaleDateString("fr-FR")}`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleView(cartesScolairesApi.pdfPath(carte.id), `Carte scolaire — ${carte.numero_carte}`)}
                    className="btn-primary"
                  >
                    <Eye size={16} /> Voir {estParent ? "la carte" : "ma carte"}
                  </button>
                </div>
              ) : (
                <p className="text-sm text-slate-400">
                  {estParent ? `La carte scolaire de ${eleve.prenom} n'a pas` : "Votre carte scolaire n'a pas"} encore été générée. Contactez l'administration de votre établissement.
                </p>
              )}
            </div>
          )}

          {tab === "documents" && (
            <div className="card p-5">
              <p className="mb-3 text-sm font-semibold text-slate-700">Documents reçus de l'administration</p>
              <DataTable
                loading={loadingDocuments}
                rows={documents}
                columns={[
                  { key: "reference", header: "Référence" },
                  { key: "type_document", header: "Type" },
                  { key: "created_at", header: "Reçu le", render: (r) => new Date(r.created_at).toLocaleDateString("fr-FR") },
                  {
                    key: "pdf", header: "",
                    render: (r) => (
                      <button
                        onClick={() => handleView(documentsGeneresApi.pdfPath(r.id), `Document — ${r.reference}`)}
                        className="flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline"
                      >
                        <FileText size={14} /> Voir
                      </button>
                    ),
                  },
                ]}
              />
            </div>
          )}

          {tab === "recus" && (
            <div className="space-y-4">
              {loadingFactures ? (
                <div className="flex items-center justify-center p-12"><Loader2 className="animate-spin text-brand-600" size={28} /></div>
              ) : factures.length === 0 ? (
                <div className="card p-8 text-center text-sm text-slate-400">Aucune facture ou reçu pour le moment.</div>
              ) : (
                factures.map((f) => (
                  <div key={f.id} className="card p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <Wallet size={16} className="text-brand-500" />
                        <div>
                          <p className="font-semibold text-slate-800">{f.libelle || "Frais scolaires"}</p>
                          <p className="text-xs text-slate-400">Montant dû : {fmt(f.montant_net)} · Payé : {fmt(f.montant_paye)} · Solde : {fmt(f.solde)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleView(facturesApi.pdfPath(f.id), `Facture — ${f.libelle || "Frais scolaires"}`)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:underline"
                        >
                          <FileText size={13} /> Voir la facture
                        </button>
                        <span className={`badge ${STATUT_STYLES[f.statut]}`}>{STATUT_LABELS[f.statut] || f.statut}</span>
                      </div>
                    </div>
                    {(f.paiements || []).length > 0 && (
                      <div className="mt-3 space-y-2">
                        {f.paiements.map((p) => (
                          <div key={p.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-2.5 text-sm">
                            <div className="flex items-center gap-2 text-slate-600">
                              <Receipt size={14} className="text-slate-400" />
                              <span>{fmt(p.montant)} — {new Date(p.date_paiement).toLocaleDateString("fr-FR")}</span>
                            </div>
                            <button
                              onClick={() => handleView(paiementsApi.recuPath(p.id), `Reçu de paiement — ${fmt(p.montant)}`)}
                              className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:underline"
                            >
                              <Eye size={13} /> Voir le reçu
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      <Modal open={viewerOpen} onClose={closeViewer} title={viewerTitle || "Aperçu du document"} width="max-w-4xl">
        {viewerLoading || !viewerUrl ? (
          <div className="flex items-center justify-center p-16">
            <Loader2 className="animate-spin text-brand-600" size={28} />
          </div>
        ) : (
          <iframe
            src={viewerUrl}
            title={viewerTitle || "Aperçu du document"}
            className="h-[70vh] w-full rounded-lg border border-slate-200"
          />
        )}
      </Modal>
    </div>
  );
}
