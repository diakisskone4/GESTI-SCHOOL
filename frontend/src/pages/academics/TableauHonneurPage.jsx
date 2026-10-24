import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Calculator, Download, Eye, FileText, Loader2, Megaphone, Trophy } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import Modal from "../../components/ui/Modal";
import { useFetch } from "../../hooks/useFetch";
import { useAuth } from "../../context/AuthContext";
import { useToast, extractErrorMessage } from "../../context/ToastContext";
import { periodesApi, tableauHonneurApi } from "../../api/endpoints";
import { downloadAuthFile, fetchAuthBlobUrl } from "../../utils/download";

const COULEURS_RANG = {
  1: "bg-amber-400 text-white",
  2: "bg-slate-400 text-white",
  3: "bg-orange-700 text-white",
};
const rangTexte = (rang) => (rang === 1 ? "1er" : `${rang}e`);
const moyenneTexte = (m) => Number(m).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Portrait({ laureat }) {
  const [erreur, setErreur] = useState(false);
  if (laureat.photo && !erreur) {
    return <img src={laureat.photo} alt="" onError={() => setErreur(true)} className="h-24 w-24 rounded-full object-cover ring-4 ring-white" />;
  }
  return (
    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-brand-100 text-2xl font-bold text-brand-700 ring-4 ring-white">
      {`${laureat.prenom?.[0] ?? ""}${laureat.nom?.[0] ?? ""}`.toUpperCase()}
    </div>
  );
}

function CarteLaureat({ classe, laureat }) {
  return (
    <div className={`card relative flex flex-col items-center p-5 text-center ${laureat.rang === 1 ? "border-amber-300 bg-amber-50/60" : ""}`}>
      <div className="relative">
        <Portrait laureat={laureat} />
        <span className={`absolute -bottom-1 -right-1 rounded-full px-2 py-0.5 text-xs font-bold shadow ${COULEURS_RANG[laureat.rang] || "bg-brand-600 text-white"}`}>
          {rangTexte(laureat.rang)}
        </span>
      </div>
      <p className="mt-3 font-bold text-slate-900">{laureat.prenom} {laureat.nom.toUpperCase()}</p>
      <p className="text-sm text-slate-500">{classe.nom}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-brand-700">{moyenneTexte(laureat.moyenne)}<span className="text-sm font-medium text-slate-400"> / 20</span></p>
      {laureat.mention && <p className="text-xs italic text-slate-500">{laureat.mention}{laureat.effectif ? ` · ${laureat.effectif} élèves classés` : ""}</p>}
    </div>
  );
}

/**
 * Tableau d'honneur : les premiers de chaque classe pour une période (moyennes des bulletins),
 * affiche téléchargeable (PNG / PDF) et publication comme annonce visible par tous.
 */
