import { View, Text, Pressable, StyleSheet, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenContainer from "../../components/ui/ScreenContainer";
import { Card, SectionTitle } from "../../components/ui/Card";
import { useAuth, ROLE_LABELS } from "../../context/AuthContext";
import { colors, radius, spacing } from "../../theme/colors";

function InfoRow({ icon, label, value }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={16} color={colors.textMuted} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  const confirmLogout = () => {
    Alert.alert("Déconnexion", "Voulez-vous vraiment vous déconnecter ?", [
      { text: "Annuler", style: "cancel" },
      { text: "Se déconnecter", style: "destructive", onPress: logout },
    ]);
  };

  return (
    <ScreenContainer>
      <View style={styles.avatarWrap}>
        <View style={styles.avatar}>
          <Text style={styles.avatarInitials}>
            {(user?.first_name?.[0] || "") + (user?.last_name?.[0] || "")}
          </Text>
        </View>
        <Text style={styles.name}>{user?.full_name}</Text>
        <Text style={styles.role}>{ROLE_LABELS[user?.role] || user?.role}</Text>
      </View>

      <Card>
        <SectionTitle>Informations</SectionTitle>
        <InfoRow icon="mail-outline" label="Email" value={user?.email} />
        <InfoRow icon="call-outline" label="Téléphone" value={user?.telephone} />
      </Card>

      <Pressable style={styles.logoutButton} onPress={confirmLogout}>
        <Ionicons name="log-out-outline" size={18} color={colors.rose} />
        <Text style={styles.logoutText}>Se déconnecter</Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  avatarWrap: { alignItems: "center", marginBottom: spacing.lg },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.brand[600],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  avatarInitials: { color: colors.white, fontSize: 24, fontWeight: "700" },
  name: { fontSize: 17, fontWeight: "700", color: colors.text },
  role: { fontSize: 13, color: colors.textMuted },
  infoRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 8 },
  infoLabel: { fontSize: 13, color: colors.textMuted, width: 70 },
  infoValue: { fontSize: 13, color: colors.text, fontWeight: "600", flex: 1 },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.roseBg,
    borderRadius: radius.md,
    paddingVertical: 13,
    marginTop: spacing.md,
  },
  logoutText: { color: colors.rose, fontWeight: "700", fontSize: 14 },
});
