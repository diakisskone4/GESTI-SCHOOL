"""Documents financiers imprimables : reçu de paiement (A5) et facture (A4).

Les deux partagent la même identité visuelle : en-tête avec le logo et les coordonnées
de l'établissement, couleurs de l'application, pied de page avec les mentions légales.
"""
import io
from decimal import Decimal

import qrcode
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, A5
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from apps.core.images import lecteur_image
from apps.core.pdf_utils import _decouper_texte

PRIMAIRE = colors.HexColor("#5f34dd")
PRIMAIRE_FONCE = colors.HexColor("#2e1a6e")
PRIMAIRE_CLAIR = colors.HexColor("#f2efff")
TEXTE = colors.HexColor("#1e293b")
GRIS = colors.HexColor("#64748b")
GRIS_CLAIR = colors.HexColor("#e2e8f0")
FOND = colors.HexColor("#f8fafc")
VERT = colors.HexColor("#059669")
ROUGE = colors.HexColor("#e11d48")
ORANGE = colors.HexColor("#d97706")


# ---------------------------------------------------------------------------
# Montants
# ---------------------------------------------------------------------------
def fcfa(montant):
    """12500 -> '12 500 FCFA' (espaces comme séparateur de milliers)."""
    return f"{Decimal(montant or 0):,.0f}".replace(",", " ") + " FCFA"


_UNITES = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix",
           "onze", "douze", "treize", "quatorze", "quinze", "seize"]
_DIZAINES = {2: "vingt", 3: "trente", 4: "quarante", 5: "cinquante", 6: "soixante"}


def _moins_de_cent(n):
    if n <= 16:
        return _UNITES[n]
    if n < 20:
        return "dix-" + _UNITES[n - 10]
    d, u = divmod(n, 10)
    if d in (7, 9):                      # 70-79 = soixante-dix..., 90-99 = quatre-vingt-dix...
        base = "soixante" if d == 7 else "quatre-vingt"
        reste = 10 + u
        lien = " et " if d == 7 and u == 1 else "-"
        return f"{base}{lien}{_moins_de_cent(reste)}"
    if d == 8:
        return "quatre-vingts" if u == 0 else f"quatre-vingt-{_UNITES[u]}"
    if u == 0:
        return _DIZAINES[d]
    if u == 1:
        return f"{_DIZAINES[d]} et un"
    return f"{_DIZAINES[d]}-{_UNITES[u]}"


def _moins_de_mille(n):
    c, r = divmod(n, 100)
    if c == 0:
        return _moins_de_cent(r)
    centaines = "cent" if c == 1 else f"{_UNITES[c]} cent" + ("s" if r == 0 else "")
    return centaines if r == 0 else f"{centaines} {_moins_de_cent(r)}"


def nombre_en_lettres(n):
    """Écrit un entier en toutes lettres (orthographe traditionnelle). 1250 -> 'mille deux cent cinquante'."""
    n = int(n)
    if n == 0:
        return "zéro"
    morceaux = []
    for valeur, singulier, pluriel in ((10**9, "milliard", "milliards"), (10**6, "million", "millions")):
        q, n = divmod(n, valeur)
        if q:
            morceaux.append(f"{nombre_en_lettres(q)} {singulier if q == 1 else pluriel}")
    q, n = divmod(n, 1000)
    if q:
        # « mille » est invariable ; « quatre-vingts » et « cents » perdent leur s devant mille
        milliers = "mille" if q == 1 else f"{_moins_de_mille(q)} mille".replace("vingts mille", "vingt mille").replace("cents mille", "cent mille")
        morceaux.append(milliers)
    if n:
        morceaux.append(_moins_de_mille(n))
    return " ".join(morceaux)


def montant_en_lettres(montant):
    texte = nombre_en_lettres(Decimal(montant or 0).quantize(Decimal("1")))
    return f"{texte[0].upper()}{texte[1:]} francs CFA"


