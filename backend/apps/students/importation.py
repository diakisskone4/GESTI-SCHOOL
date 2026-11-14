"""Import de listes d'élèves depuis un fichier Excel (.xlsx), CSV ou PDF.

Deux temps :
1. `analyser_fichier` lit le fichier et en tire, ligne par ligne, les élèves et leur classe,
   sans rien enregistrer : l'administrateur voit un aperçu qu'il peut corriger.
2. `importer_lignes` inscrit les lignes validées (création de l'élève + inscription en classe).

La classe de chaque élève est retrouvée, dans l'ordre :
- une colonne « Classe » du tableau ;
- un titre au-dessus du tableau (« Classe : 6e A », « Liste des élèves de la 6ème A »...) ;
- le nom de l'onglet Excel (un onglet par classe) ;
- la classe choisie par défaut lors de l'import.
"""
import csv
import datetime
import io
import re
import unicodedata

from django.db import IntegrityError, transaction

from apps.core.models import Classe
from apps.students.models import Eleve, Inscription

TAILLE_MAX = 10 * 1024 * 1024
LIGNES_MAX = 5000
EXTENSIONS = (".xlsx", ".xlsm", ".csv", ".txt", ".pdf")


class FichierIllisible(ValueError):
    """Le fichier ne peut pas être lu (format non pris en charge, vide, protégé...)."""


# ---------------------------------------------------------------------------
# Normalisation
# ---------------------------------------------------------------------------
def normaliser(texte):
    """Minuscules sans accents ni ponctuation : « Date de Naissance » → « date de naissance »."""
    texte = unicodedata.normalize("NFKD", str(texte or "")).encode("ascii", "ignore").decode()
    texte = re.sub(r"[^a-z0-9]+", " ", texte.lower())
    return re.sub(r"\s+", " ", texte).strip()


def cle_classe(texte):
    """Forme comparable d'un nom de classe : « Classe 6ème A » → « 6e a », « 1ère année » → « 1e annee »."""
    t = normaliser(texte)
    t = re.sub(r"^(la |le |l )?(classe|cl)\s+(de |du |des )?", "", t)
    t = re.sub(r"\b(\d+)\s*(eme|ieme|em|e|er|ere|re|nd|nde)\b", r"\1e", t)
    return t.strip()


# ---------------------------------------------------------------------------
# Lecture des fichiers : liste de « feuilles » (titre, lignes de cellules)
# ---------------------------------------------------------------------------
def _cellule(valeur):
    if valeur is None:
        return ""
    if isinstance(valeur, (datetime.datetime, datetime.date)):
        return valeur.date() if isinstance(valeur, datetime.datetime) else valeur
    if isinstance(valeur, float) and valeur.is_integer():
        return str(int(valeur))
    return str(valeur).replace("\n", " ").strip()


def _lire_excel(contenu):
    from openpyxl import load_workbook

    try:
        classeur = load_workbook(io.BytesIO(contenu), read_only=True, data_only=True)
    except Exception as exc:  # noqa: BLE001 - fichier corrompu ou protégé
        raise FichierIllisible("Ce fichier Excel ne peut pas être lu (corrompu ou protégé par mot de passe).") from exc
    feuilles = []
    for onglet in classeur.worksheets:
        lignes = [[_cellule(v) for v in ligne] for ligne in onglet.iter_rows(values_only=True)]
        feuilles.append((onglet.title, lignes))
    classeur.close()
    return feuilles


def _lire_csv(contenu):
    for encodage in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            texte = contenu.decode(encodage)
            break
        except UnicodeDecodeError:
            continue
    echantillon = texte[:5000]
    try:
        dialecte = csv.Sniffer().sniff(echantillon, delimiters=";,\t|")
    except csv.Error:
        dialecte = csv.excel
        dialecte.delimiter = ";" if echantillon.count(";") > echantillon.count(",") else ","
    lignes = [[c.strip() for c in ligne] for ligne in csv.reader(io.StringIO(texte), dialecte)]
    return [("", lignes)]


