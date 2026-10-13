"""Génère la documentation PDF de Gesti-Scolaire (ReportLab / Platypus).

Usage (depuis la racine du projet) :
    backend\venv\Scripts\python docs\generer_documentation.py docs\Documentation_Gesti-Scolaire.pdf frontend\public\icons\icon-512.png
"""
import datetime
import sys

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.platypus import (
    BaseDocTemplate, CondPageBreak, Frame, Image, KeepTogether, NextPageTemplate, PageBreak,
    PageTemplate, Paragraph, Spacer, Table, TableStyle,
)
from reportlab.platypus.flowables import Flowable
from reportlab.platypus.tableofcontents import TableOfContents

SORTIE = sys.argv[1]
ICONE = sys.argv[2]

VIOLET = colors.HexColor("#5f34dd")
VIOLET_FONCE = colors.HexColor("#2e1a6e")
VIOLET_CLAIR = colors.HexColor("#f2efff")
VIOLET_MOYEN = colors.HexColor("#cabdff")
ENCRE = colors.HexColor("#1e293b")
GRIS = colors.HexColor("#64748b")
GRIS_CLAIR = colors.HexColor("#e2e8f0")
FOND = colors.HexColor("#f8fafc")
VERT_CLAIR = colors.HexColor("#ecfdf5")
VERT = colors.HexColor("#059669")
AMBRE_CLAIR = colors.HexColor("#fffbeb")
AMBRE = colors.HexColor("#d97706")
ROUGE_CLAIR = colors.HexColor("#fff1f2")
ROUGE = colors.HexColor("#e11d48")

LARGEUR, HAUTEUR = A4
MARGE_G, MARGE_D, MARGE_H, MARGE_B = 20 * mm, 20 * mm, 24 * mm, 20 * mm
LARGEUR_UTILE = LARGEUR - MARGE_G - MARGE_D
VERSION = "Version 1.0"
DATE = datetime.date.today().strftime("%d/%m/%Y")

# ---------------------------------------------------------------------------
# Styles
# ---------------------------------------------------------------------------
S = {
    "corps": ParagraphStyle("corps", fontName="Helvetica", fontSize=10, leading=15, textColor=ENCRE, spaceAfter=6),
    "h1": ParagraphStyle("h1", fontName="Helvetica-Bold", fontSize=22, leading=27, textColor=VIOLET_FONCE, spaceAfter=4),
    "h1_num": ParagraphStyle("h1_num", fontName="Helvetica-Bold", fontSize=11, leading=14, textColor=VIOLET, spaceAfter=2),
    "h2": ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=14, leading=18, textColor=VIOLET, spaceBefore=12, spaceAfter=6, keepWithNext=1),
    "h3": ParagraphStyle("h3", fontName="Helvetica-Bold", fontSize=11, leading=15, textColor=VIOLET_FONCE, spaceBefore=8, spaceAfter=4, keepWithNext=1),
    "chapo": ParagraphStyle("chapo", fontName="Helvetica", fontSize=11.5, leading=17, textColor=GRIS, spaceAfter=10),
    "puce": ParagraphStyle("puce", fontName="Helvetica", fontSize=10, leading=14.5, textColor=ENCRE, leftIndent=14,
                           bulletIndent=3, spaceAfter=3),
    "cellule": ParagraphStyle("cellule", fontName="Helvetica", fontSize=9, leading=13, textColor=ENCRE),
    "cellule_b": ParagraphStyle("cellule_b", fontName="Helvetica-Bold", fontSize=9, leading=12.5, textColor=ENCRE),
    "entete_tab": ParagraphStyle("entete_tab", fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=colors.white),
    "encadre": ParagraphStyle("encadre", fontName="Helvetica", fontSize=9.5, leading=14, textColor=ENCRE),
    "code": ParagraphStyle("code", fontName="Courier", fontSize=8.5, leading=12, textColor=ENCRE),
    "toc1": ParagraphStyle("toc1", fontName="Helvetica-Bold", fontSize=10.5, leading=16, spaceBefore=7, textColor=VIOLET_FONCE, leftIndent=0),
    "toc2": ParagraphStyle("toc2", fontName="Helvetica", fontSize=9, leading=13, textColor=ENCRE, leftIndent=16),
}


def p(texte, style="corps"):
    return Paragraph(texte, S[style])


def puces(elements):
    return [Paragraph(e, S["puce"], bulletText="•") for e in elements]


def etapes(elements):
    """Liste numérotée avec pastilles violettes."""
    lignes = []
    for i, texte in enumerate(elements, 1):
        taille = 9 if i < 10 else 7.5
        pastille = Table([[Paragraph(f"<b>{i}</b>", ParagraphStyle("n", fontName="Helvetica-Bold", fontSize=taille,
                                                                       leading=taille + 1, textColor=colors.white,
                                                                       alignment=TA_CENTER))]],
                         colWidths=[6.5 * mm], rowHeights=[6.5 * mm])
        pastille.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), VIOLET), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ROUNDEDCORNERS", [3.25 * mm] * 4), ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
            ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ]))
        lignes.append([pastille, p(texte, "corps")])
    t = Table(lignes, colWidths=[10 * mm, LARGEUR_UTILE - 10 * mm])
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                           ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 2)]))
    return t


def encadre(titre, texte, genre="info"):
    fond, bord = {"info": (VIOLET_CLAIR, VIOLET), "ok": (VERT_CLAIR, VERT),
                  "attention": (AMBRE_CLAIR, AMBRE), "danger": (ROUGE_CLAIR, ROUGE)}[genre]
    contenu = [Paragraph(f"<font color='{bord.hexval()}'><b>{titre}</b></font>", S["encadre"]), Spacer(1, 2)]
    contenu += [Paragraph(t, S["encadre"]) for t in (texte if isinstance(texte, list) else [texte])]
    t = Table([[contenu]], colWidths=[LARGEUR_UTILE])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), fond), ("LINEBEFORE", (0, 0), (0, -1), 3, bord),
        ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return KeepTogether([Spacer(1, 4), t, Spacer(1, 8)])


