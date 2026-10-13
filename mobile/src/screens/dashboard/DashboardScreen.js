import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import ScreenContainer, { EmptyState } from "../../components/ui/ScreenContainer";
import { Card, SectionTitle, Badge } from "../../components/ui/Card";
import ChildSelector from "../../components/ui/ChildSelector";
import { useAuth, ROLE_LABELS } from "../../context/AuthContext";
import { useChild } from "../../context/ChildContext";
import {
  absencesApi, bulletinsApi, cartesScolairesApi, documentsGeneresApi, emploisDuTempsApi,
  facturesApi, moyennesMatieresApi, paiementsApi,
} from "../../api/endpoints";
import { colors, radius, spacing } from "../../theme/colors";

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

// Rubriques affichées en widgets sur l'accueil.
// `onglet` : onglet de navigation correspondant ; `panneau` : détail affiché sur l'accueil.
const WIDGETS = [
  { key: "notes", label: "Notes", icon: "school-outline", bg: "#ede9fe", fg: "#7c3aed", onglet: "Notes" },
  { key: "bulletins", label: "Bulletins", icon: "document-text-outline", bg: colors.skyBg, fg: colors.sky, onglet: "Bulletins" },
  { key: "emploi", label: "Emploi du temps", icon: "calendar-outline", bg: "#e0e7ff", fg: "#4f46e5", panneau: true },
  { key: "absences", label: "Absences", icon: "alert-circle-outline", bg: colors.roseBg, fg: colors.rose, onglet: "Absences" },
  { key: "carte", label: "Carte scolaire", icon: "card-outline", bg: colors.amberBg, fg: colors.amber },
  { key: "documents", label: "Documents", icon: "folder-open-outline", bg: "#ccfbf1", fg: "#0d9488", onglet: "Documents" },
  { key: "recus", label: "Reçus & factures", icon: "wallet-outline", bg: colors.emeraldBg, fg: colors.emerald, panneau: true },
];

const toArray = (d) => (Array.isArray(d) ? d : d?.results || []);
const fcfa = (n) => `${Math.round(Number(n || 0)).toLocaleString("fr-FR")} FCFA`;

/** Tuile du tableau de bord : icône, titre, résumé en direct et éventuelle alerte. */
function Widget({ widget, resume, detail, alerte, actif, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.widget, actif && styles.widgetActif, pressed && styles.widgetPresse]}
      accessibilityRole="button"
      accessibilityLabel={`${widget.label} : ${resume}`}
    >
      <View style={styles.widgetHaut}>
        <View style={[styles.widgetIcone, { backgroundColor: widget.bg }]}>
          <Ionicons name={widget.icon} size={21} color={widget.fg} />
        </View>
        {alerte ? (
          <View style={styles.alerte}>
            <Text style={styles.alerteTexte}>{alerte}</Text>
          </View>
        ) : (
          <Ionicons name={widget.panneau && actif ? "chevron-down" : "chevron-forward"} size={16} color={colors.slate[300]} />
        )}
      </View>
      <Text style={styles.widgetTitre}>{widget.label}</Text>
      <Text style={styles.widgetResume} numberOfLines={1}>{resume}</Text>
      {detail ? <Text style={styles.widgetDetail} numberOfLines={1}>{detail}</Text> : null}
    </Pressable>
  );
}

