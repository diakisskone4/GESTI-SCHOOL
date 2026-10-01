import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import ProtectedRoute from "./routes/ProtectedRoute";
import DashboardLayout from "./components/layout/DashboardLayout";

import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import DashboardRouter from "./pages/dashboard/DashboardRouter";
import EtablissementsPage from "./pages/core/EtablissementsPage";
import ClassesPage from "./pages/core/ClassesPage";
import AnneesScolairesPage from "./pages/core/AnneesScolairesPage";
import PeriodesPage from "./pages/core/PeriodesPage";
import EmploiDuTempsPage from "./pages/core/EmploiDuTempsPage";
import ElevesPage from "./pages/students/ElevesPage";
import EleveDetailPage from "./pages/students/EleveDetailPage";
import AbsencesPage from "./pages/students/AbsencesPage";
import CartesScolairesPage from "./pages/students/CartesScolairesPage";
import LiensParentsElevesPage from "./pages/students/LiensParentsElevesPage";
import EnseignantsPage from "./pages/staff/EnseignantsPage";
import BulletinsPage from "./pages/academics/BulletinsPage";
import DocumentsPage from "./pages/documents/DocumentsPage";
import FacturesPage from "./pages/finance/FacturesPage";
import PaiePage from "./pages/payroll/PaiePage";
import MessagesPage from "./pages/communication/MessagesPage";
import AnnoncesPage from "./pages/communication/AnnoncesPage";
import StatistiquesPage from "./pages/reporting/StatistiquesPage";
import ProfilePage from "./pages/profile/ProfilePage";
import UtilisateursPage from "./pages/accounts/UtilisateursPage";

const ADMIN_ROLES = ["admin", "superadmin"];
const FINANCE_ROLES = ["admin", "superadmin", "comptable"];
const ACADEMIC_ROLES = ["admin", "superadmin", "enseignant"];

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/connexion" element={<Login />} />
            <Route path="/inscription" element={<Register />} />
            <Route path="/inscription/:role" element={<Register />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<DashboardLayout />}>
                <Route path="/" element={<DashboardRouter />} />
                <Route path="/profil" element={<ProfilePage />} />
                <Route path="/messages" element={<MessagesPage />} />
                <Route path="/annonces" element={<AnnoncesPage />} />

                <Route element={<ProtectedRoute roles={ADMIN_ROLES} />}>
                  <Route path="/etablissements" element={<EtablissementsPage />} />
                  <Route path="/utilisateurs" element={<UtilisateursPage />} />
                  <Route path="/classes" element={<ClassesPage />} />
                  <Route path="/annees-scolaires" element={<AnneesScolairesPage />} />
                  <Route path="/periodes" element={<PeriodesPage />} />
                  <Route path="/emploi-du-temps" element={<EmploiDuTempsPage />} />
                  <Route path="/eleves" element={<ElevesPage />} />
                  <Route path="/eleves/:id" element={<EleveDetailPage />} />
                  <Route path="/liens-parents-eleves" element={<LiensParentsElevesPage />} />
                  <Route path="/enseignants" element={<EnseignantsPage />} />
                  <Route path="/cartes-scolaires" element={<CartesScolairesPage />} />
                  <Route path="/documents" element={<DocumentsPage />} />
                  <Route path="/statistiques" element={<StatistiquesPage />} />
                </Route>

                <Route element={<ProtectedRoute roles={ACADEMIC_ROLES} />}>
                  <Route path="/academique/bulletins" element={<BulletinsPage />} />
                  <Route path="/absences" element={<AbsencesPage />} />
                </Route>

                <Route element={<ProtectedRoute roles={FINANCE_ROLES} />}>
                  <Route path="/finance/factures" element={<FacturesPage />} />
                  <Route path="/paie" element={<PaiePage />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
