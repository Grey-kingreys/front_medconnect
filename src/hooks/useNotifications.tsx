"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  clearReadNotifications,
  deleteNotification,
  getNotifications,
  markAllAsRead,
  markNotificationAsRead,
  type Notification,
} from "@/lib/api_notifications";

/** Intervalle du sondage des notifications, onglet visible seulement. */
export const INTERVALLE_SONDAGE_NOTIFICATIONS_MS = 30_000;

export interface ContexteNotifications {
  notifications: Notification[];
  nonLues: number;
  /** Vrai tant que la première réponse (ou le premier échec) n'est pas arrivée. */
  premierChargement: boolean;
  rafraichir: () => Promise<void>;
  marquerToutLu: () => Promise<void>;
  marquerLu: (id: string) => Promise<void>;
  supprimer: (id: string, etaitNonLue: boolean) => Promise<void>;
  supprimerLues: () => Promise<void>;
}

const NotificationsContext = createContext<ContexteNotifications | null>(null);

/**
 * Source unique des notifications du tableau de bord : un seul sondage par onglet,
 * suspendu quand l'onglet est caché, partagé par toutes les cloches (D06, D07).
 * Monté une fois dans app/dashboard/layout.tsx, avec `key={user.id}`.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [nonLues, setNonLues] = useState(0);
  const [premierChargement, setPremierChargement] = useState(true);
  const enCours = useRef(false);

  const rafraichir = useCallback(async () => {
    // Pas de requête en parallèle (ouverture du panneau pendant un sondage)
    if (enCours.current) return;
    enCours.current = true;
    try {
      const res = await getNotifications();
      setNotifications(res.data.notifications);
      setNonLues(res.data.nonLues);
    } catch {
      // Échec silencieux : la liste précédente reste affichée, nouvel essai au prochain passage
    } finally {
      enCours.current = false;
      setPremierChargement(false);
    }
  }, []);

  useEffect(() => {
    let minuteur: ReturnType<typeof setInterval> | null = null;
    const arreter = () => {
      if (minuteur !== null) {
        clearInterval(minuteur);
        minuteur = null;
      }
    };
    const demarrer = () => {
      if (minuteur !== null) return;
      void rafraichir();
      minuteur = setInterval(() => void rafraichir(), INTERVALLE_SONDAGE_NOTIFICATIONS_MS);
    };
    const surChangementVisibilite = () => (document.visibilityState === "hidden" ? arreter() : demarrer());

    surChangementVisibilite();
    document.addEventListener("visibilitychange", surChangementVisibilite);
    return () => {
      arreter();
      document.removeEventListener("visibilitychange", surChangementVisibilite);
    };
  }, [rafraichir]);

  const marquerToutLu = useCallback(async () => {
    await markAllAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, lu: true })));
    setNonLues(0);
  }, []);

  const marquerLu = useCallback(async (id: string) => {
    await markNotificationAsRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, lu: true } : n)));
    setNonLues((prev) => Math.max(0, prev - 1));
  }, []);

  const supprimer = useCallback(async (id: string, etaitNonLue: boolean) => {
    await deleteNotification(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (etaitNonLue) setNonLues((prev) => Math.max(0, prev - 1));
  }, []);

  const supprimerLues = useCallback(async () => {
    await clearReadNotifications();
    setNotifications((prev) => prev.filter((n) => !n.lu));
  }, []);

  const valeur = useMemo(
    () => ({ notifications, nonLues, premierChargement, rafraichir, marquerToutLu, marquerLu, supprimer, supprimerLues }),
    [notifications, nonLues, premierChargement, rafraichir, marquerToutLu, marquerLu, supprimer, supprimerLues]
  );

  return <NotificationsContext.Provider value={valeur}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): ContexteNotifications {
  const contexte = useContext(NotificationsContext);
  if (!contexte) {
    throw new Error("useNotifications doit être utilisé dans un NotificationsProvider");
  }
  return contexte;
}
