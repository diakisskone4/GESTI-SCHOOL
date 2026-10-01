import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { GraduationCap, Loader2, Lock, Mail } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { extractErrorMessage } from "../../context/ToastContext";
import authBg from "../../assets/auth-bg.jpg";
import authBgMobile from "../../assets/auth-bg-mobile.jpg";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      const dest = location.state?.from?.pathname || "/";
      navigate(dest, { replace: true });
    } catch (err) {
      setError(extractErrorMessage(err) || "Identifiants invalides.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center bg-slate-900 bg-(image:--auth-bg-mobile) bg-cover bg-center px-4 lg:bg-(image:--auth-bg) py-8 lg:justify-end lg:px-16"
      style={{ "--auth-bg": `url(${authBg})`, "--auth-bg-mobile": `url(${authBgMobile})` }}
    >
      <div className="absolute inset-0 bg-slate-900/35 lg:bg-slate-900/20" />
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/30">
            <GraduationCap size={28} />
          </div>
          <h1 className="text-2xl font-bold text-white drop-shadow">Gesti-Scolaire</h1>
          <p className="mt-1 text-sm text-white/85 drop-shadow">Connectez-vous à votre espace ERP</p>
        </div>

        <form onSubmit={handleSubmit} className="card bg-white/95 p-6 shadow-2xl backdrop-blur sm:p-8">
          {error && (
            <div className="mb-4 rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-600">{error}</div>
          )}

          <label className="label" htmlFor="email">Adresse email</label>
          <div className="relative mb-4">
            <Mail size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@etablissement.ml"
              className="input pl-10"
            />
          </div>

          <label className="label" htmlFor="password">Mot de passe</label>
          <div className="relative mb-6">
            <Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input pl-10"
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading && <Loader2 size={16} className="animate-spin" />}
            Se connecter
          </button>

          <p className="mt-5 text-center text-sm text-slate-500">
            Pas encore de compte ?{" "}
            <Link to="/inscription" className="font-semibold text-brand-600 hover:text-brand-700">
              Créer un compte
            </Link>
          </p>

          <p className="mt-3 text-center text-xs text-slate-400">
            Compte de démonstration : admin@gesti-scolaire.local / Admin@1234
          </p>
        </form>
      </div>
    </div>
  );
}