def tableau(entetes, lignes, largeurs, premiere_colonne_grasse=True):
    donnees = [[Paragraph(e, S["entete_tab"]) for e in entetes]]
    for ligne in lignes:
        donnees.append([Paragraph(str(c), S["cellule_b" if (j == 0 and premiere_colonne_grasse) else "cellule"])
                        for j, c in enumerate(ligne)])
    t = Table(donnees, colWidths=[l * LARGEUR_UTILE for l in largeurs], repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), VIOLET_FONCE), ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 1), (-1, -1), 0.4, GRIS_CLAIR),
    ]
    for i in range(1, len(donnees)):
        if i % 2 == 0:
            style.append(("BACKGROUND", (0, i), (-1, i), FOND))
    t.setStyle(TableStyle(style))
    return KeepTogether([t, Spacer(1, 10)]) if len(lignes) <= 8 else t


def code(lignes):
    t = Table([[Paragraph(l.replace(" ", "&nbsp;").replace("<", "&lt;") or "&nbsp;", S["code"])] for l in lignes],
              colWidths=[LARGEUR_UTILE])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f1f5f9")), ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 1), ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ("TOPPADDING", (0, 0), (-1, 0), 7), ("BOTTOMPADDING", (0, -1), (-1, -1), 7),
        ("BOX", (0, 0), (-1, -1), 0.5, GRIS_CLAIR),
    ]))
    return KeepTogether([t, Spacer(1, 8)])


# ---------------------------------------------------------------------------
# Document : sommaire automatique, en-têtes et pieds de page
# ---------------------------------------------------------------------------
class Chapitre(Paragraph):
    """Titre de chapitre (niveau 1 du sommaire)."""


class DefinirChapitre(Flowable):
    """Marqueur invisible placé avant le saut de page d'un chapitre : l'en-tête de sa première
    page affiche ainsi le bon titre (un Spacer serait ignoré en haut de page)."""

    def __init__(self, titre):
        super().__init__()
        self.titre = titre

    def wrap(self, *args):
        return (0, 0)

    def draw(self):
        pass


class Section(Paragraph):
    """Titre de section (niveau 2 du sommaire)."""


class DocGesti(BaseDocTemplate):
    def __init__(self, fichier, **kw):
        super().__init__(fichier, pagesize=A4, leftMargin=MARGE_G, rightMargin=MARGE_D,
                         topMargin=MARGE_H, bottomMargin=MARGE_B, title="Gesti-Scolaire — Documentation",
                         author="Gesti-Scolaire", subject="Guide d'utilisation et documentation technique", **kw)
        cadre = Frame(MARGE_G, MARGE_B, LARGEUR_UTILE, HAUTEUR - MARGE_H - MARGE_B, id="cadre")
        self.addPageTemplates([
            PageTemplate(id="couverture", frames=[Frame(0, 0, LARGEUR, HAUTEUR, id="plein")], onPage=dessiner_couverture),
            PageTemplate(id="contenu", frames=[cadre], onPage=dessiner_page),
        ])
        self.chapitre_courant = ""
        self._num_chapitre = 0

    def beforeDocument(self):
        self.chapitre_courant = ""

    def afterFlowable(self, flowable):
        if isinstance(flowable, DefinirChapitre):
            self.chapitre_courant = flowable.titre
        elif isinstance(flowable, Chapitre):
            self.chapitre_courant = flowable.getPlainText()
            cle = f"ch{id(flowable)}"
            self.canv.bookmarkPage(cle)
            self.canv.addOutlineEntry(self.chapitre_courant, cle, level=0)
            self.notify("TOCEntry", (0, self.chapitre_courant, self.page, cle))
        elif isinstance(flowable, Section):
            texte = flowable.getPlainText()
            cle = f"s{id(flowable)}"
            self.canv.bookmarkPage(cle)
            self.canv.addOutlineEntry(texte, cle, level=1)
            self.notify("TOCEntry", (1, texte, self.page, cle))

    def handle_pageBegin(self):
        # Avant super() : l'en-tête est dessiné pendant handle_pageBegin
        self.canv._chapitre = self.chapitre_courant
        super().handle_pageBegin()


class CanvasNumerote(rl_canvas.Canvas):
    """Canvas qui connaît le nombre total de pages (« Page 3 / 24 »)."""

    def __init__(self, *args, **kw):
        super().__init__(*args, **kw)
        self._pages = []

    def showPage(self):
        self._pages.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total = len(self._pages)
        for etat in self._pages:
            self.__dict__.update(etat)
            if self._pageNumber > 1:
                self.setFont("Helvetica", 8)
                self.setFillColor(GRIS)
                self.drawRightString(LARGEUR - MARGE_D, 10 * mm, f"Page {self._pageNumber} / {total}")
            super().showPage()
        super().save()