def _lire_pdf(contenu):
    import pdfplumber

    try:
        pdf = pdfplumber.open(io.BytesIO(contenu))
    except Exception as exc:  # noqa: BLE001
        raise FichierIllisible("Ce PDF ne peut pas être lu (corrompu ou protégé par mot de passe).") from exc
    lignes = []
    with pdf:
        for page in pdf.pages:
            tableaux = page.find_tables()
            if not tableaux:
                # Pas de tableau tracé : colonnes séparées par de larges espaces
                for texte in (page.extract_text(layout=True) or "").splitlines():
                    if texte.strip():
                        lignes.append([c.strip() for c in re.split(r"\s{2,}|\t", texte.strip())])
                continue
            # Le texte situé au-dessus de chaque tableau (titre « Classe : ... ») est conservé dans l'ordre
            haut = 0
            for tableau in sorted(tableaux, key=lambda t: t.bbox[1]):
                x0, y0, x1, y1 = tableau.bbox
                if y0 > haut + 1:
                    zone = page.crop((0, haut, page.width, y0)).extract_text() or ""
                    lignes.extend([t.strip()] for t in zone.splitlines() if t.strip())
                lignes.extend([_cellule(c) for c in ligne] for ligne in tableau.extract())
                haut = y1
    if not any(any(c for c in ligne) for ligne in lignes):
        raise FichierIllisible(
            "Aucun texte n'a été trouvé dans ce PDF : il s'agit sans doute d'un document scanné (image). "
            "Utilisez le fichier Excel ou CSV d'origine."
        )
    return [("", lignes)]


def lire_fichier(nom, contenu):
    extension = "." + nom.rsplit(".", 1)[-1].lower() if "." in nom else ""
    if extension == ".xls":
        raise FichierIllisible("L'ancien format Excel (.xls) n'est pas pris en charge : enregistrez le fichier en .xlsx.")
    if extension not in EXTENSIONS:
        raise FichierIllisible("Format non pris en charge. Utilisez un fichier Excel (.xlsx), CSV ou PDF.")
    if not contenu:
        raise FichierIllisible("Le fichier est vide.")
    if len(contenu) > TAILLE_MAX:
        raise FichierIllisible("Le fichier dépasse 10 Mo.")
    if extension in (".xlsx", ".xlsm"):
        return _lire_excel(contenu)
    if extension == ".pdf":
        return _lire_pdf(contenu)
    return _lire_csv(contenu)


# ---------------------------------------------------------------------------
# Reconnaissance des colonnes
# ---------------------------------------------------------------------------
# Libellés d'en-tête reconnus (comparés après normalisation)
COLONNES = {
    "nom_complet": ["nom et prenom", "nom et prenoms", "nom prenom", "nom prenoms", "prenom et nom", "prenoms et nom",
                    "prenom nom", "nom complet", "noms et prenoms", "eleve", "eleves", "nom de l eleve", "identite",
                    "apprenant", "nom s et prenom s"],
    "nom": ["nom", "noms", "nom de famille", "patronyme", "nom eleve", "nom de l eleve"],
    "prenom": ["prenom", "prenoms", "prenom s", "prenom eleve"],
    "sexe": ["sexe", "genre", "s", "sx", "g f", "m f", "f g"],
    "date_naissance": ["date de naissance", "date naissance", "ne le", "ne e le", "nee le", "date nais", "naissance",
                       "dn", "d n", "date de naiss", "ddn"],
    "lieu_naissance": ["lieu de naissance", "lieu naissance", "lieu", "ne a", "ne e a", "lieu de naiss"],
    "classe": ["classe", "classes", "niveau classe", "cl", "salle de classe"],
    "matricule": ["matricule", "n matricule", "numero matricule", "mat", "no matricule", "id eleve", "identifiant"],
    "nationalite": ["nationalite"],
    "nom_pere": ["nom du pere", "pere", "nom pere", "prenom et nom du pere"],
    "nom_mere": ["nom de la mere", "mere", "nom mere", "prenom et nom de la mere"],
    "adresse": ["adresse", "domicile", "quartier", "residence"],
    "contact_urgence_nom": ["parent", "tuteur", "parent tuteur", "nom du parent", "nom du tuteur", "responsable",
                            "personne a contacter", "contact"],
    "contact_urgence_telephone": ["telephone", "tel", "telephone parent", "tel parent", "contact telephonique",
                                  "numero de telephone", "portable", "cellulaire", "telephone du parent",
                                  "tel du parent", "telephone tuteur"],
    "ecole_provenance": ["ecole de provenance", "provenance", "ecole d origine", "etablissement d origine"],
    "statut": ["statut", "nouveau redoublant", "redoublant", "statut eleve", "n r"],
}
_INDEX_COLONNES = {libelle: champ for champ, libelles in COLONNES.items() for libelle in libelles}
COLONNES_ORDRE = ["n", "no", "num", "numero", "n d ordre", "ordre", "rang", "nr"]


