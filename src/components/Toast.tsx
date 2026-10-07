"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { ToastContext, type TypeNotification } from "@/hooks/useToast";

const DUREE_AFFICHAGE_MS = 5_000;

interface Notification {
  id: number;
  message: string;
  type: TypeNotification;
}

// Une seule délimitation (ombre) ; la couleur ne porte que sur l'icône
const ICONES: Record<TypeNotification, ReactNode> = {
  erreur: <AlertCircle className="w-5 h-5 text-emergency-600 dark:text-emergency-500" aria-hidden="true" />,
  succes: <CheckCircle2 className="w-5 h-5 text-secondary-700 dark:text-secondary-400" aria-hidden="true" />,
  info: <Info className="w-5 h-5 text-primary-700 dark:text-primary-400" aria-hidden="true" />,
};

/** Fournisseur et affichage des notifications à l'écran (D11). */
export default function ToastProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const compteur = useRef(0);
  const minuteurs = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const fermer = useCallback((id: number) => {
    setNotifications((liste) => liste.filter((n) => n.id !== id));
    const minuteur = minuteurs.current.get(id);
    if (minuteur) clearTimeout(minuteur);
    minuteurs.current.delete(id);
  }, []);

  const notifier = useCallback(
    (message: string, type: TypeNotification = "info") => {
      const id = ++compteur.current;
      setNotifications((liste) => [...liste, { id, message, type }]);
      minuteurs.current.set(id, setTimeout(() => fermer(id), DUREE_AFFICHAGE_MS));
    },
    [fermer]
  );

  // Nettoyage des minuteurs au démontage
  useEffect(() => {
    const enCours = minuteurs.current;
    return () => enCours.forEach((minuteur) => clearTimeout(minuteur));
  }, []);

  const valeur = useMemo(() => ({ notifier }), [notifier]);

  return (
    <ToastContext.Provider value={valeur}>
      {children}
      {/* Empilées en haut à droite, en bas au centre sur mobile */}
      <div className="fixed z-[110] inset-x-4 bottom-4 flex flex-col items-center gap-2 pointer-events-none sm:inset-x-auto sm:bottom-auto sm:top-6 sm:right-6 sm:items-end">
        {notifications.map((n) => (
          <div
            key={n.id}
            role={n.type === "erreur" ? "alert" : "status"}
            className="pointer-events-auto w-full max-w-sm flex items-start gap-3 px-4 py-3 rounded-2xl shadow-lg bg-white dark:bg-slate-800 text-sm font-medium text-slate-900 dark:text-white animate-slide-up"
          >
            {ICONES[n.type]}
            <p className="flex-1 leading-snug">{n.message}</p>
            <button
              type="button"
              aria-label="Fermer la notification"
              onClick={() => fermer(n.id)}
              className="p-1 -m-1 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
