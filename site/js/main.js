/* Site vitrine Gesti-Scolaire : menu mobile, liens et coordonnées configurables, formulaire de démonstration. */
(function () {
  "use strict";
  var config = window.GESTI_CONFIG || {};

  // ---------- Liens vers l'application ----------
  document.querySelectorAll("[data-lien-app]").forEach(function (lien) {
    if (config.appUrl) {
      lien.href = config.appUrl.replace(/\/$/, "") + "/connexion";
    } else {
      lien.hidden = true;
    }
  });

  // ---------- Coordonnées (masquées si non renseignées dans config.js) ----------
  var coordonnees = {
    telephone: config.telephone && { href: "tel:" + config.telephone.replace(/\s/g, ""), texte: config.telephone },
    whatsapp: config.whatsapp && {
      href: "https://wa.me/" + String(config.whatsapp).replace(/\D/g, "") + "?text=" +
        encodeURIComponent("Bonjour, je souhaite une démonstration de Gesti-Scolaire."),
    },
    email: config.email && { href: "mailto:" + config.email + "?subject=" + encodeURIComponent("Démonstration Gesti-Scolaire"), texte: config.email },
  };
  Object.keys(coordonnees).forEach(function (cle) {
    var element = document.querySelector('[data-contact="' + cle + '"]');
    var valeur = coordonnees[cle];
    if (!element || !valeur) return;
    var lien = element.querySelector("a");
    lien.href = valeur.href;
    if (valeur.texte) lien.textContent = valeur.texte;
    element.hidden = false;
  });

  // ---------- Année du pied de page ----------
  var annee = document.getElementById("annee");
  if (annee) annee.textContent = new Date().getFullYear();

  // ---------- En-tête : ombre au défilement ----------
  var entete = document.getElementById("entete");
  function majEntete() { entete.classList.toggle("entete--defile", window.scrollY > 8); }
  window.addEventListener("scroll", majEntete, { passive: true });
  majEntete();

  // ---------- Menu mobile ----------
  var burger = document.getElementById("burger");
  var menu = document.getElementById("menu");
  function basculerMenu(ouvert) {
    menu.classList.toggle("menu--ouvert", ouvert);
    burger.setAttribute("aria-expanded", String(ouvert));
    burger.setAttribute("aria-label", ouvert ? "Fermer le menu" : "Ouvrir le menu");
  }
  burger.addEventListener("click", function () { basculerMenu(!menu.classList.contains("menu--ouvert")); });
  menu.addEventListener("click", function (e) { if (e.target.closest("a")) basculerMenu(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") basculerMenu(false); });

  // ---------- Formulaire de démonstration (page /contact) ----------
  var formulaire = document.getElementById("formulaire");
  if (!formulaire) return;
  var message = document.getElementById("formulaire-message");
  var bouton = formulaire.querySelector('button[type="submit"]');
  var texteBouton = bouton.textContent;

  function afficher(texte, type) {
    message.textContent = texte;
    message.className = "formulaire__message" + (type ? " formulaire__message--" + type : "");
  }

  function premiereErreur(erreurs) {
    if (!erreurs || typeof erreurs !== "object") return null;
    if (erreurs.detail) return erreurs.detail;
    var cle = Object.keys(erreurs)[0];
    var valeur = Array.isArray(erreurs[cle]) ? erreurs[cle][0] : erreurs[cle];
    var champ = formulaire.elements[cle];
    if (champ) { champ.setAttribute("aria-invalid", "true"); champ.focus(); }
    return valeur;
  }

  formulaire.addEventListener("input", function (e) { e.target.removeAttribute("aria-invalid"); });

  formulaire.addEventListener("submit", function (e) {
    e.preventDefault();
    var manquants = ["nom", "etablissement", "telephone"].filter(function (nom) { return !formulaire.elements[nom].value.trim(); });
    if (manquants.length) {
      manquants.forEach(function (nom) { formulaire.elements[nom].setAttribute("aria-invalid", "true"); });
      formulaire.elements[manquants[0]].focus();
      afficher("Merci de renseigner les champs marqués d'une étoile.", "erreur");
      return;
    }
    if (!config.apiUrl) {
      afficher("Le formulaire n'est pas encore configuré. Contactez-nous directement.", "erreur");
      return;
    }

    var donnees = {};
    new FormData(formulaire).forEach(function (valeur, cle) { donnees[cle] = String(valeur).trim(); });
    bouton.disabled = true;
    bouton.textContent = "Envoi en cours…";
    afficher("", "");

    fetch(config.apiUrl.replace(/\/$/, "") + "/public/demande-demo/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(donnees),
    })
      .then(function (reponse) {
        return reponse.json().catch(function () { return {}; }).then(function (corps) { return { ok: reponse.ok, statut: reponse.status, corps: corps }; });
      })
      .then(function (r) {
        if (r.ok) {
          formulaire.reset();
          var texte = r.corps.detail || "Merci, votre demande a bien été envoyée.";
          if (r.corps.reference) texte += " Votre numéro de demande : " + r.corps.reference + ".";
          afficher(texte, "ok");
        } else if (r.statut === 429) {
          afficher("Trop de demandes envoyées. Réessayez dans un moment ou contactez-nous directement.", "erreur");
        } else {
          afficher(premiereErreur(r.corps) || "Impossible d'envoyer la demande. Vérifiez les informations.", "erreur");
        }
      })
      .catch(function () {
        afficher("Connexion impossible. Vérifiez votre accès internet, puis réessayez.", "erreur");
      })
      .then(function () {
        bouton.disabled = false;
        bouton.textContent = texteBouton;
      });
  });
})();