def _champ_de_lentete(texte):
    t = normaliser(texte)
    if not t:
        return None
    if t in _INDEX_COLONNES:
        return _INDEX_COLONNES[t]
    if "prenom" in t and "nom" in t.replace("prenom", ""):
        return "nom_complet"
    for prefixe, champ in (("date de naissance", "date_naissance"), ("lieu de naissance", "lieu_naissance"),
                           ("telephone", "contact_urgence_telephone"), ("matricule", "matricule"),
                           ("prenom", "prenom"), ("classe", "classe"), ("sexe", "sexe")):
        if t.startswith(prefixe):
            return champ
    return None


def _detecter_entete(ligne):
    """Colonnes reconnues d'une ligne d'en-tête ({index: champ}), ou None si ce n'en est pas une."""
    colonnes = {}
    for i, cellule in enumerate(ligne):
        if isinstance(cellule, datetime.date):
            return None
        champ = _champ_de_lentete(cellule)
        if champ and champ not in colonnes.values():
            colonnes[i] = champ
    champs = set(colonnes.values())
    a_un_nom = "nom_complet" in champs or "nom" in champs
    if a_un_nom and len(champs) >= 2:
        return colonnes
    return None


# ---------------------------------------------------------------------------
# Interprétation des valeurs
# ---------------------------------------------------------------------------
def lire_sexe(valeur):
    t = normaliser(valeur)
    if t in ("m", "masculin", "masc", "garcon", "g", "h", "homme", "male", "1", "mr", "m r"):
        return "M"
    if t in ("f", "feminin", "fem", "fille", "femme", "female", "2", "mlle", "mme"):
        return "F"
    return ""


def lire_date(valeur):
    """Date au format ISO (AAAA-MM-JJ), ou "" si la valeur n'est pas une date reconnue."""
    if isinstance(valeur, datetime.date):
        return valeur.isoformat()
    texte = str(valeur or "").strip()
    if not texte:
        return ""
    if re.fullmatch(r"\d{5}(\.0)?", texte):  # numéro de série Excel
        jour = datetime.date(1899, 12, 30) + datetime.timedelta(days=int(float(texte)))
        return jour.isoformat() if 1950 <= jour.year <= 2100 else ""
    texte = re.sub(r"\s+", "", texte.split(" ")[0] if re.match(r"\d{4}-\d{2}-\d{2} ", texte) else texte)
    m = re.fullmatch(r"(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})", texte)
    if m:
        a, mo, j = (int(x) for x in m.groups())
    else:
        m = re.fullmatch(r"(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})", texte)
        if not m:
            return ""
        j, mo, a = (int(x) for x in m.groups())
        if a < 100:
            a += 2000 if a <= datetime.date.today().year % 100 else 1900
    try:
        date = datetime.date(a, mo, j)
    except ValueError:
        return ""
    return date.isoformat() if 1950 <= date.year <= datetime.date.today().year else ""


def separer_nom_complet(texte):
    """« TRAORE Awa » ou « Awa TRAORE » → (nom, prénom) : les mots en MAJUSCULES forment le nom.
    Sans majuscules distinctives, le dernier mot est le nom (« Moussa Diarra »)."""
    mots = [m for m in re.split(r"\s+", str(texte).strip()) if m]
    if len(mots) < 2:
        return (mots[0] if mots else ""), ""
    majuscules = [m for m in mots if len(re.sub(r"[^A-Za-zÀ-ÿ]", "", m)) > 1 and m.isupper()]
    if majuscules and len(majuscules) < len(mots):
        nom = " ".join(majuscules)
        prenom = " ".join(m for m in mots if m not in majuscules)
        return nom, prenom
    return mots[-1], " ".join(mots[:-1])


def _propre(texte):
    """Nom ou prénom lisible : espaces normalisés, sans puces ni numéros d'ordre collés."""
    texte = re.sub(r"^\s*\d+\s*[-.)]\s*", "", str(texte or ""))
    return re.sub(r"\s+", " ", texte).strip(" .-–—")


