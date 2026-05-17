import { type PrecacheEntry, Serwist, NetworkFirst, StaleWhileRevalidate, ExpirationPlugin } from "serwist";

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: (string | PrecacheEntry)[] | undefined;
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false, // Désactivé pour éviter les conflits App Router
  runtimeCaching: [
    {
      // 1. Cache API requests (Medical data, stats, structures)
      matcher: /\/api\/.*|\/super-admin\/.*|\/users\/.*/i,
      handler: new NetworkFirst({
        cacheName: "medconnecte-api-cache",
        networkTimeoutSeconds: 5,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 24 * 60 * 60, // 24 heures
          }),
        ],
      }),
    },
    {
      // 2. Cache images, fonts, and static assets
      matcher: /\.(?:png|jpg|jpeg|svg|webp|woff2?|css|js)$/i,
      handler: new StaleWhileRevalidate({
        cacheName: "medconnecte-static-assets",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 200,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7 jours
          }),
        ],
      }),
    },
  ],
});



serwist.addEventListeners();
