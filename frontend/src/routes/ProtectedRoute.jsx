import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/** Protège une branche de routes : nécessite une session valide,
 * et optionnellement un rôle parmi `roles`.
 * `espace` sépare les deux mondes : « ecole » (établissements) et « console » (équipe développeurs).
 * Un développeur est toujours renvoyé vers la console, et seul un développeur peut y entrer. */
export default function ProtectedRoute({ roles, espace = "ecole" }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/connexion" state={{ from: location }} replace />;
  }

  const estDeveloppeur = user.role === "developpeur";
  if (espace === "console" && !estDeveloppeur) return <Navigate to="/" replace />;
  if (espace === "ecole" && estDeveloppeur) return <Navigate to="/console" replace />;

  if (roles && !roles.includes(user.role) && !(user.role === "superadmin")) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
