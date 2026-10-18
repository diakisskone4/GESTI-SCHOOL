import { useNavigate } from "react-router-dom";
import { Lock, LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { ACCES_SUSPENDU_KEY } from "../../api/client";

/** Affichée quand l'abonnement de l'établissement est expiré ou a été désactivé par l'équipe. */
export default function AccesSuspendu() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  let message = "";
  try {
    message = sessionStorage.getItem(ACCES_SUSPENDU_KEY) || "";
  } catch {
    // stockage indisponible : message par défaut
  }

  const deconnexion = async () => {
    await logout();
    navigate("/connexion", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="card max-w-md p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"><Lock size={26} /></div>
        <h1 className="text-xl font-bold text-slate-800">Accès indisponible</h1>
        <p className="mt-2 text-sm text-slate-600">
          {message || "L'accès de votre établissement à Gesti-Scolaire est suspendu. Contactez l'équipe Gesti-Scolaire."}
        </p>
        <button onClick={deconnexion} className="btn-primary mt-6 w-full"><LogOut size={16} /> Se déconnecter</button>
      </div>
    </div>
  );
}
