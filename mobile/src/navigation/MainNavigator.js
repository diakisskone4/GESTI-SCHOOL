import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import DashboardScreen from "../screens/dashboard/DashboardScreen";
import NotesScreen from "../screens/notes/NotesScreen";
import BulletinsScreen from "../screens/bulletins/BulletinsScreen";
import AbsencesScreen from "../screens/absences/AbsencesScreen";
import DocumentsScreen from "../screens/documents/DocumentsScreen";
import PdfViewerScreen from "../screens/documents/PdfViewerScreen";
import ProfileScreen from "../screens/profile/ProfileScreen";
import { ChildProvider } from "../context/ChildContext";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/colors";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function stackWithPdfViewer(name, Component, title) {
  return function StackScreen() {
    return (
      <Stack.Navigator>
        <Stack.Screen name={`${name}List`} component={Component} options={{ title, headerShown: false }} />
        <Stack.Screen
          name="PdfViewer"
          component={PdfViewerScreen}
          options={({ route }) => ({ title: route.params?.title || "Document" })}
        />
      </Stack.Navigator>
    );
  };
}

const BulletinsStack = stackWithPdfViewer("Bulletins", BulletinsScreen, "Bulletins");
const DocumentsStack = stackWithPdfViewer("Documents", DocumentsScreen, "Documents");

const TAB_ICONS = {
  Accueil: "home-outline",
  Notes: "school-outline",
  Bulletins: "document-text-outline",
  Absences: "alert-circle-outline",
  Documents: "folder-outline",
  Profil: "person-outline",
};

export default function MainNavigator() {
  const { user } = useAuth();
  const isEleveOuParent = user?.est_eleve || user?.est_parent;

  return (
    <ChildProvider>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: colors.brand[600],
          tabBarInactiveTintColor: colors.textMuted,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={TAB_ICONS[route.name]} size={size} color={color} />
          ),
        })}
      >
        <Tab.Screen name="Accueil" component={DashboardScreen} />
        {isEleveOuParent && (
          <>
            <Tab.Screen name="Notes" component={NotesScreen} />
            <Tab.Screen name="Bulletins" component={BulletinsStack} />
            <Tab.Screen name="Absences" component={AbsencesScreen} />
            <Tab.Screen name="Documents" component={DocumentsStack} />
          </>
        )}
        <Tab.Screen name="Profil" component={ProfileScreen} />
      </Tab.Navigator>
    </ChildProvider>
  );
}
