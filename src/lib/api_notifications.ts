import { authFetch } from "./api_auth";

export interface Notification {
  id: string;
  userId: string;
  type: 
    | "SOS_DECLENCHE" 
    | "SOS_PRIS_EN_CHARGE" 
    | "SOS_ALERTE" 
    | "RENDEZ_VOUS" 
    | "MESSAGE" 
    | "SYSTEME"
    | "CATALOGUE_MODIF"
    | "STOCK_ALERTE"
    | "EXPIRATION_ALERTE"
    | "NOUVELLE_ORDONNANCE";
  titre: string;
  message: string;
  lu: boolean;
  lien?: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  nonLues: number;
}

/** Récupérer mes notifications */
export const getNotifications = () =>
  authFetch<NotificationsResponse>("/notifications");

/** Marquer toutes comme lues */
export const markAllAsRead = () =>
  authFetch<null>("/notifications/read-all", { method: "PATCH" });

/** Marquer une notification comme lue */
export const markNotificationAsRead = (id: string) =>
  authFetch<null>(`/notifications/${id}/read`, { method: "PATCH" });

/** Supprimer une notification */
export const deleteNotification = (id: string) =>
  authFetch<null>(`/notifications/${id}`, { method: "DELETE" });

/** Supprimer les notifications lues */
export const clearReadNotifications = () =>
  authFetch<null>("/notifications/clear-read", { method: "DELETE" });
