/*
 * Service worker MINIMAL — installabilité uniquement, aucun cache.
 *
 * Chrome/Edge n'émettent `beforeinstallprompt` (donc n'autorisent l'ajout à
 * l'écran d'accueil) que si la page contrôle un service worker déclarant un
 * gestionnaire `fetch`. Ce fichier ne sert qu'à cela.
 *
 * ⚠️ NE RIEN METTRE EN CACHE ICI. La PWA hors-ligne (serwist) reste désactivée
 * (cf. next.config.ts) : sa version précédente provoquait une boucle de
 * rechargement en développement, et une application mobile native est prévue.
 * Ce fichier remplace ce build serwist obsolète, qui restait servi depuis
 * /public et que le layout devait désinscrire à chaque chargement de page.
 */

self.addEventListener("install", () => {
  // Prendre la main immédiatement, y compris sur l'ancien SW serwist.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Purger les caches laissés par la version serwist précédente.
      const noms = await caches.keys();
      await Promise.all(noms.map((nom) => caches.delete(nom)));
      await self.clients.claim();
    })(),
  );
});

// Pass-through explicite : la requête part au réseau, rien n'est intercepté.
// Le gestionnaire doit exister pour que le navigateur juge l'app installable.
self.addEventListener("fetch", () => {});