export default function TableauHonneurPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const estAdmin = user?.est_admin;

  const { data: periodesData } = useFetch(() => periodesApi.list({ page_size: 100 }), []);
  const periodes = useMemo(() => periodesData?.results || [], [periodesData]);
  const [periodeChoisie, setPeriode] = useState("");
  const [nombre, setNombre] = useState(1);
  // Tant que rien n'est choisi : la période en cours, sinon la plus récente
  const periodeParDefaut = periodes.find((p) => p.est_courante) || periodes[periodes.length - 1];
  const periode = periodeChoisie || (periodeParDefaut ? String(periodeParDefaut.id) : "");

  const { data, loading, reload } = useFetch(
    () => (periode ? tableauHonneurApi.laureats({ periode, nombre }) : Promise.resolve(null)),
    [periode, nombre]
  );
  const classes = data?.classes || [];
  const sansResultats = data?.classes_sans_resultats || [];
  const nbLaureats = classes.reduce((n, c) => n + c.laureats.length, 0);

  const [occupe, setOccupe] = useState(null);
  const [apercu, setApercu] = useState(null); // URL blob de l'affiche
  const [publication, setPublication] = useState(null);

  useEffect(() => () => apercu && URL.revokeObjectURL(apercu), [apercu]);

  const libellePeriode = periodes.find((p) => String(p.id) === periode)?.libelle || "";

  const calculer = async () => {
    setOccupe("calcul");
    try {
      const r = await tableauHonneurApi.calculer(periode);
      notify(r.detail, "success");
      reload();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setOccupe(null);
    }
  };

  const voirAffiche = async () => {
    setOccupe("apercu");
    try {
      setApercu(await fetchAuthBlobUrl(tableauHonneurApi.affichePath(periode, nombre)));
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setOccupe(null);
    }
  };

  const telecharger = async (fichier) => {
    setOccupe(fichier);
    try {
      const nom = `tableau_honneur_${libellePeriode.replace(/\s+/g, "_")}.${fichier}`;
      await downloadAuthFile(tableauHonneurApi.affichePath(periode, nombre, fichier), nom, { open: false });
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setOccupe(null);
    }
  };

  const publier = async (e) => {
    e.preventDefault();
    setOccupe("publier");
    try {
      await tableauHonneurApi.publier({ periode, nombre, ...publication });
      setPublication(null);
      notify("Tableau d'honneur publié dans les annonces.", "success");
      navigate("/annonces");
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setOccupe(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tableau d'honneur"
        subtitle="Les premiers de chaque classe, d'après les moyennes des bulletins. Affiche à imprimer ou à publier."
        actions={
          <>
            <button className="btn-secondary" onClick={voirAffiche} disabled={!nbLaureats || !!occupe}>
              {occupe === "apercu" ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />} Voir l'affiche
            </button>
            {estAdmin && (
              <button
                className="btn-primary" disabled={!nbLaureats || !!occupe}
                onClick={() => setPublication({ titre: `Tableau d'honneur — ${libellePeriode}`, message: "", public_cible: "tous", epinglee: true })}
              >
                <Megaphone size={16} /> Publier comme annonce
              </button>
            )}
          </>
        }
      />

      <div className="card flex flex-wrap items-end gap-4 p-4">
        <div>
          <label className="label">Période</label>
          <select className="input w-auto min-w-56" value={periode} onChange={(e) => setPeriode(e.target.value)}>
            {periodes.length === 0 && <option value="">Aucune période</option>}
            {periodes.map((p) => (
              <option key={p.id} value={p.id}>{p.libelle} ({p.annee_scolaire_libelle}){p.est_courante ? " — en cours" : ""}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Élèves par classe</label>
          <div className="flex rounded-xl border border-slate-200 bg-white p-1">
            {[1, 2, 3].map((n) => (
              <button key={n} onClick={() => setNombre(n)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${nombre === n ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
                {n === 1 ? "Le 1er" : `Les ${n} premiers`}
              </button>
            ))}
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <button className="btn-secondary px-3 py-2 text-xs" onClick={() => telecharger("png")} disabled={!nbLaureats || !!occupe}>
            {occupe === "png" ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Image (PNG)
          </button>
          <button className="btn-secondary px-3 py-2 text-xs" onClick={() => telecharger("pdf")} disabled={!nbLaureats || !!occupe}>
            {occupe === "pdf" ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} PDF à imprimer
          </button>
        </div>
      </div>

      {sansResultats.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle size={18} className="shrink-0" />
          <p className="flex-1">
            <strong>{sansResultats.length} classe(s)</strong> sans moyennes calculées pour cette période :{" "}
            {sansResultats.map((c) => c.nom).join(", ")}.
          </p>
          {estAdmin && (
            <button className="btn-secondary px-3 py-2 text-xs" onClick={calculer} disabled={!!occupe}>
              {occupe === "calcul" ? <Loader2 size={14} className="animate-spin" /> : <Calculator size={14} />} Calculer les moyennes
            </button>
          )}
        </div>
      )}

      {loading && !data ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-slate-400" /></div>
      ) : nbLaureats === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-10 text-center">
          <Trophy size={32} className="text-amber-400" />
          <p className="font-semibold text-slate-700">Aucun lauréat pour cette période</p>
          <p className="text-sm text-slate-500">Saisissez les notes puis calculez les moyennes pour établir le classement.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <Trophy size={16} className="text-amber-500" />
            <strong>{nbLaureats}</strong> lauréat(s) dans <strong>{classes.length}</strong> classe(s) — {libellePeriode}
          </p>
          {nombre === 1 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {classes.map((c) => <CarteLaureat key={c.id} classe={c} laureat={c.laureats[0]} />)}
            </div>
          ) : (
            classes.map((c) => (
              <section key={c.id}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">{c.nom}</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {c.laureats.map((l) => <CarteLaureat key={l.eleve_id} classe={c} laureat={l} />)}
                </div>
              </section>
            ))
          )}
        </div>
      )}

      <Modal open={!!apercu} onClose={() => setApercu(null)} title="Affiche du tableau d'honneur" width="max-w-3xl"
        footer={<>
          <button className="btn-secondary" onClick={() => telecharger("pdf")} disabled={!!occupe}><FileText size={16} /> PDF</button>
          <button className="btn-primary" onClick={() => telecharger("png")} disabled={!!occupe}><Download size={16} /> Télécharger l'image</button>
        </>}
      >
        {apercu && <img src={apercu} alt="Affiche du tableau d'honneur" className="w-full rounded-lg border border-slate-200" />}
      </Modal>

      <Modal open={!!publication} onClose={() => setPublication(null)} title="Publier le tableau d'honneur"
        footer={<>
          <button className="btn-secondary" onClick={() => setPublication(null)}>Annuler</button>
          <button className="btn-primary" form="publication-form" disabled={occupe === "publier"}>
            {occupe === "publier" && <Loader2 size={16} className="animate-spin" />} Publier
          </button>
        </>}
      >
        {publication && (
          <form id="publication-form" onSubmit={publier} className="space-y-4">
            <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              L'affiche (photos, noms, classes et moyennes) est publiée comme annonce, avec la liste des lauréats en texte.
            </p>
            <div>
              <label className="label">Titre</label>
              <input required maxLength={200} className="input" value={publication.titre} onChange={(e) => setPublication({ ...publication, titre: e.target.value })} />
            </div>
            <div>
              <label className="label">Message (facultatif)</label>
              <textarea rows={3} className="input" placeholder="Félicitations aux meilleurs élèves !"
                value={publication.message} onChange={(e) => setPublication({ ...publication, message: e.target.value })} />
            </div>
            <div>
              <label className="label">Public</label>
              <select className="input" value={publication.public_cible} onChange={(e) => setPublication({ ...publication, public_cible: e.target.value })}>
                <option value="tous">Tout le monde</option>
                <option value="eleves">Élèves</option>
                <option value="parents">Parents</option>
                <option value="enseignants">Enseignants</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={publication.epinglee} onChange={(e) => setPublication({ ...publication, epinglee: e.target.checked })} />
              Épingler en haut des annonces
            </label>
          </form>
        )}
      </Modal>
    </div>
  );
}
