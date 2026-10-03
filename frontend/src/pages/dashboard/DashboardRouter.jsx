import { useAuth } from "../../context/AuthContext";
import AdminDashboard from "./AdminDashboard";
import TeacherDashboard from "./TeacherDashboard";
import StudentParentDashboard from "./StudentParentDashboard";
import SurveillantDashboard from "./SurveillantDashboard";

/** Affiche le tableau de bord adapté au rôle de l'utilisateur connecté. */
export default function DashboardRouter() {
  const { user } = useAuth();

  if (user?.role === "enseignant") return <TeacherDashboard />;
  if (user?.role === "surveillant") return <SurveillantDashboard />;
  if (user?.role === "eleve" || user?.role === "parent") return <StudentParentDashboard />;
  return <AdminDashboard />;
}
