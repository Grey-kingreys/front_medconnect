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

## Stockage objets (Cloudflare R2)

Utiliser la couche `src/lib/api_storage.ts` + `src/hooks/useR2Upload.ts` +
`src/components/FileUpload.tsx`. **Ne pas** rappeler l'ancien module legacy
(`/storage/upload-url`, `/storage/download-url`, `fichierUrl`) — dormant, à retirer.

**Flux d'upload** (`uploadToR2`) : `POST /storage/presign` (via `authFetch`) →
**PUT direct du fichier sur R2** (seul appel hors `authFetch`, avec progression XHR) →
`POST /storage/confirm`. On récupère un `StoredFile` **confirmé** dont l'`id` est
ensuite rattaché à une entité métier.

**Rattacher** l'`id` à une entité via son endpoint dédié :

- Avatar : `PATCH/DELETE /users/me/avatar` (`setMyAvatar`/`removeMyAvatar`, `api_auth`).
- Logo structure : `PATCH/DELETE /structures/my/logo` (`setMyLogo`/`removeMyLogo`, `api_structure`).
- Document d'analyse / ordonnance scannée : champ `documentFileId` / `scanFileId` passé à
  `createAnalyse` / `createOrdonnance` (`api_carnet`).

**Lecture** : les fichiers **publics** (avatar/logo) exposent une `*Url` directe
(`avatarUrl`, `logoUrl`) — affichage via `<img>`. Les documents **privés** passent par
`GET /storage/:id/read-url` (`openStoredFile`, URL présignée courte, contrôle d'accès + audit).

⚠️ Ces hôtes R2 sont whitelistés dans la **CSP** (`next.config.ts`) : `*.r2.cloudflarestorage.com`
(upload/lecture présignée) et `*.r2.dev` / `cdn.medconnecte.com` (`img-src`). Ajouter tout
nouveau domaine de stockage à la CSP.

## ⚠️ Dette/risques spécifiques frontend

Voir la liste complète dans le `CLAUDE.md` racine. En résumé : **zéro test**, typage
**`any`** sur les payloads API (`api_carnet.ts`…), **PWA serwist commentée** dans
`next.config.ts` (offline non fonctionnel malgré les deps), pas de `middleware.ts`
(flash de contenu protégé), accessibilité faible (peu d'ARIA), pas de retry/back-off
réseau (important en contexte de connexion instable).
