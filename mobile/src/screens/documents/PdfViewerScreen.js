import { useEffect, useState } from "react";
import { View, StyleSheet, ActivityIndicator, Text } from "react-native";
import { WebView } from "react-native-webview";
import { File, Paths } from "expo-file-system";
import { API_BASE_URL, tokenStore } from "../../api/client";
import { colors, spacing } from "../../theme/colors";

// Lecture seule : le PDF est téléchargé dans le cache de l'app (avec l'en-tête
// d'authentification) puis affiché depuis ce fichier local dans une WebView,
// sans jamais passer par un lien "ouvrir dans le navigateur" qui proposerait le
// téléchargement. Comme sur le web, cela reste une limite côté client (une
// capture d'écran reste possible) et non une protection absolue.
export default function PdfViewerScreen({ route }) {
  const { path } = route.params;
  const [fileUri, setFileUri] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const token = await tokenStore.getAccess();
        const destination = new File(Paths.cache, `gs_doc_${Date.now()}.pdf`);
        const file = await File.downloadFileAsync(`${API_BASE_URL}${path}`, destination, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          idempotent: true,
        });
        if (!cancelled) setFileUri(file.uri);
      } catch {
        if (!cancelled) setError("Impossible de charger le document.");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!fileUri) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.brand[600]} size="large" />
      </View>
    );
  }

  return (
    <WebView
      source={{ uri: fileUri }}
      style={styles.flex}
      originWhitelist={["*"]}
      renderLoading={() => <ActivityIndicator color={colors.brand[600]} size="large" />}
      startInLoadingState
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.white },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.white },
  errorText: { color: colors.rose, fontSize: 14, padding: spacing.lg, textAlign: "center" },
});
