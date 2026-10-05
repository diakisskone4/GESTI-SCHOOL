"""Génération de documents PDF (cartes scolaires, bulletins, reçus, attestations...).

Utilise ReportLab. Toutes les fonctions renvoient un buffer BytesIO prêt
à être servi via HttpResponse ou sauvegardé dans un FileField.
"""
import io
import qrcode
from django.utils import timezone
from reportlab.lib.pagesizes import A5, A4, landscape
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.graphics.barcode import code128

from apps.core.images import lecteur_image

# Format carte scolaire PVC : CR80 (carte de crédit / badge), 85.6 x 54 mm, paysage
CARTE_SIZE = (85.6 * mm, 54 * mm)

_BLEU_CARTE = colors.HexColor("#0c3d78")
_OR_CARTE = colors.HexColor("#e8b923")
_GRIS_CARTE = colors.HexColor("#64748b")


def _police_ajustee(c, texte, police, taille, largeur_max, taille_min=3.6):
    """Réduit la taille de police jusqu'à ce que `texte` tienne dans `largeur_max`."""
    taille_actuelle = taille
    while taille_actuelle > taille_min and c.stringWidth(texte, police, taille_actuelle) > largeur_max:
        taille_actuelle -= 0.2
    return round(taille_actuelle, 1)


def _texte_tronque(c, texte, police, taille, largeur_max):
    """Coupe `texte` avec une ellipse si même à la taille minimale il dépasse `largeur_max`."""
    if c.stringWidth(texte, police, taille) <= largeur_max:
        return texte
    tronque = texte
    while tronque and c.stringWidth(tronque + "…", police, taille) > largeur_max:
        tronque = tronque[:-1]
    return (tronque + "…") if tronque else texte


def generer_carte_scolaire_pdf(eleve, inscription, etablissement, qr_data=""):
    """Génère une carte scolaire au format PVC CR80 (85.6 x 54mm, paysage) :
    en-tête établissement avec emblème et drapeau national, photo, identité,
    QR code de vérification, signature du directeur, cachet et code-barres du matricule."""
    buffer = io.BytesIO()
    largeur, hauteur = CARTE_SIZE
    c = canvas.Canvas(buffer, pagesize=CARTE_SIZE)

    # Fond blanc + repère de découpe (bordure fine arrondie)
    c.setFillColor(colors.white)
    c.rect(0, 0, largeur, hauteur, fill=1, stroke=0)
    c.setStrokeColor(colors.HexColor("#d0d5dd"))
    c.setLineWidth(0.4)
    c.roundRect(0.6 * mm, 0.6 * mm, largeur - 1.2 * mm, hauteur - 1.2 * mm, 2.2 * mm, fill=0, stroke=1)

    # --- En-tête ---
    entete_h = 11 * mm
    c.setFillColor(_BLEU_CARTE)
    c.rect(0, hauteur - entete_h, largeur, entete_h, fill=1, stroke=0)
    c.setFillColor(_OR_CARTE)
    c.rect(0, hauteur - entete_h - 0.5 * mm, largeur, 0.5 * mm, fill=1, stroke=0)

    # Emblème (logo établissement si disponible, sinon sigle dans un médaillon)
    logo_cx, logo_cy, logo_r = 6.3 * mm, hauteur - entete_h / 2, 3.6 * mm
    c.setFillColor(colors.white)
    c.circle(logo_cx, logo_cy, logo_r, fill=1, stroke=0)
    logo_dessine = False
    if getattr(etablissement, "logo", None):
        try:
            img = lecteur_image(etablissement, "logo")
            c.saveState()
            chemin_clip = c.beginPath()
            chemin_clip.circle(logo_cx, logo_cy, logo_r - 0.3 * mm)
            c.clipPath(chemin_clip, stroke=0, fill=0)
            c.drawImage(img, logo_cx - logo_r, logo_cy - logo_r, width=2 * logo_r, height=2 * logo_r,
                        preserveAspectRatio=True, anchor="c", mask="auto")
            c.restoreState()
            logo_dessine = True
        except Exception:
            logo_dessine = False
    if not logo_dessine:
        c.setFillColor(_BLEU_CARTE)
        c.setFont("Helvetica-Bold", 7)
        initiales = (etablissement.sigle or etablissement.nom or "?")[:3].upper()
        c.drawCentredString(logo_cx, logo_cy - 2.3, initiales)

    # Nom de l'établissement + devise, bloc pays à droite (drapeau si Mali)
    pays = (etablissement.pays or "").strip()
    texte_x = 11 * mm
    marge_droite = 4 * mm

    # Largeur réellement occupée par le bloc pays (texte le plus large des lignes),
    # calculée avant de dessiner le nom pour ne jamais empiéter dessus.
    drap_w, drap_h = 5 * mm, 3.3 * mm
    largeur_bloc_pays = 0
    if pays:
        if pays.lower() == "mali":
            largeur_bloc_pays = max(
                c.stringWidth("RÉPUBLIQUE DU MALI", "Helvetica-Bold", 4.2),
                c.stringWidth("Un Peuple - Un But - Une Foi", "Helvetica-Oblique", 3.2),
                drap_w,
            )
        else:
            largeur_bloc_pays = max(c.stringWidth(pays.upper(), "Helvetica-Bold", 4.2), drap_w)

    zone_droite = largeur - marge_droite - (largeur_bloc_pays + 2.5 * mm if pays else 0)
    largeur_dispo = zone_droite - texte_x

    c.setFillColor(colors.white)
    nom_etab = (etablissement.nom or "").upper()
    taille_nom = _police_ajustee(c, nom_etab, "Helvetica-Bold", 6.8, largeur_dispo)
    c.setFont("Helvetica-Bold", taille_nom)
    c.drawString(texte_x, hauteur - 5 * mm, _texte_tronque(c, nom_etab, "Helvetica-Bold", taille_nom, largeur_dispo))

    devise = (etablissement.devise or "Établissement scolaire").upper()
    c.setFont("Helvetica", 4.6)
    c.drawString(texte_x, hauteur - 8.6 * mm, _texte_tronque(c, devise, "Helvetica", 4.6, largeur_dispo))

    if pays:
        drap_x, drap_y = largeur - marge_droite - drap_w, hauteur - 1.8 * mm - drap_h
        if pays.lower() == "mali":
            bande = drap_w / 3
            for i, couleur_hex in enumerate(["#14b53a", "#fcd116", "#ce1126"]):
                c.setFillColor(colors.HexColor(couleur_hex))
                c.rect(drap_x + i * bande, drap_y, bande, drap_h, fill=1, stroke=0)
            c.setFillColor(colors.white)
            c.setFont("Helvetica-Bold", 4.2)
            c.drawRightString(largeur - marge_droite, drap_y - 1.8, "RÉPUBLIQUE DU MALI")
            c.setFont("Helvetica-Oblique", 3.2)
            c.drawRightString(largeur - marge_droite, drap_y - 4.4, "Un Peuple - Un But - Une Foi")
        else:
            c.setFillColor(colors.white)
            c.setStrokeColor(colors.HexColor("#d0d5dd"))
            c.setLineWidth(0.3)
            c.rect(drap_x, drap_y, drap_w, drap_h, fill=1, stroke=1)
            c.setFillColor(colors.white)
            c.setFont("Helvetica-Bold", 4.2)
            c.drawRightString(largeur - marge_droite, drap_y - 2, pays.upper())

    # --- Titre ---
    titre_y = hauteur - entete_h - 3.6 * mm
    c.setFillColor(_BLEU_CARTE)
    c.setFont("Helvetica-Bold", 7)
    c.drawCentredString(largeur / 2, titre_y, "CARTE SCOLAIRE")
    c.setFillColor(_GRIS_CARTE)
    c.setFont("Helvetica", 4.6)
    annee_libelle = inscription.annee_scolaire.libelle if inscription.annee_scolaire_id else ""
    c.drawCentredString(largeur / 2, titre_y - 3.8 * mm, f"ANNÉE SCOLAIRE {annee_libelle}".strip())

    # --- Zone principale : photo, identité, QR code ---
    contenu_haut = titre_y - 5.6 * mm
    contenu_bas = 15.6 * mm
    contenu_h = contenu_haut - contenu_bas

    # Photo de l'élève
    photo_x, photo_w = 4 * mm, 17 * mm
    photo_y, photo_h = contenu_bas, contenu_h
    c.setFillColor(colors.HexColor("#f1f5f9"))
    c.setStrokeColor(_BLEU_CARTE)
    c.setLineWidth(0.6)
    c.roundRect(photo_x, photo_y, photo_w, photo_h, 1 * mm, fill=1, stroke=1)
    if eleve.photo:
        try:
            img = ImageReader(eleve.photo.path)
            c.saveState()
            chemin_clip = c.beginPath()
            chemin_clip.roundRect(photo_x + 0.5 * mm, photo_y + 0.5 * mm, photo_w - 1 * mm, photo_h - 1 * mm, 0.8 * mm)
            c.clipPath(chemin_clip, stroke=0, fill=0)
            c.drawImage(img, photo_x + 0.5 * mm, photo_y + 0.5 * mm, width=photo_w - 1 * mm, height=photo_h - 1 * mm,
                        preserveAspectRatio=True, anchor="c", mask="auto")
            c.restoreState()
        except Exception:
            c.setFillColor(_GRIS_CARTE)
            c.setFont("Helvetica", 4.5)
            c.drawCentredString(photo_x + photo_w / 2, photo_y + photo_h / 2, "PHOTO")
    else:
        c.setFillColor(_GRIS_CARTE)
        c.setFont("Helvetica", 4.5)
        c.drawCentredString(photo_x + photo_w / 2, photo_y + photo_h / 2, "PHOTO")

    # QR code de vérification
    qr_size = 13 * mm
    qr_x = largeur - 4 * mm - qr_size
    qr_y = contenu_bas + 4.5 * mm
    qr_img = qrcode.make(qr_data or str(eleve.id))
    qr_buffer = io.BytesIO()
    qr_img.save(qr_buffer, format="PNG")
    qr_buffer.seek(0)
    c.drawImage(ImageReader(qr_buffer), qr_x, qr_y, width=qr_size, height=qr_size)
    c.setFillColor(_GRIS_CARTE)
    c.setFont("Helvetica", 3.4)
    c.drawCentredString(qr_x + qr_size / 2, qr_y - 2.6, "Scannez pour vérifier")
    c.drawCentredString(qr_x + qr_size / 2, qr_y - 5.2, "la carte")

    # Champs d'identité, entre la photo et le QR code
    champs_x = photo_x + photo_w + 3 * mm
    champs_droite = qr_x - 2.5 * mm
    largeur_valeur = champs_droite - champs_x - 13.5 * mm
    serie_nom = inscription.classe.serie.nom if (inscription.classe_id and inscription.classe.serie_id) else "—"
    champs = [
        ("Nom", (eleve.nom or "").upper()),
        ("Prénom", eleve.prenom or ""),
        ("Né(e) le", f"{eleve.date_naissance:%d/%m/%Y}" if eleve.date_naissance else "—"),
        ("Classe", inscription.classe.nom if inscription.classe_id else "—"),
        ("Matricule", eleve.matricule or "—"),
        ("Filière", serie_nom),
    ]
    y_champ = contenu_haut - 2 * mm
    pas = (contenu_h - 2 * mm) / len(champs)
    for label, valeur in champs:
        c.setFillColor(_BLEU_CARTE)
        c.setFont("Helvetica-Bold", 4.6)
        c.drawString(champs_x, y_champ, label)
        c.setFillColor(colors.black)
        taille_valeur = _police_ajustee(c, valeur, "Helvetica", 4.6, largeur_valeur)
        c.setFont("Helvetica", taille_valeur)
        c.drawString(champs_x + 13.5 * mm, y_champ, _texte_tronque(c, valeur, "Helvetica", taille_valeur, largeur_valeur))
        y_champ -= pas

    # --- Pied de page : signature, cachet, code-barres matricule ---
    c.setStrokeColor(colors.HexColor("#d0d5dd"))
    c.setLineWidth(0.3)
    c.line(3 * mm, contenu_bas - 1.4 * mm, largeur - 3 * mm, contenu_bas - 1.4 * mm)

    # Signature du directeur
    sign_x = 4 * mm
    if getattr(etablissement, "directeur_signature", None):
        try:
            img = lecteur_image(etablissement, "directeur_signature")
            c.drawImage(img, sign_x, 5.6 * mm, width=13 * mm, height=5.5 * mm,
                        preserveAspectRatio=True, anchor="sw", mask="auto")
        except Exception:
            pass
    c.setFillColor(_GRIS_CARTE)
    c.setFont("Helvetica", 3.6)
    c.drawString(sign_x, 4.6 * mm, "Le Directeur")

    # Cachet de l'établissement
    if getattr(etablissement, "cachet", None):
        try:
            img = lecteur_image(etablissement, "cachet")
            c.drawImage(img, sign_x + 15 * mm, 3.2 * mm, width=9 * mm, height=9 * mm,
                        preserveAspectRatio=True, anchor="sw", mask="auto")
        except Exception:
            pass

    # Code-barres du matricule (Code 128)
    try:
        barre = code128.Code128(eleve.matricule or str(eleve.id), barHeight=5 * mm, barWidth=0.26)
        barre_x = (largeur - barre.width) / 2
        barre.drawOn(c, barre_x, 6.4 * mm)
        c.setFillColor(colors.black)
        c.setFont("Helvetica", 3.6)
        c.drawCentredString(largeur / 2, 4.2 * mm, eleve.matricule or "")
    except Exception:
        pass

    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer


