import { useMemo, useRef, useState } from "react";
import { Upload, FileSpreadsheet, FileText, Loader2, CheckCircle2, AlertTriangle, RotateCcw } from "lucide-react";
import Modal from "../../components/ui/Modal";
import { useToast, extractErrorMessage } from "../../context/ToastContext";
import { elevesApi } from "../../api/endpoints";

const STATUTS = {
  nouveau: { libelle: "Nouvel élève", style: "bg-emerald-50 text-emerald-700" },
  existant: { libelle: "Déjà connu : inscription", style: "bg-sky-50 text-sky-700" },
  deja_inscrit: { libelle: "Déjà inscrit — ignoré", style: "bg-slate-100 text-slate-500" },
  doublon: { libelle: "Doublon — ignoré", style: "bg-slate-100 text-slate-500" },
  erreur: { libelle: "À compléter", style: "bg-amber-50 text-amber-700" },
};

/** Contrôle côté navigateur des lignes modifiées dans l'aperçu (le serveur revérifie tout à l'import). */
function controler(ligne) {
  if (ligne.statut === "deja_inscrit" || ligne.statut === "doublon") return ligne;
  const erreurs = [];
  if (!ligne.nom?.trim()) erreurs.push("Nom manquant");
  if (!ligne.prenom?.trim()) erreurs.push("Prénom manquant");
  if (!["M", "F"].includes(ligne.sexe)) erreurs.push("Sexe à préciser");
  if (!ligne.date_naissance) erreurs.push("Date de naissance à préciser");
  if (!ligne.classe) erreurs.push("Classe à choisir");
  const statut = erreurs.length ? "erreur" : ligne.eleve_existant ? "existant" : "nouveau";
  return { ...ligne, erreurs, statut };
}

