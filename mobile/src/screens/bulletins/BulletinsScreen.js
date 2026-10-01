import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenContainer, { EmptyState } from "../../components/ui/ScreenContainer";
import { Card, Badge } from "../../components/ui/Card";
import ChildSelector from "../../components/ui/ChildSelector";
import { useChild } from "../../context/ChildContext";
import { bulletinsApi } from "../../api/endpoints";
import { colors, spacing } from "../../theme/colors";

export default function BulletinsScreen({ navigation }) {
  const { selected, loading: childLoading } = useChild();
  const [bulletins, setBulletins] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const data = await bulletinsApi.list({ inscription: selected.id });
      setBulletins(Array.isArray(data) ? data : data.results || []);
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
      {bulletins.length === 0 ? (
        <EmptyState text="Aucun bulletin disponible pour le moment." />
      ) : (
        bulletins.map((b) => (
          <Pressable
            key={b.id}
            onPress={() =>
              navigation.navigate("PdfViewer", {
                path: bulletinsApi.pdfPath(b.id),
                title: `Bulletin - ${b.periode_libelle || ""}`,
              })
            }
          >
            <Card style={styles.row}>
              <View style={styles.iconWrap}>
                <Ionicons name="document-text-outline" size={20} color={colors.brand[600]} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.title}>{b.periode_libelle || `Bulletin #${b.id}`}</Text>
                <Text style={styles.subtitle}>Moyenne générale : {b.moyenne_generale ?? "—"}</Text>
              </View>
              {b.valide ? <Badge label="Validé" tone="emerald" /> : <Badge label="Brouillon" tone="amber" />}
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Card>
          </Pressable>
        ))
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  flex: { flex: 1 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.brand[50],
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 14, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