# ---------------------------------------------------------------------------
# Éléments communs
# ---------------------------------------------------------------------------
def _image(etablissement, champ):
    """ImageReader d'une image de l'établissement (fichier ou copie en base), ou None."""
    try:
        return lecteur_image(etablissement, champ)
    except ValueError:
        return None


def _dessiner_logo(c, x, y, taille, etablissement):
    """Logo de l'établissement dans un carré (coin bas-gauche en x, y), ou ses initiales à défaut."""
    logo = _image(etablissement, "logo")
    if logo:
        c.drawImage(logo, x, y, width=taille, height=taille, preserveAspectRatio=True, anchor="c", mask="auto")
        return
    c.setFillColor(PRIMAIRE)
    c.roundRect(x, y, taille, taille, taille * 0.22, fill=1, stroke=0)
    c.setFillColor(colors.white)
    initiales = (etablissement.sigle or etablissement.nom or "?")[:3].upper()
    c.setFont("Helvetica-Bold", taille * 0.32)
    c.drawCentredString(x + taille / 2, y + taille * 0.36, initiales)


def _dessiner_entete(c, largeur, hauteur, marge, etablissement, titre, numero, date_doc, compact=False):
    """En-tête : bande de couleur, logo + coordonnées à gauche, titre du document à droite.
    Retourne l'ordonnée sous l'en-tête."""
    c.setFillColor(PRIMAIRE)
    c.rect(0, hauteur - 3 * mm, largeur, 3 * mm, fill=1, stroke=0)

    taille_logo = 18 * mm if compact else 24 * mm
    haut = hauteur - marge - 2 * mm
    _dessiner_logo(c, marge, haut - taille_logo, taille_logo, etablissement)

    # Bloc titre (à droite) : sa largeur réelle limite la place laissée aux coordonnées
    taille_titre = 13 if compact else 22
    largeur_titre = max(
        c.stringWidth(titre, "Helvetica-Bold", taille_titre),
        c.stringWidth(f"N° {numero}", "Helvetica-Bold", 8.5 if compact else 10),
    ) + 5 * mm
    xd = largeur - marge
    c.setFillColor(PRIMAIRE)
    c.setFont("Helvetica-Bold", taille_titre)
    c.drawRightString(xd, haut - (5 if compact else 7) * mm, titre)
    c.setFillColor(TEXTE)
    c.setFont("Helvetica-Bold", 8.5 if compact else 10)
    c.drawRightString(xd, haut - (10 if compact else 13.5) * mm, f"N° {numero}")
    c.setFillColor(GRIS)
    c.setFont("Helvetica", 7.5 if compact else 9)
    c.drawRightString(xd, haut - (14 if compact else 18.5) * mm, date_doc)

    # Coordonnées (entre le logo et le titre)
    x = marge + taille_logo + 4 * mm
    largeur_dispo = largeur - marge - largeur_titre - x
    y = haut - 4.5 * mm
    taille_nom = 10.5 if compact else 13
    c.setFillColor(PRIMAIRE_FONCE)
    for ligne in _decouper_texte(c, (etablissement.nom or "").upper(), "Helvetica-Bold", taille_nom, largeur_dispo)[:2]:
        c.setFont("Helvetica-Bold", taille_nom)
        c.drawString(x, y, ligne)
        y -= taille_nom * 0.42 * mm
    taille = 7 if compact else 8.5
    if etablissement.devise:
        c.setFillColor(GRIS)
        c.setFont("Helvetica-Oblique", taille)
        c.drawString(x, y, etablissement.devise[:90])
        y -= taille * 0.45 * mm
    adresse = ", ".join(p for p in (etablissement.adresse, etablissement.ville, etablissement.pays) if p)
    contacts = "  ·  ".join(p for p in (
        f"Tél : {etablissement.telephone}" if etablissement.telephone else "", etablissement.email,
    ) if p)
    c.setFillColor(TEXTE)
    c.setFont("Helvetica", taille)
    for ligne in (adresse, contacts):
        for morceau in _decouper_texte(c, ligne, "Helvetica", taille, largeur_dispo)[:2]:
            c.drawString(x, y, morceau)
            y -= taille * 0.45 * mm

    bas = min(y, haut - taille_logo) - 4 * mm
    c.setStrokeColor(GRIS_CLAIR)
    c.setLineWidth(0.8)
    c.line(marge, bas, largeur - marge, bas)
    return bas - 6 * mm


