import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, XCircle, Info } from "lucide-react";

const ToastContext = createContext(null);

const ICONS = { success: CheckCircle2, error: XCircle, info: Info };
const STYLES = {
  success: "bg-emerald-600",
  error: "bg-rose-600",
  info: "bg-slate-800",
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const notify = useCallback((message, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map(({ id, message, type }) => {
          const Icon = ICONS[type];
          return (
            <div
              key={id}
              className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${STYLES[type]}`}
            >
              <Icon size={18} />
              {message}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast doit être utilisé à l'intérieur d'un ToastProvider");
  return ctx;
}

/** Extrait un message d'erreur lisible depuis une réponse Axios/DRF. */
// Libellés lisibles des champs renvoyés par l'API dans les messages d'erreur
const LIBELLES_CHAMPS = {
  email: "Email", telephone: "Téléphone", matricule: "Matricule", classe: "Classe", nom: "Nom",
  prenom: "Prénom", first_name: "Prénom", last_name: "Nom", date_naissance: "Date de naissance",
  password: "Mot de passe", password_confirm: "Confirmation", sexe: "Sexe", role: "Rôle",
  etablissement: "Établissement", etablissement_courant: "Établissement",
};

export function extractErrorMessage(error) {
  const data = error?.response?.data;
  if (!data) return error?.message || "Une erreur est survenue.";
  if (typeof data === "string") return data;
  if (data.detail) return data.detail;
  const firstKey = Object.keys(data)[0];
  const firstVal = Array.isArray(data[firstKey]) ? data[firstKey][0] : data[firstKey];
  const message = typeof firstVal === "object" && firstVal !== null ? Object.values(firstVal).flat()[0] : firstVal;
  if (firstKey === "non_field_errors") return String(message);
  return `${LIBELLES_CHAMPS[firstKey] || firstKey} : ${message}`;
}
