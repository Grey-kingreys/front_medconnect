/* import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: false,
}); */

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            // R2 : img-src pour l'affichage (avatars/logos publics via *.r2.dev / cdn ; images
            // privées via URL présignée sur *.r2.cloudflarestorage.com) ; connect-src pour
            // l'upload PUT direct et la lecture présignée sur l'endpoint S3.
            value: `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://*.mapbox.com https://*.r2.dev https://*.r2.cloudflarestorage.com https://cdn.medconnecte.com; connect-src 'self' ${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'} ${process.env.NEXT_PUBLIC_API_URL?.replace('http', 'ws') || 'ws://localhost:3001'} https://*.mapbox.com https://raw.githubusercontent.com https://*.r2.cloudflarestorage.com https://*.r2.dev; worker-src 'self' blob:; child-src blob:;`,
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            // camera=(self) : autorisé pour le scan du QR de consentement (page Accueil).
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=(self), browsing-topics=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;