function EleveParentDashboard() {
  const navigation = useNavigation();
  const { selected, loading: childLoading } = useChild();
  const [donnees, setDonnees] = useState(null);
  const [loading, setLoading] = useState(false);
  const [panneau, setPanneau] = useState(null); // "emploi" | "recus" | null

  const load = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const [absences, bulletins, cartes, moyennes, documents, factures, creneaux] = await Promise.all([
        absencesApi.list({ inscription: selected.id }),
        bulletinsApi.list({ inscription: selected.id }),
        cartesScolairesApi.list({ inscription: selected.id }),
        moyennesMatieresApi.list({ inscription: selected.id }),
        documentsGeneresApi.list({ eleve: selected.eleve }).catch(() => []),
        facturesApi.list({ inscription__eleve: selected.eleve }).catch(() => []),
        emploisDuTempsApi.list({ classe: selected.classe }).catch(() => []),
      ]);
      setDonnees({
        absences: toArray(absences),
        bulletins: toArray(bulletins),
        carte: toArray(cartes)[0] || null,
        moyennes: toArray(moyennes),
        documents: toArray(documents),
        factures: toArray(factures),
        creneaux: toArray(creneaux),
      });
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => {
    setPanneau(null);
    load();
  }, [load]);

  // --- Résumés des widgets ---
  const resumes = useMemo(() => {
    if (!donnees) return {};
    const { absences, bulletins, carte, moyennes, documents, factures, creneaux } = donnees;

    // Moyenne générale de la dernière période notée (pondérée par les coefficients)
    const dernierePeriode = moyennes.reduce((max, m) => (m.periode > max ? m.periode : max), 0);
    const dePeriode = moyennes.filter((m) => m.periode === dernierePeriode);
    const coef = dePeriode.reduce((t, m) => t + Number(m.coefficient || 1), 0);
    const moyenne = coef ? dePeriode.reduce((t, m) => t + Number(m.moyenne) * Number(m.coefficient || 1), 0) / coef : null;

    const jour = (new Date().getDay() + 6) % 7; // lundi = 0
    const coursDuJour = creneaux
      .filter((c) => c.jour === jour)
      .sort((a, b) => a.heure_debut.localeCompare(b.heure_debut));
    const nbAbs = absences.filter((a) => a.type_evenement === "absence").length;
    const nbRet = absences.filter((a) => a.type_evenement === "retard").length;
    const nonJustifiees = absences.filter((a) => !a.justifiee).length;
    const reste = factures
      .filter((f) => f.statut !== "annulee")
      .reduce((t, f) => t + Math.max(Number(f.solde || 0), 0), 0);
    const dernierBulletin = [...bulletins].sort((a, b) => b.periode - a.periode)[0];

    return {
      notes: {
        resume: moyenne !== null ? `Moyenne ${moyenne.toFixed(2).replace(".", ",")} / 20` : "Aucune note",
        detail: dePeriode.length ? `${dePeriode.length} matière(s) notée(s)` : null,
      },
      bulletins: {
        resume: bulletins.length ? `${bulletins.length} bulletin(s)` : "Aucun bulletin",
        detail: dernierBulletin?.rang ? `Dernier rang : ${dernierBulletin.rang}/${dernierBulletin.effectif_classe}` : null,
      },
      emploi: {
        resume: jour > 5 ? "Week-end" : coursDuJour.length ? `${coursDuJour.length} cours aujourd'hui` : "Pas de cours aujourd'hui",
        detail: coursDuJour[0] ? `${coursDuJour[0].heure_debut.substring(0, 5)} · ${coursDuJour[0].matiere_nom}` : null,
      },
      absences: {
        resume: `${nbAbs} absence(s) · ${nbRet} retard(s)`,
        detail: nonJustifiees ? `${nonJustifiees} non justifiée(s)` : absences.length ? "Toutes justifiées" : null,
        alerte: nonJustifiees || null,
      },
      carte: {
        resume: carte ? `N° ${carte.numero_carte}` : "Pas encore générée",
        detail: carte ? "Toucher pour l'afficher" : null,
      },
      documents: {
        resume: documents.length ? `${documents.length} document(s)` : "Aucun document",
        detail: documents[0] ? `Dernier : ${new Date(documents[0].created_at).toLocaleDateString("fr-FR")}` : null,
      },
      recus: {
        resume: reste > 0 ? `Reste ${fcfa(reste)}` : factures.length ? "Tout est réglé" : "Aucune facture",
        detail: factures.length ? `${factures.length} facture(s)` : null,
        alerte: reste > 0 ? "À payer" : null,
      },
    };
  }, [donnees]);

  const ouvrirPdf = (path, title) => navigation.navigate("PdfViewer", { path, title });

  const ouvrir = (widget) => {
    if (widget.onglet) {
      navigation.navigate(widget.onglet);
    } else if (widget.key === "carte") {
      if (donnees?.carte) {
        ouvrirPdf(cartesScolairesApi.pdfPath(donnees.carte.id), `Carte scolaire — ${donnees.carte.numero_carte}`);
      }
    } else if (widget.panneau) {
      setPanneau((courant) => (courant === widget.key ? null : widget.key));
    }
  };

  return (
    <ScreenContainer loading={childLoading} onRefresh={load} refreshing={loading}>
      <ChildSelector />

      {!selected ? (
        <EmptyState text="Aucune inscription active trouvée." />
      ) : (
        <>
          <Card style={styles.eleveCarte}>
            <View style={styles.eleveIcone}>
              <Ionicons name="person-outline" size={20} color={colors.brand[600]} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.eleveNom}>{selected.eleve_nom}</Text>
              <Text style={styles.muted}>Classe {selected.classe_nom}</Text>
            </View>
          </Card>

          <Text style={styles.sectionLabel}>Ma scolarité</Text>
          <View style={styles.grille}>
            {WIDGETS.map((w) => (
              <View key={w.key} style={styles.cellule}>
                <Widget
                  widget={w}
                  actif={panneau === w.key}
                  resume={resumes[w.key]?.resume ?? (loading ? "Chargement…" : "—")}
                  detail={resumes[w.key]?.detail}
                  alerte={resumes[w.key]?.alerte}
                  onPress={() => ouvrir(w)}
                />
              </View>
            ))}
          </View>

          {panneau === "emploi" && donnees && <PanneauEmploi creneaux={donnees.creneaux} />}
          {panneau === "recus" && donnees && <PanneauRecus factures={donnees.factures} onPdf={ouvrirPdf} />}
        </>
      )}
    </ScreenContainer>
  );
}

