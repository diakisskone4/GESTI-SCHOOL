import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenContainer, { EmptyState } from "../../components/ui/ScreenContainer";
import { Card } from "../../components/ui/Card";
import ChildSelector from "../../components/ui/ChildSelector";
import { useChild } from "../../context/ChildContext";
import { moyennesMatieresApi } from "../../api/endpoints";
import { colors, spacing } from "../../theme/colors";

function moyenneTone(valeur) {
  if (valeur == null) return colors.textMuted;
  if (valeur >= 10) return colors.emerald;
  if (valeur >= 8) return colors.amber;
  return colors.rose;
}

export default function NotesScreen() {
  const { selected, loading: childLoading } = useChild();
  const [moyennes, setMoyennes] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const data = await moyennesMatieresApi.list({ inscription: selected.id });
      setMoyennes(Array.isArray(data) ? data : data.results || []);
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
      {moyennes.length === 0 ? (
        <EmptyState text="Aucune moyenne disponible pour le moment." />
      ) : (
        moyennes.map((m) => (
          <Card key={m.id} style={styles.row}>
            <View style={styles.iconWrap}>
              <Ionicons name="book-outline" size={18} color={colors.brand[600]} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.title}>{m.matiere_nom}</Text>
            </View>
            <Text style={[styles.moyenne, { color: moyenneTone(m.moyenne) }]}>
              {m.moyenne != null ? Number(m.moyenne).toFixed(2) : "—"}/20
            </Text>
          </Card>
        ))
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  flex: { flex: 1 },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.brand[50],
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 14, fontWeight: "700", color: colors.text },
  moyenne: { fontSize: 15, fontWeight: "700" },
});