def dessiner_couverture(c, doc):
    c.saveState()
    c.setFillColor(VIOLET_FONCE)
    c.rect(0, 0, LARGEUR, HAUTEUR, fill=1, stroke=0)
    # Formes décoratives
    c.setFillColor(VIOLET)
    c.circle(LARGEUR + 10 * mm, HAUTEUR - 20 * mm, 95 * mm, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#7048f0"))
    c.circle(LARGEUR - 5 * mm, HAUTEUR + 15 * mm, 60 * mm, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#3d2190"))
    c.circle(-25 * mm, 30 * mm, 70 * mm, fill=1, stroke=0)

    c.drawImage(ICONE, MARGE_G, HAUTEUR - 95 * mm, width=34 * mm, height=34 * mm, mask="auto")
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 40)
    c.drawString(MARGE_G, HAUTEUR - 125 * mm, "Gesti-Scolaire")
    c.setFillColor(VIOLET_MOYEN)
    c.setFont("Helvetica", 16)
    c.drawString(MARGE_G, HAUTEUR - 136 * mm, "ERP de gestion d'établissements scolaires")

    c.setFillColor(colors.HexColor("#e8b923"))
    c.rect(MARGE_G, HAUTEUR - 147 * mm, 30 * mm, 1.6 * mm, fill=1, stroke=0)

    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 20)
    c.drawString(MARGE_G, HAUTEUR - 165 * mm, "Documentation officielle")
    c.setFont("Helvetica", 12)
    c.setFillColor(colors.HexColor("#e6e0ff"))
    for i, ligne in enumerate([
        "Guide d'utilisation par rôle, mise en place d'un établissement,",
        "règles de gestion et annexe technique (installation et déploiement).",
    ]):
        c.drawString(MARGE_G, HAUTEUR - 176 * mm - i * 6.5 * mm, ligne)

    # Bandeau bas
    c.setFillColor(colors.HexColor("#ffffff"))
    c.setFillAlpha(0.08)
    c.rect(0, 0, LARGEUR, 34 * mm, fill=1, stroke=0)
    c.setFillAlpha(1)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(MARGE_G, 20 * mm, VERSION)
    c.setFont("Helvetica", 10)
    c.drawString(MARGE_G, 14 * mm, f"Mise à jour le {DATE}")
    c.drawRightString(LARGEUR - MARGE_D, 20 * mm, "Web  ·  Android  ·  iPhone  ·  Tablette  ·  PC")
    c.drawRightString(LARGEUR - MARGE_D, 14 * mm, "Multi-établissements  ·  Mali")
    c.restoreState()


def dessiner_page(c, doc):
    c.saveState()
    # En-tête
    c.setFillColor(VIOLET)
    c.rect(0, HAUTEUR - 3 * mm, LARGEUR, 3 * mm, fill=1, stroke=0)
    c.drawImage(ICONE, MARGE_G, HAUTEUR - 15.5 * mm, width=7 * mm, height=7 * mm, mask="auto")
    c.setFillColor(VIOLET_FONCE)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(MARGE_G + 9.5 * mm, HAUTEUR - 12.2 * mm, "Gesti-Scolaire")
    c.setFillColor(GRIS)
    c.setFont("Helvetica", 8.5)
    c.drawRightString(LARGEUR - MARGE_D, HAUTEUR - 12.2 * mm, getattr(c, "_chapitre", "") or "Documentation")
    c.setStrokeColor(GRIS_CLAIR)
    c.setLineWidth(0.5)
    c.line(MARGE_G, HAUTEUR - 17.5 * mm, LARGEUR - MARGE_D, HAUTEUR - 17.5 * mm)
    # Pied
    c.line(MARGE_G, 14 * mm, LARGEUR - MARGE_D, 14 * mm)
    c.setFont("Helvetica", 8)
    c.drawString(MARGE_G, 10 * mm, f"Gesti-Scolaire  ·  Documentation  ·  {VERSION}")
    c.restoreState()


N = {"ch": 0}


def chapitre(titre, chapo=None):
    N["ch"] += 1
    elements = [DefinirChapitre(titre), PageBreak(), p(f"CHAPITRE {N['ch']}", "h1_num"), Chapitre(titre, S["h1"])]
    barre = Table([[""]], colWidths=[22 * mm], rowHeights=[1.4 * mm])
    barre.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), VIOLET)]))
    barre.hAlign = "LEFT"
    elements += [Spacer(1, 2), barre, Spacer(1, 10)]
    if chapo:
        elements.append(p(chapo, "chapo"))
    return elements


def section(titre):
    return [CondPageBreak(40 * mm), Section(titre, S["h2"])]


# ---------------------------------------------------------------------------
# Contenu
# ---------------------------------------------------------------------------
H = []  # histoire (story)
H += [NextPageTemplate("contenu"), DefinirChapitre("Sommaire"), PageBreak()]

# Sommaire
toc = TableOfContents()
toc.levelStyles = [S["toc1"], S["toc2"]]
toc.dotsMinLevel = 0
toc.tableStyle = TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
])
H += [p("Sommaire", "h1"), Spacer(1, 2)]
barre = Table([[""]], colWidths=[22 * mm], rowHeights=[1.4 * mm])
barre.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), VIOLET)]))
barre.hAlign = "LEFT"
H += [barre, Spacer(1, 12), toc]

# 1. Présentation ---------------------------------------------------------
H += chapitre("Présentation de Gesti-Scolaire",
              "Gesti-Scolaire est une application web de gestion scolaire complète. Elle réunit dans un même outil "
              "la scolarité, la pédagogie, la vie scolaire, les finances, la paie et la communication avec les familles, "
              "pour un ou plusieurs établissements.")
H += section("À qui s'adresse ce document ?")
H += [p("Ce guide s'adresse aux <b>responsables d'établissement</b> (directeurs, proviseurs, administrateurs), "
        "au <b>personnel</b> (enseignants, comptables, surveillants) et sert de référence pour expliquer l'application "
        "aux <b>élèves et parents</b>. L'annexe technique (chapitre 9) est destinée à la personne chargée de "
        "l'installation et de l'hébergement.")]
