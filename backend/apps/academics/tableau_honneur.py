"""Tableau d'honneur : les premiers de chaque classe pour une période, et leur affiche.

Les lauréats sont lus dans les bulletins (moyenne générale et rang calculés par « Calculer les bulletins ») :
pour chaque classe, les élèves classés de 1 à `nombre`. L'affiche (PNG ou PDF) réunit le logo et le nom de
l'établissement, puis, pour chaque lauréat, sa photo (ou ses initiales), son nom, sa classe et sa moyenne.
"""
import io
import os
from decimal import Decimal

import reportlab
from django.utils import timezone
from PIL import Image, ImageDraw, ImageFont, ImageOps

from apps.academics.models import Bulletin
from apps.academics.services import calculer_moyenne_generale_et_rangs, calculer_moyennes_matiere
from apps.core.images import contenu_image
from apps.core.models import Classe

# ---------------------------------------------------------------------------
# Données
# ---------------------------------------------------------------------------


def photo_eleve(eleve):
    """Octets de la photo de l'élève, ou None si absente ou perdue (disque non persistant)."""
    if not eleve.photo:
        return None
    try:
        eleve.photo.open("rb")
        contenu = eleve.photo.read()
        eleve.photo.close()
        return contenu
    except (OSError, ValueError):
        return None


def classes_de_la_periode(etablissement, periode):
    return (Classe.objects.filter(etablissement=etablissement, annee_scolaire=periode.annee_scolaire)
            .select_related("niveau").order_by("niveau__ordre", "nom"))


def laureats(etablissement, periode, nombre=1):
    """[(classe, [bulletins des `nombre` premiers])] pour chaque classe, et la liste des classes sans résultats."""
    bulletins = (
        Bulletin.objects.filter(
            periode=periode, rang__isnull=False, rang__lte=nombre, moyenne_generale__isnull=False,
            inscription__classe__etablissement=etablissement, inscription__statut="active",
        )
        .select_related("inscription__eleve", "inscription__classe__niveau")
        .order_by("rang", "-moyenne_generale")
    )
    par_classe = {}
    for bulletin in bulletins:
        par_classe.setdefault(bulletin.inscription.classe_id, []).append(bulletin)
    resultats, sans_resultats = [], []
    for classe in classes_de_la_periode(etablissement, periode):
        if classe.pk in par_classe:
            resultats.append((classe, par_classe[classe.pk]))
        elif classe.inscriptions.filter(statut="active").exists():
            sans_resultats.append(classe)
    return resultats, sans_resultats


def calculer_toutes_les_classes(etablissement, periode):
    """Calcule moyennes, rangs et bulletins de toutes les classes de la période. Renvoie le nombre de classes traitées."""
    nombre = 0
    for classe in classes_de_la_periode(etablissement, periode):
        calculer_moyennes_matiere(classe, periode)
        if calculer_moyenne_generale_et_rangs(classe, periode):
            nombre += 1
    return nombre


def rang_texte(rang):
    return "1er" if rang == 1 else f"{rang}e"


def moyenne_texte(moyenne):
    return f"{Decimal(moyenne):.2f}".replace(".", ",")


# ---------------------------------------------------------------------------
# Affiche
# ---------------------------------------------------------------------------
LARGEUR = 1240  # A4 à 150 points par pouce
MARGE = 60
COLONNES = 3
VIOLET = (95, 52, 221)
VIOLET_FONCE = (46, 26, 110)
OR = (201, 151, 0)
OR_CLAIR = (253, 246, 220)
GRIS = (100, 116, 139)
ENCRE = (15, 23, 42)
FOND = (255, 255, 255)
COULEURS_RANG = {1: OR, 2: (148, 163, 184), 3: (180, 110, 60)}


def _police(taille, style=""):
    fichier = {"": "Vera.ttf", "gras": "VeraBd.ttf", "italique": "VeraIt.ttf"}[style]
    return ImageFont.truetype(os.path.join(os.path.dirname(reportlab.__file__), "fonts", fichier), taille)


def _centrer(draw, texte, police, y, x0=0, largeur=LARGEUR, couleur=ENCRE):
    boite = draw.textbbox((0, 0), texte, font=police)
    draw.text((x0 + (largeur - (boite[2] - boite[0])) / 2, y), texte, font=police, fill=couleur)
    return boite[3] - boite[1]


def _ajuster(draw, texte, taille, largeur_max, style="", taille_min=16):
    """Police dont la taille est réduite jusqu'à ce que `texte` tienne sur une ligne de `largeur_max`."""
    while taille > taille_min and draw.textlength(texte, font=_police(taille, style)) > largeur_max:
        taille -= 1
    return _police(taille, style)


