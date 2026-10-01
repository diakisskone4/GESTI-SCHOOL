import { Navigate } from "react-router-dom";

/** Redirige directement vers l'onglet Périodes de la gestion unifiée du calendrier scolaire. */
export default function PeriodesPage() {
  return <Navigate to="/annees-scolaires?tab=periodes" replace />;
}