# ---------------------------------------------------------------------------
# Correspondance des classes
# ---------------------------------------------------------------------------
class ReferentielClasses:
    """Classes de l'établissement, l'année courante en priorité, comparées par nom normalisé."""

    def __init__(self, etablissement):
        classes = list(
            Classe.objects.filter(etablissement=etablissement).select_related("annee_scolaire", "niveau")
            .order_by("-annee_scolaire__est_courante", "-annee_scolaire__date_debut")
        )
        self.classes = classes
        self.par_cle = {}
        for c in classes:  # la première rencontrée (année courante) l'emporte
            for cle in {cle_classe(c.nom), cle_classe(f"{c.niveau.nom} {c.nom}")}:
                self.par_cle.setdefault(cle, c)

    def trouver(self, texte):
        cle = cle_classe(texte)
        if not cle:
            return None
        if cle in self.par_cle:
            return self.par_cle[cle]
        sans_espace = cle.replace(" ", "")
        for k, c in self.par_cle.items():
            if k.replace(" ", "") == sans_espace:
                return c
        # « Liste des élèves de la 6e A - Année 2025-2026 » : une seule classe dont le nom apparaît en entier
        trouvees = {c.pk: c for k, c in self.par_cle.items() if len(k) >= 2 and re.search(rf"(^| ){re.escape(k)}( |$)", cle)}
        if len(trouvees) == 1:
            return next(iter(trouvees.values()))
        if len(trouvees) > 1:  # la plus longue correspondance : « 6e A » plutôt que « 6e »
            return max(trouvees.values(), key=lambda c: len(cle_classe(c.nom)))
        return None


MOTS_TITRE_CLASSE = re.compile(r"\b(classe|cl|niveau|section|salle)\b")


def _titre_de_classe(ligne, referentiel):
    """Une ligne de titre (« Classe : 6e A ») hors tableau : renvoie (libellé, classe ou None)."""
    remplies = [c for c in ligne if isinstance(c, str) and c.strip()]
    if not remplies or len(remplies) > 3:
        return None
    texte = " ".join(remplies)
    norm = normaliser(texte)
    if MOTS_TITRE_CLASSE.search(norm):
        libelle = re.split(r"[:\-–]", texte, maxsplit=1)[-1].strip() if ":" in texte else texte
        return libelle, referentiel.trouver(libelle) or referentiel.trouver(texte)
    classe = referentiel.trouver(texte)
    if classe and len(remplies) == 1 and len(norm) <= 40:
        return texte, classe
    return None


# ---------------------------------------------------------------------------
# Analyse
# ---------------------------------------------------------------------------
def _cellule_texte(ligne, i):
    if i is None or i >= len(ligne):
        return ""
    valeur = ligne[i]
    return valeur if isinstance(valeur, datetime.date) else str(valeur or "").strip()


def _est_ligne_vide_ou_total(ligne):
    remplies = [c for c in ligne if (c if isinstance(c, datetime.date) else str(c or "").strip())]
    if not remplies:
        return True
    premier = normaliser(remplies[0]) if not isinstance(remplies[0], datetime.date) else ""
    return premier.startswith(("total", "effectif", "nombre", "arrete", "fait a", "le directeur", "signature"))