def _couper(draw, texte, police, largeur_max):
    """Coupe le texte en lignes tenant dans `largeur_max` (2 lignes au plus, la fin est abrégée)."""
    mots, lignes, ligne = texte.split(), [], ""
    for mot in mots:
        essai = f"{ligne} {mot}".strip()
        if draw.textlength(essai, font=police) <= largeur_max:
            ligne = essai
        else:
            if ligne:
                lignes.append(ligne)
            ligne = mot
    if ligne:
        lignes.append(ligne)
    if len(lignes) > 2:
        lignes = [lignes[0], " ".join(lignes[1:])]
        while draw.textlength(lignes[1] + "…", font=police) > largeur_max and len(lignes[1]) > 1:
            lignes[1] = lignes[1][:-1]
        lignes[1] += "…"
    return lignes


def _portrait(eleve, diametre):
    """Photo ronde de l'élève, ou ses initiales sur fond violet si aucune photo n'est disponible."""
    masque = Image.new("L", (diametre, diametre), 0)
    ImageDraw.Draw(masque).ellipse((0, 0, diametre - 1, diametre - 1), fill=255)
    contenu = photo_eleve(eleve)
    if contenu:
        try:
            photo = ImageOps.exif_transpose(Image.open(io.BytesIO(contenu))).convert("RGB")
            photo = ImageOps.fit(photo, (diametre, diametre), centering=(0.5, 0.35))
            rond = Image.new("RGBA", (diametre, diametre), (0, 0, 0, 0))
            rond.paste(photo, (0, 0), masque)
            return rond
        except (OSError, ValueError):
            pass
    rond = Image.new("RGBA", (diametre, diametre), (0, 0, 0, 0))
    draw = ImageDraw.Draw(rond)
    draw.ellipse((0, 0, diametre - 1, diametre - 1), fill=(230, 224, 255))
    initiales = f"{eleve.prenom[:1]}{eleve.nom[:1]}".upper()
    police = _police(diametre // 3, "gras")
    boite = draw.textbbox((0, 0), initiales, font=police)
    draw.text(((diametre - (boite[2] - boite[0])) / 2 - boite[0], (diametre - (boite[3] - boite[1])) / 2 - boite[1]),
              initiales, font=police, fill=VIOLET)
    return rond


def _carte(classe, bulletin, largeur, hauteur):
    """Carte d'un lauréat : médaille de rang, photo, nom, classe, moyenne et mention."""
    carte = Image.new("RGB", (largeur, hauteur), FOND)
    draw = ImageDraw.Draw(carte)
    rang = bulletin.rang
    couleur = COULEURS_RANG.get(rang, VIOLET)
    draw.rounded_rectangle((0, 0, largeur - 1, hauteur - 1), radius=28, fill=OR_CLAIR if rang == 1 else (248, 247, 252),
                           outline=couleur, width=4)
    eleve = bulletin.inscription.eleve

    diametre = 190
    x_photo = (largeur - diametre) // 2
    draw.ellipse((x_photo - 8, 26, x_photo + diametre + 8, 34 + diametre + 8), fill=couleur)
    portrait = _portrait(eleve, diametre)
    carte.paste(portrait, (x_photo, 34), portrait)

    # Médaille du rang
    r = 34
    cx, cy = x_photo + diametre - 10, 34 + diametre - 18
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=couleur, outline=FOND, width=4)
    police_rang = _police(24, "gras")
    texte = rang_texte(rang)
    boite = draw.textbbox((0, 0), texte, font=police_rang)
    draw.text((cx - (boite[2] - boite[0]) / 2 - boite[0], cy - (boite[3] - boite[1]) / 2 - boite[1]), texte,
              font=police_rang, fill=FOND)

    y = 34 + diametre + 26
    police_nom = _police(30, "gras")
    for ligne in _couper(draw, f"{eleve.prenom} {eleve.nom.upper()}", police_nom, largeur - 40):
        y += _centrer(draw, ligne, police_nom, y, largeur=largeur) + 8
    y += 6
    _centrer(draw, classe.nom, _ajuster(draw, classe.nom, 25, largeur - 40), y, largeur=largeur, couleur=GRIS)
    y += 44
    _centrer(draw, f"{moyenne_texte(bulletin.moyenne_generale)} / 20", _police(40, "gras"), y, largeur=largeur, couleur=VIOLET)
    y += 54
    if bulletin.mention:
        _centrer(draw, bulletin.mention, _police(23, "italique"), y, largeur=largeur, couleur=GRIS)
    return carte


