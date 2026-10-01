import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, GraduationCap, Loader2, Lock, Mail, Phone, UserRound } from "lucide-react";
import { authApi, etablissementsApi } from "../../api/endpoints";
import { useFetch } from "../../hooks/useFetch";
import { extractErrorMessage } from "../../context/ToastContext";
import authBg from "../../assets/auth-bg.jpg";
import authBgMobile from "../../assets/auth-bg-mobile.jpg";

const PUBLIC_ROLES = [
  { value: "eleve", label: "Élève" },
  { value: "parent", label: "Parent" },
];

const STAFF_ROLES = [
  { value: "enseignant", label: "Enseignant" },
  { value: "comptable", label: "Comptable" },
  { value: "surveillant", label: "Surveillant" },
  { value: "admin", label: "Administrateur" },
];

export default function Register() {
  const { role: requestedRole } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", telephone: "", password: "", password_confirm: "",
    role: PUBLIC_ROLES.some((item) => item.value === requestedRole) ? requestedRole : "eleve",
    etablissement_courant: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const estRoleStaff = STAFF_ROLES.some((role) => role.value === form.role);
  const { data: etablissementsData } = useFetch(
    () => (estRoleStaff ? etablissementsApi.list() : Promise.resolve({ results: [] })),
    [estRoleStaff],
  );
  const etablissements = etablissementsData?.results || [];

  useEffect(() => {
    if (PUBLIC_ROLES.some((item) => item.value === requestedRole)) {
      setForm((current) => ({ ...current, role: requestedRole }));
    }
  }, [requestedRole]);

  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await authApi.register({ ...form, etablissement_courant: form.etablissement_courant || null });
      navigate("/connexion", { replace: true, state: { registered: true } });
    } catch (err) {
      setError(extractErrorMessage(err) || "Impossible de créer le compte.");
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
      <div className="relative w-full max-w-lg">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/30">
            <GraduationCap size={28} />
          </div>
          <h1 className="text-2xl font-bold text-white drop-shadow">Créer votre compte</h1>
          <p className="mt-1 text-sm text-white/85 drop-shadow">Choisissez votre rôle dans Gesti-Scolaire</p>
        </div>

        <form onSubmit={handleSubmit} className="card bg-white/95 p-6 shadow-2xl backdrop-blur sm:p-8">
          {error && <div className="mb-4 rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-600">{error}</div>}

          <label className="label" htmlFor="role">Rôle</label>
          <select id="role" name="role" value={form.role} onChange={update} className="input mb-4">
            <optgroup label="Inscription libre">
              {PUBLIC_ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
            </optgroup>
            <optgroup label="Créé par un administrateur">
              {STAFF_ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
            </optgroup>
          </select>

          {estRoleStaff && (
            <>
              <label className="label" htmlFor="etablissement_courant">Établissement</label>
              <select
                id="etablissement_courant" name="etablissement_courant" required
                value={form.etablissement_courant} onChange={update} className="input mb-4"
              >
                <option value="">Sélectionner...</option>
                {etablissements.map((etab) => <option key={etab.id} value={etab.id}>{etab.nom}</option>)}
              </select>
            </>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="first_name">Prénom</label><div className="relative"><UserRound size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input id="first_name" name="first_name" required value={form.first_name} onChange={update} className="input pl-10" /></div></div>
            <div><label className="label" htmlFor="last_name">Nom</label><input id="last_name" name="last_name" required value={form.last_name} onChange={update} className="input" /></div>
          </div>

          <label className="label mt-4" htmlFor="email">Adresse email</label>
          <div className="relative mb-4"><Mail size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input id="email" name="email" type="email" required value={form.email} onChange={update} className="input pl-10" /></div>

          <label className="label" htmlFor="telephone">Téléphone</label>
          <div className="relative mb-4"><Phone size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input id="telephone" name="telephone" type="tel" value={form.telephone} onChange={update} className="input pl-10" /></div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="password">Mot de passe</label><div className="relative"><Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input id="password" name="password" type="password" minLength="8" required value={form.password} onChange={update} className="input pl-10" /></div></div>
            <div><label className="label" htmlFor="password_confirm">Confirmation</label><input id="password_confirm" name="password_confirm" type="password" minLength="8" required value={form.password_confirm} onChange={update} className="input" /></div>
          </div>

          {STAFF_ROLES.some((role) => role.value === form.role) && <p className="mt-3 text-xs text-amber-700">Ce compte doit être créé par un administrateur connecté.</p>}
          <button type="submit" disabled={loading} className="btn-primary mt-6 w-full">{loading && <Loader2 size={16} className="animate-spin" />}Créer le compte</button>
          <Link to="/connexion" className="btn-ghost mt-3 w-full"><ArrowLeft size={16} />Retour à la connexion</Link>
        </form>
      </div>
    </div>
  );
}