def extraire_eleves(feuilles, referentiel):
    """Toutes les lignes élèves trouvées dans le fichier, avec le libellé de classe d'origine."""
    lignes_eleves = []
    for titre_feuille, lignes in feuilles:
        classe_feuille = referentiel.trouver(titre_feuille) if titre_feuille else None
        contexte = (titre_feuille, classe_feuille) if classe_feuille else ("", None)
        colonnes = None
        for numero, ligne in enumerate(lignes, start=1):
            if not ligne:
                continue
            entete = _detecter_entete(ligne)
            if entete:
                colonnes = entete
                continue
            if colonnes is None or _est_ligne_vide_ou_total(ligne):
                titre = _titre_de_classe(ligne, referentiel) if ligne else None
                if titre:
                    contexte = titre
                continue
            index = {champ: i for i, champ in colonnes.items()}
            titre = _titre_de_classe(ligne, referentiel)
            remplies = [c for c in ligne if str(c or "").strip()]
            if titre and len(remplies) <= 2 and not _cellule_texte(ligne, index.get("prenom")):
                contexte = titre  # nouveau bloc de classe sous le même en-tête
                continue

            if "nom_complet" in index and not ("nom" in index and "prenom" in index):
                nom, prenom = separer_nom_complet(_propre(_cellule_texte(ligne, index["nom_complet"])))
            else:
                nom = _propre(_cellule_texte(ligne, index.get("nom")))
                prenom = _propre(_cellule_texte(ligne, index.get("prenom")))
                if nom and not prenom and " " in nom and "prenom" not in index:
                    nom, prenom = separer_nom_complet(nom)
            if not nom and not prenom:
                continue
            if normaliser(nom) in _INDEX_COLONNES or normaliser(prenom) in ("prenom", "prenoms"):
                continue  # en-tête répété en haut d'une nouvelle page

            libelle_classe = _cellule_texte(ligne, index.get("classe"))
            classe = referentiel.trouver(libelle_classe) if libelle_classe else None
            if not libelle_classe:
                libelle_classe, classe = contexte
            statut = normaliser(_cellule_texte(ligne, index.get("statut")))

            eleve = {
                "source": f"{titre_feuille} · ligne {numero}" if titre_feuille else f"Ligne {numero}",
                "nom": nom.upper(),
                "prenom": prenom,
                "sexe": lire_sexe(_cellule_texte(ligne, index.get("sexe"))),
                "date_naissance": lire_date(_cellule_texte(ligne, index.get("date_naissance"))),
                "date_lue": str(_cellule_texte(ligne, index.get("date_naissance")) or ""),
                "classe_libelle": str(libelle_classe or ""),
                "classe": classe.pk if classe else None,
                "redoublant": statut.startswith(("r", "redoubl")) and not statut.startswith("re inscri"),
            }
            for champ in ("lieu_naissance", "matricule", "nationalite", "nom_pere", "nom_mere", "adresse",
                          "contact_urgence_nom", "contact_urgence_telephone", "ecole_provenance"):
                eleve[champ] = str(_cellule_texte(ligne, index.get(champ)) or "")[:150]
            lignes_eleves.append(eleve)
            if len(lignes_eleves) > LIGNES_MAX:
                raise FichierIllisible(f"Le fichier contient plus de {LIGNES_MAX} élèves : découpez-le en plusieurs fichiers.")
    return lignes_eleves


def _statut_ligne(ligne, etablissement, existants_par_cle, existants_par_matricule, classes):
    """Contrôle d'une ligne avant import : erreurs bloquantes et élève déjà connu."""
    erreurs = []
    if not ligne.get("nom"):
        erreurs.append("Nom manquant")
    if not ligne.get("prenom"):
        erreurs.append("Prénom manquant")
    if ligne.get("sexe") not in ("M", "F"):
        erreurs.append("Sexe à préciser")
    if not ligne.get("date_naissance"):
        erreurs.append("Date de naissance à préciser")
    classe = classes.get(str(ligne.get("classe") or ""))
    if not classe:
        erreurs.append("Classe à choisir")

    existant = None
    if ligne.get("matricule"):
        existant = existants_par_matricule.get(ligne["matricule"].strip().upper())
    if existant is None and ligne.get("date_naissance"):
        existant = existants_par_cle.get((normaliser(ligne.get("nom")), normaliser(ligne.get("prenom")),
                                          ligne["date_naissance"]))
    statut = "nouveau"
    if existant is not None:
        statut = "existant"
        if classe and any(i.annee_scolaire_id == classe.annee_scolaire_id for i in existant.inscriptions_annee):
            statut = "deja_inscrit"
    return {
        **ligne,
        "erreurs": erreurs,
        "statut": "erreur" if erreurs and statut != "deja_inscrit" else statut,
        "eleve_existant": str(existant.pk) if existant else None,
        "eleve_existant_matricule": existant.matricule if existant else "",
    }


def _index_existants(etablissement):
    from django.db.models import Prefetch

    eleves = Eleve.objects.filter(etablissement=etablissement).prefetch_related(
        Prefetch("inscriptions", queryset=Inscription.objects.all(), to_attr="inscriptions_annee")
    )
    par_cle, par_matricule = {}, {}
    for e in eleves:
        par_cle[(normaliser(e.nom), normaliser(e.prenom), e.date_naissance.isoformat())] = e
        par_matricule[e.matricule.upper()] = e
    return par_cle, par_matricule


def verifier_lignes(lignes, etablissement):
    classes = {str(c.pk): c for c in Classe.objects.filter(etablissement=etablissement)}
    par_cle, par_matricule = _index_existants(etablissement)
    verifiees = [_statut_ligne(l, etablissement, par_cle, par_matricule, classes) for l in lignes]
    # Doublons à l'intérieur du fichier lui-même
    vues = {}
    for l in verifiees:
        if l["statut"] == "erreur" or not l.get("date_naissance"):
            continue
        cle = (normaliser(l["nom"]), normaliser(l["prenom"]), l["date_naissance"])
        if cle in vues:
            l["statut"] = "doublon"
            l["erreurs"] = [f"Déjà présent plus haut ({vues[cle]})"]
        else:
            vues[cle] = l.get("source", "")
    return verifiees


