import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { plateformeApi } from "../../api/endpoints";
import { extractErrorMessage } from "../../context/ToastContext";

/** Inscription privée de l'équipe : page non référencée, qui exige le code d'invitation
 *  configuré sur le serveur (PLATEFORME_CODE_INVITATION). */
export default function InscriptionEquipe() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    code_invitation: "", first_name: "", last_name: "", email: "", password: "", password_confirm: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (champ) => (e) => setForm({ ...form, [champ]: e.target.value });

  const envoyer = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await plateformeApi.inscriptionEquipe(form);
      navigate("/connexion", { replace: true });
    } catch (err) {
      setError(err?.response?.status === 404 ? "L'inscription de l'équipe est fermée sur ce serveur." : extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center text-white">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600"><ShieldCheck size={28} /></div>
          <h1 className="text-2xl font-bold">Équipe Gesti-Scolaire</h1>
          <p className="mt-1 text-sm text-slate-400">Création d'un compte de la console</p>
        </div>
        <form onSubmit={envoyer} className="card space-y-4 p-6 sm:p-8">
          {error && <div className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-600">{error}</div>}
          <div>
            <label className="label">Code d'invitation</label>
            <div className="relative">
              <KeyRound size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input required type="password" autoComplete="off" className="input pl-10" value={form.code_invitation} onChange={set("code_invitation")} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">Prénom</label><input required className="input" value={form.first_name} onChange={set("first_name")} /></div>
            <div><label className="label">Nom</label><input required className="input" value={form.last_name} onChange={set("last_name")} /></div>
          </div>
          <div><label className="label">Email</label><input required type="email" className="input" value={form.email} onChange={set("email")} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">Mot de passe</label><input required type="password" minLength={8} className="input" value={form.password} onChange={set("password")} /></div>
            <div><label className="label">Confirmation</label><input required type="password" minLength={8} className="input" value={form.password_confirm} onChange={set("password_confirm")} /></div>
          </div>
          <button className="btn-primary w-full" disabled={loading}>{loading && <Loader2 size={16} className="animate-spin" />} Créer mon compte</button>
          <Link to="/connexion" className="btn-ghost w-full">Aller à la connexion</Link>
        </form>
      </div>
    </div>
  );
}
