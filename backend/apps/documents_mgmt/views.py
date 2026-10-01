from django.core.files.base import ContentFile
from django.http import FileResponse
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.pdf_utils import generer_document_administratif_pdf
from apps.core.permissions import IsAdmin
from apps.documents_mgmt.models import DocumentGenere
from apps.documents_mgmt.serializers import DocumentGenereSerializer

TITRES = {
    "certificat_scolarite": "Certificat de scolarité",
    "certificat_frequentation": "Certificat de fréquentation scolaire",
    "convocation_examen": "Convocation à un examen",
    "convocation_reunion": "Convocation à une réunion",
    "attestation_reussite": "Attestation de réussite",
    "attestation_passage": "Attestation de passage",
    "fiche_permission": "Fiche de permission",
    "fiche_medicale": "Fiche médicale",
    "billet_entree": "Billet d'entrée",
    "avis_recouvrement": "Avis de recouvrement",
    "attestation_travail": "Attestation de travail",
    "certificat_travail": "Certificat de travail",
    "certificat_fin_contrat": "Certificat de fin de contrat",
    "attestation_fin_stage": "Attestation de fin de stage",
    "fiche_licenciement": "Fiche de licenciement",
}

# Documents dont le signataire n'est pas le Directeur/Proviseur mais un autre responsable.
SIGNATAIRES_PARTICULIERS = {
    "avis_recouvrement": "L'Économe",
    "billet_entree": "Le Gestionnaire de l'établissement",
}

# Style visuel du PDF selon le type de document (voir generer_document_administratif_pdf).
STYLES = {
    "certificat_scolarite": "officiel",
    "certificat_frequentation": "officiel",
    "attestation_travail": "orne",
    "certificat_travail": "orne",
    "certificat_fin_contrat": "orne",
    "attestation_fin_stage": "orne",
    "attestation_reussite": "orne",
    "attestation_passage": "orne",
}

TYPE_ETABLISSEMENT_LABELS = {
    "prescolaire": "préscolaire",
    "primaire": "primaire",
    "secondaire": "secondaire général",
    "mixte": "scolaire",
}


