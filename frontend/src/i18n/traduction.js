/**
 * Traduction de l'interface (français, anglais, arabe).
 *
 * L'application est écrite en français. Plutôt que de modifier chaque écran, ce module observe la page
 * et remplace chaque texte affiché (et les attributs placeholder, title, aria-label, alt) par sa traduction
 * du dictionnaire (i18n/dictionnaire.js). Le texte d'origine est mémorisé pour revenir au français.
 * Seule la valeur des textes change, jamais la structure de la page : React continue de la gérer.
 *
 * Ne sont jamais traduits : ce que l'utilisateur saisit (champs de formulaire) et les zones marquées
 * translate="no" (noms, matricules...). Un texte absent du dictionnaire reste en français.
 */
import { DICTIONNAIRE, MODELES } from "./dictionnaire";

export const LANGUES = [
  { code: "fr", libelle: "Français", court: "FR", dir: "ltr" },
  { code: "en", libelle: "English", court: "EN", dir: "ltr" },
  { code: "ar", libelle: "العربية", court: "ع", dir: "rtl" },
];
const CLE_STOCKAGE = "gs_langue";
const ATTRIBUTS = ["placeholder", "title", "aria-label", "alt"];
const IGNORES = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE", "NOSCRIPT"]);

let langue = lireLangueMemorisee();
const originaux = new WeakMap(); // nœud texte → { fr, rendu }
const attributsOriginaux = new WeakMap(); // élément → { attribut: { fr, rendu } }
const abonnes = new Set();
let observateur = null;

function lireLangueMemorisee() {
  try {
    const memorisee = localStorage.getItem(CLE_STOCKAGE);
    return LANGUES.some((l) => l.code === memorisee) ? memorisee : "fr";
  } catch {
    return "fr";
  }
}

/** Traduction d'un texte français dans la langue active (ou dans `cible`), ou null si inconnue. */
export function traduire(texte, cible = langue) {
  if (cible === "fr" || !texte) return null;
  const propre = texte.replace(/\s+/g, " ").trim();
  if (!propre || !/[A-Za-zÀ-ÿ]/.test(propre)) return null;
  const entree = DICTIONNAIRE.get(propre);
  if (entree) return entree[cible];
  for (const [modele, en, ar] of MODELES) {
    const m = propre.match(modele);
    if (m) {
      // Les parties variables elles-mêmes peuvent figurer au dictionnaire (« Classe Grande Section »)
      const parties = m.slice(1).map((p) => DICTIONNAIRE.get(p)?.[cible] ?? p);
      return (cible === "en" ? en : ar).replace(/\$(\d)/g, (_, i) => parties[Number(i) - 1] ?? "");
    }
  }
  return null;
}

/** Comme traduire(), mais renvoie le texte d'origine quand il n'a pas de traduction. */
export const t = (texte) => traduire(texte) ?? texte;

function exclu(element) {
  for (let el = element; el && el !== document.body; el = el.parentElement) {
    if (IGNORES.has(el.tagName) || el.isContentEditable || el.getAttribute?.("translate") === "no") return true;
  }
  return false;
}

function traiterTexte(noeud) {
  const valeur = noeud.nodeValue;
  let memo = originaux.get(noeud);
  if (!memo || valeur !== memo.rendu) {
    // Nouveau texte, ou texte remplacé par React depuis la dernière traduction
    memo = { fr: valeur, rendu: valeur };
    originaux.set(noeud, memo);
  }
  const traduit = traduire(memo.fr);
  let rendu = memo.fr;
  if (traduit != null) {
    // On garde les espaces autour du texte (« Nom » dans « Nom : ... »)
    const avant = memo.fr.match(/^\s*/)[0];
    const apres = memo.fr.match(/\s*$/)[0];
    rendu = avant + traduit + apres;
  }
  if (noeud.nodeValue !== rendu) noeud.nodeValue = rendu;
  memo.rendu = rendu;
}

function traiterAttributs(element) {
  if (!element.getAttribute) return;
  let memos = attributsOriginaux.get(element);
  for (const attribut of ATTRIBUTS) {
    const valeur = element.getAttribute(attribut);
    if (valeur == null) continue;
    if (!memos) {
      memos = {};
      attributsOriginaux.set(element, memos);
    }
    let memo = memos[attribut];
    if (!memo || valeur !== memo.rendu) memo = memos[attribut] = { fr: valeur, rendu: valeur };
    const rendu = traduire(memo.fr) ?? memo.fr;
    if (valeur !== rendu) element.setAttribute(attribut, rendu);
    memo.rendu = rendu;
  }
}

function parcourir(racine) {
  if (racine.nodeType === Node.TEXT_NODE) {
    if (!exclu(racine.parentElement)) traiterTexte(racine);
    return;
  }
  if (racine.nodeType !== Node.ELEMENT_NODE || exclu(racine)) return;
  traiterAttributs(racine);
  const marcheur = document.createTreeWalker(racine, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      if (n.nodeType === Node.ELEMENT_NODE) {
        if (IGNORES.has(n.tagName) || n.getAttribute("translate") === "no" || n.isContentEditable) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
      return n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });
  let n = marcheur.nextNode();
  while (n) {
    if (n.nodeType === Node.TEXT_NODE) traiterTexte(n);
    else traiterAttributs(n);
    n = marcheur.nextNode();
  }
}

function appliquerDocument() {
  const info = LANGUES.find((l) => l.code === langue);
  document.documentElement.lang = langue;
  document.documentElement.dir = info.dir;
  parcourir(document.body);
}

/** Démarre la traduction automatique (une seule fois, au chargement de l'application). */
export function demarrerTraduction() {
  if (observateur) return;
  appliquerDocument();
  observateur = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "characterData") {
        if (!exclu(m.target.parentElement)) traiterTexte(m.target);
      } else if (m.type === "attributes") {
        if (!exclu(m.target)) traiterAttributs(m.target);
      } else {
        m.addedNodes.forEach(parcourir);
      }
    }
  });
  observateur.observe(document.body, {
    subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTS,
  });

  // Boîtes de dialogue du navigateur (confirmations de suppression...)
  for (const nom of ["confirm", "alert", "prompt"]) {
    const natif = window[nom].bind(window);
    window[nom] = (message, ...reste) => natif(typeof message === "string" ? t(message) : message, ...reste);
  }
}

export function langueActive() {
  return langue;
}

/** Change la langue de toute l'application, immédiatement et sans recharger la page. */
export function changerLangue(code) {
  if (!LANGUES.some((l) => l.code === code) || code === langue) return;
  langue = code;
  try {
    localStorage.setItem(CLE_STOCKAGE, code);
  } catch {
    /* préférence non mémorisée (navigation privée) */
  }
  appliquerDocument();
  abonnes.forEach((f) => f(code));
}

export function surChangementLangue(fonction) {
  abonnes.add(fonction);
  return () => abonnes.delete(fonction);
}