def generer_affiche(etablissement, periode, resultats, titre="Tableau d'honneur"):
    """Image PIL de l'affiche (largeur A4 à 150 ppp, hauteur selon le nombre de lauréats)."""
    cartes = [(classe, b) for classe, bulletins in resultats for b in bulletins]
    lignes = max(1, -(-len(cartes) // COLONNES))
    largeur_carte = (LARGEUR - 2 * MARGE - (COLONNES - 1) * 30) // COLONNES
    hauteur_carte = 470
    hauteur_entete = 380
    hauteur = max(1754, hauteur_entete + lignes * (hauteur_carte + 30) + 200)

    affiche = Image.new("RGB", (LARGEUR, hauteur), FOND)
    draw = ImageDraw.Draw(affiche)

    # Bandeau
    draw.rectangle((0, 0, LARGEUR, 300), fill=VIOLET_FONCE)
    draw.rectangle((0, 300, LARGEUR, 312), fill=OR)
    x_texte = MARGE
    logo = contenu_image(etablissement, "logo")
    if logo:
        try:
            image_logo = Image.open(io.BytesIO(logo)).convert("RGBA")
            image_logo.thumbnail((150, 150))
            fond_logo = Image.new("RGBA", (174, 174), (255, 255, 255, 255))
            fond_logo.paste(image_logo, ((174 - image_logo.width) // 2, (174 - image_logo.height) // 2), image_logo)
            affiche.paste(fond_logo.convert("RGB"), (MARGE, 62))
            x_texte = MARGE + 200
        except (OSError, ValueError):
            pass
    largeur_texte = LARGEUR - x_texte - MARGE
    police_etab = _police(30, "gras")
    nom_etab = _couper(draw, etablissement.nom.upper(), police_etab, largeur_texte)
    y = 52
    for ligne in nom_etab:
        y += _centrer(draw, ligne, police_etab, y, x0=x_texte, largeur=largeur_texte, couleur=(230, 224, 255)) + 8
    y += 14
    y += _centrer(draw, titre.upper(), _police(64, "gras"), y, x0=x_texte, largeur=largeur_texte, couleur=FOND) + 22
    sous_titre = f"{periode.libelle} — Année scolaire {periode.annee_scolaire.libelle}"
    _centrer(draw, sous_titre, _police(28), y, x0=x_texte, largeur=largeur_texte, couleur=(253, 224, 140))

    _centrer(draw, "Félicitations à nos meilleurs élèves !", _police(32, "italique"), 330, couleur=VIOLET_FONCE)

    # Cartes des lauréats
    if not cartes:
        _centrer(draw, "Aucun résultat pour cette période : calculez d'abord les moyennes.", _police(28), hauteur_entete + 40, couleur=GRIS)
    for i, (classe, bulletin) in enumerate(cartes):
        ligne, colonne = divmod(i, COLONNES)
        restant = len(cartes) - ligne * COLONNES
        decalage = (COLONNES - restant) * (largeur_carte + 30) // 2 if restant < COLONNES else 0  # dernière ligne centrée
        x = MARGE + decalage + colonne * (largeur_carte + 30)
        y = hauteur_entete + ligne * (hauteur_carte + 30)
        affiche.paste(_carte(classe, bulletin, largeur_carte, hauteur_carte), (x, y))

    # Pied de page
    y_pied = hauteur - 120
    draw.line((MARGE, y_pied, LARGEUR - MARGE, y_pied), fill=(226, 232, 240), width=2)
    signature = f"{etablissement.directeur_titre or 'La Direction'}{' ' + etablissement.directeur_nom if etablissement.directeur_nom else ''}"
    draw.text((MARGE, y_pied + 26), f"Fait le {timezone.localdate():%d/%m/%Y}", font=_police(24), fill=GRIS)
    police_signature = _police(24, "gras")
    draw.text((LARGEUR - MARGE - draw.textlength(signature, font=police_signature), y_pied + 26), signature,
              font=police_signature, fill=ENCRE)
    return affiche


def affiche_en_octets(image, format_fichier="png"):
    tampon = io.BytesIO()
    if format_fichier == "pdf":
        image.save(tampon, format="PDF", resolution=150.0)
    elif format_fichier == "jpeg":
        image.save(tampon, format="JPEG", quality=90, optimize=True, progressive=True)
    else:
        image.save(tampon, format="PNG", optimize=True)
    return tampon.getvalue()