def _dessiner_pied(c, largeur, marge, etablissement, mention):
    """Pied de page : mentions légales de l'établissement + date de génération."""
    y = marge
    c.setStrokeColor(GRIS_CLAIR)
    c.setLineWidth(0.5)
    c.line(marge, y + 7 * mm, largeur - marge, y + 7 * mm)
    c.setFillColor(GRIS)
    c.setFont("Helvetica", 6.5)
    legal = "  ·  ".join(p for p in (
        etablissement.nom,
        f"Arrêté de création {etablissement.arrete_creation}" if etablissement.arrete_creation else "",
        f"Arrêté d'ouverture {etablissement.arrete_ouverture}" if etablissement.arrete_ouverture else "",
    ) if p)
    c.drawCentredString(largeur / 2, y + 3.5 * mm, legal[:160])
    c.drawCentredString(largeur / 2, y, f"{mention}  ·  Document généré le {timezone.localtime():%d/%m/%Y à %H:%M}")


def _tampon(c, cx, cy, taille, texte, couleur):
    """Tampon incliné semi-transparent (PAYÉE, ANNULÉ...) centré en (cx, cy)."""
    c.saveState()
    c.translate(cx, cy)
    c.rotate(18)
    c.setFillColor(couleur)
    c.setStrokeColor(couleur)
    c.setFillAlpha(0.55)
    c.setStrokeAlpha(0.55)
    c.setFont("Helvetica-Bold", taille)
    l = c.stringWidth(texte, "Helvetica-Bold", taille)
    c.drawCentredString(0, -taille * 0.35, texte)
    c.setLineWidth(taille * 0.08)
    c.roundRect(-l / 2 - taille * 0.3, -taille * 0.75, l + taille * 0.6, taille * 1.5, taille * 0.25, fill=0, stroke=1)
    c.restoreState()


def _qr(c, x, y, taille, contenu):
    img = qrcode.make(contenu, box_size=6, border=1)
    tampon = io.BytesIO()
    img.save(tampon, format="PNG")
    tampon.seek(0)
    c.drawImage(ImageReader(tampon), x, y, width=taille, height=taille)


def _signature(c, x_centre, y, etablissement, titre, largeur):
    """Zone de signature avec le cachet de l'établissement s'il est disponible."""
    c.setFillColor(TEXTE)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawCentredString(x_centre, y, titre)
    cachet = _image(etablissement, "cachet")
    if cachet:
        taille = 24 * mm
        c.drawImage(cachet, x_centre - taille / 2, y - taille - 2 * mm, width=taille, height=taille,
                    preserveAspectRatio=True, anchor="c", mask="auto")
    c.setStrokeColor(GRIS_CLAIR)
    c.setLineWidth(0.6)
    c.line(x_centre - largeur / 2, y - 28 * mm, x_centre + largeur / 2, y - 28 * mm)


def _infos_eleve(inscription):
    eleve = inscription.eleve
    return [
        ("Élève", f"{eleve.prenom} {eleve.nom}"),
        ("Matricule", eleve.matricule or "—"),
        ("Classe", inscription.classe.nom if inscription.classe_id else "—"),
        ("Année scolaire", inscription.annee_scolaire.libelle if inscription.annee_scolaire_id else "—"),
    ]


def _paiements_valides(facture):
    return list(facture.paiements.filter(annule=False).order_by("created_at"))


def numero_facture(facture):
    return f"FAC-{facture.created_at:%Y}-{facture.id.hex[:6].upper()}"


