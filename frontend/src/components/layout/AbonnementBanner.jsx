import { CalendarClock } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

/** Prévient l'administrateur quand l'accès de son établissement arrive à échéance (30 jours ou moins). */
export default function AbonnementBanner() {
  const { user } = useAuth();
  const ab = user?.abonnement;
  if (!ab || ab.statut !== "actif" || ab.jours_restants > 30) return null;
  return (
    <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 lg:px-8">
      <CalendarClock size={16} className="shrink-0" />
      <span>
        L'accès de votre établissement expire le <strong>{new Date(ab.date_fin).toLocaleDateString("fr-FR")}</strong>
        {" "}({ab.jours_restants} jour{ab.jours_restants > 1 ? "s" : ""}). Contactez l'équipe Gesti-Scolaire pour le prolonger.
      </span>
    </div>
  );
}