def resume(lignes):
    compte = {}
    for l in lignes:
        compte[l["statut"]] = compte.get(l["statut"], 0) + 1
    return compte


def analyser_fichier(nom, contenu, etablissement, classe_defaut=None):
    feuilles = lire_fichier(nom, contenu)
    referentiel = ReferentielClasses(etablissement)
    lignes = extraire_eleves(feuilles, referentiel)
    if not lignes:
        raise FichierIllisible(
            "Aucun élève n'a été trouvé. Le fichier doit contenir un tableau avec au moins une colonne "
            "« Nom » (ou « Nom et prénom ») et une colonne « Prénom », « Sexe », « Date de naissance » ou « Classe »."
        )
    if classe_defaut is not None:
        for l in lignes:
            if not l["classe"]:
                l["classe"] = classe_defaut.pk
                l["classe_libelle"] = l["classe_libelle"] or classe_defaut.nom
    lignes = verifier_lignes(lignes, etablissement)
    non_reconnues = sorted({l["classe_libelle"] for l in lignes if l["classe_libelle"] and not l["classe"]})
    return {"lignes": lignes, "resume": resume(lignes), "classes_non_reconnues": non_reconnues}


# ---------------------------------------------------------------------------
# Import
# ---------------------------------------------------------------------------
CHAMPS_ELEVE = ["nom", "prenom", "sexe", "date_naissance", "lieu_naissance", "nationalite", "nom_pere", "nom_mere",
                "adresse", "contact_urgence_nom", "contact_urgence_telephone", "ecole_provenance"]


def importer_lignes(lignes, etablissement):
    """Inscrit les lignes valides ; chaque ligne est indépendante (une erreur n'annule pas les autres)."""
    verifiees = verifier_lignes(lignes, etablissement)
    classes = {str(c.pk): c for c in Classe.objects.filter(etablissement=etablissement).select_related("annee_scolaire")}
    resultat = {"crees": 0, "inscrits": 0, "ignores": 0, "erreurs": [], "par_classe": {}}
    for ligne in verifiees:
        libelle = f"{ligne.get('prenom', '')} {ligne.get('nom', '')}".strip() or ligne.get("source", "")
        if ligne["statut"] in ("deja_inscrit", "doublon"):
            resultat["ignores"] += 1
            continue
        if ligne["statut"] == "erreur":
            resultat["erreurs"].append({"source": ligne.get("source"), "eleve": libelle, "erreur": ", ".join(ligne["erreurs"])})
            continue
        classe = classes[str(ligne["classe"])]
        try:
            with transaction.atomic():
                if ligne["eleve_existant"]:
                    eleve = Eleve.objects.get(pk=ligne["eleve_existant"])
                    type_inscription = "reinscription"
                else:
                    donnees = {c: (ligne.get(c) or "").strip() for c in CHAMPS_ELEVE}
                    donnees["nationalite"] = donnees["nationalite"] or "Malienne"
                    donnees["date_naissance"] = datetime.date.fromisoformat(donnees["date_naissance"])
                    matricule = (ligne.get("matricule") or "").strip()
                    if matricule and Eleve.objects.filter(matricule__iexact=matricule).exists():
                        matricule = ""  # déjà pris dans un autre établissement : un nouveau est généré
                    eleve = Eleve.objects.create(etablissement=etablissement, matricule=matricule[:30], **donnees)
                    type_inscription = "inscription"
                Inscription.objects.create(
                    eleve=eleve, classe=classe, annee_scolaire=classe.annee_scolaire,
                    type_inscription=type_inscription, redoublant=bool(ligne.get("redoublant")),
                )
        except (IntegrityError, ValueError) as exc:
            resultat["erreurs"].append({"source": ligne.get("source"), "eleve": libelle,
                                        "erreur": "Enregistrement impossible (doublon ?)" if isinstance(exc, IntegrityError) else str(exc)})
            continue
        resultat["inscrits"] += 1
        resultat["crees"] += type_inscription == "inscription"
        resultat["par_classe"][classe.nom] = resultat["par_classe"].get(classe.nom, 0) + 1
    return resultat
