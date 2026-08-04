"use client";

import { useEffect } from "react";

/**
 * Enregistre le service worker minimal (`public/sw.js`), sans lequel
 * Chrome/Edge n'émettent jamais `beforeinstallprompt` : l'application ne serait
 * pas installable sur Android malgré un manifeste valide.
 *
 * Ce SW ne met rien en cache — le hors-ligne (serwist) reste désactivé.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Pas d'enregistrement depuis une iframe (aperçus, intégrations tierces).
    if (window.self !== window.top) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Échec non bloquant : le site fonctionne, seule l'installabilité est perdue.
    });
  }, []);

  return null;
}