_BLEU_BULLETIN = colors.HexColor("#0c3d78")
_BLEU_CLAIR_BULLETIN = colors.HexColor("#eaf2fb")
_OR_BULLETIN = colors.HexColor("#e8b923")
_GRIS_BULLETIN = colors.HexColor("#64748b")


def _decouper_texte(c, texte, police, taille, largeur_max):
    """Découpe `texte` en plusieurs lignes tenant chacune dans `largeur_max`."""
    mots = texte.split()
    lignes, ligne = [], ""
    for mot in mots:
        essai = f"{ligne} {mot}".strip()
        if c.stringWidth(essai, police, taille) <= largeur_max:
            ligne = essai
        else:
            if ligne:
                lignes.append(ligne)
            ligne = mot
    if ligne:
        lignes.append(ligne)
    return lignes


def _ordinal(rang):
    return "1er" if rang == 1 else f"{rang}ème" if rang else "—"


def _nombre_court(valeur):
    """Formate un nombre sans décimale inutile (4.0 -> '4', 3.5 -> '3.5')."""
    v = float(valeur)
    return f"{v:.0f}" if v == int(v) else f"{v:.1f}"


def _appreciation_matiere(moyenne):
    m = float(moyenne)
    if m >= 16:
        return "Excellent", colors.HexColor("#dbeafe"), colors.HexColor("#1d4ed8")
    if m >= 14:
        return "Très bien", colors.HexColor("#dbeafe"), colors.HexColor("#1d4ed8")
    if m >= 12:
        return "Bien", colors.HexColor("#d1fae5"), colors.HexColor("#047857")
    if m >= 10:
        return "Assez bien", colors.HexColor("#d1fae5"), colors.HexColor("#047857")
    return "Insuffisant", colors.HexColor("#fee2e2"), colors.HexColor("#b91c1c")


def _appreciation_generale(moyenne):
    m = float(moyenne)
    if m >= 16:
        return "Excellent travail !", "Félicitations, continuez sur cette lancée."
    if m >= 14:
        return "Très bon travail !", "Continuez ainsi pour atteindre l'excellence."
    if m >= 12:
        return "Bon travail !", "Continue ainsi pour atteindre l'excellence."
    if m >= 10:
        return "Travail satisfaisant.", "Des efforts supplémentaires sont possibles."
    return "Travail insuffisant.", "Des efforts supplémentaires sont nécessaires."


def _dessiner_bloc_pays_bulletin(c, pays, right_x, top_y):
    """Drapeau + nom du pays, ancrés en haut à droite (right_x, top_y)."""
    drap_w, drap_h = 14 * mm, 9.3 * mm
    drap_x, drap_y = right_x - drap_w, top_y - drap_h
    if pays.lower() == "mali":
        bande = drap_w / 3
        for i, couleur_hex in enumerate(["#14b53a", "#fcd116", "#ce1126"]):
            c.setFillColor(colors.HexColor(couleur_hex))
            c.rect(drap_x + i * bande, drap_y, bande, drap_h, fill=1, stroke=0)
        c.setFillColor(_BLEU_BULLETIN)
        c.setFont("Helvetica-Bold", 8.5)
        c.drawRightString(right_x, drap_y - 4 * mm, "RÉPUBLIQUE DU MALI")
        c.setFillColor(_GRIS_BULLETIN)
        c.setFont("Helvetica-Oblique", 6.8)
        c.drawRightString(right_x, drap_y - 7.8 * mm, "Un Peuple - Un But - Une Foi")
    else:
        c.setFillColor(colors.white)
        c.setStrokeColor(colors.HexColor("#d0d5dd"))
        c.setLineWidth(0.4)
        c.rect(drap_x, drap_y, drap_w, drap_h, fill=1, stroke=1)
        c.setFillColor(_BLEU_BULLETIN)
        c.setFont("Helvetica-Bold", 8.5)
        c.drawRightString(right_x, drap_y - 4 * mm, pays.upper())