/** Emploi du temps de la semaine, jour par jour (aujourd'hui en premier). */
function PanneauEmploi({ creneaux }) {
  const aujourdhui = (new Date().getDay() + 6) % 7;
  // Les 7 jours à partir d'aujourd'hui, sans le dimanche (index 6)
  const ordre = Array.from({ length: 7 }, (_, i) => (aujourdhui + i) % 7).filter((i) => i < 6);
  if (!creneaux.length) {
    return <Card><Text style={styles.muted}>L'emploi du temps de la classe n'est pas encore disponible.</Text></Card>;
  }
  return (
    <Card>
      <SectionTitle>Emploi du temps</SectionTitle>
      {ordre.map((jour) => {
        const cours = creneaux.filter((c) => c.jour === jour).sort((a, b) => a.heure_debut.localeCompare(b.heure_debut));
        if (!cours.length) return null;
        return (
          <View key={jour} style={styles.jour}>
            <Text style={styles.jourTitre}>{jour === aujourdhui ? `Aujourd'hui · ${JOURS[jour]}` : JOURS[jour]}</Text>
            {cours.map((c) => (
              <View key={c.id} style={styles.cours}>
                <Text style={styles.coursHeure}>{c.heure_debut.substring(0, 5)}{"\n"}{c.heure_fin.substring(0, 5)}</Text>
                <View style={styles.flex}>
                  <Text style={styles.coursMatiere}>{c.matiere_nom}</Text>
                  <Text style={styles.muted}>
                    {[c.enseignant_nom, c.salle && `Salle ${c.salle}`].filter(Boolean).join(" · ") || "—"}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        );
      })}
    </Card>
  );
}

/** Factures de l'élève, avec leur reste à payer et l'accès aux reçus. */
function PanneauRecus({ factures, onPdf }) {
  if (!factures.length) {
    return <Card><Text style={styles.muted}>Aucune facture pour le moment.</Text></Card>;
  }
  const TONS = { payee: "emerald", partielle: "amber", impayee: "rose", annulee: "brand" };
  const LIBELLES = { payee: "Payée", partielle: "Partielle", impayee: "Impayée", annulee: "Annulée" };
  return (
    <Card>
      <SectionTitle>Reçus & factures</SectionTitle>
      {factures.map((f) => (
        <View key={f.id} style={styles.facture}>
          <View style={styles.factureHaut}>
            <Text style={[styles.coursMatiere, styles.flex]}>{f.libelle || "Frais scolaires"}</Text>
            <Badge label={LIBELLES[f.statut] || f.statut} tone={TONS[f.statut] || "brand"} />
          </View>
          <Text style={styles.muted}>Montant {fcfa(f.montant_net)} · Payé {fcfa(f.montant_paye)} · Reste {fcfa(f.solde)}</Text>
          <View style={styles.boutons}>
            <Pressable onPress={() => onPdf(`/factures/${f.id}/pdf/`, "Facture")} style={styles.lien}>
              <Ionicons name="document-outline" size={14} color={colors.brand[600]} />
              <Text style={styles.lienTexte}>Facture</Text>
            </Pressable>
            {(f.paiements || []).filter((p) => !p.annule).map((p) => (
              <Pressable key={p.id} onPress={() => onPdf(paiementsApi.recuPath(p.id), `Reçu ${p.numero_recu}`)} style={styles.lien}>
                <Ionicons name="receipt-outline" size={14} color={colors.brand[600]} />
                <Text style={styles.lienTexte}>Reçu {fcfa(p.montant)}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </Card>
  );
}

function StaffComingSoon() {
  return (
    <ScreenContainer>
      <Card style={styles.comingSoonCard}>
        <Ionicons name="construct-outline" size={28} color={colors.brand[600]} />
        <SectionTitle style={{ marginTop: spacing.sm }}>Bientôt disponible</SectionTitle>
        <Text style={styles.muted}>
          Les modules de gestion (élèves, classes, finance, paie...) arrivent dans une prochaine mise à
          jour de l'application mobile. Utilisez l'application web pour ces fonctions en attendant.
        </Text>
      </Card>
    </ScreenContainer>
  );
}

export default function DashboardScreen() {
  const { user } = useAuth();

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <Text style={styles.hello}>Bonjour, {user?.first_name || user?.full_name}</Text>
        <Text style={styles.role}>{ROLE_LABELS[user?.role] || user?.role}</Text>
      </View>
      {user?.est_eleve || user?.est_parent ? <EleveParentDashboard /> : <StaffComingSoon />}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    backgroundColor: colors.brand[600],
    paddingTop: 56,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  hello: { color: colors.white, fontSize: 18, fontWeight: "700" },
  role: { color: colors.brand[100], fontSize: 12, marginTop: 2 },
  muted: { color: colors.slate[500], fontSize: 12 },

  eleveCarte: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  eleveIcone: {
    width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.brand[50],
    alignItems: "center", justifyContent: "center",
  },
  eleveNom: { fontSize: 15, fontWeight: "700", color: colors.text },
  sectionLabel: {
    fontSize: 11, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.8,
    textTransform: "uppercase", marginTop: spacing.xs, marginBottom: spacing.sm,
  },

  // Grille de widgets (2 colonnes)
  grille: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -spacing.xs, marginBottom: spacing.sm },
  cellule: { width: "50%", padding: spacing.xs },
  widget: {
    backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, minHeight: 128,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: "#10112e", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  widgetActif: { borderColor: colors.brand[300] },
  widgetPresse: { transform: [{ scale: 0.97 }], opacity: 0.9 },
  widgetHaut: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  widgetIcone: { width: 42, height: 42, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  widgetTitre: { marginTop: spacing.md, fontSize: 14, fontWeight: "700", color: colors.text },
  widgetResume: { marginTop: 2, fontSize: 12.5, fontWeight: "600", color: colors.slate[600] },
  widgetDetail: { marginTop: 1, fontSize: 11, color: colors.textMuted },
  alerte: { backgroundColor: colors.rose, borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 2 },
  alerteTexte: { color: colors.white, fontSize: 10, fontWeight: "700" },

  // Panneaux de détail
  jour: { marginTop: spacing.sm },
  jourTitre: { fontSize: 12, fontWeight: "700", color: colors.brand[600], marginBottom: spacing.xs },
  cours: {
    flexDirection: "row", gap: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.slate[100],
  },
  coursHeure: { width: 44, fontSize: 11, fontWeight: "600", color: colors.slate[600] },
  coursMatiere: { fontSize: 13.5, fontWeight: "700", color: colors.text },
  facture: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.slate[100] },
  factureHaut: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: 2 },
  boutons: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.xs },
  lien: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 },
  lienTexte: { color: colors.brand[600], fontSize: 12.5, fontWeight: "600" },

  comingSoonCard: { alignItems: "center", paddingVertical: spacing.xl },
});
