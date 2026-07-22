@AGENTS.md

# MedConnecte — Frontend (Next.js 16 + React 19)

Web app de la plateforme de santé. Voir aussi le `CLAUDE.md` racine (architecture +
liste complète des problématiques).

> ⚠️ **Next.js 16** : voir `AGENTS.md` ci-dessus — APIs/conventions peuvent différer de
> ton entraînement. **Lire `node_modules/next/dist/docs/`** avant d'écrire du code Next,
> et tenir compte des avis de dépréciation.

## Stack & démarrage

- **Next.js 16** (App Router), **React 19**, **TypeScript**, **Tailwind 4**,
  **Mapbox GL**, **Recharts**, **socket.io-client**, PWA (**serwist**, *actuellement
  désactivée*).
- Local : `npm run dev` (= `next dev --webpack`). Port `3000`. Build : `next build` + `next start`.

## Structure

- `src/app/` — App Router. `auth/` (login, register, reset…), `dashboard/` (~20 sous-routes
  métier : patients, consultations, ordonnances, analyses, carnet, pharmacies, stock,
  chat, rendez-vous, map, super-admin…), `offline/`, `debug/`.
- `src/lib/` — **couche API centralisée** : tous les appels passent par `authFetch()`
  (`api_auth.ts`) qui ajoute le Bearer token, gère le **refresh automatique** sur 401,
  et normalise les erreurs (`ApiError`). Un fichier `api_<domaine>.ts` par domaine.
  **Ne pas faire de `fetch()` brut dans les composants.**
- `src/hooks/` — `useAuth` (contexte global, silent refresh ~12 min), etc.
- `src/components/` — UI réutilisable (`modals/`, `charts/`, listeners socket).

## Conventions importantes

- **Auth** : token JWT en `localStorage` ; refresh via cookie httpOnly + fallback body.
  Redirection des routes protégées gérée **côté client** dans `useAuth` (pas de middleware).
- **Temps réel** : socket.io vers `NEXT_PUBLIC_API_URL` (chat, alertes SOS via
  `EmergencyListener`). Toujours nettoyer les listeners (`socket.off`) au démontage.
- **Variables `NEXT_PUBLIC_*`** : `API_URL`, `BASE_URL`, `MAPBOX_ACCESS_TOKEN`,
  `GOOGLE_SITE_VERIFICATION`. ⚠️ **Inlinées au build** → rebuild de l'image front si
  elles changent (passées en build args dans le Dockerfile).
- **CSP** définie dans `next.config.ts` (`connect-src` inclut `NEXT_PUBLIC_API_URL` +
  son équivalent `ws://`). Si tu ajoutes un domaine externe (API, CDN), mettre à jour la CSP.
- **Langue** : UI et messages en français (locale `fr-GN`).

## Brancher le stockage S3 (backend Phase 2)

Flux d'upload recommandé : `POST /storage/upload-url` (avec Bearer) → récupérer
`{ key, uploadUrl }` → **PUT direct du fichier** sur `uploadUrl` (S3/MinIO, pas via
l'API) → enregistrer la `key` (ex. `fichierUrl` d'un résultat d'analyse). Téléchargement :
`GET /storage/download-url?key=…` → URL présignée temporaire.

## ⚠️ Dette/risques spécifiques frontend

Voir la liste complète dans le `CLAUDE.md` racine. En résumé : **zéro test**, typage
**`any`** sur les payloads API (`api_carnet.ts`…), **PWA serwist commentée** dans
`next.config.ts` (offline non fonctionnel malgré les deps), pas de `middleware.ts`
(flash de contenu protégé), accessibilité faible (peu d'ARIA), pas de retry/back-off
réseau (important en contexte de connexion instable).