H += section("Ce que permet l'application")
H.append(tableau(
    ["Domaine", "Fonctionnalités principales"],
    [
        ["Organisation", "Établissements, années scolaires et périodes (trimestres), niveaux, séries, classes, matières, emploi du temps."],
        ["Scolarité", "Fiches élèves, inscriptions en classe, matricules automatiques, liens parents-élèves, cartes scolaires."],
        ["Pédagogie", "Carnet de notes (interrogations, devoirs, compositions), moyennes pondérées, rangs, bulletins A4 et A5."],
        ["Vie scolaire", "Absences et retards, justification, sanctions et récompenses."],
        ["Documents", "Certificats, attestations, convocations, fiches de permission… générés en PDF avec l'en-tête de l'établissement."],
        ["Finances", "Types de frais, barèmes, bourses, factures, encaissements, reçus numérotés, suivi du recouvrement."],
        ["Paie", "Contrats, primes, indemnités, retenues, avances, bulletins de paie."],
        ["Communication", "Messagerie interne, annonces ciblées, notifications automatiques."],
        ["Pilotage", "Tableaux de bord par rôle, statistiques, exports Excel et CSV."],
    ],
    [0.22, 0.78],
))
H += section("Points forts")
H += puces([
    "<b>Multi-établissements</b> : chaque établissement a ses propres données, totalement séparées des autres.",
    "<b>Application installable</b> (PWA) sur Android, iPhone, tablette et ordinateur, avec une interface mobile native.",
    "<b>Documents officiels soignés</b> : logo, coordonnées, arrêtés de création et d'ouverture, cachet et signature.",
    "<b>Sécurité</b> : accès selon le rôle, données cloisonnées par établissement, refus des comptes en double.",
    "<b>Espace familles</b> : élèves et parents consultent notes, bulletins, absences, emploi du temps, factures et reçus.",
])

# 2. Rôles ------------------------------------------------------------------
H += chapitre("Rôles et droits d'accès",
              "Chaque compte possède un rôle. Le rôle détermine le menu affiché, le tableau de bord et les actions autorisées. "
              "Les droits sont contrôlés par le serveur : masquer un bouton ne suffit jamais à contourner une règle.")
H.append(tableau(
    ["Rôle", "Ce qu'il peut faire", "Création du compte"],
    [
        ["Super administrateur", "Tout, dans tous les établissements. Crée des établissements et peut attribuer le rôle super administrateur.", "Par un super administrateur"],
        ["Administrateur", "Gère entièrement les établissements auxquels il a accès : organisation, élèves, personnel, notes, documents, finances, statistiques, utilisateurs.", "Par un administrateur"],
        ["Enseignant", "Carnet de notes (évaluations et saisie), absences, messagerie, annonces.", "Par un administrateur"],
        ["Comptable / Caissier", "Factures, encaissements, reçus, paie, tableau de bord financier.", "Par un administrateur"],
        ["Surveillant général", "Absences et retards (saisie, justification), sanctions, tableau de bord de la vie scolaire.", "Par un administrateur"],
        ["Élève", "Consulte ses notes, bulletins, absences, emploi du temps, carte scolaire, documents, factures et reçus.", "Inscription libre (avec choix de la classe)"],
        ["Parent", "Consulte les mêmes informations pour chacun de ses enfants liés.", "Inscription libre, puis lien par l'administration"],
    ],
    [0.2, 0.55, 0.25],
))
H.append(encadre("À savoir", "Les comptes du personnel ne peuvent pas être créés depuis la page d'inscription publique : "
                 "ils sont créés par un administrateur depuis le menu <b>Utilisateurs</b>, qui leur attribue un mot de passe provisoire "
                 "à changer à la première connexion."))

# 3. Premiers pas --------------------------------------------------------
H += chapitre("Premiers pas", "Connexion, inscription, installation sur téléphone et navigation dans l'application.")
H += section("Se connecter")
H.append(etapes([
    "Ouvrez l'adresse de l'application dans un navigateur (Chrome, Edge, Safari, Firefox).",
    "Saisissez votre <b>adresse email</b> et votre <b>mot de passe</b>. Les majuscules de l'email n'ont pas d'importance.",
    "Vous arrivez sur le <b>tableau de bord</b> correspondant à votre rôle.",
]))
H += section("Créer un compte élève")
H.append(etapes([
    "Sur la page de connexion, choisissez <b>Créer un compte</b> puis le rôle <b>Élève</b>.",
    "Choisissez votre <b>établissement</b>, puis votre <b>classe</b> (seules les classes de l'année en cours sont proposées).",
    "Indiquez votre date de naissance et votre sexe.",
    "Si l'école vous a déjà donné un <b>matricule</b>, saisissez-le : votre compte sera relié à votre dossier existant "
    "(notes, absences…). Le matricule et la date de naissance doivent correspondre.",
    "Renseignez email, téléphone et mot de passe (8 caractères minimum), puis validez.",
]))
H.append(encadre("Pourquoi un matricule ?", "Sans matricule, une nouvelle fiche élève est créée. Si une fiche existe déjà avec "
                 "les mêmes nom, prénom et date de naissance, l'inscription est refusée et le message indique le matricule à utiliser : "
                 "cela évite les doublons.", "attention"))
H += section("Créer un compte parent")
H += [p("Le parent choisit le rôle <b>Parent</b> et son établissement. L'administration relie ensuite le compte à ses enfants "
        "depuis <b>Liens parents-élèves</b>. Dès que le lien existe, le parent voit les informations de chaque enfant "
        "et peut passer de l'un à l'autre.")]