# ---------------------------------------------------------------------------
# Reçu de paiement (A5)
# ---------------------------------------------------------------------------
def generer_recu_pdf(paiement, etablissement):
    buffer = io.BytesIO()
    largeur, hauteur = A5
    c = canvas.Canvas(buffer, pagesize=A5)
    c.setTitle(f"Reçu {paiement.numero_recu}")
    marge = 10 * mm
    facture = paiement.facture
    inscription = facture.inscription

    y = _dessiner_entete(
        c, largeur, hauteur, marge, etablissement, "REÇU DE PAIEMENT", paiement.numero_recu,
        f"Le {paiement.date_paiement:%d/%m/%Y}", compact=True,
    )

    # Bloc élève (2 colonnes)
    infos = _infos_eleve(inscription)
    h_bloc = 15 * mm
    c.setFillColor(FOND)
    c.setStrokeColor(GRIS_CLAIR)
    c.roundRect(marge, y - h_bloc, largeur - 2 * marge, h_bloc, 2.5 * mm, fill=1, stroke=1)
    col = (largeur - 2 * marge) / 2
    for i, (lib, val) in enumerate(infos):
        x = marge + 4 * mm + (i % 2) * col
        yy = y - 5.5 * mm - (i // 2) * 6 * mm
        c.setFillColor(GRIS)
        c.setFont("Helvetica", 7)
        c.drawString(x, yy, lib.upper())
        c.setFillColor(TEXTE)
        c.setFont("Helvetica-Bold", 8.5)
        c.drawString(x + 25 * mm, yy, str(val)[:30])
    y -= h_bloc + 6 * mm

    # Montant reçu
    h_montant = 20 * mm
    c.setFillColor(PRIMAIRE)
    c.roundRect(marge, y - h_montant, largeur - 2 * marge, h_montant, 3 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica", 7.5)
    c.drawString(marge + 5 * mm, y - 6 * mm, "MONTANT REÇU")
    c.setFont("Helvetica-Bold", 18)
    c.drawString(marge + 5 * mm, y - 13.5 * mm, fcfa(paiement.montant))
    c.setFont("Helvetica-Oblique", 7)
    lettres = _decouper_texte(c, montant_en_lettres(paiement.montant), "Helvetica-Oblique", 7, largeur - 2 * marge - 10 * mm)
    c.drawString(marge + 5 * mm, y - 17.5 * mm, lettres[0] if lettres else "")
    y -= h_montant + 6 * mm

    # Détails du paiement
    details = [
        ("Motif", f"{paiement.libelle}" + (f" — {facture.periode.libelle}" if facture.periode_id else "")),
        ("Mode de paiement", paiement.get_mode_paiement_display()),
    ]
    if paiement.reference_transaction:
        details.append(("Référence", paiement.reference_transaction))
    if paiement.encaisse_par_id:
        details.append(("Encaissé par", paiement.encaisse_par.get_full_name()))
    for lib, val in details:
        c.setFillColor(GRIS)
        c.setFont("Helvetica", 8)
        c.drawString(marge, y, lib)
        c.setFillColor(TEXTE)
        c.setFont("Helvetica-Bold", 8.5)
        c.drawRightString(largeur - marge, y, str(val)[:60])
        y -= 5.5 * mm
    y -= 2 * mm

    # Situation du compte pour cette facture
    valides = _paiements_valides(facture)
    deja_paye = sum((p.montant for p in valides if p.created_at < paiement.created_at), Decimal("0"))
    total_paye = sum((p.montant for p in valides), Decimal("0"))
    reste = max(facture.montant_net - total_paye, Decimal("0"))
    lignes = [
        ("Montant de la facture", fcfa(facture.montant_net), TEXTE),
        ("Déjà payé auparavant", fcfa(deja_paye), TEXTE),
        ("Ce paiement", fcfa(paiement.montant if not paiement.annule else 0), TEXTE),
        ("Reste à payer", "SOLDÉ" if reste == 0 else fcfa(reste), VERT if reste == 0 else ROUGE),
    ]
    c.setFillColor(PRIMAIRE_FONCE)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(marge, y, "SITUATION DE LA FACTURE")
    y -= 3 * mm
    for i, (lib, val, couleur) in enumerate(lignes):
        derniere = i == len(lignes) - 1
        c.setFillColor(PRIMAIRE_CLAIR if derniere else (FOND if i % 2 == 0 else colors.white))
        c.rect(marge, y - 6 * mm, largeur - 2 * marge, 6 * mm, fill=1, stroke=0)
        c.setFillColor(TEXTE)
        c.setFont("Helvetica-Bold" if derniere else "Helvetica", 8.5)
        c.drawString(marge + 3 * mm, y - 4.2 * mm, lib)
        c.setFillColor(couleur)
        c.setFont("Helvetica-Bold", 9 if derniere else 8.5)
        c.drawRightString(largeur - marge - 3 * mm, y - 4.2 * mm, val)
        y -= 6 * mm
    y -= 8 * mm

    # QR code de vérification + signature
    taille_qr = 22 * mm
    _qr(c, marge, y - taille_qr, taille_qr,
        f"{etablissement.sigle or etablissement.nom} | Reçu {paiement.numero_recu} | "
        f"{inscription.eleve.matricule} | {paiement.montant:.0f} FCFA | {paiement.date_paiement:%d/%m/%Y}")
    c.setFillColor(GRIS)
    c.setFont("Helvetica", 6.5)
    c.drawString(marge, y - taille_qr - 3 * mm, "Code de vérification du reçu")
    _signature(c, largeur - marge - 25 * mm, y, etablissement, "Le Caissier", 44 * mm)

    if paiement.annule:
        _tampon(c, largeur / 2, hauteur / 2, 34, "ANNULÉ", ROUGE)

    _dessiner_pied(c, largeur, 8 * mm, etablissement, "Reçu à conserver — aucun duplicata ne sera délivré sans justificatif")
    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer


# ---------------------------------------------------------------------------
# Facture (A4)
# ---------------------------------------------------------------------------
def generer_facture_pdf(facture, etablissement):
    buffer = io.BytesIO()
    largeur, hauteur = A4
    c = canvas.Canvas(buffer, pagesize=A4)
    numero = numero_facture(facture)
    c.setTitle(f"Facture {numero}")
    marge = 16 * mm
    inscription = facture.inscription

    y = _dessiner_entete(
        c, largeur, hauteur, marge, etablissement, "FACTURE", numero,
        f"Émise le {timezone.localtime(facture.created_at):%d/%m/%Y}",
    )

    # Deux cartes : « Facturé à » et « Informations »
    h_carte = 30 * mm
    l_carte = (largeur - 2 * marge - 6 * mm) / 2
    parent = None
    lien = inscription.eleve.parents_lies.select_related("parent").order_by("-est_contact_principal").first()
    if lien:
        parent = lien.parent
    statut_couleur = {"payee": VERT, "partielle": ORANGE, "impayee": ROUGE, "annulee": GRIS}.get(facture.statut, GRIS)
    cartes = [
        ("FACTURÉ À", _infos_eleve(inscription) + (
            [("Parent / tuteur", f"{parent.get_full_name()}" + (f" — {parent.telephone}" if parent.telephone else ""))]
            if parent else []
        )),
        ("INFORMATIONS", [
            ("Date d'émission", f"{timezone.localtime(facture.created_at):%d/%m/%Y}"),
            ("Date d'échéance", f"{facture.date_echeance:%d/%m/%Y}"),
            ("Période", facture.periode.libelle if facture.periode_id else "—"),
            ("Statut", facture.get_statut_display()),
        ]),
    ]
    for i, (titre, lignes) in enumerate(cartes):
        x = marge + i * (l_carte + 6 * mm)
        hauteur_carte = max(h_carte, (len(lignes) + 1) * 5.2 * mm + 4 * mm)
        c.setFillColor(FOND)
        c.setStrokeColor(GRIS_CLAIR)
        c.roundRect(x, y - hauteur_carte, l_carte, hauteur_carte, 3 * mm, fill=1, stroke=1)
        c.setFillColor(PRIMAIRE)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(x + 4 * mm, y - 5.5 * mm, titre)
        yy = y - 11 * mm
        for lib, val in lignes:
            c.setFillColor(GRIS)
            c.setFont("Helvetica", 8)
            c.drawString(x + 4 * mm, yy, lib)
            c.setFillColor(statut_couleur if lib == "Statut" else TEXTE)
            c.setFont("Helvetica-Bold", 8.5)
            c.drawString(x + 32 * mm, yy, str(val)[:40])
            yy -= 5.2 * mm
    y -= max(h_carte, (max(len(l) for _, l in cartes) + 1) * 5.2 * mm + 4 * mm) + 8 * mm

    # Tableau des lignes de facturation
    colonnes = [("Désignation", marge + 3 * mm, "l"), ("Montant", largeur - marge - 68 * mm, "r"),
                ("Remise", largeur - marge - 36 * mm, "r"), ("Net à payer", largeur - marge - 3 * mm, "r")]
    c.setFillColor(PRIMAIRE_FONCE)
    c.roundRect(marge, y - 8 * mm, largeur - 2 * marge, 8 * mm, 2 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 8.5)
    for texte, x, align in colonnes:
        (c.drawString if align == "l" else c.drawRightString)(x, y - 5.3 * mm, texte.upper())
    y -= 8 * mm
    designation = facture.libelle or facture.type_frais.nom
    sous_titre = f"{facture.type_frais.nom} · {facture.type_frais.get_periodicite_display()}"
    c.setFillColor(colors.white)
    c.setStrokeColor(GRIS_CLAIR)
    c.rect(marge, y - 13 * mm, largeur - 2 * marge, 13 * mm, fill=1, stroke=1)
    c.setFillColor(TEXTE)
    c.setFont("Helvetica-Bold", 9.5)
    c.drawString(colonnes[0][1], y - 5.5 * mm, designation[:70])
    c.setFillColor(GRIS)
    c.setFont("Helvetica", 7.5)
    c.drawString(colonnes[0][1], y - 10 * mm, sous_titre[:90])
    c.setFillColor(TEXTE)
    c.setFont("Helvetica", 9)
    c.drawRightString(colonnes[1][1], y - 7.5 * mm, fcfa(facture.montant_du))
    c.drawRightString(colonnes[2][1], y - 7.5 * mm, f"- {fcfa(facture.montant_remise)}" if facture.montant_remise else "—")
    c.setFont("Helvetica-Bold", 9.5)
    c.drawRightString(colonnes[3][1], y - 7.5 * mm, fcfa(facture.montant_net))
    y -= 13 * mm + 6 * mm

    # Totaux (à droite) et montant en lettres (à gauche)
    valides = _paiements_valides(facture)
    total_paye = sum((p.montant for p in valides), Decimal("0"))
    reste = max(facture.montant_net - total_paye, Decimal("0"))
    l_totaux = 80 * mm
    x_tot = largeur - marge - l_totaux
    totaux = [
        ("Sous-total", fcfa(facture.montant_du)),
        ("Remise / bourse", f"- {fcfa(facture.montant_remise)}" if facture.montant_remise else fcfa(0)),
        ("Net à payer", fcfa(facture.montant_net)),
        ("Déjà payé", fcfa(total_paye)),
    ]
    yt = y
    for lib, val in totaux:
        c.setFillColor(GRIS)
        c.setFont("Helvetica", 9)
        c.drawString(x_tot + 3 * mm, yt - 4.5 * mm, lib)
        c.setFillColor(TEXTE)
        c.setFont("Helvetica-Bold", 9)
        c.drawRightString(largeur - marge - 3 * mm, yt - 4.5 * mm, val)
        yt -= 6.5 * mm
    c.setFillColor(VERT if reste == 0 else PRIMAIRE)
    c.roundRect(x_tot, yt - 10 * mm, l_totaux, 10 * mm, 2.5 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(x_tot + 3 * mm, yt - 6.5 * mm, "RESTE À PAYER")
    c.setFont("Helvetica-Bold", 12)
    c.drawRightString(largeur - marge - 3 * mm, yt - 6.7 * mm, "SOLDÉ" if reste == 0 else fcfa(reste))
    yt -= 10 * mm

    l_gauche = x_tot - marge - 8 * mm
    c.setFillColor(GRIS)
    c.setFont("Helvetica", 7.5)
    c.drawString(marge, y - 4.5 * mm, "Arrêtée la présente facture à la somme de :")
    c.setFillColor(TEXTE)
    c.setFont("Helvetica-BoldOblique", 9)
    yl = y - 9.5 * mm
    for ligne in _decouper_texte(c, montant_en_lettres(facture.montant_net), "Helvetica-BoldOblique", 9, l_gauche)[:3]:
        c.drawString(marge, yl, ligne)
        yl -= 4.5 * mm
    y_tampon = (yl + yt) / 2 - 2 * mm
    y = min(yt, yl) - 10 * mm

    # Historique des paiements
    c.setFillColor(PRIMAIRE_FONCE)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(marge, y, "HISTORIQUE DES PAIEMENTS")
    y -= 3 * mm
    cols_p = [("Date", marge + 3 * mm, "l"), ("N° reçu", marge + 30 * mm, "l"),
              ("Mode de paiement", marge + 75 * mm, "l"), ("Montant", largeur - marge - 3 * mm, "r")]
    c.setFillColor(PRIMAIRE_CLAIR)
    c.rect(marge, y - 6.5 * mm, largeur - 2 * marge, 6.5 * mm, fill=1, stroke=0)
    c.setFillColor(PRIMAIRE_FONCE)
    c.setFont("Helvetica-Bold", 8)
    for texte, x, align in cols_p:
        (c.drawString if align == "l" else c.drawRightString)(x, y - 4.4 * mm, texte)
    y -= 6.5 * mm
    if not valides:
        c.setFillColor(GRIS)
        c.setFont("Helvetica-Oblique", 8.5)
        c.drawString(marge + 3 * mm, y - 5 * mm, "Aucun paiement enregistré pour cette facture.")
        y -= 7 * mm
    for i, p in enumerate(valides[:12]):
        if i % 2:
            c.setFillColor(FOND)
            c.rect(marge, y - 6 * mm, largeur - 2 * marge, 6 * mm, fill=1, stroke=0)
        c.setFillColor(TEXTE)
        c.setFont("Helvetica", 8.5)
        valeurs = [f"{p.date_paiement:%d/%m/%Y}", p.numero_recu, p.get_mode_paiement_display(), fcfa(p.montant)]
        for (_, x, align), val in zip(cols_p, valeurs):
            (c.drawString if align == "l" else c.drawRightString)(x, y - 4.2 * mm, val)
        y -= 6 * mm
    y -= 8 * mm

    # Conditions + signature
    c.setFillColor(GRIS)
    c.setFont("Helvetica", 7.5)
    conditions = [
        f"Paiement à effectuer au plus tard le {facture.date_echeance:%d/%m/%Y} auprès de la caisse de l'établissement.",
        "Un reçu numéroté est remis pour chaque versement : merci de le conserver.",
    ]
    if etablissement.telephone:
        conditions.append(f"Pour toute question : {etablissement.telephone}" + (f" · {etablissement.email}" if etablissement.email else ""))
    for ligne in conditions:
        c.drawString(marge, y, ligne)
        y -= 4.2 * mm
    _signature(c, largeur - marge - 30 * mm, y + 8 * mm, etablissement,
               etablissement.directeur_titre or "La Direction", 50 * mm)
    if etablissement.directeur_nom:
        c.setFillColor(TEXTE)
        c.setFont("Helvetica", 8)
        c.drawCentredString(largeur - marge - 30 * mm, y + 8 * mm - 32 * mm, etablissement.directeur_nom)

    # Tampon à gauche des totaux, dans l'espace libre sous le montant en lettres
    if facture.statut == "annulee":
        _tampon(c, marge + 38 * mm, y_tampon, 22, "ANNULÉE", ROUGE)
    elif reste == 0:
        _tampon(c, marge + 38 * mm, y_tampon, 22, "PAYÉE", VERT)

    _dessiner_pied(c, largeur, 10 * mm, etablissement, f"Facture {numero}")
    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer
