import { useState } from "react";
import { ChevronDown, ChevronLeft, GraduationCap, LogOut, Search, Settings, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth, ROLE_LABELS } from "../../context/AuthContext";
import NotificationBell from "./NotificationBell";
import EtablissementSwitcher from "./EtablissementSwitcher";
import { infosPage } from "./navConfig";

export default function Topbar() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { titre, retour } = infosPage(pathname);

  const handleLogout = async () => {
    await logout();
    navigate("/connexion");
  };

  const initials = user ? `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase() : "";

  return (
    <header className="app-topbar sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-100 bg-surface/85 px-4 py-2.5 backdrop-blur-xl lg:px-8 lg:py-3">
      {/* Mobile / tablette : barre d'application (retour ou logo + titre de la page) */}
      <div className="flex min-w-0 items-center gap-2 lg:hidden">
        {retour ? (
          <button onClick={() => navigate(retour)} className="-ml-2 rounded-full p-1.5 text-brand-600 active:bg-brand-50" aria-label="Retour">
            <ChevronLeft size={26} />
          </button>
        ) : (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
            <GraduationCap size={18} />
          </div>
        )}
        <h1 className="truncate text-[17px] font-bold text-slate-800">{titre}</h1>
      </div>

      <div className="hidden items-center gap-3 lg:flex">
        <EtablissementSwitcher />
        <div className="flex w-72 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400">
          <Search size={16} />
          <input
            placeholder="Rechercher un élève, une classe..."
            className="w-full bg-transparent outline-none placeholder:text-slate-400"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <NotificationBell />

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2.5 rounded-xl px-1 py-1 hover:bg-slate-100 sm:px-2 sm:py-1.5"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
              {initials || <User size={16} />}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-semibold leading-none text-slate-800">{user?.full_name}</p>
              <p className="mt-1 text-xs text-slate-400">{ROLE_LABELS[user?.role] ?? user?.role}</p>
            </div>
            <ChevronDown size={16} className="hidden text-slate-400 sm:block" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-100 bg-white py-1.5 shadow-[var(--shadow-card-hover)]">
              <button
                onClick={() => { setMenuOpen(false); navigate("/profil"); }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                <Settings size={16} /> Mon profil
              </button>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-rose-600 hover:bg-rose-50"
              >
                <LogOut size={16} /> Déconnexion
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