H += section("Installer l'application sur un téléphone, une tablette ou un ordinateur")
H.append(tableau(
    ["Appareil", "Comment installer"],
    [
        ["Android (Chrome)", "Un bandeau « Installer Gesti-Scolaire » apparaît : touchez <b>Installer l'application</b>. Sinon : menu du navigateur (trois points) puis « Installer l'application »."],
        ["iPhone / iPad (Safari)", "Touchez le bouton <b>Partager</b> puis <b>Sur l'écran d'accueil</b>. Le bandeau de l'application rappelle la manipulation."],
        ["Ordinateur (Chrome, Edge)", "Cliquez sur l'icône d'installation dans la barre d'adresse, ou sur le bouton du bandeau."],
    ],
    [0.25, 0.75],
))
H += [p("Une fois installée, l'application s'ouvre en plein écran avec son icône, comme une application classique : "
        "barre d'onglets en bas de l'écran, panneaux qui glissent depuis le bas, tirer vers le bas pour actualiser, "
        "et un bandeau <b>Hors connexion</b> si Internet est coupé.")]
H += section("Se repérer dans l'interface")
H.append(tableau(
    ["Élément", "Sur ordinateur", "Sur téléphone et tablette"],
    [
        ["Navigation", "Menu latéral à gauche, organisé par rubriques.", "Barre d'onglets en bas (4 raccourcis + <b>Menu</b>)."],
        ["Établissement actif", "Sélecteur en haut à gauche.", "En tête du panneau <b>Menu</b>."],
        ["Notifications", "Cloche en haut à droite.", "Cloche en haut à droite."],
        ["Profil, déconnexion", "Menu de l'avatar en haut à droite.", "Panneau <b>Menu</b>."],
    ],
    [0.22, 0.39, 0.39],
))
H += section("Les notifications")
H += [p("La cloche affiche le nombre de notifications non lues. Elles sont créées automatiquement :")]
H += puces([
    "<b>Nouveau message</b> reçu dans la messagerie ;",
    "<b>Nouvelle annonce</b> qui vous concerne (tout le monde, enseignants, élèves, parents ou une classe) ;",
    "<b>Absence ou retard</b> d'un élève : prévient ses parents et l'élève.",
])
H += [p("Cliquer sur une notification la marque comme lue et ouvre la page concernée. "
        "<b>Tout marquer comme lu</b> vide le compteur.")]

# 4. Mise en place --------------------------------------------------------
H += chapitre("Mettre en place un établissement",
              "Ordre conseillé pour configurer un nouvel établissement. Chaque étape s'appuie sur la précédente.")
H.append(etapes([
    "<b>Établissements</b> : créez l'établissement (nom, sigle, coordonnées, logo, devise, arrêtés, directeur, signature, cachet), "
    "puis cliquez sur <b>Gérer</b> pour basculer vers lui.",
    "<b>Années & Périodes</b> : créez l'année scolaire (ex. 2026-2027), cochez « année courante », puis générez les périodes "
    "(trimestres ou semestres).",
    "<b>Classes & Niveaux</b> : créez les niveaux (ex. 7e, 10e, Terminale), les séries si besoin, puis les classes.",
    "<b>Matières</b> : créez les matières avec leur code et leur coefficient par défaut.",
    "<b>Utilisateurs</b> : créez les comptes du personnel (enseignants, comptable, surveillant).",
    "<b>Enseignants</b> : complétez les fiches (diplôme, spécialité, matières enseignées).",
    "<b>Élèves</b> : inscrivez les élèves dans leur classe (ou laissez-les s'inscrire eux-mêmes).",
    "<b>Notes & bulletins</b> : créez les types d'évaluation (bouton « Créer les types par défaut »).",
    "<b>Facturation & frais</b> : créez les types de frais (scolarité, inscription, cantine…) et leurs barèmes.",
    "<b>Emploi du temps</b> : planifiez les cours de chaque classe.",
]))
H.append(encadre("Le logo et le cachet", [
    "Ils apparaissent sur les factures, reçus, bulletins, cartes scolaires, certificats et attestations. "
    "Envoyez des images nettes, de préférence sur fond transparent (PNG).",
    "Ces images sont conservées à la fois sur le serveur et dans la base de données : elles ne disparaissent pas lors d'une mise à jour de l'application.",
], "ok"))

# 5. Modules ---------------------------------------------------------------
H += chapitre("Guide des modules", "Description de chaque rubrique du menu et des opérations courantes.")

H += section("Établissements et multi-établissements")
H += [p("Chaque établissement possède <b>ses propres données</b> : années, classes, élèves, notes, finances, personnel, "
        "utilisateurs, statistiques. Le personnel travaille dans un établissement à la fois : l'<b>établissement actif</b>.")]
H += puces([
    "<b>Changer d'établissement</b> : sélecteur en haut à gauche (ou dans Menu sur mobile), ou bouton <b>Gérer</b> sur la page Établissements. L'application se recharge sur les données du nouvel établissement.",
    "Un administrateur ne voit que les établissements auxquels il a accès ; le super administrateur les voit tous.",
    "Toute donnée créée est rattachée automatiquement à l'établissement actif.",
    "Un établissement ne peut pas être supprimé tant qu'il est actif. Sa suppression efface toutes ses données.",
])
H += section("Utilisateurs")
H += [p("Création et gestion des comptes de connexion : email, prénom, nom, rôle, téléphone, mot de passe provisoire. "
        "Un compte peut être désactivé pour bloquer la connexion sans le supprimer. Recherche par nom, email ou téléphone, "
        "filtre par rôle.")]
H += section("Années, périodes, classes et matières")
H += [p("L'<b>année courante</b> détermine les classes proposées à l'inscription. Les <b>périodes</b> (trimestres, semestres) "
        "servent aux notes et aux bulletins. Une classe appartient à une année, un niveau et éventuellement une série.")]