class DocumentGenereViewSet(viewsets.ModelViewSet):
    serializer_class = DocumentGenereSerializer
    filterset_fields = ["type_document", "eleve", "employe"]
    search_fields = ["reference", "objet"]

    def get_queryset(self):
        qs = DocumentGenere.objects.select_related("eleve", "employe", "inscription")
        user = self.request.user
        if user.est_admin:
            return qs
        if user.est_eleve:
            return qs.filter(eleve__user=user)
        if user.est_parent:
            return qs.filter(eleve__parents_lies__parent=user)
        return qs.none()

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAdmin()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(genere_par=self.request.user)

    @action(detail=True, methods=["get"])
    def pdf(self, request, pk=None):
        """Génère le PDF du document (A4) à partir de son contenu texte et l'archive."""
        doc = self.get_object()
        titre = TITRES.get(doc.type_document, doc.get_type_document_display())
        etablissement = (
            (doc.eleve.etablissement if doc.eleve else None)
            or (doc.employe.etablissement if doc.employe else None)
            or request.user.etablissement_courant
        )
        if etablissement is None:
            return Response(
                {"detail": "Impossible de déterminer l'établissement : sélectionnez un élève ou configurez votre établissement courant."},
                status=400,
            )
        lignes = self._construire_contenu(doc)
        tableau = self._construire_tableau_releve(doc.eleve) if (doc.type_document == "certificat_scolarite" and doc.eleve) else None
        buffer = generer_document_administratif_pdf(
            titre=titre, etablissement=etablissement, contenu_lignes=lignes,
            destinataire=str(doc.eleve or doc.employe or ""), reference=doc.reference,
            signataire_titre=SIGNATAIRES_PARTICULIERS.get(doc.type_document, ""),
            style=STYLES.get(doc.type_document, "simple"),
            preambule_lignes=self._construire_preambule(doc, etablissement),
            tableau=tableau,
        )
        doc.fichier_pdf.save(f"{doc.reference}.pdf", ContentFile(buffer.getvalue()), save=True)
        buffer.seek(0)
        return FileResponse(buffer, as_attachment=False, filename=f"{doc.reference}.pdf", content_type="application/pdf")

    def _construire_contenu(self, doc):
        if doc.contenu_texte:
            return doc.contenu_texte.split("\n")

        eleve = doc.eleve
        employe = doc.employe
        type_document = doc.type_document

        if type_document in ("certificat_scolarite", "certificat_frequentation") and eleve:
            insc = eleve.inscription_courante
            lignes = [
                f"Je soussigné, {self._soussigne(doc, avec_nom=False)}, certifie que l'élève {eleve.prenom} {eleve.nom}, "
                f"né(e) le {eleve.date_naissance:%d/%m/%Y} à {eleve.lieu_naissance or '...'},",
            ]
            filiation = self._ligne_filiation(eleve)
            if filiation:
                lignes.append(filiation + ",")
            lignes.append(
                f"est régulièrement inscrit(e) dans notre établissement en classe de {insc.classe.nom if insc else '...'} "
                f"pour l'année scolaire {insc.annee_scolaire.libelle if insc else '...'}."
            )
            if type_document == "certificat_scolarite" and doc.objet:
                motif = doc.objet.rstrip(".")
                lignes.append(f"Motif du départ : {motif}.")
            lignes.append("En foi de quoi ce certificat lui est délivré pour servir et valoir ce que de droit.")
            if type_document == "certificat_scolarite" and doc.objet:
                # Disclaimer d'usage : uniquement pertinent pour la variante "relevé de sortie".
                lignes.append("")
                lignes.append("NB : ce certificat ne peut en aucun cas servir de certificat de fréquentation scolaire.")
            return lignes

        if type_document.startswith("convocation"):
            lieu = doc.lieu_evenement or "l'établissement"
            return [
                f"Nous vous prions de bien vouloir vous présenter le {doc.date_evenement:%d/%m/%Y}" if doc.date_evenement else "Nous vous prions de bien vouloir vous présenter",
                f"à {lieu} concernant : {doc.objet}.",
                "Votre présence est indispensable.",
            ]

        if type_document in ("attestation_reussite", "attestation_passage") and eleve:
            insc = eleve.inscription_courante
            return [
                f"Nous attestons que {eleve.prenom} {eleve.nom} a suivi avec succès sa scolarité "
                f"en classe de {insc.classe.nom if insc else '...'}.",
                doc.objet or "",
            ]

        if type_document == "fiche_permission" and eleve:
            insc = eleve.inscription_courante
            lignes = [
                f"Je soussigné, {self._soussigne(doc, avec_nom=False)}, atteste qu'il a été accordé à {eleve.prenom} {eleve.nom},",
                f"élève inscrit(e) sous le matricule {eleve.matricule}, fréquentant la classe de "
                f"{insc.classe.nom if insc else '...'} au titre de l'année scolaire "
                f"{insc.annee_scolaire.libelle if insc else '...'}, une permission de : {doc.objet or '...'}.",
            ]
            if doc.date_evenement and doc.date_fin_evenement:
                lignes.append(f"Du {doc.date_evenement:%d/%m/%Y} au {doc.date_fin_evenement:%d/%m/%Y}.")
            elif doc.date_evenement:
                lignes.append(f"À compter du {doc.date_evenement:%d/%m/%Y}.")
            lignes.append("En foi de quoi la présente fiche lui est délivrée pour servir et valoir ce que de droit.")
            return lignes

        if type_document == "fiche_medicale" and eleve:
            insc = eleve.inscription_courante
            return [
                f"L'élève {eleve.prenom} {eleve.nom}, inscrit(e) en classe de {insc.classe.nom if insc else '...'}, "
                f"est autorisé(e) à se faire consulter dans : {doc.lieu_evenement or '...'}.",
                f"Motif : {doc.objet}." if doc.objet else "",
            ]

        if type_document == "billet_entree" and eleve:
            insc = eleve.inscription_courante
            return [
                f"L'élève {eleve.prenom} {eleve.nom}, inscrit(e) en classe de {insc.classe.nom if insc else '...'}, "
                "est autorisé(e) à entrer dans l'établissement.",
                f"Motif : {doc.objet}." if doc.objet else "",
            ]

        if type_document == "avis_recouvrement" and eleve:
            insc = eleve.inscription_courante
            lignes = [
                "Monsieur,",
                f"Père, tuteur ou responsable de la scolarité de l'élève {eleve.prenom} {eleve.nom}, qui fréquente la "
                f"classe de {insc.classe.nom if insc else '...'}, nous vous rappelons que vous n'avez toujours pas payé "
                "le reste des frais de scolarité de votre enfant.",
                "Par conséquent, nous vous demandons de bien vouloir y penser et de procéder au règlement au plus "
                f"tard le {doc.date_evenement:%d/%m/%Y}." if doc.date_evenement else
                "Par conséquent, nous vous demandons de bien vouloir y penser et de procéder au règlement dans les meilleurs délais.",
                "Faute de quoi nous serons au regret de renvoyer l'élève en question.",
                "Veuillez nous en accuser réception et recevez, monsieur, nos salutations distinguées.",
            ]
            return lignes

        if type_document in ("attestation_travail", "certificat_travail") and employe:
            periode = f"du {employe.date_embauche:%d/%m/%Y}" if employe.date_embauche else "depuis son embauche"
            periode += f" au {employe.date_fin_contrat:%d/%m/%Y}" if employe.date_fin_contrat else " à nos jours"
            verbe = "travaille" if type_document == "attestation_travail" else "a travaillé"
            action = "atteste" if type_document == "attestation_travail" else "certifie"
            return [
                f"Je soussigné, {self._soussigne(doc)}, {action} par la présente que : "
                f"{employe.prenom} {employe.nom} {verbe} dans mon établissement {periode}, "
                f"en qualité de : {doc.objet or '...'}.",
                "Les services rendus sont appréciés par toute la Direction, le corps professoral et les élèves.",
                "En foi de quoi, ce document lui est délivré pour servir et valoir ce que de droit.",
            ]

        if type_document == "certificat_fin_contrat" and employe:
            date_fin = f"le {employe.date_fin_contrat:%d/%m/%Y}" if employe.date_fin_contrat else "à la date convenue"
            return [
                f"Je soussigné, {self._soussigne(doc)}, atteste que {employe.prenom} {employe.nom}, "
                f"précédemment employé(e) en qualité de : {doc.objet or '...'}, a mis fin à son contrat {date_fin}.",
                "En foi de quoi, le présent certificat de fin de contrat est délivré pour servir et valoir ce que de droit.",
            ]

        if type_document == "attestation_fin_stage":
            nom_stagiaire = f"{employe.prenom} {employe.nom}" if employe else (doc.objet or "l'intéressé(e)")
            provenance = f", {doc.lieu_evenement}," if doc.lieu_evenement else ""
            if doc.date_evenement and doc.date_fin_evenement:
                periode = f" de {doc.date_evenement:%d/%m/%Y} à {doc.date_fin_evenement:%d/%m/%Y}"
            elif doc.date_evenement:
                periode = f" à compter du {doc.date_evenement:%d/%m/%Y}"
            else:
                periode = ""
            return [
                f"Je soussigné, {self._soussigne(doc)}, atteste que {nom_stagiaire}{provenance} a effectué un stage "
                f"pratique au sein de mon établissement{periode}.",
                "Pendant le stage, l'intéressé(e) a fait preuve de sérieux et d'assiduité.",
                "En foi de quoi, la présente attestation de fin de stage lui est délivrée pour servir et valoir ce que de droit.",
            ]

        if type_document == "fiche_licenciement" and employe:
            return [
                f"Madame/Monsieur {employe.prenom} {employe.nom},",
                doc.objet or "Nous portons à votre connaissance la fin de votre contrat d'embauche.",
                "Veuillez agréer l'expression de nos meilleures salutations.",
            ]

        return [doc.objet or ""]

    def _titre_directeur(self, doc):
        etablissement = (doc.eleve.etablissement if doc.eleve else None) or (doc.employe.etablissement if doc.employe else None)
        titre = getattr(etablissement, "directeur_titre", "") if etablissement else ""
        return titre or "Directeur de l'établissement"

    def _soussigne(self, doc, avec_nom=True):
        """Formule 'Je soussigné, {Nom,} {Titre} du {Établissement} ({Sigle})'. Le nom du
        directeur n'est inclus que si `avec_nom` est vrai et que le champ est renseigné —
        certains documents (fiches) ne le mentionnent pas dans leur modèle d'origine."""
        etablissement = (doc.eleve.etablissement if doc.eleve else None) or (doc.employe.etablissement if doc.employe else None)
        titre = self._titre_directeur(doc)
        if not etablissement:
            return titre
        etab_label = f"{etablissement.nom} ({etablissement.sigle})" if etablissement.sigle else etablissement.nom
        nom = (getattr(etablissement, "directeur_nom", "") if avec_nom else "") or ""
        if nom:
            return f"{nom}, {titre} du {etab_label}"
        return f"{titre} du {etab_label}"

    def _construire_preambule(self, doc, etablissement):
        """Préambule légal ('Vu l'arrêté...') pour les documents au style 'orne', si les
        références d'arrêté sont renseignées sur l'établissement."""
        if STYLES.get(doc.type_document) != "orne":
            return None
        if not (etablissement.arrete_creation or etablissement.arrete_ouverture):
            return None
        type_label = TYPE_ETABLISSEMENT_LABELS.get(etablissement.type_etablissement, "scolaire")
        nom_complet = f"« {etablissement.nom} » ({etablissement.sigle})" if etablissement.sigle else f"« {etablissement.nom} »"
        lignes = []
        if etablissement.arrete_creation:
            lignes.append(
                f"Vu l'arrêté de création {etablissement.arrete_creation}, portant autorisation de création "
                f"d'un établissement {type_label} dénommé : {nom_complet} ;"
            )
        if etablissement.arrete_ouverture:
            lignes.append(
                f"Vu l'arrêté d'ouverture {etablissement.arrete_ouverture}, portant autorisation d'ouverture "
                f"d'un établissement {type_label} dénommé : {nom_complet} ;"
            )
        return lignes

    def _ligne_filiation(self, eleve):
        """'Fils/Fille de : {père} et de : {mère}' — n'apparaît que si au moins un des deux
        parents est renseigné sur la fiche élève."""
        if not (eleve.nom_pere or eleve.nom_mere):
            return None
        genre = "Fils" if eleve.sexe == "M" else "Fille"
        return f"{genre} de : {eleve.nom_pere or '...'} et de : {eleve.nom_mere or '...'}"

    def _construire_tableau_releve(self, eleve):
        """Relevé de notes (moyennes par période, par année scolaire) pour la variante 'certificat
        de scolarité de sortie' — construit uniquement si l'élève a un historique de bulletins sur
        au moins deux périodes (sinon un simple certificat de scolarité suffit, sans tableau)."""
        from apps.academics.models import Bulletin

        bulletins = list(
            Bulletin.objects.filter(inscription__eleve=eleve, moyenne_generale__isnull=False)
            .select_related("inscription__classe", "inscription__annee_scolaire", "periode")
            .order_by("inscription__annee_scolaire__date_debut", "periode__numero")
        )
        if len(bulletins) < 2:
            return None

        groupes = {}
        for b in bulletins:
            annee = b.inscription.annee_scolaire
            groupe = groupes.setdefault(annee.id, {
                "annee": annee.libelle, "classe": b.inscription.classe.nom, "bulletins": [],
            })
            groupe["bulletins"].append(b)

        lignes = []
        for groupe in groupes.values():
            periodes = sorted(groupe["bulletins"], key=lambda b: b.periode.numero)[:3]
            moyennes = [float(p.moyenne_generale) for p in periodes]
            moy_an = round(sum(moyennes) / len(moyennes), 2) if moyennes else None
            ligne = [groupe["annee"], groupe["classe"]]
            for i in range(3):
                if i < len(periodes):
                    p = periodes[i]
                    rang = f"{p.rang}è" if p.rang else ""
                    ligne.append(f"{p.moyenne_generale:.2f} {rang} {p.mention or ''}".strip())
                else:
                    ligne.append("—")
            ligne.append(f"{moy_an:.2f}" if moy_an is not None else "—")
            lignes.append(ligne)

        return {
            "entetes": ["Année scolaire", "Classe", "1ère Comp.", "2ème Comp.", "3ème Comp.", "Moy. Année"],
            "lignes": lignes,
            "largeurs": [1.3, 0.9, 1.3, 1.3, 1.3, 1],
        }
