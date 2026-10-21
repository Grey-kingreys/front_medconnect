"use client";

import { createContext, useContext } from "react";
import { ApiError } from "@/lib/api_auth";

export type TypeNotification = "erreur" | "succes" | "info";

export interface ContexteToast {
  notifier: (message: string, type?: TypeNotification) => void;
}

export const ToastContext = createContext<ContexteToast | null>(null);

/**
 * Notifications à l'écran (D11) : `const { notifier } = useToast(); notifier("...", "erreur")`.
 * Le fournisseur (`components/Toast.tsx`) est monté dans le tableau de bord et dans les pages de connexion (`app/auth/layout.tsx`).
 */
export function useToast(): ContexteToast {
  const contexte = useContext(ToastContext);
  // Hors fournisseur : repli discret plutôt qu'un plantage de la page
  return contexte ?? { notifier: (message: string) => console.warn(`[Notification] ${message}`) };
}

/** Message à afficher pour une erreur : celui du serveur (déjà rédigé pour l'utilisateur), sinon le texte fourni. */
export const messageErreurPour = (err: unknown, texteParDefaut: string): string =>
  err instanceof ApiError && err.message ? err.message : texteParDefaut;