H += section("Emploi du temps")
H += puces([
    "Vue <b>grille hebdomadaire</b> ou <b>tableau détaillé</b>, filtrable par classe, enseignant ou salle.",
    "Ajout d'un créneau : classe, matière, enseignant, jour, heures de début et de fin, salle.",
    "<b>Imprimer / PDF</b> : produit un emploi du temps propre avec l'en-tête de l'établissement (logo, coordonnées) et une grille horaires × jours, au format A4 paysage.",
])
H += section("Élèves")
H += puces([
    "<b>Inscrire un élève</b> : identité, filiation, contacts d'urgence, informations médicales, photo, classe et année.",
    "Le <b>matricule</b> est généré automatiquement (ex. GS-CSMD-2026-0001).",
    "Bouton <b>Affecter</b> (élève sans classe, en orange) ou <b>Classe</b> : inscrit l'élève ou le change de classe. La classe se modifie aussi depuis « Modifier l'élève ».",
    "Bouton <b>Carte</b> : génère et télécharge la carte scolaire.",
    "Dossier élève : parcours (années, classes), absences, retards, sanctions et récompenses.",
])
H += section("Liens parents-élèves")
H += [p("Associe un compte parent à un ou plusieurs élèves, avec la relation (père, mère, tuteur, autre) et l'indication "
        "du contact principal. Le parent est alors rattaché à l'établissement de l'enfant et reçoit les notifications le concernant.")]

H += section("Notes et bulletins")
H += [p("La page comporte deux onglets : le <b>Carnet de notes</b> et les <b>Bulletins</b>. On choisit d'abord la classe, "
        "la période et la matière.")]
H += [Paragraph("Le carnet de notes", S["h3"])]
H += puces([
    "Chaque <b>évaluation</b> (Interrogation 1, Devoir 1, Composition…) est une colonne ; chaque élève est une ligne.",
    "<b>Nouvelle évaluation</b> : type, libellé (proposé automatiquement), date et barème. Une note sur 10 est convertie sur 20.",
    "Saisie directe dans le tableau ; <b>Entrée</b> ou les flèches passent à l'élève suivant. Les notes modifiées apparaissent en orange, les notes hors barème en rouge.",
    "<b>Enregistrer</b> valide toutes les modifications en une fois ; une case vidée efface la note.",
    "Filtres par type et tri des colonnes par type ou par date.",
])
H += [Paragraph("Calcul de la moyenne d'une matière", S["h3"])]
H += [p("On calcule d'abord la moyenne de chaque type d'évaluation, puis on les combine selon leur coefficient. "
        "Avec les types par défaut :")]
H.append(encadre("Formule par défaut",
                 "Moyenne = (moyenne des interrogations × 1 + moyenne des devoirs × 1 + composition × 2) ÷ 4", "info"))
H += [p("L'administration peut modifier les types et leurs coefficients (<b>Types & pondérations</b>) : ajout d'un type "
        "« Travaux pratiques », changement de poids, ordre des colonnes.")]
H += [Paragraph("Les bulletins", S["h3"])]
H += [p("<b>Calculer moyennes & rangs</b> (administration) calcule les moyennes par matière, la moyenne générale pondérée par "
        "les coefficients des matières, les rangs et les mentions. Chaque bulletin se télécharge en <b>A4</b> (officiel, archivé) "
        "ou en <b>A5</b> (compact).")]

H += section("Absences et discipline")
H += puces([
    "<b>Signaler</b> une absence ou un retard : élève, date, motif, justification.",
    "Le surveillant peut marquer une absence comme justifiée directement depuis son tableau de bord.",
    "Chaque absence ou retard prévient automatiquement les parents par notification.",
    "Sanctions et récompenses sont enregistrées par période et figurent dans le dossier de l'élève.",
])
H += section("Documents administratifs")
H += [p("Les documents sont générés en PDF, archivés et numérotés. L'en-tête comprend le logo, le nom de l'établissement, "
        "la devise, les coordonnées et les arrêtés de création et d'ouverture. Le cachet et la signature du directeur "
        "sont ajoutés automatiquement.")]
H.append(tableau(
    ["Pour les élèves", "Pour le personnel"],
    [
        ["Certificat de scolarité, certificat de fréquentation", "Attestation de travail, certificat de travail"],
        ["Convocation (examen, réunion)", "Certificat de fin de contrat"],
        ["Attestation de réussite, attestation de passage", "Attestation de fin de stage"],
        ["Fiche de permission, fiche médicale, billet d'entrée", "Fiche de licenciement"],
        ["Avis de recouvrement", ""],
    ],
    [0.5, 0.5], premiere_colonne_grasse=False,
))

H += section("Facturation et frais scolaires")
H += puces([
    "<b>Nouvelle facture</b> : élève, type de frais, période, montant, remise ou bourse, date d'échéance.",
    "<b>Encaisser</b> : montant et mode de paiement (espèces, Mobile Money, virement, chèque, carte). Le reçu est téléchargé immédiatement.",
    "Statut automatique : <b>Impayée</b>, <b>Partielle</b>, <b>Payée</b> ou <b>Annulée</b>. Un paiement annulé ne compte plus dans le payé.",
    "Boutons <b>Facture</b> (PDF A4) et <b>Reçu</b> (PDF A5) sur chaque ligne.",
])
H.append(tableau(
    ["Document", "Contenu"],
    [
        ["Facture (A4)", "N° FAC-…, élève et parent, dates d'émission et d'échéance, désignation, remise, net à payer, déjà payé, reste à payer, "
         "montant en toutes lettres, historique des paiements, signature et cachet, tampon « PAYÉE »."],
        ["Reçu (A5)", "N° REC-…, élève, classe, montant reçu en chiffres et en lettres, mode de paiement, situation de la facture, "
         "QR code de vérification, signature du caissier et cachet, tampon « ANNULÉ » si besoin."],
    ],
    [0.2, 0.8],
))
H += section("Paie")
H += [p("Éléments de salaire (primes, indemnités, retenues, heures supplémentaires), contrats, avances et bulletins de paie "
        "(brouillon, validé, payé), imprimables en PDF. Le tableau de bord du comptable affiche la masse salariale du mois.")]
