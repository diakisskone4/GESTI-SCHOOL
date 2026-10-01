import { View, Text, StyleSheet } from "react-native";
import { colors, radius, spacing } from "../../theme/colors";

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children, style }) {
  return <Text style={[styles.sectionTitle, style]}>{children}</Text>;
}

export function Badge({ label, tone = "brand" }) {
  const palette = {
    brand: { bg: colors.brand[50], fg: colors.brand[700] },
    emerald: { bg: colors.emeraldBg, fg: colors.emerald },
    amber: { bg: colors.amberBg, fg: colors.amber },
    rose: { bg: colors.roseBg, fg: colors.rose },
    sky: { bg: colors.skyBg, fg: colors.sky },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.badgeText, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    alignSelf: "flex-start",
  },
  badgeText: { fontSize: 11, fontWeight: "700" },
});