def generer_bulletin_pdf(eleve, inscription, periode, lignes_notes, moyenne_generale, rang, effectif_classe,
                          etablissement, appreciation="", moyenne_classe=None):
    """Génère un bulletin de notes au format A4 : en-tête établissement (logo, drapeau,
    contacts), identité de l'élève, tableau des moyennes par matière avec appréciations
    colorées, synthèse générale et zone de signatures.

    lignes_notes: liste de dicts {matiere, moyenne, coefficient, rang_matiere}
    """
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    largeur, hauteur = A4
    marge = 10 * mm

    # Bandeau inférieur (fixe, dessiné en premier pour ne jamais être recouvert)
    banniere_h = 7 * mm
    c.setFillColor(_BLEU_BULLETIN)
    c.rect(0, 0, largeur, banniere_h, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Oblique", 8)
    c.drawCentredString(largeur / 2, banniere_h / 2 - 1.2, "— Ensemble pour la réussite de nos enfants —")

    # --- En-tête établissement ---
    entete_h = 34 * mm
    logo_r = 11 * mm
    logo_cx, logo_cy = marge + logo_r, hauteur - marge - logo_r
    c.setFillColor(colors.HexColor("#f1f5f9"))
    c.circle(logo_cx, logo_cy, logo_r, fill=1, stroke=0)
    c.setStrokeColor(_BLEU_BULLETIN)
    c.setLineWidth(1)
    c.circle(logo_cx, logo_cy, logo_r, fill=0, stroke=1)
    logo_dessine = False
    if getattr(etablissement, "logo", None):
        try:
            img = lecteur_image(etablissement, "logo")
            c.saveState()
            chemin = c.beginPath()
            chemin.circle(logo_cx, logo_cy, logo_r - 0.6 * mm)
            c.clipPath(chemin, stroke=0, fill=0)
            c.drawImage(img, logo_cx - logo_r, logo_cy - logo_r, width=2 * logo_r, height=2 * logo_r,
                        preserveAspectRatio=True, anchor="c", mask="auto")
            c.restoreState()
            logo_dessine = True
        except Exception:
            logo_dessine = False
    if not logo_dessine:
        c.setFillColor(_BLEU_BULLETIN)
        c.setFont("Helvetica-Bold", 13)
        initiales = (etablissement.sigle or etablissement.nom or "?")[:3].upper()
        c.drawCentredString(logo_cx, logo_cy - 4, initiales)

    texte_x = marge + 2 * logo_r + 6 * mm
    pays = (etablissement.pays or "").strip()
    zone_droite_entete = largeur - marge - (36 * mm if pays else 0)
    largeur_dispo_nom = zone_droite_entete - texte_x

    c.setFillColor(_BLEU_BULLETIN)
    nom_etab = (etablissement.nom or "").upper()
    taille_nom = _police_ajustee(c, nom_etab, "Helvetica-Bold", 15, largeur_dispo_nom, taille_min=9)
    c.setFont("Helvetica-Bold", taille_nom)
    c.drawString(texte_x, hauteur - marge - 6 * mm, _texte_tronque(c, nom_etab, "Helvetica-Bold", taille_nom, largeur_dispo_nom))

    if etablissement.devise:
        c.setFillColor(_GRIS_BULLETIN)
        c.setFont("Helvetica-Oblique", 10)
        c.drawString(texte_x, hauteur - marge - 12.5 * mm,
                     _texte_tronque(c, etablissement.devise, "Helvetica-Oblique", 10, largeur_dispo_nom))

    # Ligne de contact : téléphone, ville, année scolaire
    contact_y = hauteur - marge - 19.5 * mm
    infos_contact = []
    if etablissement.telephone:
        infos_contact.append(f"Tél : {etablissement.telephone}")
    if etablissement.ville:
        infos_contact.append(etablissement.ville)
    infos_contact.append(f"Année scolaire : {inscription.annee_scolaire.libelle}" if inscription.annee_scolaire_id else "")
    infos_contact = [i for i in infos_contact if i]
    x_curseur = texte_x
    c.setFont("Helvetica", 8)
    for info in infos_contact:
        c.setFillColor(_BLEU_BULLETIN)
        c.circle(x_curseur + 0.6 * mm, contact_y + 1.3 * mm, 0.6 * mm, fill=1, stroke=0)
        c.setFillColor(_GRIS_BULLETIN)
        c.drawString(x_curseur + 2.4 * mm, contact_y, info)
        x_curseur += 2.4 * mm + c.stringWidth(info, "Helvetica", 8) + 6 * mm

    if pays:
        _dessiner_bloc_pays_bulletin(c, pays, largeur - marge, hauteur - marge)

    c.setFillColor(_OR_BULLETIN)
    c.rect(0, hauteur - entete_h, largeur, 1.4 * mm, fill=1, stroke=0)

    y = hauteur - entete_h - 8 * mm

    # --- Bandeau titre ---
    titre_h = 14 * mm
    c.setFillColor(_BLEU_BULLETIN)
    c.roundRect(marge, y - titre_h, largeur - 2 * marge, titre_h, 3 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.roundRect(marge + 3 * mm, y - titre_h + 3 * mm, 8 * mm, 8 * mm, 1.5 * mm, fill=1, stroke=0)
    c.setFillColor(_BLEU_BULLETIN)
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString(marge + 7 * mm, y - titre_h + 6 * mm, "A+")
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(marge + 15 * mm, y - titre_h + 5 * mm, "BULLETIN DE NOTES")

    periode_txt = (periode.libelle or "").upper()
    c.setFont("Helvetica-Bold", 9)
    pastille_w = c.stringWidth(periode_txt, "Helvetica-Bold", 9) + 10 * mm
    pastille_x = largeur - marge - pastille_w - 4 * mm
    c.setFillColor(colors.HexColor("#3661a3"))
    c.roundRect(pastille_x, y - titre_h + 3 * mm, pastille_w, 8 * mm, 4 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.drawCentredString(pastille_x + pastille_w / 2, y - titre_h + 6 * mm, periode_txt)

    y -= titre_h + 6 * mm

    # --- Bloc identité ---
    bloc_h = 30 * mm
    droite_largeur = 62 * mm
    champs = [
        ("Nom", (eleve.nom or "").upper()),
        ("Prénom", eleve.prenom or ""),
        ("Date de naissance", f"{eleve.date_naissance:%d/%m/%Y}" if eleve.date_naissance else "—"),
        ("Classe", inscription.classe.nom if inscription.classe_id else "—"),
        ("Matricule", eleve.matricule or "—"),
    ]
    y_champ = y - 5 * mm
    pas = bloc_h / len(champs)
    for label, valeur in champs:
        c.setFillColor(_BLEU_BULLETIN)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(marge, y_champ, f"{label} :")
        c.setFillColor(colors.black)
        c.setFont("Helvetica", 10)
        c.drawString(marge + 42 * mm, y_champ, valeur)
        y_champ -= pas

    boite_x = largeur - marge - droite_largeur
    c.setFillColor(_BLEU_CLAIR_BULLETIN)
    c.roundRect(boite_x, y - bloc_h, droite_largeur, bloc_h, 3 * mm, fill=1, stroke=0)
    c.setFillColor(_BLEU_BULLETIN)
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(boite_x + droite_largeur / 2, y - 9 * mm, "Année scolaire")
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(boite_x + droite_largeur / 2, y - 16 * mm,
                         inscription.annee_scolaire.libelle if inscription.annee_scolaire_id else "—")
    c.setFillColor(_GRIS_BULLETIN)
    c.setFont("Helvetica-Oblique", 8)
    for i, ligne_txt in enumerate(_decouper_texte(c, "Le savoir est la clé de la réussite !", "Helvetica-Oblique", 8, droite_largeur - 8 * mm)):
        c.drawCentredString(boite_x + droite_largeur / 2, y - 22 * mm - i * 3.8 * mm, ligne_txt)

    y -= bloc_h + 6 * mm

    # --- Tableau des matières ---
    colonnes = [("Matières", 0.40), ("Coef.", 0.12), ("Moyenne/20", 0.16), ("Rang", 0.12), ("Appréciation", 0.20)]
    table_largeur = largeur - 2 * marge
    xs = [marge]
    for _, part in colonnes:
        xs.append(xs[-1] + part * table_largeur)

    ligne_h = 7.5 * mm
    entete_table_h = 8 * mm

    def _entete_tableau(y_ref):
        c.setFillColor(_BLEU_BULLETIN)
        c.rect(marge, y_ref - entete_table_h, table_largeur, entete_table_h, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 9)
        for (label, _), x0, x1 in zip(colonnes, xs, xs[1:]):
            if label == "Matières":
                c.drawString(x0 + 3 * mm, y_ref - entete_table_h + 2.6 * mm, label)
            else:
                c.drawCentredString((x0 + x1) / 2, y_ref - entete_table_h + 2.6 * mm, label)
        return y_ref - entete_table_h

    y = _entete_tableau(y)
    c.setFont("Helvetica", 9)
    for i, ligne in enumerate(lignes_notes):
        if y - ligne_h < 92 * mm:
            c.showPage()
            c.setFillColor(_BLEU_BULLETIN)
            c.rect(0, 0, largeur, banniere_h, fill=1, stroke=0)
            c.setFillColor(colors.white)
            c.setFont("Helvetica-Oblique", 8)
            c.drawCentredString(largeur / 2, banniere_h / 2 - 1.2, "— Ensemble pour la réussite de nos enfants —")
            y = _entete_tableau(hauteur - marge)
            c.setFont("Helvetica", 9)

        if i % 2 == 1:
            c.setFillColor(colors.HexColor("#f8fafc"))
            c.rect(marge, y - ligne_h, table_largeur, ligne_h, fill=1, stroke=0)

        moyenne_m = ligne.get("moyenne")
        label_appr, bg_appr, texte_appr = _appreciation_matiere(moyenne_m if moyenne_m is not None else 0)

        c.setFillColor(colors.black)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(xs[0] + 3 * mm, y - ligne_h + 2.6 * mm,
                     _texte_tronque(c, str(ligne.get("matiere", "")), "Helvetica-Bold", 9, xs[1] - xs[0] - 4 * mm))
        c.setFont("Helvetica", 9)
        coef_val = ligne.get("coefficient")
        c.drawCentredString((xs[1] + xs[2]) / 2, y - ligne_h + 2.6 * mm, _nombre_court(coef_val) if coef_val is not None else "—")
        c.drawCentredString((xs[2] + xs[3]) / 2, y - ligne_h + 2.6 * mm,
                             f"{moyenne_m:.2f}" if moyenne_m is not None else "—")
        c.drawCentredString((xs[3] + xs[4]) / 2, y - ligne_h + 2.6 * mm, _ordinal(ligne.get("rang_matiere")))

        badge_w, badge_h = xs[5] - xs[4] - 4 * mm, 5 * mm
        badge_x, badge_y = xs[4] + 2 * mm, y - ligne_h + 1.3 * mm
        c.setFillColor(bg_appr)
        c.roundRect(badge_x, badge_y, badge_w, badge_h, 1.4 * mm, fill=1, stroke=0)
        c.setFillColor(texte_appr)
        c.setFont("Helvetica-Bold", 7.3)
        c.drawCentredString(badge_x + badge_w / 2, badge_y + 1.5 * mm, label_appr)

        c.setStrokeColor(colors.HexColor("#e5e7eb"))
        c.setLineWidth(0.3)
        c.line(marge, y - ligne_h, largeur - marge, y - ligne_h)
        y -= ligne_h

    y -= 6 * mm

    # --- Synthèse : statistiques + appréciation générale ---
    synth_h = 28 * mm
    stats_largeur = (table_largeur - 6 * mm) * 0.46
    appr_largeur = table_largeur - stats_largeur - 6 * mm

    c.setFillColor(_BLEU_CLAIR_BULLETIN)
    c.roundRect(marge, y - synth_h, stats_largeur, synth_h, 3 * mm, fill=1, stroke=0)

    total_general = sum(float(l.get("moyenne") or 0) * float(l.get("coefficient") or 0) for l in lignes_notes)
    total_coefficients = sum(float(l.get("coefficient") or 0) for l in lignes_notes)
    total_coef_txt = _nombre_court(total_coefficients)
    stats = [
        ("Total général", f"{total_general:.2f} / {total_coefficients * 20:.0f}" if total_coefficients else "—"),
        ("Total coefficients", total_coef_txt),
        ("Moyenne obtenue", f"{moyenne_generale:.2f} / 20"),
        ("Rang", f"{_ordinal(rang)} sur {effectif_classe} élève(s) classé(s)"),
    ]
    y_stat = y - 6.5 * mm
    pas_stat = (synth_h - 4 * mm) / len(stats)
    for label, valeur in stats:
        c.setFillColor(_BLEU_BULLETIN)
        c.circle(marge + 3.5 * mm, y_stat + 1.2 * mm, 1 * mm, fill=1, stroke=0)
        c.setFont("Helvetica-Bold", 9)
        libelle = f"{label} : "
        c.drawString(marge + 7 * mm, y_stat, libelle)
        c.setFillColor(colors.black)
        largeur_valeur = stats_largeur - 7 * mm - c.stringWidth(libelle, "Helvetica-Bold", 9) - 3 * mm
        c.drawString(marge + 7 * mm + c.stringWidth(libelle, "Helvetica-Bold", 9),
                     y_stat, _texte_tronque(c, valeur, "Helvetica-Bold", 9, largeur_valeur))
        y_stat -= pas_stat

    appr_x = marge + stats_largeur + 6 * mm
    c.setFillColor(_BLEU_BULLETIN)
    c.roundRect(appr_x, y - synth_h, appr_largeur, synth_h, 3 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(appr_x + appr_largeur / 2, y - 7 * mm, "Appréciation générale")
    titre_appr, sous_texte_appr = _appreciation_generale(moyenne_generale)
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(appr_x + appr_largeur / 2, y - 15 * mm, titre_appr)
    c.setFont("Helvetica", 8.5)
    for i, ligne_txt in enumerate(_decouper_texte(c, sous_texte_appr, "Helvetica", 8.5, appr_largeur - 8 * mm)):
        c.drawCentredString(appr_x + appr_largeur / 2, y - 20.5 * mm - i * 4 * mm, ligne_txt)

    y -= synth_h + 5 * mm

    if moyenne_classe is not None:
        c.setFillColor(_GRIS_BULLETIN)
        c.setFont("Helvetica", 9)
        c.drawCentredString(largeur / 2, y, f"Moyenne de la classe : {float(moyenne_classe):.2f} / 20")
        y -= 9 * mm

    # --- Pied de page : signatures, observations ---
    col_w = table_largeur / 3

    c.setFillColor(_BLEU_BULLETIN)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(marge, y, "Le Directeur")
    if getattr(etablissement, "directeur_signature", None):
        try:
            img = lecteur_image(etablissement, "directeur_signature")
            c.drawImage(img, marge, y - 17 * mm, width=26 * mm, height=13 * mm,
                        preserveAspectRatio=True, anchor="sw", mask="auto")
        except Exception:
            pass
    if getattr(etablissement, "cachet", None):
        try:
            img = lecteur_image(etablissement, "cachet")
            c.drawImage(img, marge + 25 * mm, y - 20 * mm, width=16 * mm, height=16 * mm,
                        preserveAspectRatio=True, anchor="sw", mask="auto")
        except Exception:
            pass

    obs_x = marge + col_w
    c.setFillColor(_BLEU_BULLETIN)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(obs_x, y, "Observations")
    c.setFillColor(colors.black)
    c.setFont("Helvetica", 9)
    if appreciation:
        for i, ligne_txt in enumerate(_decouper_texte(c, appreciation, "Helvetica", 9, col_w - 6 * mm)[:3]):
            c.drawString(obs_x, y - 6 * mm - i * 4.4 * mm, ligne_txt)
    c.setFillColor(_GRIS_BULLETIN)
    c.setFont("Helvetica", 7)
    c.drawString(obs_x, y - 20 * mm, timezone.localtime().strftime("%d/%m/%Y %H:%M"))

    parents_x = marge + 2 * col_w
    c.setFillColor(_BLEU_BULLETIN)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(parents_x, y, "Parents")
    c.setStrokeColor(colors.HexColor("#cbd5e1"))
    c.setLineWidth(0.4)
    c.line(parents_x, y - 15 * mm, largeur - marge, y - 15 * mm)

    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer


def generer_bulletin_pdf_a5(eleve, inscription, periode, lignes_notes, moyenne_generale, rang, effectif_classe,
                             etablissement, appreciation="", moyenne_classe=None):
    """Génère un bulletin de notes au format A5 (148 x 210mm) : version compacte du bulletin A4,
    pratique pour l'impression en volume ou la distribution en classe."""
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A5)
    largeur, hauteur = A5
    marge = 7 * mm

    banniere_h = 5 * mm
    c.setFillColor(_BLEU_BULLETIN)
    c.rect(0, 0, largeur, banniere_h, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Oblique", 5.5)
    c.drawCentredString(largeur / 2, banniere_h / 2 - 1, "— Ensemble pour la réussite de nos enfants —")

    # --- En-tête ---
    entete_h = 19 * mm
    logo_r = 6.5 * mm
    logo_cx, logo_cy = marge + logo_r, hauteur - marge - logo_r
    c.setFillColor(colors.HexColor("#f1f5f9"))
    c.circle(logo_cx, logo_cy, logo_r, fill=1, stroke=0)
    c.setStrokeColor(_BLEU_BULLETIN)
    c.setLineWidth(0.8)
    c.circle(logo_cx, logo_cy, logo_r, fill=0, stroke=1)
    logo_dessine = False
    if getattr(etablissement, "logo", None):
        try:
            img = lecteur_image(etablissement, "logo")
            c.saveState()
            chemin = c.beginPath()
            chemin.circle(logo_cx, logo_cy, logo_r - 0.5 * mm)
            c.clipPath(chemin, stroke=0, fill=0)
            c.drawImage(img, logo_cx - logo_r, logo_cy - logo_r, width=2 * logo_r, height=2 * logo_r,
                        preserveAspectRatio=True, anchor="c", mask="auto")
            c.restoreState()
            logo_dessine = True
        except Exception:
            logo_dessine = False
    if not logo_dessine:
        c.setFillColor(_BLEU_BULLETIN)
        c.setFont("Helvetica-Bold", 6)
        initiales = (etablissement.sigle or etablissement.nom or "?")[:3].upper()
        c.drawCentredString(logo_cx, logo_cy - 2, initiales)

    pays = (etablissement.pays or "").strip()
    texte_x = marge + 2 * logo_r + 3 * mm
    largeur_bloc_pays = 0
    if pays:
        largeur_bloc_pays = max(c.stringWidth(("RÉPUBLIQUE DU MALI" if pays.lower() == "mali" else pays.upper()), "Helvetica-Bold", 5.4), 9 * mm)
    zone_droite = largeur - marge - (largeur_bloc_pays + 2 * mm if pays else 0)
    largeur_dispo_nom = zone_droite - texte_x

    c.setFillColor(_BLEU_BULLETIN)
    nom_etab = (etablissement.nom or "").upper()
    taille_nom = _police_ajustee(c, nom_etab, "Helvetica-Bold", 9, largeur_dispo_nom, taille_min=6)
    c.setFont("Helvetica-Bold", taille_nom)
    c.drawString(texte_x, hauteur - marge - 3.6 * mm, _texte_tronque(c, nom_etab, "Helvetica-Bold", taille_nom, largeur_dispo_nom))

    if etablissement.devise:
        c.setFillColor(_GRIS_BULLETIN)
        c.setFont("Helvetica-Oblique", 5.6)
        c.drawString(texte_x, hauteur - marge - 7.4 * mm,
                     _texte_tronque(c, etablissement.devise, "Helvetica-Oblique", 5.6, largeur_dispo_nom))

    if pays:
        drap_w, drap_h = 9 * mm, 5.9 * mm
        drap_x, drap_y = largeur - marge - drap_w, hauteur - marge - 1 * mm - drap_h
        if pays.lower() == "mali":
            bande = drap_w / 3
            for i, couleur_hex in enumerate(["#14b53a", "#fcd116", "#ce1126"]):
                c.setFillColor(colors.HexColor(couleur_hex))
                c.rect(drap_x + i * bande, drap_y, bande, drap_h, fill=1, stroke=0)
            c.setFillColor(_BLEU_BULLETIN)
            c.setFont("Helvetica-Bold", 5.4)
            c.drawRightString(largeur - marge, drap_y - 3, "RÉP. DU MALI")
        else:
            c.setFillColor(colors.white)
            c.setStrokeColor(colors.HexColor("#d0d5dd"))
            c.setLineWidth(0.3)
            c.rect(drap_x, drap_y, drap_w, drap_h, fill=1, stroke=1)
            c.setFillColor(_BLEU_BULLETIN)
            c.setFont("Helvetica-Bold", 5.4)
            c.drawRightString(largeur - marge, drap_y - 3, pays.upper())

    c.setFillColor(_OR_BULLETIN)
    c.rect(0, hauteur - entete_h, largeur, 0.5 * mm, fill=1, stroke=0)

    # --- Titre + période/année sur une ligne ---
    titre_y = hauteur - entete_h - 3.6 * mm
    c.setFillColor(_BLEU_BULLETIN)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawCentredString(largeur / 2, titre_y, "BULLETIN DE NOTES")
    c.setFillColor(_GRIS_BULLETIN)
    c.setFont("Helvetica", 5.4)
    annee_libelle = inscription.annee_scolaire.libelle if inscription.annee_scolaire_id else ""
    periode_libelle = periode.libelle or ""
    c.drawCentredString(largeur / 2, titre_y - 4.2 * mm, f"{periode_libelle} — Année scolaire {annee_libelle}".strip(" —"))

    # --- Identité (2 colonnes compactes) ---
    y = titre_y - 9.5 * mm
    col1_x, col2_x = marge, marge + (largeur - 2 * marge) / 2 + 1 * mm
    champs = [
        ("Nom", (eleve.nom or "").upper(), "Prénom", eleve.prenom or ""),
        ("Classe", inscription.classe.nom if inscription.classe_id else "—", "Matricule", eleve.matricule or "—"),
        ("Né(e) le", f"{eleve.date_naissance:%d/%m/%Y}" if eleve.date_naissance else "—", "Rang", f"{_ordinal(rang)}/{effectif_classe}"),
    ]
    for l1, v1, l2, v2 in champs:
        c.setFillColor(_BLEU_BULLETIN)
        c.setFont("Helvetica-Bold", 6)
        c.drawString(col1_x, y, f"{l1} :")
        c.drawString(col2_x, y, f"{l2} :")
        c.setFillColor(colors.black)
        c.setFont("Helvetica", 6)
        c.drawString(col1_x + 16 * mm, y, str(v1))
        c.drawString(col2_x + 16 * mm, y, str(v2))
        y -= 4 * mm

    y -= 2 * mm

    # --- Tableau des matières ---
    colonnes = [("Matières", 0.38), ("Coef.", 0.12), ("Moy./20", 0.17), ("Rang", 0.12), ("Appréciation", 0.21)]
    table_largeur = largeur - 2 * marge
    xs = [marge]
    for _, part in colonnes:
        xs.append(xs[-1] + part * table_largeur)

    ligne_h = 4.6 * mm
    entete_table_h = 5 * mm

    def _entete_tableau(y_ref):
        c.setFillColor(_BLEU_BULLETIN)
        c.rect(marge, y_ref - entete_table_h, table_largeur, entete_table_h, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 6)
        for (label, _), x0, x1 in zip(colonnes, xs, xs[1:]):
            if label == "Matières":
                c.drawString(x0 + 2 * mm, y_ref - entete_table_h + 1.6 * mm, label)
            else:
                c.drawCentredString((x0 + x1) / 2, y_ref - entete_table_h + 1.6 * mm, label)
        return y_ref - entete_table_h

    y = _entete_tableau(y)
    for i, ligne in enumerate(lignes_notes):
        if y - ligne_h < 58 * mm:
            c.showPage()
            c.setFillColor(_BLEU_BULLETIN)
            c.rect(0, 0, largeur, banniere_h, fill=1, stroke=0)
            c.setFillColor(colors.white)
            c.setFont("Helvetica-Oblique", 5.5)
            c.drawCentredString(largeur / 2, banniere_h / 2 - 1, "— Ensemble pour la réussite de nos enfants —")
            y = _entete_tableau(hauteur - marge)

        if i % 2 == 1:
            c.setFillColor(colors.HexColor("#f8fafc"))
            c.rect(marge, y - ligne_h, table_largeur, ligne_h, fill=1, stroke=0)

        moyenne_m = ligne.get("moyenne")
        label_appr, bg_appr, texte_appr = _appreciation_matiere(moyenne_m if moyenne_m is not None else 0)

        c.setFillColor(colors.black)
        c.setFont("Helvetica-Bold", 5.8)
        c.drawString(xs[0] + 2 * mm, y - ligne_h + 1.5 * mm,
                     _texte_tronque(c, str(ligne.get("matiere", "")), "Helvetica-Bold", 5.8, xs[1] - xs[0] - 3 * mm))
        c.setFont("Helvetica", 5.8)
        coef_val = ligne.get("coefficient")
        c.drawCentredString((xs[1] + xs[2]) / 2, y - ligne_h + 1.5 * mm, _nombre_court(coef_val) if coef_val is not None else "—")
        c.drawCentredString((xs[2] + xs[3]) / 2, y - ligne_h + 1.5 * mm, f"{moyenne_m:.2f}" if moyenne_m is not None else "—")
        c.drawCentredString((xs[3] + xs[4]) / 2, y - ligne_h + 1.5 * mm, _ordinal(ligne.get("rang_matiere")))

        badge_w, badge_h = xs[5] - xs[4] - 2.4 * mm, 3.4 * mm
        badge_x, badge_y = xs[4] + 1.2 * mm, y - ligne_h + 0.6 * mm
        c.setFillColor(bg_appr)
        c.roundRect(badge_x, badge_y, badge_w, badge_h, 1 * mm, fill=1, stroke=0)
        c.setFillColor(texte_appr)
        c.setFont("Helvetica-Bold", 5)
        c.drawCentredString(badge_x + badge_w / 2, badge_y + 1 * mm, label_appr)

        c.setStrokeColor(colors.HexColor("#e5e7eb"))
        c.setLineWidth(0.25)
        c.line(marge, y - ligne_h, largeur - marge, y - ligne_h)
        y -= ligne_h

    y -= 3.5 * mm

    # --- Synthèse ---
    synth_h = 15 * mm
    stats_largeur = (table_largeur - 4 * mm) * 0.46
    appr_largeur = table_largeur - stats_largeur - 4 * mm

    c.setFillColor(_BLEU_CLAIR_BULLETIN)
    c.roundRect(marge, y - synth_h, stats_largeur, synth_h, 2 * mm, fill=1, stroke=0)
    total_general = sum(float(l.get("moyenne") or 0) * float(l.get("coefficient") or 0) for l in lignes_notes)
    total_coefficients = sum(float(l.get("coefficient") or 0) for l in lignes_notes)
    stats = [
        ("Total", f"{total_general:.1f}/{total_coefficients * 20:.0f}" if total_coefficients else "—"),
        ("Coeffs", _nombre_court(total_coefficients)),
        ("Moyenne", f"{moyenne_generale:.2f}/20"),
    ]
    y_stat = y - 4 * mm
    pas_stat = (synth_h - 2 * mm) / len(stats)
    for label, valeur in stats:
        c.setFillColor(_BLEU_BULLETIN)
        c.setFont("Helvetica-Bold", 5.6)
        libelle = f"{label} : "
        c.drawString(marge + 2 * mm, y_stat, libelle)
        c.setFillColor(colors.black)
        c.drawString(marge + 2 * mm + c.stringWidth(libelle, "Helvetica-Bold", 5.6), y_stat, valeur)
        y_stat -= pas_stat

    appr_x = marge + stats_largeur + 4 * mm
    c.setFillColor(_BLEU_BULLETIN)
    c.roundRect(appr_x, y - synth_h, appr_largeur, synth_h, 2 * mm, fill=1, stroke=0)
    titre_appr, sous_texte_appr = _appreciation_generale(moyenne_generale)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 7)
    c.drawCentredString(appr_x + appr_largeur / 2, y - 5.5 * mm, titre_appr)
    c.setFont("Helvetica", 5.4)
    for i, ligne_txt in enumerate(_decouper_texte(c, sous_texte_appr, "Helvetica", 5.4, appr_largeur - 4 * mm)[:2]):
        c.drawCentredString(appr_x + appr_largeur / 2, y - 9.5 * mm - i * 3 * mm, ligne_txt)

    y -= synth_h + 3.5 * mm

    if moyenne_classe is not None:
        c.setFillColor(_GRIS_BULLETIN)
        c.setFont("Helvetica", 5.6)
        c.drawCentredString(largeur / 2, y, f"Moyenne de la classe : {float(moyenne_classe):.2f} / 20")
        y -= 6 * mm

    # --- Pied de page ---
    col_w = table_largeur / 3

    c.setFillColor(_BLEU_BULLETIN)
    c.setFont("Helvetica-Bold", 5.6)
    c.drawString(marge, y, "Le Directeur")
    if getattr(etablissement, "directeur_signature", None):
        try:
            img = lecteur_image(etablissement, "directeur_signature")
            c.drawImage(img, marge, y - 9 * mm, width=16 * mm, height=8 * mm,
                        preserveAspectRatio=True, anchor="sw", mask="auto")
        except Exception:
            pass

    obs_x = marge + col_w
    c.setFillColor(_BLEU_BULLETIN)
    c.setFont("Helvetica-Bold", 5.6)
    c.drawString(obs_x, y, "Observations")
    c.setFillColor(colors.black)
    c.setFont("Helvetica", 5.4)
    if appreciation:
        for i, ligne_txt in enumerate(_decouper_texte(c, appreciation, "Helvetica", 5.4, col_w - 4 * mm)[:2]):
            c.drawString(obs_x, y - 3.6 * mm - i * 3 * mm, ligne_txt)

    parents_x = marge + 2 * col_w
    c.setFillColor(_BLEU_BULLETIN)
    c.setFont("Helvetica-Bold", 5.6)
    c.drawString(parents_x, y, "Parents")
    c.setStrokeColor(colors.HexColor("#cbd5e1"))
    c.setLineWidth(0.3)
    c.line(parents_x, y - 9 * mm, largeur - marge, y - 9 * mm)

    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer


def _dessiner_logo_etablissement(c, cx, cy, r, etablissement):
    """Dessine le logo circulaire de l'établissement (ou ses initiales à défaut)."""
    c.setFillColor(colors.HexColor("#f1f5f9"))
    c.circle(cx, cy, r, fill=1, stroke=0)
    c.setStrokeColor(_BLEU_BULLETIN)
    c.setLineWidth(1)
    c.circle(cx, cy, r, fill=0, stroke=1)
    if getattr(etablissement, "logo", None):
        try:
            img = lecteur_image(etablissement, "logo")
            c.saveState()
            chemin = c.beginPath()
            chemin.circle(cx, cy, r - 0.6 * mm)
            c.clipPath(chemin, stroke=0, fill=0)
            c.drawImage(img, cx - r, cy - r, width=2 * r, height=2 * r,
                        preserveAspectRatio=True, anchor="c", mask="auto")
            c.restoreState()
            return
        except Exception:
            pass
    c.setFillColor(_BLEU_BULLETIN)
    c.setFont("Helvetica-Bold", 13)
    initiales = (etablissement.sigle or etablissement.nom or "?")[:3].upper()
    c.drawCentredString(cx, cy - 4, initiales)


def _melange_couleur(c1, c2, t):
    return colors.Color(c1.red + (c2.red - c1.red) * t, c1.green + (c2.green - c1.green) * t,
                         c1.blue + (c2.blue - c1.blue) * t)


def _bande_degradee(c, x, y, w, h, couleur1, couleur2, segments=16, horizontal=True):
    """Simule un dégradé linéaire par bandes de couleur interpolée (reportlab n'a pas de
    dégradé natif simple pour les formes)."""
    for i in range(segments):
        t = i / max(1, segments - 1)
        c.setFillColor(_melange_couleur(couleur1, couleur2, t))
        if horizontal:
            seg_w = w / segments
            c.rect(x + i * seg_w, y, seg_w + 0.6, h, fill=1, stroke=0)
        else:
            seg_h = h / segments
            c.rect(x, y + i * seg_h, w, seg_h + 0.6, fill=1, stroke=0)


def _dessiner_cadre_ornemental(c, largeur, hauteur):
    """Cadre décoratif doré façon diplôme, avec rubans dégradés bleu/or aux coins opposés —
    reste neutre/générique pour convenir à tout établissement."""
    marge_ext = 5 * mm
    c.setStrokeColor(_OR_BULLETIN)
    c.setLineWidth(1.4)
    c.rect(marge_ext, marge_ext, largeur - 2 * marge_ext, hauteur - 2 * marge_ext, fill=0, stroke=1)
    c.setStrokeColor(_BLEU_BULLETIN)
    c.setLineWidth(0.4)
    c.rect(marge_ext + 1.6 * mm, marge_ext + 1.6 * mm, largeur - 2 * (marge_ext + 1.6 * mm),
           hauteur - 2 * (marge_ext + 1.6 * mm), fill=0, stroke=1)

    # Rubans triangulaires dégradés dans deux coins opposés (haut-gauche / bas-droite)
    taille = 30 * mm
    c.saveState()
    chemin = c.beginPath()
    chemin.moveTo(0, hauteur)
    chemin.lineTo(taille, hauteur)
    chemin.lineTo(0, hauteur - taille)
    chemin.close()
    c.clipPath(chemin, stroke=0, fill=0)
    _bande_degradee(c, 0, hauteur - taille, taille, taille, _BLEU_BULLETIN, _OR_BULLETIN, horizontal=True)
    c.restoreState()

    c.saveState()
    chemin = c.beginPath()
    chemin.moveTo(largeur, 0)
    chemin.lineTo(largeur - taille, 0)
    chemin.lineTo(largeur, taille)
    chemin.close()
    c.clipPath(chemin, stroke=0, fill=0)
    _bande_degradee(c, largeur - taille, 0, taille, taille, _OR_BULLETIN, _BLEU_BULLETIN, horizontal=True)
    c.restoreState()


def _dessiner_feuille(c, longueur, largeur):
    """Feuille en amande (pointe en haut, base à l'origine), remplie dans la couleur courante."""
    chemin = c.beginPath()
    chemin.moveTo(0, 0)
    chemin.curveTo(largeur / 2, longueur * 0.3, largeur / 2, longueur * 0.75, 0, longueur)
    chemin.curveTo(-largeur / 2, longueur * 0.75, -largeur / 2, longueur * 0.3, 0, 0)
    chemin.close()
    c.drawPath(chemin, fill=1, stroke=0)


def _dessiner_laurier(c, x, y, hauteur_branche=24 * mm, miroir=False):
    """Rameau de laurier stylisé (tige courbe + feuilles dorées en amande), ancré en (x, y)."""
    c.saveState()
    c.translate(x, y)
    if miroir:
        c.scale(-1, 1)
    c.setStrokeColor(_OR_BULLETIN)
    c.setFillColor(_OR_BULLETIN)
    c.setLineWidth(0.9)
    chemin = c.beginPath()
    chemin.moveTo(0, 0)
    chemin.curveTo(1.2 * mm, hauteur_branche * 0.5, 1.2 * mm, hauteur_branche * 0.88, 0, hauteur_branche)
    c.drawPath(chemin, stroke=1, fill=0)

    nb_feuilles = 5
    for i in range(nb_feuilles):
        t = (i + 0.8) / nb_feuilles
        ly = t * hauteur_branche
        lx = 1.2 * mm * (4 * t * (1 - t))
        cote = 1 if i % 2 == 0 else -1
        c.saveState()
        c.translate(lx, ly)
        c.rotate(cote * (50 - 18 * t))
        _dessiner_feuille(c, longueur=6.5 * mm, largeur=2.8 * mm)
        c.restoreState()
    c.restoreState()


def _dessiner_banniere_ruban(c, cx, y_bas, largeur_bandeau, hauteur_bandeau, couleur):
    """Bandeau en forme de ruban (pointes triangulaires aux deux bouts) — sert de fond au titre."""
    demi = largeur_bandeau / 2
    pointe = hauteur_bandeau * 0.55
    c.setFillColor(couleur)
    chemin = c.beginPath()
    chemin.moveTo(cx - demi - pointe, y_bas + hauteur_bandeau / 2)
    chemin.lineTo(cx - demi, y_bas + hauteur_bandeau)
    chemin.lineTo(cx + demi, y_bas + hauteur_bandeau)
    chemin.lineTo(cx + demi + pointe, y_bas + hauteur_bandeau / 2)
    chemin.lineTo(cx + demi, y_bas)
    chemin.lineTo(cx - demi, y_bas)
    chemin.close()
    c.drawPath(chemin, fill=1, stroke=0)


def _dessiner_sceau(c, cx, cy, r, initiales=""):
    """Sceau doré à rubans pendants, avec les initiales de l'établissement au centre."""
    c.setFillColor(_BLEU_BULLETIN)
    for dx in (-r * 0.32, r * 0.32):
        chemin = c.beginPath()
        chemin.moveTo(cx + dx - 1.8 * mm, cy - r * 0.55)
        chemin.lineTo(cx + dx + 1.8 * mm, cy - r * 0.55)
        chemin.lineTo(cx + dx + 1.8 * mm, cy - r * 1.7)
        chemin.lineTo(cx + dx, cy - r * 1.35)
        chemin.lineTo(cx + dx - 1.8 * mm, cy - r * 1.7)
        chemin.close()
        c.drawPath(chemin, fill=1, stroke=0)
    for rayon, couleur in ((r, _OR_BULLETIN), (r * 0.86, colors.white), (r * 0.74, _OR_BULLETIN)):
        c.setFillColor(couleur)
        c.circle(cx, cy, rayon, fill=1, stroke=0)
    c.setFillColor(_BLEU_BULLETIN)
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString(cx, cy - 2.6, (initiales or "★")[:4].upper())


def _icone_info(c, cx, cy, r, type_icone):
    """Petite icône générique (dessinée en formes simples) dans un médaillon coloré."""
    c.setFillColor(_BLEU_CLAIR_BULLETIN)
    c.circle(cx, cy, r, fill=1, stroke=0)
    c.setFillColor(_BLEU_BULLETIN)
    c.setStrokeColor(_BLEU_BULLETIN)
    c.setLineWidth(1)
    if type_icone == "date":
        c.roundRect(cx - r * 0.5, cy - r * 0.45, r, r * 0.8, 0.6 * mm, fill=0, stroke=1)
        c.line(cx - r * 0.5, cy + r * 0.08, cx + r * 0.5, cy + r * 0.08)
        c.line(cx - r * 0.25, cy + r * 0.35, cx - r * 0.25, cy + r * 0.5)
        c.line(cx + r * 0.25, cy + r * 0.35, cx + r * 0.25, cy + r * 0.5)
    elif type_icone == "reference":
        c.saveState()
        c.translate(cx, cy)
        c.rotate(45)
        c.rect(-r * 0.35, -r * 0.35, r * 0.7, r * 0.7, fill=1, stroke=0)
        c.restoreState()
    elif type_icone == "etablissement":
        chemin = c.beginPath()
        chemin.moveTo(cx - r * 0.5, cy - r * 0.3)
        chemin.lineTo(cx, cy + r * 0.5)
        chemin.lineTo(cx + r * 0.5, cy - r * 0.3)
        chemin.close()
        c.drawPath(chemin, fill=1, stroke=0)
        c.line(cx - r * 0.35, cy - r * 0.05, cx + r * 0.35, cy - r * 0.05)
    else:
        c.circle(cx, cy, r * 0.4, fill=1, stroke=0)


def _dessiner_entete_officiel_mali(c, largeur, marge, y, etablissement):
    """En-tête institutionnel malien (Ministère / République / Académie), pour les documents
    à caractère officiel (certificats de scolarité, de fréquentation...)."""
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(marge, y, "MINISTÈRE DE L'ÉDUCATION NATIONALE")
    c.drawRightString(largeur - marge, y, "RÉPUBLIQUE DU MALI")
    y -= 4.6 * mm
    c.setFont("Helvetica", 8)
    c.drawString(marge, y, etablissement.academie or "Académie d'Enseignement")
    c.drawRightString(largeur - marge, y, "Un Peuple - Un But - Une Foi")
    y -= 4.6 * mm
    if getattr(etablissement, "cap", ""):
        c.setFont("Helvetica-Bold", 8)
        c.drawString(marge, y, f"Centre d'Animation Pédagogique de {etablissement.cap}" if "CAP" not in etablissement.cap.upper() else etablissement.cap)
        y -= 4.6 * mm
    y -= 1.4 * mm
    c.setStrokeColor(_GRIS_BULLETIN)
    c.setLineWidth(0.3)
    c.line(marge, y, largeur - marge, y)
    return y - 8 * mm


def _dessiner_tableau(c, x0, x1, y, tableau):
    """Dessine un petit tableau (en-tête bleu + lignes alternées) — utilisé pour le relevé
    de notes inclus dans certains certificats de scolarité."""
    entetes = tableau["entetes"]
    lignes = tableau["lignes"]
    poids = tableau.get("largeurs") or [1] * len(entetes)
    total_poids = sum(poids)
    largeur_totale = x1 - x0
    largeurs = [largeur_totale * p / total_poids for p in poids]
    xs = [x0]
    for w in largeurs:
        xs.append(xs[-1] + w)

    y_debut = y
    ligne_h = 6 * mm
    c.setFillColor(_BLEU_BULLETIN)
    c.rect(x0, y - ligne_h, largeur_totale, ligne_h, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 7.2)
    for entete, xa, xb in zip(entetes, xs, xs[1:]):
        c.drawCentredString((xa + xb) / 2, y - ligne_h + 2 * mm, entete)
    y -= ligne_h

    c.setFont("Helvetica", 7.2)
    for i, ligne in enumerate(lignes):
        if i % 2 == 1:
            c.setFillColor(colors.HexColor("#f8fafc"))
            c.rect(x0, y - ligne_h, largeur_totale, ligne_h, fill=1, stroke=0)
        c.setFillColor(colors.black)
        for val, xa, xb in zip(ligne, xs, xs[1:]):
            c.drawCentredString((xa + xb) / 2, y - ligne_h + 2 * mm, str(val) if val not in (None, "") else "—")
        c.setStrokeColor(colors.HexColor("#e5e7eb"))
        c.setLineWidth(0.3)
        c.line(x0, y - ligne_h, x1, y - ligne_h)
        y -= ligne_h

    c.setStrokeColor(_BLEU_BULLETIN)
    c.setLineWidth(0.5)
    c.rect(x0, y, largeur_totale, y_debut - y, fill=0, stroke=1)
    return y


_ROUGE_ARRETES = colors.HexColor("#9f1239")


def _dessiner_logo_carre(c, x, y, taille, etablissement):
    """Logo dans un carré (coin bas-gauche x, y), proportions conservées ; initiales à défaut."""
    try:
        c.drawImage(lecteur_image(etablissement, "logo"), x, y, width=taille, height=taille,
                    preserveAspectRatio=True, anchor="c", mask="auto")
        return
    except Exception:
        pass
    c.setFillColor(_BLEU_BULLETIN)
    c.roundRect(x, y, taille, taille, taille * 0.2, fill=1, stroke=0)
    c.setFillColor(colors.white)
    initiales = (etablissement.sigle or etablissement.nom or "?")[:4].upper()
    taille_police = _police_ajustee(c, initiales, "Helvetica-Bold", taille * 0.36, taille * 0.8, taille_min=6)
    c.setFont("Helvetica-Bold", taille_police)
    c.drawCentredString(x + taille / 2, y + taille / 2 - taille_police * 0.35, initiales)


def _dessiner_entete_document(c, largeur, x_gauche, x_droite, y_haut, etablissement, taille_logo=26 * mm):
    """En-tête des documents administratifs : logo à gauche ; nom, devise, coordonnées et arrêtés
    centrés sur la page ; double filet or/bleu. Retourne l'ordonnée sous l'en-tête."""
    _dessiner_logo_carre(c, x_gauche, y_haut - taille_logo, taille_logo, etablissement)

    # Bloc texte centré sur la page, sans empiéter sur le logo (marge symétrique à droite)
    centre = largeur / 2
    largeur_texte = 2 * min(centre - (x_gauche + taille_logo + 4 * mm), (x_droite - 4 * mm) - centre)
    y = y_haut - 6.5 * mm

    nom = (etablissement.nom or "").upper()
    # Une seule ligne si le nom tient en 13 pt minimum, sinon deux lignes
    taille_nom = _police_ajustee(c, nom, "Helvetica-Bold", 17, largeur_texte, taille_min=13)
    if c.stringWidth(nom, "Helvetica-Bold", taille_nom) <= largeur_texte:
        lignes_nom = [nom]
    else:
        taille_nom = 15
        lignes_nom = _decouper_texte(c, nom, "Helvetica-Bold", taille_nom, largeur_texte)
    c.setFillColor(_BLEU_BULLETIN)
    for ligne in lignes_nom[:2]:
        c.setFont("Helvetica-Bold", _police_ajustee(c, ligne, "Helvetica-Bold", taille_nom, largeur_texte, taille_min=9))
        c.drawCentredString(centre, y, ligne)
        y -= taille_nom * 0.42 * mm

    if etablissement.devise:
        c.setFillColor(_OR_BULLETIN)
        c.setFont("Helvetica-BoldOblique", 8.5)
        c.drawCentredString(centre, y, _texte_tronque(c, etablissement.devise, "Helvetica-BoldOblique", 8.5, largeur_texte))
        y -= 4.4 * mm

    coordonnees = "  ·  ".join(p for p in [
        ", ".join(q for q in (etablissement.adresse, etablissement.ville) if q),
        f"Tél : {etablissement.telephone}" if etablissement.telephone else "",
        etablissement.email,
    ] if p)
    if coordonnees:
        c.setFillColor(_GRIS_BULLETIN)
        c.setFont("Helvetica", 8.5)
        c.drawCentredString(centre, y, _texte_tronque(c, coordonnees, "Helvetica", 8.5, largeur_texte))
        y -= 4.4 * mm

    arretes = " / ".join(p for p in [
        f"ARRÊTÉ DE CRÉATION N° {etablissement.arrete_creation}" if etablissement.arrete_creation else "",
        f"ARRÊTÉ D'OUVERTURE N° {etablissement.arrete_ouverture}" if etablissement.arrete_ouverture else "",
    ] if p)
    if arretes:
        c.setFillColor(_ROUGE_ARRETES)
        taille_arr = _police_ajustee(c, arretes, "Helvetica-Bold", 7.5, largeur_texte, taille_min=5.5)
        c.setFont("Helvetica-Bold", taille_arr)
        c.drawCentredString(centre, y, arretes)
        y -= 4 * mm

    bas = min(y, y_haut - taille_logo) - 2.5 * mm
    c.setFillColor(_OR_BULLETIN)
    c.rect(x_gauche, bas, x_droite - x_gauche, 1.1 * mm, fill=1, stroke=0)
    c.setFillColor(_BLEU_BULLETIN)
    c.rect(x_gauche, bas - 1.6 * mm, x_droite - x_gauche, 0.35 * mm, fill=1, stroke=0)
    return bas - 1.6 * mm


def generer_document_administratif_pdf(titre, etablissement, contenu_lignes, destinataire="", reference="",
                                        signataire_titre="", style="simple", preambule_lignes=None, tableau=None):
    """Génère un document administratif générique en A4 : certificat, attestation, convocation,
    fiche de permission, avis de recouvrement, etc.

    style :
      - "simple" (défaut) : en-tête compact logo + nom, pour les fiches/avis courants (A4 portrait).
      - "officiel" : en-tête institutionnel malien (Ministère/République/Académie), pour les
        certificats de scolarité/fréquentation (A4 portrait).
      - "orne" : cadre décoratif façon diplôme, avec préambule légal ("Vu l'arrêté..."), pour
        les attestations et certificats de travail/fin de contrat/fin de stage/réussite
        (A4 **paysage**, comme un diplôme).
    """
    buffer = io.BytesIO()
    pagesize = landscape(A4) if style == "orne" else A4
    c = canvas.Canvas(buffer, pagesize=pagesize)
    largeur, hauteur = pagesize
    marge = 16 * mm if style == "orne" else 18 * mm
    # Les paragraphes tiennent plus de caractères par ligne sur une page plus large (paysage).
    car_par_ligne = round(90 * largeur / A4[0])

    if style == "orne":
        _dessiner_cadre_ornemental(c, largeur, hauteur)

    if style == "officiel" and (etablissement.pays or "").strip().lower() == "mali":
        # Bandeau institutionnel (Ministère / République) au-dessus de l'en-tête de l'établissement
        y = _dessiner_entete_officiel_mali(c, largeur, marge, hauteur - marge, etablissement) + 2 * mm
        y = _dessiner_entete_document(c, largeur, marge, largeur - marge, y, etablissement, taille_logo=24 * mm)
        y -= 12 * mm
    else:
        # En-tête commun : sur le cadre orné, il commence sous la bordure (coins décoratifs)
        haut = hauteur - (14 * mm if style == "orne" else marge)
        y = _dessiner_entete_document(c, largeur, marge, largeur - marge, haut, etablissement)
        y -= 9 * mm if style == "orne" else 12 * mm

    from datetime import date

    if style == "orne":
        # --- Titre en bandeau-ruban, encadré de rameaux de laurier ---
        c.setFont("Helvetica-Bold", 17)
        largeur_texte_titre = c.stringWidth(titre.upper(), "Helvetica-Bold", 17)
        bandeau_y = y - 11 * mm
        _dessiner_banniere_ruban(c, largeur / 2, bandeau_y, largeur_texte_titre + 18 * mm, 11 * mm, _BLEU_BULLETIN)
        c.setFillColor(colors.white)
        c.drawCentredString(largeur / 2, bandeau_y + 3.2 * mm, titre.upper())
        _dessiner_laurier(c, largeur / 2 - largeur_texte_titre / 2 - 24 * mm, bandeau_y + 1 * mm, hauteur_branche=18 * mm, miroir=False)
        _dessiner_laurier(c, largeur / 2 + largeur_texte_titre / 2 + 24 * mm, bandeau_y + 1 * mm, hauteur_branche=18 * mm, miroir=True)
        y = bandeau_y - 8 * mm

        if destinataire:
            c.setFillColor(_GRIS_BULLETIN)
            c.setFont("Helvetica-Oblique", 10)
            c.drawCentredString(largeur / 2, y, f"{(etablissement.nom or '').strip()} atteste que")
            y -= 9 * mm
            c.setFillColor(_BLEU_BULLETIN)
            largeur_dispo_nom = largeur - 2 * marge - 30 * mm
            taille_nom_dest = _police_ajustee(c, destinataire, "Times-BoldItalic", 22, largeur_dispo_nom, taille_min=13)
            c.setFont("Times-BoldItalic", taille_nom_dest)
            c.drawCentredString(largeur / 2, y, _texte_tronque(c, destinataire, "Times-BoldItalic", taille_nom_dest, largeur_dispo_nom))
            y -= 3 * mm
            largeur_ligne = min(largeur_dispo_nom, c.stringWidth(destinataire, "Times-BoldItalic", taille_nom_dest) + 20 * mm)
            c.setStrokeColor(_OR_BULLETIN)
            c.setLineWidth(0.7)
            c.line(largeur / 2 - largeur_ligne / 2, y, largeur / 2 + largeur_ligne / 2, y)
            y -= 8 * mm

        if preambule_lignes:
            c.setFillColor(_GRIS_BULLETIN)
            c.setFont("Helvetica-Oblique", 8)
            for ligne in preambule_lignes:
                for sous_ligne in _wrap_text(ligne, round(car_par_ligne * 1.15)):
                    c.drawCentredString(largeur / 2, y, sous_ligne)
                    y -= 4.4 * mm
                y -= 1 * mm
            y -= 3 * mm

        c.setFillColor(colors.black)
        c.setFont("Helvetica", 10.5)
        for ligne in contenu_lignes:
            if not ligne:
                y -= 3 * mm
                continue
            for sous_ligne in _wrap_text(ligne, round(car_par_ligne * 1.05)):
                c.drawCentredString(largeur / 2, y, sous_ligne)
                y -= 6 * mm
            y -= 2.5 * mm

        # --- Ligne d'informations (icônes) : date de délivrance, référence, établissement ---
        y -= 5 * mm
        icon_r = 5 * mm
        infos = [
            ("date", "Date de délivrance", f"{date.today():%d/%m/%Y}"),
            ("reference", "Référence", reference or "—"),
            ("etablissement", "Établissement", etablissement.sigle or (etablissement.nom or "")[:18]),
        ]
        largeur_bloc = 68 * mm
        x0 = largeur / 2 - (largeur_bloc * len(infos)) / 2
        for i, (icone, label, valeur) in enumerate(infos):
            bx = x0 + largeur_bloc * i + largeur_bloc / 2 - 24 * mm
            _icone_info(c, bx, y - icon_r, icon_r, icone)
            c.setFillColor(_GRIS_BULLETIN)
            c.setFont("Helvetica", 7)
            c.drawString(bx + icon_r + 2.5 * mm, y - icon_r + 1.8 * mm, label)
            c.setFillColor(colors.black)
            c.setFont("Helvetica-Bold", 8.5)
            c.drawString(bx + icon_r + 2.5 * mm, y - icon_r - 2.8 * mm, valeur)
        y -= (2 * icon_r + 14 * mm)

        # --- Pied : signature (gauche), sceau (centre), QR (droite) ---
        pied_y = max(y - 4 * mm, marge + 22 * mm)
        if getattr(etablissement, "directeur_signature", None):
            try:
                c.drawImage(lecteur_image(etablissement, "directeur_signature"), marge + 2 * mm, pied_y + 2 * mm,
                            width=28 * mm, height=14 * mm, preserveAspectRatio=True, anchor="sw", mask="auto")
            except Exception:
                pass
        c.setStrokeColor(_GRIS_BULLETIN)
        c.setLineWidth(0.3)
        c.line(marge + 2 * mm, pied_y, marge + 40 * mm, pied_y)
        c.setFillColor(_BLEU_BULLETIN)
        c.setFont("Helvetica-Bold", 9)
        titre_signataire = signataire_titre or getattr(etablissement, "directeur_titre", "") or "Le Directeur"
        c.drawString(marge + 2 * mm, pied_y - 4.5 * mm, titre_signataire)
        if etablissement.directeur_nom and not signataire_titre:
            c.setFillColor(_GRIS_BULLETIN)
            c.setFont("Helvetica", 8)
            c.drawString(marge + 2 * mm, pied_y - 9 * mm, etablissement.directeur_nom)

        try:
            taille_cachet = 26 * mm
            c.drawImage(lecteur_image(etablissement, "cachet"), largeur / 2 - taille_cachet / 2, pied_y - 10 * mm,
                        width=taille_cachet, height=taille_cachet, preserveAspectRatio=True, anchor="c", mask="auto")
        except Exception:
            _dessiner_sceau(c, largeur / 2, pied_y + 2 * mm, 9 * mm, etablissement.sigle)

        try:
            qr_buffer = io.BytesIO()
            qrcode.make(reference or str(etablissement.pk)).save(qr_buffer, format="PNG")
            qr_buffer.seek(0)
            qr_taille = 20 * mm
            c.drawImage(ImageReader(qr_buffer), largeur - marge - qr_taille - 2 * mm, pied_y - 2 * mm, width=qr_taille, height=qr_taille)
            c.setFillColor(_GRIS_BULLETIN)
            c.setFont("Helvetica", 6)
            c.drawCentredString(largeur - marge - qr_taille / 2 - 2 * mm, pied_y - 5 * mm, "Vérifier ce document")
        except Exception:
            pass

        c.showPage()
        c.save()
        buffer.seek(0)
        return buffer

    if reference:
        c.setFillColor(_GRIS_BULLETIN)
        c.setFont("Helvetica", 9)
        c.drawString(marge, y, f"Réf : {reference}")
        y -= 8 * mm

    c.setFillColor(_BLEU_BULLETIN)
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(largeur / 2, y, titre.upper())
    y -= 12 * mm

    if destinataire:
        c.setFillColor(colors.black)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(marge, y, f"Concerne : {destinataire}")
        y -= 10 * mm

    if preambule_lignes:
        c.setFillColor(colors.black)
        c.setFont("Helvetica-Oblique", 9.5)
        for ligne in preambule_lignes:
            for sous_ligne in _wrap_text(ligne, round(car_par_ligne * 95 / 90)):
                c.drawString(marge, y, sous_ligne)
                y -= 5.6 * mm
            y -= 1.5 * mm
        y -= 4 * mm

    c.setFillColor(colors.black)
    c.setFont("Helvetica", 11)
    for ligne in contenu_lignes:
        if not ligne:
            y -= 4 * mm
            continue
        for sous_ligne in _wrap_text(ligne, car_par_ligne):
            c.drawString(marge, y, sous_ligne)
            y -= 7 * mm
        y -= 3 * mm

    if tableau and tableau.get("lignes"):
        y -= 3 * mm
        y = _dessiner_tableau(c, marge, largeur - marge, y, tableau)
        y -= 8 * mm

    y -= 15 * mm
    c.setFillColor(colors.black)
    c.setFont("Helvetica", 10)
    lieu = etablissement.ville or "Bamako"
    c.drawRightString(largeur - marge, y, f"Fait à {lieu}, le {date.today():%d/%m/%Y}")
    y -= 10 * mm

    titre_signataire = signataire_titre or getattr(etablissement, "directeur_titre", "") or "Le Directeur"
    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(largeur - marge, y, titre_signataire)

    # Seuls les documents signés par le Directeur/Proviseur portent sa signature scannée.
    if titre_signataire == (getattr(etablissement, "directeur_titre", "") or "Le Directeur"):
        if getattr(etablissement, "directeur_signature", None):
            try:
                c.drawImage(lecteur_image(etablissement, "directeur_signature"), largeur - marge - 32 * mm, y - 20 * mm,
                            width=32 * mm, height=18 * mm, preserveAspectRatio=True, anchor="sw", mask="auto")
            except Exception:
                pass
        if etablissement.directeur_nom:
            c.setFont("Helvetica", 9)
            c.drawRightString(largeur - marge, y - 22 * mm, etablissement.directeur_nom)
        try:
            c.drawImage(lecteur_image(etablissement, "cachet"), largeur - marge - 68 * mm, y - 26 * mm,
                        width=30 * mm, height=30 * mm, preserveAspectRatio=True, anchor="c", mask="auto")
        except Exception:
            pass

    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer


def generer_bulletin_paie_pdf(bulletin, etablissement):
    """Génère le bulletin de paie PDF (A4) d'un employé pour un mois donné."""
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    largeur, hauteur = A4
    marge = 20 * mm
    y = hauteur - marge

    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(largeur / 2, y, etablissement.nom)
    y -= 8 * mm
    c.setFont("Helvetica-Bold", 13)
    c.drawCentredString(largeur / 2, y, f"BULLETIN DE PAIE - {bulletin.mois:02d}/{bulletin.annee}")
    y -= 12 * mm

    employe = bulletin.employe
    c.setFont("Helvetica", 10)
    c.drawString(marge, y, f"Employé: {employe.prenom} {employe.nom}")
    c.drawRightString(largeur - marge, y, f"Matricule: {employe.matricule}")
    y -= 6 * mm
    c.drawString(marge, y, f"Fonction: {employe.get_type_employe_display()}")
    y -= 10 * mm

    c.line(marge, y, largeur - marge, y)
    y -= 8 * mm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(marge, y, "Désignation")
    c.drawRightString(largeur - marge, y, "Montant (FCFA)")
    y -= 5 * mm
    c.line(marge, y, largeur - marge, y)
    y -= 7 * mm

    c.setFont("Helvetica", 10)
    lignes = [
        ("Salaire de base", bulletin.salaire_base),
        ("Total primes", bulletin.total_primes),
        ("Total indemnités", bulletin.total_indemnites),
        ("Heures supplémentaires", bulletin.total_heures_sup),
    ]
    for lib, montant in lignes:
        c.drawString(marge, y, lib)
        c.drawRightString(largeur - marge, y, f"{montant:,.0f}")
        y -= 6 * mm

    y -= 3 * mm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(marge, y, "Salaire brut")
    c.drawRightString(largeur - marge, y, f"{bulletin.salaire_brut:,.0f}")
    y -= 8 * mm

    c.setFont("Helvetica", 10)
    for lib, montant in [("Retenues", bulletin.total_retenues), ("Avances déduites", bulletin.avances_deduites)]:
        c.drawString(marge, y, f"- {lib}")
        c.drawRightString(largeur - marge, y, f"{montant:,.0f}")
        y -= 6 * mm

    y -= 6 * mm
    c.line(marge, y, largeur - marge, y)
    y -= 8 * mm
    c.setFont("Helvetica-Bold", 13)
    c.drawString(marge, y, "NET À PAYER")
    c.drawRightString(largeur - marge, y, f"{bulletin.net_a_payer:,.0f} FCFA")

    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer


def _wrap_text(text, max_chars):
    import textwrap
    return textwrap.wrap(text, max_chars) or [""]
