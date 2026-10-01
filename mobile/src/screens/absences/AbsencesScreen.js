import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenContainer, { EmptyState } from "../../components/ui/ScreenContainer";
import { Card, Badge } from "../../components/ui/Card";
import ChildSelector from "../../components/ui/ChildSelector";
import { useChild } from "../../context/ChildContext";
import { absencesApi } from "../../api/endpoints";
import { colors, spacing } from "../../theme/colors";

const TYPE_LABELS = { absence: "Absence", retard: "Retard" };

export default function AbsencesScreen() {
  const { selected, loading: childLoading } = useChild();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const data = await absencesApi.list({ inscription: selected.id });
      const list = Array.isArray(data) ? data : data.results || [];
      list.sort((a, b) => new Date(b.date) - new Date(a.date));
      setItems(list);
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
      {items.length === 0 ? (
        <EmptyState text="Aucune absence ou retard enregistré." />
      ) : (
        items.map((item) => (
          <Card key={item.id} style={styles.row}>
            <View style={styles.iconWrap}>
              <Ionicons
                name={item.type_evenement === "retard" ? "time-outline" : "close-circle-outline"}
                size={18}
                color={colors.rose}
              />
            </View>
            <View style={styles.flex}>
              <Text style={styles.title}>{TYPE_LABELS[item.type_evenement] || item.type_evenement}</Text>
              <Text style={styles.subtitle}>{item.date}{item.motif ? ` — ${item.motif}` : ""}</Text>
            </View>
            {item.justifiee ? (
              <Badge label="Justifiée" tone="emerald" />
            ) : (
              <Badge label="Non justifiée" tone="rose" />
            )}
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
    backgroundColor: colors.roseBg,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 14, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
