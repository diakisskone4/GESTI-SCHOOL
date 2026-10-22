import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, Megaphone, Pin, Plus, Trash2, X } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import Modal from "../../components/ui/Modal";
import { useFetch } from "../../hooks/useFetch";
import { useAuth } from "../../context/AuthContext";
import { useToast, extractErrorMessage } from "../../context/ToastContext";
import { annoncesApi } from "../../api/endpoints";

const MAX_IMAGES = 6;
const MAX_MO = 8;
const FORMULAIRE_VIDE = { titre: "", contenu: "", public_cible: "tous" };

/** Images d'une annonce : une seule en grand, plusieurs en mosaïque (la 4e indique « +N »). */
function GalerieAnnonce({ images, onOuvrir }) {
  if (!images?.length) return null;
  if (images.length === 1) {
    const [image] = images;
    return (
      <button type="button" onClick={() => onOuvrir(0)} className="mt-4 block w-full overflow-hidden rounded-xl bg-slate-100">
        <img src={image.url} alt={image.nom_fichier || "Image de l'annonce"} loading="lazy"
          className="max-h-[28rem] w-full object-contain" />
      </button>
    );
  }
  const visibles = images.slice(0, 4);
  return (
    <div className={`mt-4 grid gap-1.5 ${{ 2: "grid-cols-2", 3: "grid-cols-3" }[visibles.length] || "grid-cols-2 sm:grid-cols-4"}`}>
      {visibles.map((image, i) => (
        <button type="button" key={image.id} onClick={() => onOuvrir(i)}
          className="relative aspect-square overflow-hidden rounded-xl bg-slate-100">
          <img src={image.url} alt={image.nom_fichier || `Image ${i + 1}`} loading="lazy" className="h-full w-full object-cover transition hover:scale-105" />
          {i === 3 && images.length > 4 && (
            <span className="absolute inset-0 flex items-center justify-center bg-slate-900/55 text-xl font-bold text-white">
              +{images.length - 4}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Affichage plein écran d'une image, avec navigation entre les images de l'annonce. */
function Visionneuse({ images, index, onFermer, onChanger }) {
  useEffect(() => {
    const clavier = (e) => {
      if (e.key === "Escape") onFermer();
      if (e.key === "ArrowRight") onChanger((index + 1) % images.length);
      if (e.key === "ArrowLeft") onChanger((index - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", clavier);
    return () => window.removeEventListener("keydown", clavier);
  }, [index, images.length, onFermer, onChanger]);

  const image = images[index];
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/90 p-4" onClick={onFermer} role="dialog" aria-modal="true">
      <button className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" onClick={onFermer} aria-label="Fermer">
        <X size={22} />
      </button>
      {images.length > 1 && (
        <>
          <button className="absolute left-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Image précédente"
            onClick={(e) => { e.stopPropagation(); onChanger((index - 1 + images.length) % images.length); }}>
            <ChevronLeft size={26} />
          </button>
          <button className="absolute right-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Image suivante"
            onClick={(e) => { e.stopPropagation(); onChanger((index + 1) % images.length); }}>
            <ChevronRight size={26} />
          </button>
        </>
      )}
      <img src={image.url} alt={image.nom_fichier || ""} className="max-h-[88vh] max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
      {images.length > 1 && (
        <p className="absolute bottom-4 text-sm text-white/80">{index + 1} / {images.length}</p>
      )}
    </div>
  );
}

export default function AnnoncesPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const { data, loading, reload } = useFetch(() => annoncesApi.list(), []);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(FORMULAIRE_VIDE);
  const [fichiers, setFichiers] = useState([]); // [{ file, apercu }]
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [visionneuse, setVisionneuse] = useState(null); // { images, index }
  const champFichiers = useRef(null);

  const canPublish = user?.est_admin || user?.role === "enseignant";

  // Aperçus locaux (URL blob) : libérés quand une image est retirée, à la fermeture et en quittant la page
  const fichiersRef = useRef(fichiers);
  useEffect(() => { fichiersRef.current = fichiers; }, [fichiers]);
  useEffect(() => () => fichiersRef.current.forEach((f) => URL.revokeObjectURL(f.apercu)), []);

  const fermerFormulaire = () => {
    fichiers.forEach((f) => URL.revokeObjectURL(f.apercu));
    setModalOpen(false);
    setForm(FORMULAIRE_VIDE);
    setFichiers([]);
  };

  const ajouterImages = (liste) => {
    const choisis = Array.from(liste || []);
    const refuses = choisis.filter((f) => !f.type.startsWith("image/") || f.size > MAX_MO * 1024 * 1024);
    if (refuses.length) notify(`${refuses.length} fichier(s) ignoré(s) : images uniquement, ${MAX_MO} Mo maximum.`, "error");
    const valides = choisis.filter((f) => !refuses.includes(f));
    const place = MAX_IMAGES - fichiers.length;
    if (valides.length > place) notify(`${MAX_IMAGES} images au maximum par annonce.`, "error");
    setFichiers([...fichiers, ...valides.slice(0, place).map((file) => ({ file, apercu: URL.createObjectURL(file) }))]);
  };

  const retirerImage = (index) => {
    URL.revokeObjectURL(fichiers[index].apercu);
    setFichiers(fichiers.filter((_, i) => i !== index));
  };

  const handleDelete = async (annonce) => {
    if (!window.confirm(`Supprimer l'annonce "${annonce.titre}" ? Elle restera récupérable dans la corbeille.`)) return;
    setDeletingId(annonce.id);
    try {
      await annoncesApi.remove(annonce.id);
      notify("Annonce supprimée.", "success");
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
      const donnees = new FormData();
      Object.entries(form).forEach(([cle, valeur]) => donnees.append(cle, valeur));
      if (user?.etablissement_courant) donnees.append("etablissement", user.etablissement_courant);
      fichiers.forEach(({ file }) => donnees.append("images", file));
      await annoncesApi.create(donnees);
      notify("Annonce publiée.", "success");
      fermerFormulaire();
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
        title="Annonces"
        subtitle="Publications de l'administration et des enseignants"
        actions={
          canPublish && (
            <button onClick={() => setModalOpen(true)} className="btn-primary">
              <Plus size={16} /> Publier une annonce
            </button>
          )
        }
      />

      <div className="space-y-4">
        {loading && <p className="text-sm text-slate-400">Chargement...</p>}
        {(data?.results || []).map((a) => (
          <div key={a.id} className="card p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Megaphone size={16} />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{a.titre}</p>
                  <p className="text-xs text-slate-400">
                    Par {a.auteur_nom} · {new Date(a.date_publication).toLocaleDateString("fr-FR")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {a.epinglee && <Pin size={16} className="text-amber-500" />}
                {(user?.est_admin || a.auteur === user?.id) && (
                  <button
                    onClick={() => handleDelete(a)}
                    disabled={deletingId === a.id}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    title="Supprimer"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
            <p className="mt-3 whitespace-pre-line text-sm text-slate-600">{a.contenu}</p>
            <GalerieAnnonce images={a.images} onOuvrir={(index) => setVisionneuse({ images: a.images, index })} />
          </div>
        ))}
        {!loading && (data?.results || []).length === 0 && (
          <div className="card p-8 text-center text-sm text-slate-400">Aucune annonce publiée.</div>
        )}
      </div>

      <Modal
        open={modalOpen} onClose={fermerFormulaire} title="Publier une annonce"
        footer={<>
          <button className="btn-secondary" onClick={fermerFormulaire}>Annuler</button>
          <button className="btn-primary" disabled={saving} form="annonce-form">
            {saving && <Loader2 size={16} className="animate-spin" />} Publier
          </button>
        </>}
      >
        <form id="annonce-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Titre</label>
            <input required className="input" value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} />
          </div>
          <div>
            <label className="label">Public cible</label>
            <select className="input" value={form.public_cible} onChange={(e) => setForm({ ...form, public_cible: e.target.value })}>
              <option value="tous">Tout le monde</option>
              <option value="enseignants">Enseignants</option>
              <option value="eleves">Élèves</option>
              <option value="parents">Parents</option>
            </select>
          </div>
          <div>
            <label className="label">Contenu</label>
            <textarea required rows={4} className="input" value={form.contenu} onChange={(e) => setForm({ ...form, contenu: e.target.value })} />
          </div>

          <div>
            <label className="label">Images <span className="font-normal text-slate-400">(facultatif, {MAX_IMAGES} maximum)</span></label>
            <input
              ref={champFichiers} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden"
              onChange={(e) => { ajouterImages(e.target.files); e.target.value = ""; }}
            />
            <div
              className="grid grid-cols-3 gap-2 sm:grid-cols-4"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); ajouterImages(e.dataTransfer.files); }}
            >
              {fichiers.map((f, i) => (
                <div key={f.apercu} className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  <img src={f.apercu} alt={f.file.name} className="h-full w-full object-cover" />
                  <button
                    type="button" onClick={() => retirerImage(i)} aria-label={`Retirer ${f.file.name}`}
                    className="absolute right-1 top-1 rounded-full bg-slate-900/70 p-1 text-white hover:bg-slate-900"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
              {fichiers.length < MAX_IMAGES && (
                <button
                  type="button" onClick={() => champFichiers.current?.click()}
                  className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 text-xs text-slate-500 hover:border-brand-400 hover:bg-brand-50/40 hover:text-brand-600"
                >
                  <ImagePlus size={22} />
                  Ajouter
                </button>
              )}
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              JPEG, PNG, WebP ou GIF, {MAX_MO} Mo maximum par image. Vous pouvez aussi glisser-déposer les images ici.
              Elles seront visibles par toutes les personnes qui reçoivent l'annonce.
            </p>
          </div>
        </form>
      </Modal>

      {visionneuse && (
        <Visionneuse
          images={visionneuse.images}
          index={visionneuse.index}
          onFermer={() => setVisionneuse(null)}
          onChanger={(index) => setVisionneuse({ ...visionneuse, index })}
        />
      )}
    </div>
  );
}
