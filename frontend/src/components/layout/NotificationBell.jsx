import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CalendarX, CheckCheck, Loader2, Mail, Megaphone, Wallet, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { notificationsApi } from "../../api/endpoints";

const POLL_MS = 60_000;

const TYPE_ICONS = {
  message: Mail,
  annonce: Megaphone,
  absence: CalendarX,
  paiement: Wallet,
};

function tempsRelatif(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 7 * 86400) return `il y a ${Math.floor(diff / 86400)} j`;
  return new Date(dateStr).toLocaleDateString("fr-FR");
}

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [nonLues, setNonLues] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  const refreshCount = useCallback(async () => {
    try {
      const { non_lues } = await notificationsApi.nonLues();
      setNonLues(non_lues);
    } catch {
      /* silencieux : la cloche ne doit jamais casser la barre supérieure */
    }
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await notificationsApi.list({ page: 1 });
      setItems(data?.results ?? data ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Compteur au chargement puis toutes les minutes
  useEffect(() => {
    refreshCount();
    const id = setInterval(refreshCount, POLL_MS);
    return () => clearInterval(id);
  }, [refreshCount]);

  // Fermer au clic à l'extérieur
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const toggle = () => {
    if (!open) {
      loadItems();
      refreshCount();
    }
    setOpen(!open);
  };

  const cible = (notif) => {
    if (notif.type_notification === "message") return "/messages";
    if (notif.type_notification === "annonce") return "/annonces";
    if (notif.type_notification === "absence" && ["admin", "superadmin", "enseignant"].includes(user?.role)) return "/absences";
    return null;
  };

  const handleClick = async (notif) => {
    if (!notif.lu) {
      setItems((list) => list.map((n) => (n.id === notif.id ? { ...n, lu: true } : n)));
      setNonLues((n) => Math.max(0, n - 1));
      notificationsApi.marquerLu(notif.id).catch(() => {});
    }
    const to = cible(notif);
    if (to) {
      setOpen(false);
      navigate(to);
    }
  };

  const toutMarquerLu = async () => {
    await notificationsApi.toutMarquerLu();
    setItems((list) => list.map((n) => ({ ...n, lu: true })));
    setNonLues(0);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        className="relative rounded-xl p-2.5 text-slate-500 hover:bg-slate-100"
        title="Notifications"
        aria-label={`Notifications${nonLues ? ` (${nonLues} non lues)` : ""}`}
      >
        <Bell size={19} />
        {nonLues > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white">
            {nonLues > 99 ? "99+" : nonLues}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl border border-slate-100 bg-white shadow-[var(--shadow-card-hover)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-800">Notifications</p>
            {nonLues > 0 && (
              <button onClick={toutMarquerLu} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
                <CheckCheck size={14} /> Tout marquer comme lu
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && (
              <div className="flex justify-center py-8">
                <Loader2 size={20} className="animate-spin text-slate-400" />
              </div>
            )}
            {!loading && items.length === 0 && (
              <div className="py-10 text-center text-sm text-slate-400">
                <Bell size={22} className="mx-auto mb-2 text-slate-300" />
                Aucune notification
              </div>
            )}
            {!loading &&
              items.map((notif) => {
                const Icon = TYPE_ICONS[notif.type_notification] || Info;
                return (
                  <button
                    key={notif.id}
                    onClick={() => handleClick(notif)}
                    className={`flex w-full gap-3 border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50 ${notif.lu ? "" : "bg-brand-50/40"}`}
                  >
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${notif.lu ? "bg-slate-100 text-slate-400" : "bg-brand-100 text-brand-600"}`}>
                      <Icon size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm ${notif.lu ? "text-slate-600" : "font-semibold text-slate-800"}`}>
                        {notif.titre || notif.type_label}
                      </p>
                      <p className="line-clamp-2 text-xs text-slate-500">{notif.contenu}</p>
                      <p className="mt-1 text-[11px] text-slate-400">{tempsRelatif(notif.created_at)}</p>
                    </div>
                    {!notif.lu && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
