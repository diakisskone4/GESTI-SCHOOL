import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Inbox, LayoutDashboard, LogOut, School, ShieldCheck, Users } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const ONGLETS = [
  { label: "Tableau de bord", to: "/console", icon: LayoutDashboard, end: true },
  { label: "Établissements", to: "/console/etablissements", icon: School },
  { label: "Demandes", to: "/console/demandes", icon: Inbox },
  { label: "Équipe", to: "/console/equipe", icon: Users },
];

/** Console de l'équipe développeurs : volontairement distincte de l'interface des établissements. */
export default function ConsoleLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const deconnexion = async () => {
    await logout();
    navigate("/connexion");
  };

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-20 bg-slate-900 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 lg:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600">
              <ShieldCheck size={19} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">Console Gesti-Scolaire</p>
              <p className="truncate text-xs text-slate-400">Espace réservé à l'équipe</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-right text-xs text-slate-300 sm:block">
              <span className="block font-semibold text-white">{user?.full_name}</span>
              {user?.email}
            </span>
            <button onClick={deconnexion} className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20">
              <LogOut size={14} /> Déconnexion
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 lg:px-8">
          {ONGLETS.map(({ label, to, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium ${
                  isActive ? "border-brand-400 text-white" : "border-transparent text-slate-400 hover:text-white"
                }`
              }
            >
              <Icon size={15} /> {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main key={pathname} className="page-enter mx-auto max-w-7xl px-4 py-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
