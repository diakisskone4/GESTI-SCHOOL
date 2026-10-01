import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenContainer, { EmptyState } from "../../components/ui/ScreenContainer";
import { Card } from "../../components/ui/Card";
import { documentsGeneresApi, cartesScolairesApi } from "../../api/endpoints";
import { useChild } from "../../context/ChildContext";
import ChildSelector from "../../components/ui/ChildSelector";
import { colors, spacing } from "../../theme/colors";

function DocRow({ icon, title, subtitle, onPress }) {
  return (
    <Pressable onPress={onPress}>
      <Card style={styles.row}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={20} color={colors.brand[600]} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Card>
    </Pressable>
  );
}

export default function DocumentsScreen({ navigation }) {
  const { selected, loading: childLoading } = useChild();
  const [documents, setDocuments] = useState([]);
  const [cartes, setCartes] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [docsData, cartesData] = await Promise.all([
        documentsGeneresApi.list(),
        selected ? cartesScolairesApi.list({ inscription: selected.id }) : Promise.resolve([]),
      ]);
      const toArray = (d) => (Array.isArray(d) ? d : d.results || []);
      setDocuments(toArray(docsData));
      setCartes(toArray(cartesData));
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => {
    load();
  }, [load]);

  const hasContent = documents.length > 0 || cartes.length > 0;

  return (
    <ScreenContainer loading={childLoading} onRefresh={load} refreshing={loading}>
      <ChildSelector />
      {!hasContent ? (
        <EmptyState text="Aucun document disponible pour le moment." />
      ) : (
        <>
          {cartes.map((c) => (
            <DocRow
              key={`carte-${c.id}`}
              icon="card-outline"
              title="Carte scolaire"
              subtitle={`N° ${c.numero_carte}`}
              onPress={() =>
                navigation.navigate("PdfViewer", {
                  path: cartesScolairesApi.pdfPath(c.id),
                  title: "Carte scolaire",
                })
              }
            />
          ))}
          {documents.map((d) => (
            <DocRow
              key={`doc-${d.id}`}
              icon="document-outline"
              title={d.titre || d.type_document_libelle || `Document #${d.id}`}
              subtitle={d.type_document_libelle}
              onPress={() =>
                navigation.navigate("PdfViewer", {
                  path: documentsGeneresApi.pdfPath(d.id),
                  title: d.titre,
                })
              }
            />
          ))}
        </>
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