H += section("Messagerie et annonces")
H += puces([
    "<b>Messagerie</b> : messages entre utilisateurs du même établissement, avec pièce jointe.",
    "<b>Annonces</b> : publiées par l'administration ou les enseignants, ciblées (tous, enseignants, élèves, parents, une classe), épinglables, avec date d'expiration.",
])
H += section("Statistiques")
H += [p("Effectifs, répartition filles / garçons, boursiers, redoublants, résultats par classe (taux de réussite, moyenne, "
        "absences) et exports <b>Excel</b> et <b>CSV</b> des effectifs et des résultats.")]

# 6. Tableaux de bord --------------------------------------------------------
H += chapitre("Les tableaux de bord", "Chaque rôle dispose d'un tableau de bord adapté à son travail quotidien.")
H.append(tableau(
    ["Rôle", "Contenu du tableau de bord"],
    [
        ["Administrateur", "Élèves inscrits, boursiers, redoublants, total encaissé, effectifs par classe, répartition par sexe, derniers élèves inscrits."],
        ["Comptable", "Total encaissé, reste à recouvrer, taux de recouvrement, encaissé du jour, factures en retard, masse salariale du mois, "
         "encaissements des 6 derniers mois, factures par statut, répartition par mode de paiement, derniers encaissements, factures à recouvrer."],
        ["Surveillant", "Élèves inscrits, absents et retards du jour, absences non justifiées, sanctions, dernières absences (avec justification en un clic), effectifs par classe."],
        ["Enseignant", "Classes, évaluations et accès rapide à la saisie des notes."],
        ["Élève / Parent", "Vue d'ensemble, notes, bulletins, emploi du temps, absences, carte scolaire, documents, reçus et factures (choix de l'enfant pour un parent)."],
    ],
    [0.2, 0.8],
))

# 7. Sécurité ---------------------------------------------------------------
H += chapitre("Sécurité et règles de gestion", "Les règles ci-dessous sont appliquées par le serveur, quel que soit l'appareil utilisé.")
H += section("Séparation des établissements")
H += puces([
    "Les données d'un établissement sont <b>invisibles</b> depuis un autre : une donnée d'un autre établissement est introuvable, même avec son lien direct.",
    "Toute création ou modification qui mélange deux établissements (ex. un élève de A inscrit dans une classe de B) est <b>refusée</b> et annulée.",
    "Un administrateur ne peut basculer que vers ses établissements et ne peut créer des comptes que dans ceux-ci.",
    "Élèves et parents ne voient que les données de l'élève ou de leurs enfants.",
])
H += section("Pas de comptes en double")
H.append(tableau(
    ["Information", "Règle"],
    [
        ["Email", "Un seul compte par email, majuscules comprises (Ali@Gmail.com = ali@gmail.com)."],
        ["Téléphone", "Un seul compte par numéro, quel que soit le format : +223 70 11 22 33, 0022370112233 et 70112233 sont le même numéro."],
        ["Élève", "Une seule fiche par établissement pour un même nom, prénom et date de naissance."],
        ["Personnel", "Pas deux fiches avec le même téléphone, ni la même personne (nom, prénom, date de naissance)."],
    ],
    [0.2, 0.8],
))
H += section("Comptes et mots de passe")
H += puces([
    "Mot de passe de 8 caractères minimum, ni trop courant, ni uniquement numérique.",
    "Les comptes créés par l'administration doivent changer leur mot de passe à la première connexion.",
    "Depuis « Mon profil », un utilisateur ne peut modifier que ses informations personnelles : jamais son rôle ni ses accès.",
    "Seul un super administrateur peut attribuer le rôle super administrateur.",
])
H.append(encadre("Bonnes pratiques", [
    "Ne partagez jamais un compte entre plusieurs personnes : chaque action est journalisée au nom de son auteur.",
    "Désactivez le compte d'un membre du personnel qui quitte l'établissement plutôt que de le supprimer.",
], "attention"))

# 8. FAQ ---------------------------------------------------------------------
H += chapitre("Questions fréquentes")
faq = [
    ("Un élève ne voit aucune donnée sur son tableau de bord.",
     "Son compte n'est relié à aucune fiche élève, ou la fiche n'a pas d'inscription active. Vérifiez dans <b>Élèves</b> que l'élève "
     "a une classe (bouton <b>Affecter</b>), ou faites-le s'inscrire avec son matricule."),
    ("Un parent ne voit pas son enfant.",
     "Créez le lien dans <b>Liens parents-élèves</b>. Le compte parent doit avoir le rôle Parent."),
    ("Je ne trouve pas une classe ou un élève que j'ai créé.",
     "Vérifiez l'<b>établissement actif</b> dans le sélecteur : chaque établissement a ses propres données."),
    ("Le logo n'apparaît pas sur les documents.",
     "Renvoyez le logo depuis <b>Établissements</b> &gt; Modifier. Il sera conservé définitivement."),
    ("L'inscription est refusée : « numéro déjà utilisé » ou « email déjà utilisé ».",
     "Un compte existe déjà avec cette information. Connectez-vous avec ce compte ; si le mot de passe est perdu, "
     "l'administration peut en définir un nouveau depuis <b>Utilisateurs</b> &gt; Modifier."),
    ("La moyenne d'un élève me semble fausse.",
     "Vérifiez le barème de chaque évaluation et les coefficients des types (<b>Types & pondérations</b>), puis relancez "
     "<b>Calculer moyennes & rangs</b>."),
    ("L'application installée n'affiche pas la dernière version.",
     "Fermez-la complètement puis rouvrez-la, ou tirez vers le bas pour actualiser."),
]
for question, reponse in faq:
    H.append(KeepTogether([p(f"<b>{question}</b>", "h3"), p(reponse)]))

