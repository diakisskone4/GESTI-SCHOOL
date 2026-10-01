import { View, ActivityIndicator, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import AuthStack from "./AuthStack";
import MainNavigator from "./MainNavigator";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/colors";

export default function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.brand[600]} size="large" />
      </View>
    );
  }

  return <NavigationContainer>{user ? <MainNavigator /> : <AuthStack />}</NavigationContainer>;
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
});
