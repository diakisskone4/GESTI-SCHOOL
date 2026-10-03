import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, IdCard, Pencil, Trash2, Download, Loader2, Eye, Filter, Camera, User, School } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import DataTable from "../../components/ui/DataTable";
import Modal from "../../components/ui/Modal";
import { useFetch } from "../../hooks/useFetch";
import { useAuth } from "../../context/AuthContext";
import { useToast, extractErrorMessage } from "../../context/ToastContext";
import { elevesApi, classesApi, anneesScolairesApi, inscriptionsApi, cartesScolairesApi } from "../../api/endpoints";
import { downloadAuthFile } from "../../utils/download";

const EMPTY_FORM = {
  matricule: "",
  nom: "",
  prenom: "",
  sexe: "M",
  date_naissance: "",
  lieu_naissance: "",
  nationalite: "Malienne",
  nom_pere: "",
  nom_mere: "",
  adresse: "",
  groupe_sanguin: "",
  contact_urgence_nom: "",
  contact_urgence_telephone: "",
  allergies_ou_besoins_speciaux: "",
  classe: "",
  annee_scolaire: "",
};

export default function ElevesPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const etablissementId = user?.etablissement_courant;

  const [search, setSearch] = useState("");
  const [selectedClasseFilter, setSelectedClasseFilter] = useState("");

  const { data, loading, reload } = useFetch(
    () => elevesApi.list({ etablissement: etablissementId, search }),
    [etablissementId, search]
  );
  const { data: classesData } = useFetch(() => classesApi.list({ etablissement: etablissementId }), [etablissementId]);
  const classes = classesData?.results || [];

  const { data: anneesData } = useFetch(() => anneesScolairesApi.list({ etablissement: etablissementId }), [etablissementId]);
  const annees = anneesData?.results || [];

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEleve, setEditingEleve] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [generatingCardId, setGeneratingCardId] = useState(null);

  // Affectation (ou changement) de classe d'un élève existant
  const [affectEleve, setAffectEleve] = useState(null);
  const [affectClasseId, setAffectClasseId] = useState("");
  const [affectSaving, setAffectSaving] = useState(false);

  // Les <select> renvoient des chaînes alors que les identifiants de classe sont des nombres.
  const trouverClasse = (classeId) => classes.find((c) => String(c.id) === String(classeId));
  const classeActuelleId = (eleve) => classes.find((c) => c.nom === eleve.classe_actuelle)?.id ?? "";

  /** Inscrit l'élève dans la classe, ou le change de classe s'il est déjà inscrit cette année-là. */
  const affecterClasse = async (eleveId, classe) => {
    const existantes = await inscriptionsApi.list({ eleve: eleveId, annee_scolaire: classe.annee_scolaire });
    const inscription = existantes.results?.[0];
    if (inscription) {
      await inscriptionsApi.update(inscription.id, { classe: classe.id, statut: "active" });
    } else {
      await inscriptionsApi.create({ eleve: eleveId, classe: classe.id, annee_scolaire: classe.annee_scolaire });
    }
  };

  const openAffectation = (eleve) => {
    setAffectEleve(eleve);
    setAffectClasseId(String(classeActuelleId(eleve)));
  };

  const handleAffectation = async (e) => {
    e.preventDefault();
    const classe = trouverClasse(affectClasseId);
    if (!classe) {
      notify("Sélectionnez une classe.", "error");
      return;
    }
    setAffectSaving(true);
    try {
      await affecterClasse(affectEleve.id, classe);
      notify(`${affectEleve.nom_complet} est affecté(e) à la classe ${classe.nom}.`, "success");
      setAffectEleve(null);
      reload();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setAffectSaving(false);
    }
  };

  // Photo de l'élève (utilisée notamment sur la carte scolaire générée en PDF)
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const photoInputRef = useRef(null);

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notify("Veuillez sélectionner un fichier image (JPG, PNG...).", "error");
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  // Filtrage côté client si classe sélectionnée
  const elevesList = (data?.results || []).filter((el) => {
    if (!selectedClasseFilter) return true;
    return el.classe_actuelle === trouverClasse(selectedClasseFilter)?.nom;
  });

  const openCreate = () => {
    setEditingEleve(null);
    const anneeCourante = annees.find((a) => a.est_courante) || annees[0];
    setForm({
      ...EMPTY_FORM,
      annee_scolaire: anneeCourante?.id || "",
      classe: selectedClasseFilter || "",
    });
    setPhotoFile(null);
    setPhotoPreview(null);
    setModalOpen(true);
  };

  const openEdit = (e, eleve) => {
    e.stopPropagation();
    setEditingEleve(eleve);
    setForm({
      matricule: eleve.matricule || "",
      nom: eleve.nom || "",
      prenom: eleve.prenom || "",
      sexe: eleve.sexe || "M",
      date_naissance: eleve.date_naissance || "",
      lieu_naissance: eleve.lieu_naissance || "",
      nationalite: eleve.nationalite || "Malienne",
      nom_pere: eleve.nom_pere || "",
      nom_mere: eleve.nom_mere || "",
      adresse: eleve.adresse || "",
      groupe_sanguin: eleve.groupe_sanguin || "",
      contact_urgence_nom: eleve.contact_urgence_nom || "",
      contact_urgence_telephone: eleve.contact_urgence_telephone || "",
      allergies_ou_besoins_speciaux: eleve.allergies_ou_besoins_speciaux || "",
      classe: String(classeActuelleId(eleve)),
      annee_scolaire: "",
    });
    setPhotoFile(null);
    setPhotoPreview(eleve.photo || null);
    setModalOpen(true);
  };

  /** Construit le payload à envoyer : FormData multipart si une photo a été choisie, sinon JSON classique. */
  const buildPayload = (eleveData, extra = {}) => {
    if (!photoFile) return { ...eleveData, ...extra };
    const fd = new FormData();
    Object.entries({ ...eleveData, ...extra }).forEach(([key, value]) => {
      if (value !== null && value !== undefined) fd.append(key, value);
    });
    fd.append("photo", photoFile);
    return fd;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingEleve) {
        const { classe, annee_scolaire, ...eleveData } = form;
        await elevesApi.update(editingEleve.id, buildPayload(eleveData));
        const nouvelleClasse = trouverClasse(classe);
        if (nouvelleClasse && String(nouvelleClasse.id) !== String(classeActuelleId(editingEleve))) {
          await affecterClasse(editingEleve.id, nouvelleClasse);
          notify(`Profil mis à jour et élève affecté(e) à la classe ${nouvelleClasse.nom}.`, "success");
        } else {
          notify("Profil élève mis à jour avec succès.", "success");
        }
      } else {
        const { classe, annee_scolaire, ...eleveData } = form;
        const eleve = await elevesApi.create(buildPayload(eleveData, { etablissement: etablissementId }));
        if (classe && annee_scolaire) {
          await inscriptionsApi.create({ eleve: eleve.id, classe, annee_scolaire });
        }
        notify("Élève inscrit avec succès.", "success");
      }
      setModalOpen(false);
      reload();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e, eleve) => {
    e.stopPropagation();
    if (!window.confirm(`Supprimer définitivement l'élève ${eleve.nom_complet} (${eleve.matricule}) ?`)) return;
    try {
      await elevesApi.remove(eleve.id);
      notify("Élève supprimé.", "success");
      reload();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    }
  };

  /** Génération / téléchargement immédiat de la carte scolaire en un clic */
  const handleTelechargerCarte = async (e, eleve) => {
    e.stopPropagation();
    setGeneratingCardId(eleve.id);
    try {
      const carte = await cartesScolairesApi.genererPourEleve(eleve.id);
      await downloadAuthFile(cartesScolairesApi.pdfPath(carte.id), `carte_${eleve.matricule}.pdf`);
      notify(`Carte scolaire de ${eleve.nom_complet} téléchargée.`, "success");
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setGeneratingCardId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Élèves"
        subtitle="Gestion des inscriptions, profils scolaires et impression des cartes d'identité scolaire."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => navigate("/cartes-scolaires")}
              className="btn-secondary"
            >
              <IdCard size={16} /> Cartes scolaires
            </button>
            <button onClick={openCreate} className="btn-primary">
              <Plus size={16} /> Inscrire un élève
            </button>
          </div>
        }
      />

      {/* Barre de recherche et filtres */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, prénom ou matricule..."
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
          <strong>{elevesList.length}</strong> élève(s) affiché(s)
        </div>
      </div>

      <DataTable
        loading={loading}
        rows={elevesList}
        onRowClick={(row) => navigate(`/eleves/${row.id}`)}
        columns={[
          {
            key: "matricule",
            header: "Matricule",
            render: (r) => (
              <span className="font-mono text-xs font-semibold text-brand-700">
                {r.matricule}
              </span>
            ),
          },
          {
            key: "nom_complet",
            header: "Nom & Prénom",
            render: (r) => (
              <div>
                <span className="font-bold text-slate-900">{r.nom_complet}</span>
                <span className="ml-2 text-xs text-slate-400">
                  {r.sexe === "M" ? "Masculin" : "Féminin"}
                </span>
              </div>
            ),
          },
          {
            key: "classe_actuelle",
            header: "Classe",
            render: (r) => (
              <span className="font-medium text-slate-700">
                {r.classe_actuelle ? `Classe ${r.classe_actuelle}` : "Non inscrit"}
              </span>
            ),
          },
          {
            key: "statut",
            header: "Statut",
            render: (r) => (
              <span className={`badge ${r.actif ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                {r.actif ? "Actif" : "Inactif"}
              </span>
            ),
          },
          {
            key: "actions",
            header: "Actions",
            render: (r) => (
              <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                {/* BOUTON CARTE SCOLAIRE DIRECT */}
                <button
                  onClick={(e) => handleTelechargerCarte(e, r)}
                  disabled={generatingCardId === r.id}
                  className="flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50/70 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100"
                  title="Générer et télécharger la carte scolaire A6"
                >
                  {generatingCardId === r.id ? (
                    <Loader2 size={13} className="animate-spin text-brand-600" />
                  ) : (
                    <IdCard size={14} className="text-brand-600" />
                  )}
                  <span>Carte</span>
                </button>

                <button
                  onClick={() => openAffectation(r)}
                  className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                    r.classe_actuelle
                      ? "border-slate-200 text-slate-600 hover:bg-slate-50"
                      : "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                  }`}
                  title={r.classe_actuelle ? "Changer de classe" : "Affecter à une classe"}
                >
                  <School size={13} />
                  <span>{r.classe_actuelle ? "Classe" : "Affecter"}</span>
                </button>

                <button
                  onClick={() => navigate(`/eleves/${r.id}`)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  title="Consulter le dossier scolaire"
                >
                  <Eye size={15} />
                </button>

                <button
                  onClick={(e) => openEdit(e, r)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
                  title="Modifier le profil"
                >
                  <Pencil size={15} />
                </button>

                <button
                  onClick={(e) => handleDelete(e, r)}
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

      {/* --- MODAL AFFECTATION À UNE CLASSE --- */}
      <Modal
        open={!!affectEleve}
        onClose={() => setAffectEleve(null)}
        title={affectEleve ? `Classe de ${affectEleve.nom_complet}` : ""}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setAffectEleve(null)}>Annuler</button>
            <button className="btn-primary" disabled={affectSaving || !affectClasseId} form="affect-form">
              {affectSaving && <Loader2 size={16} className="animate-spin" />}
              Enregistrer
            </button>
          </>
        }
      >
        <form id="affect-form" onSubmit={handleAffectation} className="space-y-3">
          <p className="text-sm text-slate-600">
            Classe actuelle : <strong>{affectEleve?.classe_actuelle || "aucune"}</strong>
          </p>
          <div>
            <label className="label">Nouvelle classe</label>
            <select required className="input" value={affectClasseId} onChange={(e) => setAffectClasseId(e.target.value)}>
              <option value="">Sélectionner une classe...</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}{c.niveau_nom ? ` — ${c.niveau_nom}` : ""}{c.annee_scolaire_libelle ? ` (${c.annee_scolaire_libelle})` : ""}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-slate-500">
            L'élève est inscrit pour l'année scolaire de la classe choisie. S'il est déjà inscrit cette année-là, il change simplement de classe.
          </p>
        </form>
      </Modal>

      {/* --- MODAL INSCRIPTION / MODIFICATION ÉLÈVE --- */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingEleve ? `Modifier l'élève : ${editingEleve.nom_complet}` : "Inscrire un nouvel élève"}
        width="max-w-2xl"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>Annuler</button>
            <button className="btn-primary" disabled={saving} form="eleve-form">
              {saving && <Loader2 size={16} className="animate-spin" />}
              {editingEleve ? "Enregistrer les modifications" : "Inscrire l'élève"}
            </button>
          </>
        }
      >
        <form id="eleve-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="border-b border-slate-100 pb-1">
            <p className="text-xs font-bold uppercase tracking-wider text-brand-600">Identité de l'élève</p>
          </div>

          {/* Photo de l'élève : utilisée sur la carte scolaire (format A6) */}
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              {photoPreview ? (
                <img src={photoPreview} alt="Aperçu photo élève" className="h-full w-full object-cover" />
              ) : (
                <User size={28} className="text-slate-300" />
              )}
            </div>
            <div>
              <label className="label">Photo d'identité</label>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="btn-secondary text-xs"
              >
                <Camera size={14} /> {photoPreview ? "Changer la photo" : "Ajouter une photo"}
              </button>
              <p className="mt-1 text-xs text-slate-400">Format portrait recommandé. Insérée sur la carte scolaire A6.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Matricule</label>
              <input
                className="input font-mono"
                value={form.matricule}
                onChange={(e) => setForm({ ...form, matricule: e.target.value })}
                placeholder="Laisser vide pour générer automatiquement"
              />
            </div>
            <div>
              <label className="label">Nom de famille</label>
              <input
                required
                className="input"
                value={form.nom}
                onChange={(e) => setForm({ ...form, nom: e.target.value })}
                placeholder="Ex: Diallo"
              />
            </div>
            <div>
              <label className="label">Prénom</label>
              <input
                required
                className="input"
                value={form.prenom}
                onChange={(e) => setForm({ ...form, prenom: e.target.value })}
                placeholder="Ex: Ibrahim"
              />
            </div>
            <div>
              <label className="label">Sexe</label>
              <select
                className="input"
                value={form.sexe}
                onChange={(e) => setForm({ ...form, sexe: e.target.value })}
              >
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
              </select>
            </div>
            <div>
              <label className="label">Date de naissance</label>
              <input
                required
                type="date"
                className="input"
                value={form.date_naissance}
                onChange={(e) => setForm({ ...form, date_naissance: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Lieu de naissance</label>
              <input
                className="input"
                value={form.lieu_naissance}
                onChange={(e) => setForm({ ...form, lieu_naissance: e.target.value })}
                placeholder="Ex: Bamako"
              />
            </div>
            <div>
              <label className="label">Nationalité</label>
              <input
                className="input"
                value={form.nationalite}
                onChange={(e) => setForm({ ...form, nationalite: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Nom du père</label>
              <input
                className="input"
                value={form.nom_pere}
                onChange={(e) => setForm({ ...form, nom_pere: e.target.value })}
                placeholder="Figure sur les certificats officiels"
              />
            </div>
            <div>
              <label className="label">Nom de la mère</label>
              <input
                className="input"
                value={form.nom_mere}
                onChange={(e) => setForm({ ...form, nom_mere: e.target.value })}
                placeholder="Figure sur les certificats officiels"
              />
            </div>
          </div>

          <div className="border-b border-slate-100 pt-2 pb-1">
            <p className="text-xs font-bold uppercase tracking-wider text-brand-600">Coordonnées & Santé</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Adresse de résidence</label>
              <input
                className="input"
                value={form.adresse}
                onChange={(e) => setForm({ ...form, adresse: e.target.value })}
                placeholder="Ex: Faladiè SEMA, Rue 12"
              />
            </div>
            <div>
              <label className="label">Groupe sanguin</label>
              <input
                className="input"
                value={form.groupe_sanguin}
                onChange={(e) => setForm({ ...form, groupe_sanguin: e.target.value })}
                placeholder="Ex: O+, A+, B-..."
              />
            </div>
            <div>
              <label className="label">Besoins spéciaux / Allergies (optionnel)</label>
              <input
                className="input"
                value={form.allergies_ou_besoins_speciaux}
                onChange={(e) => setForm({ ...form, allergies_ou_besoins_speciaux: e.target.value })}
              />
            </div>
          </div>

          <div className="border-b border-slate-100 pt-2 pb-1">
            <p className="text-xs font-bold uppercase tracking-wider text-brand-600">Contact d'urgence (Parent / Tuteur)</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Nom du contact d'urgence</label>
              <input
                className="input"
                value={form.contact_urgence_nom}
                onChange={(e) => setForm({ ...form, contact_urgence_nom: e.target.value })}
                placeholder="Ex: M. Ousmane Diallo (Père)"
              />
            </div>
            <div>
              <label className="label">Téléphone d'urgence</label>
              <input
                className="input"
                value={form.contact_urgence_telephone}
                onChange={(e) => setForm({ ...form, contact_urgence_telephone: e.target.value })}
                placeholder="Ex: +223 70 00 00 00"
              />
            </div>
          </div>

          {editingEleve && (
            <>
              <div className="border-b border-slate-100 pt-2 pb-1">
                <p className="text-xs font-bold uppercase tracking-wider text-brand-600">Classe</p>
              </div>
              <div>
                <label className="label">
                  Classe de l'élève <span className="font-normal text-slate-400">(actuelle : {editingEleve.classe_actuelle || "aucune"})</span>
                </label>
                <select
                  className="input"
                  value={form.classe}
                  onChange={(e) => setForm({ ...form, classe: e.target.value })}
                >
                  <option value="">{editingEleve.classe_actuelle ? "-- Ne pas changer --" : "-- Sans classe pour l'instant --"}</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nom}{c.niveau_nom ? ` — ${c.niveau_nom}` : ""}{c.annee_scolaire_libelle ? ` (${c.annee_scolaire_libelle})` : ""}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  S'il est déjà inscrit pour l'année de cette classe, il change simplement de classe.
                </p>
              </div>
            </>
          )}

          {!editingEleve && (
            <>
              <div className="border-b border-slate-100 pt-2 pb-1">
                <p className="text-xs font-bold uppercase tracking-wider text-brand-600">Inscription en classe</p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Classe d'inscription</label>
                  <select
                    className="input"
                    value={form.classe}
                    onChange={(e) => setForm({ ...form, classe: e.target.value })}
                  >
                    <option value="">-- Sans classe pour l'instant --</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nom} {c.niveau_nom ? `— Niveau ${c.niveau_nom}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Année scolaire</label>
                  <select
                    className="input"
                    value={form.annee_scolaire}
                    onChange={(e) => setForm({ ...form, annee_scolaire: e.target.value })}
                  >
                    <option value="">-- Sélectionner l'année --</option>
                    {annees.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.libelle} {a.est_courante ? "(Année courante)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}
        </form>
      </Modal>
    </div>
  );
}
