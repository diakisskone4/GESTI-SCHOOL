import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenContainer, { EmptyState } from "../../components/ui/ScreenContainer";
import { Card, SectionTitle, Badge } from "../../components/ui/Card";
import ChildSelector from "../../components/ui/ChildSelector";
import { useAuth, ROLE_LABELS } from "../../context/AuthContext";
import { useChild } from "../../context/ChildContext";
import { absencesApi, bulletinsApi, cartesScolairesApi } from "../../api/endpoints";
import { colors, radius, spacing } from "../../theme/colors";

const STAT_TONES = {
  brand: { bg: colors.brand[50], fg: colors.brand[600] },
  rose: { bg: colors.roseBg, fg: colors.rose },
};

function StatCard({ icon, label, value, tone = "brand" }) {
  const palette = STAT_TONES[tone] || STAT_TONES.brand;
  return (
    <Card style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: palette.bg }]}>
        <Ionicons name={icon} size={18} color={palette.fg} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

function EleveParentDashboard() {
  const { selected, loading: childLoading } = useChild();
  const [stats, setStats] = useState({ absences: 0, bulletins: 0, carte: null });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const [absences, bulletins, cartes] = await Promise.all([
        absencesApi.list({ inscription: selected.id, type_evenement: "absence" }),
        bulletinsApi.list({ inscription: selected.id }),
        cartesScolairesApi.list({ inscription: selected.id }),
      ]);
      const toArray = (d) => (Array.isArray(d) ? d : d.results || []);
      setStats({
        absences: toArray(absences).length,
        bulletins: toArray(bulletins).length,
        carte: toArray(cartes)[0] || null,
      });
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScreenContainer loading={childLoading} onRefresh={load} refreshing={loading}>
      <ChildSelector />

      {!selected ? (
        <EmptyState text="Aucune inscription active trouvée." />
      ) : (
        <>
          <Card>
            <SectionTitle>{selected.eleve_nom}</SectionTitle>
            <Text style={styles.muted}>{selected.classe_nom}</Text>
          </Card>

          <View style={styles.statsRow}>
            <StatCard icon="document-text-outline" label="Bulletins" value={stats.bulletins} tone="brand" />
            <StatCard icon="alert-circle-outline" label="Absences" value={stats.absences} tone="rose" />
          </View>

          <Card>
            <SectionTitle>Carte scolaire</SectionTitle>
            {stats.carte ? (
              <Badge label={`N° ${stats.carte.numero_carte}`} tone="emerald" />
            ) : (
              <Text style={styles.muted}>Pas encore générée par l'établissement.</Text>
            )}
          </Card>
        </>
      )}
    </ScreenContainer>
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
  flex: { flex: 1, backgroundColor: colors.background },
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
  muted: { color: colors.textMuted, fontSize: 13 },
  statsRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md },
  statCard: { flex: 1, alignItems: "flex-start" },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  statValue: { fontSize: 20, fontWeight: "700", color: colors.text },
  statLabel: { fontSize: 12, color: colors.textMuted },
  comingSoonCard: { alignItems: "center", paddingVertical: spacing.xl },
});
