# T05 - Socle de tests Vitest, premiers tests de src/lib, pre-push

Tier: spécifié (agent implementeur-specifie)
Audience: n/a
Visuel: n/a
Background-safe: oui

Worktree de travail : `D:/souleymane/perso-archive-20260923/perso/medconnecte/.worktrees/front-p3-fond` (branche `orch/p3-fond`, node_modules installés). Ne travaille que là. Ne commite pas : l'orchestrateur commite.

## Spec

Point 20 du backlog. Le front n'a aucun framework de test. Décision D01 : Vitest + Testing Library.

1. Dépendances de dev (via `npm install -D --no-audit --no-fund`, qui met à jour `package.json` et `package-lock.json` ensemble) : `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/jest-dom`. Rien d'autre. Vérifier la compatibilité avec React 19.2 et Node 24.
2. `vitest.config.mts` à la racine : environnement `jsdom`, alias `@` vers `./src` (comme `tsconfig.json`), plugin React, fichiers `src/**/*.test.{ts,tsx}`, `setupFiles` vers `vitest.setup.ts` qui importe `@testing-library/jest-dom/vitest`. Ne pas toucher `next.config.ts` ni `tsconfig.json` sauf si `tsc --noEmit` l'exige (le justifier dans le Return).
3. Script `"test": "vitest run"` dans `package.json` (ne modifier aucun autre script).
4. Tests sur des fonctions de `src/lib/` **sans modifier ces fichiers** (d'autres niveaux les modifient) :
   - `src/lib/api_carnet.test.ts` : avec `vi.mock("./api_auth")`, vérifier que `createConsultation`, `createOrdonnance`, `createVaccination`, `createAnalyse`, `createRendezVous` appellent `authFetch` avec le bon chemin, `method: "POST"` et un `body` JSON égal aux données passées ; idem `updateRendezVousStatus` (corps `{ status }`).
   - `src/lib/api_auth.test.ts` : la classe `ApiError` (message, statut, propriétés exposées, `instanceof Error`) ; uniquement ce qui est pur, pas de réseau.
   - Toute autre fonction pure trouvée dans `src/lib/` (lire les fichiers ; par exemple dans `api_storage.ts`) : la tester si elle existe, sans réseau réel (`vi.stubGlobal("fetch", ...)` autorisé).
5. Pre-push : modifier `.githooks/pre-push` pour lancer `run_local npm test` **avant** `run_local npm run build`, et remplacer le message « Aucun test automatise... » par un message exact (tests puis build). Lire `.githooks/gate-lib.sh` (fonction `run_local`) et la section 14 de `docs/ORCHESTRATOR.md`. Garder le style ASCII sans accents des commentaires existants de ce fichier.

## Contraintes

Faire uniquement ce qui est demandé : pas de refactors, helpers ou abstractions non demandés. Commentaires en français. Aucun tiret cadratin ni demi-cadratin. Ne pas modifier docs/plans/. Écrire les fichiers uniquement avec Write et Edit, jamais par redirection shell (npm install est autorisé pour package.json et le lock). Ne lire aucun fichier `.env*`.

## Done when

Dans le worktree :
- `npm test` : toutes les suites passent, au moins 8 tests.
- `npx --no-install tsc --noEmit` : aucune erreur.
- `npx --no-install eslint vitest.config.mts vitest.setup.ts src/lib/*.test.ts` : aucune erreur.
- `sh -n .githooks/pre-push` : syntaxe valide ; le fichier lance `npm test` avant `npm run build`.
- `npm ci --dry-run --no-audit --no-fund` ne signale pas de désynchronisation du lock.
- `git status --porcelain` : seulement package.json, package-lock.json, vitest.config.mts, vitest.setup.ts, les fichiers `src/lib/*.test.ts`, `.githooks/pre-push`.

## Return

Chemin des artefacts + preuves (commande lancée, résultat en une ligne). Ou un bloc BLOCKED. Pas de prose.

## Historique

## Validation
