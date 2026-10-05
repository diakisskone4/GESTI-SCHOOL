import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { ChevronRight, LayoutGrid, LogOut, Settings, User, X } from "lucide-react";
import { useAuth, ROLE_LABELS } from "../../context/AuthContext";
import { messagesApi } from "../../api/endpoints";
import { MOBILE_TABS, sectionsPourRole } from "./navConfig";
import EtablissementSwitcher from "./EtablissementSwitcher";

const POLL_MS = 60_000;

/** Petite vibration au toucher (Android) pour un ressenti d'application native. */
const vibrer = () => navigator.vibrate?.(8);

/** Barre d'onglets en bas de l'écran (mobile et tablette), comme une application native. */
export default function MobileTabBar() {
  const { user } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [nonLus, setNonLus] = useState(0);
  const tabs = MOBILE_TABS[user?.role] || MOBILE_TABS.eleve;

  // Badge des messages non lus
  useEffect(() => {
    let actif = true;
    const charger = () =>
      messagesApi.nonLus().then((r) => actif && setNonLus(r.non_lus || 0)).catch(() => {});
    charger();
    const id = setInterval(charger, POLL_MS);
    return () => { actif = false; clearInterval(id); };
  }, [location.pathname]);

  // Fermer le menu quand on change de page
  useEffect(() => setMenuOpen(false), [location.pathname]);

  const ongletActif = (to) => (to === "/" ? location.pathname === "/" : location.pathname.startsWith(to));
  const menuActif = menuOpen || !tabs.some((t) => ongletActif(t.to));

  return (
    <>
      <nav className="mobile-tabbar fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/90 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-xl items-stretch justify-around">
          {tabs.map(({ label, to, icon: Icon, badge }) => {
            const actif = ongletActif(to) && !menuOpen;
            return (
              <NavLink key={to} to={to} end={to === "/"} onClick={vibrer} className="tab-item">
                <span className={`tab-icon ${actif ? "bg-brand-100 text-brand-600" : "text-slate-400"}`}>
                  <Icon size={21} strokeWidth={actif ? 2.4 : 2} />
                  {badge === "messages" && nonLus > 0 && (
                    <span className="absolute -right-1 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                      {nonLus > 9 ? "9+" : nonLus}
                    </span>
                  )}
                </span>
                <span className={`text-[11px] ${actif ? "font-semibold text-brand-600" : "font-medium text-slate-500"}`}>{label}</span>
              </NavLink>
            );
          })}
          <button onClick={() => { vibrer(); setMenuOpen((v) => !v); }} className="tab-item">
            <span className={`tab-icon ${menuActif ? "bg-brand-100 text-brand-600" : "text-slate-400"}`}>
              <LayoutGrid size={21} strokeWidth={menuActif ? 2.4 : 2} />
            </span>
            <span className={`text-[11px] ${menuActif ? "font-semibold text-brand-600" : "font-medium text-slate-500"}`}>Menu</span>
          </button>
        </div>
      </nav>

      <MenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}

/** Panneau « Menu » : profil, toutes les rubriques accessibles au rôle, déconnexion. */
function MenuSheet({ open, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!open) return null;

  const initials = `${user?.first_name?.[0] ?? ""}${user?.last_name?.[0] ?? ""}`.toUpperCase();
  const sections = sectionsPourRole(user?.role);

  const deconnexion = async () => {
    await logout();
    navigate("/connexion");
  };

  return (
    <div className="fixed inset-0 z-30 lg:hidden" role="dialog" aria-modal="true">
      <div className="sheet-backdrop absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="sheet-panel absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-3xl bg-canvas pb-[calc(4.5rem+env(safe-area-inset-bottom))] shadow-2xl">
        <div className="flex justify-center pt-2.5"><span className="h-1.5 w-10 rounded-full bg-slate-300" /></div>
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <p className="text-lg font-bold text-slate-800">Menu</p>
          <button onClick={onClose} className="rounded-full bg-slate-200/70 p-1.5 text-slate-500" aria-label="Fermer">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 pb-4">
          <button
            onClick={() => navigate("/profil")}
            className="press flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-sm"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-base font-bold text-brand-700">
              {initials || <User size={20} />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-slate-800">{user?.full_name}</p>
              <p className="text-xs text-slate-500">{ROLE_LABELS[user?.role] ?? user?.role}</p>
            </div>
            <ChevronRight size={18} className="text-slate-300" />
          </button>

          <EtablissementSwitcher variante="liste" />

          {sections.map((section) => (
            <div key={section.title}>
              <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{section.title}</p>
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                {section.items.map(({ label, to, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === "/"}
                    onClick={vibrer}
                    className={({ isActive }) =>
                      `press flex flex-col items-center gap-2 rounded-2xl p-3 text-center shadow-sm ${
                        isActive ? "bg-brand-600 text-white" : "bg-white text-slate-700"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${isActive ? "bg-white/20" : "bg-brand-50 text-brand-600"}`}>
                          <Icon size={20} />
                        </span>
                        <span className="text-[11px] font-medium leading-tight">{label}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}

          <div className="space-y-2">
            <button onClick={() => navigate("/profil")} className="press flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-sm font-medium text-slate-700 shadow-sm">
              <Settings size={18} className="text-slate-400" /> Mon profil et mot de passe
            </button>
            <button onClick={deconnexion} className="press flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-sm font-semibold text-rose-600 shadow-sm">
              <LogOut size={18} /> Déconnexion
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
