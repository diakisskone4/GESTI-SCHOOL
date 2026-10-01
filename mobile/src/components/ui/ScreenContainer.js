import { View, StyleSheet, RefreshControl, ScrollView, ActivityIndicator, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "../../theme/colors";

export default function ScreenContainer({
  children,
  scroll = true,
  loading = false,
  onRefresh,
  refreshing = false,
}) {
  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.brand[600]} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const Wrapper = scroll ? ScrollView : View;
  const wrapperProps = scroll
    ? {
        contentContainerStyle: styles.scrollContent,
        refreshControl: onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand[600]} />
        ) : undefined,
      }
    : { style: styles.flexContent };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Wrapper {...wrapperProps}>{children}</Wrapper>
    </SafeAreaView>
  );
}

export function EmptyState({ text }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  flexContent: { flex: 1, padding: spacing.lg },
  empty: { paddingVertical: spacing.xxl, alignItems: "center" },
  emptyText: { color: colors.textMuted, fontSize: 14 },
});