# 9. Annexe technique ----------------------------------------------------------
H += chapitre("Annexe technique", "Architecture, installation locale, déploiement et maintenance. Destinée à l'équipe technique.")
H += section("Architecture")
H.append(tableau(
    ["Composant", "Technologie"],
    [
        ["Backend (API REST)", "Python 3.11, Django 5.2, Django REST Framework, authentification JWT (SimpleJWT)"],
        ["Base de données", "PostgreSQL"],
        ["Frontend", "React 19, Vite, Tailwind CSS 4, React Router, Recharts, Lucide"],
        ["Documents PDF", "ReportLab, QR codes (qrcode), exports Excel (openpyxl)"],
        ["Application mobile", "PWA : manifeste, service worker, icônes et écrans de démarrage iOS"],
        ["Hébergement", "Render (Blueprint render.yaml) : base PostgreSQL, API Django (gunicorn + WhiteNoise), site statique"],
    ],
    [0.3, 0.7],
))
H += section("Organisation du code")
H.append(tableau(
    ["Application Django", "Rôle"],
    [
        ["core", "Établissements, années, périodes, niveaux, classes, matières, emploi du temps, cloisonnement (tenancy.py), PDF"],
        ["accounts", "Utilisateurs, rôles, inscription, liens parents-élèves, règles anti-doublons (doublons.py)"],
        ["students", "Élèves, inscriptions, absences, sanctions, cartes scolaires"],
        ["staff", "Employés, enseignants, affectations, présences"],
        ["academics", "Types d'évaluation, évaluations, notes, moyennes, bulletins, examens"],
        ["documents_mgmt", "Certificats, attestations, convocations"],
        ["finance", "Frais, barèmes, bourses, factures, paiements, reçus (pdf.py)"],
        ["payroll", "Éléments de salaire, contrats, bulletins de paie, avances"],
        ["communication", "Messagerie, annonces, notifications automatiques (signals.py)"],
        ["reporting", "Statistiques, rapports, exports"],
    ],
    [0.25, 0.75],
))
H += section("Installation locale")
H += [Paragraph("Backend", S["h3"])]
H.append(code([
    "cd backend",
    "python -m venv venv",
    "venv\\Scripts\\activate            # Windows",
    "pip install -r requirements.txt",
    "copy .env.example .env           # puis renseigner DB_*, SECRET_KEY...",
    "python manage.py migrate",
    "python manage.py createsuperuser",
    "python manage.py runserver       # http://127.0.0.1:8000",
]))
H += [Paragraph("Frontend", S["h3"])]
H.append(code([
    "cd frontend",
    "npm install",
    "npm run dev                      # http://localhost:5173",
]))
H += section("Déploiement sur Render")
H.append(etapes([
    "Pousser le code sur GitHub (branche main).",
    "Sur dashboard.render.com : <b>New</b> &gt; <b>Blueprint</b>, puis sélectionner le dépôt. Render lit render.yaml et crée la base, l'API et le site.",
    "Renseigner les variables demandées : compte administrateur initial (DJANGO_SUPERUSER_*), CORS_ALLOWED_ORIGINS (adresse du site) et VITE_API_BASE_URL (adresse de l'API suivie de /api/v1).",
    "Cliquer sur <b>Apply</b>. Le script build.sh installe les dépendances, applique les migrations et crée le compte administrateur.",
]))
H.append(tableau(
    ["Variable", "Rôle"],
    [
        ["DJANGO_SETTINGS_MODULE", "config.settings.prod en production"],
        ["SECRET_KEY", "Clé secrète Django (générée automatiquement par le Blueprint)"],
        ["ALLOWED_HOSTS", "Noms d'hôte autorisés (ex. .onrender.com)"],
        ["CORS_ALLOWED_ORIGINS", "Adresse du site frontend autorisée à appeler l'API"],
        ["DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT", "Connexion PostgreSQL (fournie par Render)"],
        ["SERVE_MEDIA", "true : Django sert les fichiers envoyés (/media/)"],
        ["MEDIA_ROOT", "Dossier des fichiers envoyés (disque persistant en offre payante)"],
        ["VITE_API_BASE_URL", "Adresse de l'API utilisée par le frontend (prise en compte au build)"],
    ],
    [0.4, 0.6],
))
H.append(encadre("Hébergement gratuit Render", [
    "L'API se met en veille après une période d'inactivité : la première requête peut prendre 30 à 60 secondes.",
    "Les fichiers envoyés (photos, pièces jointes) sont effacés à chaque redéploiement, sauf le logo, le cachet et la signature, "
    "copiés en base de données. Pour tout conserver, ajoutez un disque persistant (offre payante) et MEDIA_ROOT=/var/data/media.",
], "attention"))
H += section("Maintenance")
H.append(tableau(
    ["Tâche", "Commande / procédure"],
    [
        ["Appliquer les migrations", "python manage.py migrate (automatique sur Render via build.sh)"],
        ["Lancer les tests automatiques", "python manage.py test apps.accounts apps.core"],
        ["Vérifier la configuration de production", "python manage.py check --deploy (avec config.settings.prod)"],
        ["Sauvegarder la base", "pg_dump avec l'« External Database URL » de la base Render"],
        ["Forcer la mise à jour des applications installées", "Modifier la constante CACHE dans frontend/public/sw.js"],
    ],
    [0.38, 0.62],
))
H += [Spacer(1, 16), p("<i>Fin du document.</i>", "chapo")]

# ---------------------------------------------------------------------------
doc = DocGesti(SORTIE)
doc.multiBuild(H, canvasmaker=CanvasNumerote)
print("PDF généré :", SORTIE)
