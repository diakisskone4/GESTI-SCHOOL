import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  ImageBackground,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { authApi } from "../../api/endpoints";
import { colors, radius, spacing } from "../../theme/colors";

const authBg = require("../../../assets/auth-bg.jpg");

// Seuls les rôles élève et parent peuvent s'auto-inscrire (voir RegisterView côté
// backend) ; les comptes personnel/admin doivent être créés par un administrateur
// depuis l'application web, donc ce rôle n'est pas proposé ici.
const ROLES = [
  { value: "eleve", label: "Élève" },
  { value: "parent", label: "Parent" },
];

const initialForm = {
  first_name: "",
  last_name: "",
  email: "",
  telephone: "",
  password: "",
  password_confirm: "",
  role: "eleve",
};

export default function RegisterScreen({ navigation }) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async () => {
    if (!form.first_name || !form.last_name || !form.email || !form.password) {
      setError("Veuillez remplir tous les champs obligatoires.");
      return;
    }
    if (form.password !== form.password_confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await authApi.register(form);
      navigation.replace("Login", { registered: true });
    } catch (err) {
      const data = err?.response?.data;
      const detail =
        (data && typeof data === "object" && Object.values(data)[0]?.[0]) ||
        data?.detail ||
        "Impossible de créer le compte.";
      setError(String(detail));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ImageBackground source={authBg} style={styles.background} resizeMode="cover">
      <View style={styles.overlay} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Pressable style={styles.backRow} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={18} color={colors.white} />
            <Text style={styles.backText}>Retour à la connexion</Text>
          </Pressable>

          <View style={styles.card}>
            <Text style={styles.title}>Créer votre compte</Text>
            <Text style={styles.subtitle}>Inscription élève ou parent</Text>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>Je suis...</Text>
            <View style={styles.roleRow}>
              {ROLES.map((role) => {
                const active = form.role === role.value;
                return (
                  <Pressable
                    key={role.value}
                    onPress={() => update("role", role.value)}
                    style={[styles.roleChip, active && styles.roleChipActive]}
                  >
                    <Text style={[styles.roleChipText, active && styles.roleChipTextActive]}>{role.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.rowTwo}>
              <View style={styles.half}>
                <Text style={styles.label}>Prénom</Text>
                <TextInput
                  style={styles.input}
                  value={form.first_name}
                  onChangeText={(v) => update("first_name", v)}
                />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>Nom</Text>
                <TextInput
                  style={styles.input}
                  value={form.last_name}
                  onChangeText={(v) => update("last_name", v)}
                />
              </View>
            </View>

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={form.email}
              onChangeText={(v) => update("email", v)}
            />

            <Text style={styles.label}>Téléphone</Text>
            <TextInput
              style={styles.input}
              keyboardType="phone-pad"
              value={form.telephone}
              onChangeText={(v) => update("telephone", v)}
            />

            <View style={styles.rowTwo}>
              <View style={styles.half}>
                <Text style={styles.label}>Mot de passe</Text>
                <TextInput
                  style={styles.input}
                  secureTextEntry
                  value={form.password}
                  onChangeText={(v) => update("password", v)}
                />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>Confirmation</Text>
                <TextInput
                  style={styles.input}
                  secureTextEntry
                  value={form.password_confirm}
                  onChangeText={(v) => update("password_confirm", v)}
                />
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Créer le compte</Text>}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: colors.brand[900] },
  flex: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15, 23, 42, 0.2)" },
  container: { flexGrow: 1, padding: spacing.xl, paddingTop: 220 },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
  },
  backText: { color: colors.white, fontSize: 14, fontWeight: "600" },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 20, fontWeight: "700", color: colors.text, marginBottom: 2 },
  subtitle: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.lg },
  errorBox: { backgroundColor: colors.roseBg, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  errorText: { color: colors.rose, fontSize: 13 },
  label: { fontSize: 13, fontWeight: "600", color: colors.text, marginBottom: 6, marginTop: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  rowTwo: { flexDirection: "row", gap: spacing.md },
  half: { flex: 1 },
  roleRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  roleChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  roleChipActive: { backgroundColor: colors.brand[600], borderColor: colors.brand[600] },
  roleChipText: { fontSize: 14, fontWeight: "600", color: colors.text },
  roleChipTextActive: { color: colors.white },
  button: {
    backgroundColor: colors.brand[600],
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: spacing.xl,
  },
  buttonPressed: { backgroundColor: colors.brand[700] },
  buttonText: { color: colors.white, fontWeight: "700", fontSize: 15 },
});