export default function ImportElevesModal({ open, onClose, classes, onImported }) {
  const { notify } = useToast();
  const inputRef = useRef(null);
  const [fichier, setFichier] = useState(null);
  const [classeDefaut, setClasseDefaut] = useState("");
  const [analyse, setAnalyse] = useState(null);
  const [lignes, setLignes] = useState([]);
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState(null);
  const [filtre, setFiltre] = useState("tous");

  const reinitialiser = () => {
    setFichier(null);
    setAnalyse(null);
    setLignes([]);
    setResultat(null);
    setFiltre("tous");
    if (inputRef.current) inputRef.current.value = "";
  };

  const fermer = () => {
    reinitialiser();
    setClasseDefaut("");
    onClose();
  };

  const choisirFichier = (f) => {
    if (!f) return;
    if (!/\.(xlsx|xlsm|csv|txt|pdf)$/i.test(f.name)) {
      notify("Choisissez un fichier Excel (.xlsx), CSV ou PDF.", "error");
      return;
    }
    setFichier(f);
    setAnalyse(null);
    setResultat(null);
  };

  const analyser = async () => {
    setEnCours(true);
    try {
      const donnees = await elevesApi.importerAnalyser(fichier, classeDefaut || undefined);
      setAnalyse(donnees);
      setLignes(donnees.lignes.map((l, i) => ({ ...l, _id: i, inclure: !["deja_inscrit", "doublon"].includes(l.statut) })));
      setFiltre(donnees.resume.erreur ? "erreur" : "tous");
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setEnCours(false);
    }
  };

  const modifier = (id, champs) =>
    setLignes((prec) => prec.map((l) => (l._id === id ? controler({ ...l, ...champs }) : l)));

  /** Associe d'un coup toutes les lignes d'un libellé de classe inconnu à une classe existante. */
  const associerClasse = (libelle, classeId) =>
    setLignes((prec) => prec.map((l) => (l.classe_libelle === libelle && !l.classe_force ? controler({ ...l, classe: classeId ? Number(classeId) : null }) : l)));

  const aImporter = lignes.filter((l) => l.inclure && (l.statut === "nouveau" || l.statut === "existant"));
  const aCompleter = lignes.filter((l) => l.inclure && l.statut === "erreur");

  const parClasse = useMemo(() => {
    const compte = {};
    aImporter.forEach((l) => {
      const nom = classes.find((c) => String(c.id) === String(l.classe))?.nom || "?";
      compte[nom] = (compte[nom] || 0) + 1;
    });
    return Object.entries(compte).sort((a, b) => a[0].localeCompare(b[0], "fr", { numeric: true }));
  }, [aImporter, classes]);

  const lignesAffichees = lignes.filter((l) =>
    filtre === "tous" ? true : filtre === "ignores" ? ["deja_inscrit", "doublon"].includes(l.statut) : l.statut === filtre
  );

  const importer = async () => {
    setEnCours(true);
    try {
      const envoi = aImporter.map(({ _id, inclure, erreurs, statut, ...l }) => l);
      const r = await elevesApi.importer(envoi);
      setResultat(r);
      if (r.inscrits) {
        notify(`${r.inscrits} élève(s) inscrit(s) avec succès.`, "success");
        onImported?.();
      }
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setEnCours(false);
    }
  };

  const optionsClasses = classes.map((c) => (
    <option key={c.id} value={c.id}>
      {c.nom}{c.annee_scolaire_libelle ? ` (${c.annee_scolaire_libelle})` : ""}
    </option>
  ));

  let footer;
  if (resultat) {
    footer = (
      <>
        <button className="btn-secondary" onClick={reinitialiser}><RotateCcw size={16} /> Importer un autre fichier</button>
        <button className="btn-primary" onClick={fermer}>Terminer</button>
      </>
    );
  } else if (analyse) {
    footer = (
      <>
        <button className="btn-secondary" onClick={reinitialiser} disabled={enCours}>Changer de fichier</button>
        <button className="btn-primary" onClick={importer} disabled={enCours || aImporter.length === 0}>
          {enCours && <Loader2 size={16} className="animate-spin" />}
          Inscrire {aImporter.length} élève{aImporter.length > 1 ? "s" : ""}
        </button>
      </>
    );
  } else {
    footer = (
      <>
        <button className="btn-secondary" onClick={fermer}>Annuler</button>
        <button className="btn-primary" onClick={analyser} disabled={!fichier || enCours}>
          {enCours && <Loader2 size={16} className="animate-spin" />}
          Analyser le fichier
        </button>
      </>
    );
  }

  return (
    <Modal open={open} onClose={fermer} title="Importer une liste d'élèves" width={analyse ? "max-w-6xl" : "max-w-xl"} footer={footer}>
      {/* --- 1. Choix du fichier --- */}
      {!analyse && !resultat && (
        <div className="space-y-4">
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); choisirFichier(e.dataTransfer.files?.[0]); }}
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center hover:border-brand-400 hover:bg-brand-50/40"
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xlsm,.csv,.txt,.pdf"
              className="hidden"
              onChange={(e) => choisirFichier(e.target.files?.[0])}
            />
            {fichier ? (
              <>
                {/\.pdf$/i.test(fichier.name) ? <FileText size={34} className="text-rose-500" /> : <FileSpreadsheet size={34} className="text-emerald-600" />}
                <p className="font-semibold text-slate-800">{fichier.name}</p>
                <p className="text-xs text-slate-500">{(fichier.size / 1024).toFixed(0)} Ko · cliquez pour changer</p>
              </>
            ) : (
              <>
                <Upload size={34} className="text-brand-500" />
                <p className="font-semibold text-slate-800">Glissez votre fichier ici ou cliquez pour le choisir</p>
                <p className="text-xs text-slate-500">Excel (.xlsx), CSV ou PDF — 10 Mo maximum</p>
              </>
            )}
          </div>

          <div>
            <label className="label">Classe par défaut <span className="font-normal text-slate-400">(facultatif)</span></label>
            <select className="input" value={classeDefaut} onChange={(e) => setClasseDefaut(e.target.value)}>
              <option value="">Détecter la classe dans le fichier</option>
              {optionsClasses}
            </select>
            <p className="mt-1 text-xs text-slate-500">Utilisée seulement pour les élèves dont le fichier n'indique pas la classe.</p>
          </div>

          <div className="rounded-xl bg-brand-50/60 p-3 text-xs text-slate-600">
            <p className="mb-1 font-semibold text-brand-700">Comment la classe est reconnue</p>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>une colonne « Classe » dans le tableau ;</li>
              <li>un titre au-dessus du tableau (« Classe : 6e A ») ;</li>
              <li>le nom de l'onglet Excel (un onglet par classe).</li>
            </ul>
            <p className="mt-2">
              Colonnes lues : Nom, Prénom (ou « Nom et prénom »), Sexe, Date et lieu de naissance, Matricule, parents, téléphone…
              Rien n'est enregistré avant votre confirmation.
            </p>
          </div>
        </div>
      )}

      {/* --- 2. Aperçu modifiable --- */}
      {analyse && !resultat && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {[
              ["tous", `Tous (${lignes.length})`],
              ["nouveau", `Nouveaux (${lignes.filter((l) => l.statut === "nouveau").length})`],
              ["existant", `Déjà connus (${lignes.filter((l) => l.statut === "existant").length})`],
              ["erreur", `À compléter (${lignes.filter((l) => l.statut === "erreur").length})`],
              ["ignores", `Ignorés (${lignes.filter((l) => ["deja_inscrit", "doublon"].includes(l.statut)).length})`],
            ].map(([cle, libelle]) => (
              <button
                key={cle}
                onClick={() => setFiltre(cle)}
                className={`rounded-full px-3 py-1 font-semibold ${filtre === cle ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {libelle}
              </button>
            ))}
          </div>

          {analyse.classes_non_reconnues.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-amber-800">
                <AlertTriangle size={16} /> Classes du fichier non reconnues : associez-les à une classe existante
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {analyse.classes_non_reconnues.map((libelle) => (
                  <label key={libelle} className="flex items-center gap-2 text-sm">
                    <span className="min-w-[110px] truncate font-medium text-slate-700" title={libelle}>« {libelle} »</span>
                    <select
                      className="input py-1.5 text-xs"
                      defaultValue=""
                      onChange={(e) => associerClasse(libelle, e.target.value)}
                    >
                      <option value="">Choisir…</option>
                      {optionsClasses}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="max-h-[50vh] overflow-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-2"></th>
                  <th className="px-2 py-2">Nom</th>
                  <th className="px-2 py-2">Prénom</th>
                  <th className="px-2 py-2">Sexe</th>
                  <th className="px-2 py-2">Né(e) le</th>
                  <th className="px-2 py-2">Classe</th>
                  <th className="px-2 py-2">État</th>
                </tr>
              </thead>
              <tbody>
                {lignesAffichees.map((l) => {
                  const ignore = ["deja_inscrit", "doublon"].includes(l.statut);
                  const statut = STATUTS[l.statut];
                  return (
                    <tr key={l._id} className={`border-t border-slate-100 ${!l.inclure || ignore ? "opacity-50" : ""}`}>
                      <td className="px-2 py-1.5">
                        <input
                          type="checkbox"
                          checked={l.inclure && !ignore}
                          disabled={ignore}
                          onChange={(e) => modifier(l._id, { inclure: e.target.checked })}
                          title="Inclure dans l'import"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input className="input py-1 text-xs uppercase" value={l.nom} disabled={ignore}
                          onChange={(e) => modifier(l._id, { nom: e.target.value })} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input className="input py-1 text-xs" value={l.prenom} disabled={ignore}
                          onChange={(e) => modifier(l._id, { prenom: e.target.value })} />
                      </td>
                      <td className="px-2 py-1.5">
                        <select className={`input py-1 text-xs ${!l.sexe && !ignore ? "border-amber-400" : ""}`} value={l.sexe} disabled={ignore}
                          onChange={(e) => modifier(l._id, { sexe: e.target.value })}>
                          <option value="">?</option>
                          <option value="M">M</option>
                          <option value="F">F</option>
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="date" className={`input py-1 text-xs ${!l.date_naissance && !ignore ? "border-amber-400" : ""}`}
                          value={l.date_naissance} disabled={ignore}
                          title={l.date_lue && !l.date_naissance ? `Valeur lue dans le fichier : ${l.date_lue}` : ""}
                          onChange={(e) => modifier(l._id, { date_naissance: e.target.value })} />
                      </td>
                      <td className="px-2 py-1.5">
                        <select className={`input py-1 text-xs ${!l.classe && !ignore ? "border-amber-400" : ""}`}
                          value={l.classe || ""} disabled={ignore}
                          title={l.classe_libelle ? `Dans le fichier : ${l.classe_libelle}` : ""}
                          onChange={(e) => modifier(l._id, { classe: e.target.value ? Number(e.target.value) : null, classe_force: true })}>
                          <option value="">{l.classe_libelle ? `« ${l.classe_libelle} » ?` : "Choisir…"}</option>
                          {optionsClasses}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <span className={`badge whitespace-nowrap ${statut.style}`}>{statut.libelle}</span>
                        {l.statut === "existant" && l.eleve_existant_matricule && (
                          <div className="mt-0.5 font-mono text-[10px] text-slate-400">{l.eleve_existant_matricule}</div>
                        )}
                        {l.erreurs?.length > 0 && <div className="mt-0.5 text-[10px] text-amber-700">{l.erreurs.join(" · ")}</div>}
                      </td>
                    </tr>
                  );
                })}
                {lignesAffichees.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-slate-400">Aucune ligne dans cette catégorie.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <strong className="text-slate-800">{aImporter.length}</strong> élève(s) prêt(s) à inscrire
            {parClasse.map(([nom, n]) => (
              <span key={nom} className="rounded-full bg-brand-50 px-2 py-0.5 font-semibold text-brand-700">{nom} : {n}</span>
            ))}
            {aCompleter.length > 0 && (
              <span className="text-amber-700">· {aCompleter.length} ligne(s) à compléter ne seront pas importées</span>
            )}
          </div>
        </div>
      )}

      {/* --- 3. Résultat --- */}
      {resultat && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-4">
            <CheckCircle2 className="mt-0.5 text-emerald-600" size={22} />
            <div className="text-sm text-slate-700">
              <p className="font-semibold text-emerald-800">{resultat.inscrits} élève(s) inscrit(s)</p>
              <p>{resultat.crees} nouveau(x) dossier(s) créé(s) · {resultat.inscrits - resultat.crees} élève(s) déjà connu(s) réinscrit(s) · {resultat.ignores} ignoré(s)</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.entries(resultat.par_classe).map(([nom, n]) => (
                  <span key={nom} className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-emerald-700">{nom} : {n}</span>
                ))}
              </div>
            </div>
          </div>
          {resultat.erreurs.length > 0 && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <p className="mb-1 font-semibold">{resultat.erreurs.length} ligne(s) non importée(s) :</p>
              <ul className="space-y-0.5">
                {resultat.erreurs.map((e, i) => <li key={i}>{e.eleve} ({e.source}) — {e.erreur}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
