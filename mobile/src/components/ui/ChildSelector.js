import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { useChild } from "../../context/ChildContext";
import { colors, radius, spacing } from "../../theme/colors";

export default function ChildSelector() {
  const { inscriptions, selectedId, setSelectedId } = useChild();

  if (inscriptions.length < 2) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.wrap} contentContainerStyle={styles.content}>
      {inscriptions.map((insc) => {
        const active = insc.id === selectedId;
        return (
          <Pressable
            key={insc.id}
            onPress={() => setSelectedId(insc.id)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{insc.eleve_nom}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  content: { gap: spacing.sm, paddingRight: spacing.lg },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  chipActive: { backgroundColor: colors.brand[600], borderColor: colors.brand[600] },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.text },
  chipTextActive: { color: colors.white },
});
