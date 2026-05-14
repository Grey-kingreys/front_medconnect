"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  getNotifications,
  markAllAsRead,
  markNotificationAsRead,
  deleteNotification,
  clearReadNotifications,
  Notification,
} from "@/lib/api_notifications";
import {
  Bell,
  BellRing,
  X,
  CheckCheck,
  Trash2,
  AlertTriangle,
  MessageSquare,
  Calendar,
  ShieldAlert,
  Info,
  ChevronRight,
  Loader2,
} from "lucide-react";
import Link from "next/link";

// ─── Icône par type ────────────────────────────────────────────────
function NotifIcon({ type }: { type: Notification["type"] }) {
  const icons: Record<Notification["type"], React.ReactNode> = {
    SOS_DECLENCHE: <ShieldAlert className="w-4 h-4" />,
    SOS_PRIS_EN_CHARGE: <ShieldAlert className="w-4 h-4" />,
    SOS_ALERTE: <AlertTriangle className="w-4 h-4" />,
    RENDEZ_VOUS: <Calendar className="w-4 h-4" />,
    MESSAGE: <MessageSquare className="w-4 h-4" />,
    SYSTEME: <Info className="w-4 h-4" />,
    CATALOGUE_MODIF: <Info className="w-4 h-4" />,
    STOCK_ALERTE: <AlertTriangle className="w-4 h-4" />,
    EXPIRATION_ALERTE: <AlertTriangle className="w-4 h-4" />,
    NOUVELLE_ORDONNANCE: <MessageSquare className="w-4 h-4" />,
  };

  const colors: Record<Notification["type"], string> = {
    SOS_DECLENCHE: "bg-emerald-500/15 text-emerald-500",
    SOS_PRIS_EN_CHARGE: "bg-emerald-500/15 text-emerald-500",
    SOS_ALERTE: "bg-red-500/15 text-red-500",
    RENDEZ_VOUS: "bg-blue-500/15 text-blue-500",
    MESSAGE: "bg-primary-500/15 text-primary-500",
    SYSTEME: "bg-slate-500/15 text-slate-500",
    CATALOGUE_MODIF: "bg-purple-500/15 text-purple-500",
    STOCK_ALERTE: "bg-orange-500/15 text-orange-500",
    EXPIRATION_ALERTE: "bg-amber-500/15 text-amber-500",
    NOUVELLE_ORDONNANCE: "bg-teal-500/15 text-teal-500",
  };

  return (
    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${colors[type]}`}>
      {icons[type]}
    </div>
  );
}

// ─── Formatage heure relative ──────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Il y a ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `Il y a ${days}j`;
}

// ─── Composant principal ───────────────────────────────────────────
export default function NotificationBell({ 
  direction = "down", 
  align = "right" 
}: { 
  direction?: "down" | "up",
  align?: "left" | "right"
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [nonLues, setNonLues] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifs = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await getNotifications();
      setNotifications(res.data.notifications);
      setNonLues(res.data.nonLues);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch on mount and every 30s
  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifs]);

  // Fetch when panel opens
  useEffect(() => {
    if (open) fetchNotifs();
  }, [open, fetchNotifs]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleMarkAllRead = async () => {
    setActionLoading("all");
    try {
      await markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, lu: true })));
      setNonLues(0);
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkRead = async (id: string) => {
    setActionLoading(id);
    try {
      await markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, lu: true } : n))
      );
      setNonLues((prev) => Math.max(0, prev - 1));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string, wasUnread: boolean) => {
    setActionLoading(`del-${id}`);
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (wasUnread) setNonLues((prev) => Math.max(0, prev - 1));
    } finally {
      setActionLoading(null);
    }
  };

  const handleClearRead = async () => {
    setActionLoading("clear");
    try {
      await clearReadNotifications();
      setNotifications((prev) => prev.filter((n) => !n.lu));
    } finally {
      setActionLoading(null);
    }
  };

  if (!user) return null;

  return (
    <div className="relative" ref={panelRef}>
      {/* ─── Bell Button ─── */}
      <button
        id="notification-bell-btn"
        onClick={() => setOpen((v) => !v)}
        className={`
          relative p-2.5 rounded-xl transition-all duration-200
          ${open
            ? "bg-primary-500/10 text-primary-500"
            : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-white"
          }
        `}
        aria-label="Notifications"
        title="Notifications"
      >
        {nonLues > 0 ? (
          <BellRing className="w-5 h-5 animate-[wiggle_1s_ease-in-out_infinite]" />
        ) : (
          <Bell className="w-5 h-5" />
        )}

        {/* Badge compteur */}
        {nonLues > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-[#0a0f1e] animate-in zoom-in duration-300">
            {nonLues > 9 ? "9+" : nonLues}
          </span>
        )}
      </button>

      {/* ─── Dropdown Panel ─── */}
      {open && (
        <div className={`
          fixed sm:absolute inset-x-4 sm:inset-auto
          ${direction === "up" ? "bottom-full mb-2" : "top-16 sm:top-full sm:mt-2"}
          ${align === "left" ? "sm:left-0" : "sm:right-0"}
          sm:w-[380px] max-h-[calc(100vh-100px)] sm:max-h-[520px]
          bg-white dark:bg-[#0f172a] rounded-3xl shadow-2xl shadow-black/20 border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95
          ${direction === "up" ? "slide-in-from-bottom-2" : "slide-in-from-top-2"}
          duration-200 z-[200] flex flex-col
        `}>
          
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary-500" />
              <h3 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-wide">
                Notifications
              </h3>
              {nonLues > 0 && (
                <span className="px-2 py-0.5 bg-red-500/10 text-red-500 text-[10px] font-black rounded-full">
                  {nonLues} non lue{nonLues > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {nonLues > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={actionLoading === "all"}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-primary-500 hover:bg-primary-500/10 transition-colors"
                  title="Tout marquer comme lu"
                >
                  {actionLoading === "all" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCheck className="w-4 h-4" />
                  )}
                </button>
              )}
              {notifications.some((n) => n.lu) && (
                <button
                  onClick={handleClearRead}
                  disabled={actionLoading === "clear"}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                  title="Supprimer les lues"
                >
                  {actionLoading === "clear" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Liste */}
          <div className="overflow-y-auto flex-1 custom-scrollbar">
            {loading && notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
                <p className="text-xs text-slate-400">Chargement...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 px-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                  <Bell className="w-7 h-7" />
                </div>
                <div>
                  <p className="font-bold text-sm text-slate-600 dark:text-slate-300">
                    Aucune notification
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Vous êtes à jour !
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`
                      group relative flex items-start gap-3 px-4 py-3.5 transition-colors
                      ${!notif.lu
                        ? "bg-primary-500/5 hover:bg-primary-500/8"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/30"
                      }
                    `}
                  >
                    {/* Indicateur non lu */}
                    {!notif.lu && (
                      <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-primary-500 rounded-full" />
                    )}

                    <NotifIcon type={notif.type} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-xs font-bold leading-tight ${!notif.lu ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-300"}`}>
                          {notif.titre}
                        </p>
                        <span className="text-[10px] text-slate-400 shrink-0 mt-0.5">
                          {timeAgo(notif.createdAt)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed line-clamp-2">
                        {notif.message}
                      </p>

                      {/* Actions en bas */}
                      <div className="flex items-center gap-2 mt-2">
                        {notif.lien && (
                          <Link
                            href={notif.lien}
                            onClick={() => {
                              if (!notif.lu) handleMarkRead(notif.id);
                              setOpen(false);
                            }}
                            className="flex items-center gap-1 text-[10px] font-bold text-primary-500 hover:text-primary-600 transition-colors"
                          >
                            Voir <ChevronRight className="w-3 h-3" />
                          </Link>
                        )}
                        {!notif.lu && (
                          <button
                            onClick={() => handleMarkRead(notif.id)}
                            disabled={actionLoading === notif.id}
                            className="text-[10px] font-bold text-slate-400 hover:text-emerald-500 transition-colors"
                          >
                            {actionLoading === notif.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              "Marquer lu"
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Bouton supprimer */}
                    <button
                      onClick={() => handleDelete(notif.id, !notif.lu)}
                      disabled={actionLoading === `del-${notif.id}`}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-500/10 transition-all shrink-0 mt-0.5"
                    >
                      {actionLoading === `del-${notif.id}` ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <X className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <p className="text-center text-[10px] text-slate-400">
                {notifications.length} notification{notifications.length > 1 ? "s" : ""} au total
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
