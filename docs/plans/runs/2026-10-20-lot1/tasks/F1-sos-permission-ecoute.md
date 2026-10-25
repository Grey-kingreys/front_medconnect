# F1 - Écoute des alertes SOS selon la permission sos:respond

Tier: spécifié (agent implementeur-specifie)
Audience: non-dev (aucun texte visible ajouté ni modifié)
Visuel: n/a
Background-safe: non, car docker compose exec (tests et typage dans le conteneur frontend)

## Spec

Dépôt : `D:\souleymane\perso-archive-20260923\perso\medconnecte\front_medconnect`, branche `orch/lot1-front` (arbre principal, ne pas changer de branche, ne pas committer).

### Contexte (déjà vérifié par le chef d'équipe, ne pas re-chercher)

- `src/components/EmergencyListener.tsx`, effet « Initialize Socket » (vers la ligne 79) : la connexion en direct qui reçoit `emergencyAlert` n'est ouverte que si `user.role` vaut `MEDECIN`, `STRUCTURE_ADMIN` ou `ADMIN`. C'est le SEUL endroit du front qui filtre l'écoute des alertes SOS par rôle (`EmergencyButton.tsx` filtre l'ENVOI côté patient : ne pas y toucher).
- `useAuth()` (`src/hooks/useAuth.tsx`) expose `user` (AuthUser, sans permissions) et `profile` (UserProfile, `null` tant que GET /auth/me n'a pas répondu). `UserProfile.permissions?: string[]` contient les permissions effectives (`src/lib/api_auth.ts`, ligne ~47).
- Motif existant à reproduire : `src/app/dashboard/catalogue/page.tsx` ligne 32, `profile?.permissions?.includes("catalogue:write") ?? false`.
- Côté serveur, la permission s'appelle `sos:respond` et la diffusion SOS est déjà filtrée par elle.

### Changement 1 : `src/components/EmergencyListener.tsx`

1. Remplacer `const { user } = useAuth();` par `const { user, profile } = useAuth();`.
2. Juste en dessous, ajouter :
   ```tsx
   // Même règle que le serveur : seuls les titulaires de sos:respond reçoivent les alertes SOS
   const peutRepondreSOS = profile?.permissions?.includes("sos:respond") ?? false;
   const utilisateurId = user?.id;
   ```
3. Dans l'effet « Initialize Socket », remplacer la condition
   `if (!user || (user.role !== "MEDECIN" && user.role !== "STRUCTURE_ADMIN" && user.role !== "ADMIN")) {`
   par `if (!utilisateurId || !peutRepondreSOS) {` (le `return;` reste).
4. Remplacer le tableau de dépendances `[user]` de cet effet par `[utilisateurId, peutRepondreSOS]`.
5. Ne rien changer d'autre dans le fichier : pas de nettoyage des `eslint-disable` dupliqués, des imports inutilisés, des `any`, du rendu ou des textes. Aucun repli sur le rôle : un profil non chargé (`null`) ou sans `permissions` = pas d'écoute.

Effet attendu : un rôle personnalisé titulaire de `sos:respond` ouvre la connexion et reçoit l'alerte ; un `MEDECIN` (ou tout rôle) sans `sos:respond` ne l'ouvre pas ; si le droit disparaît au rafraîchissement du profil, le nettoyage de l'effet appelle `disconnect()`.

### Changement 2 : nouveau fichier `src/components/EmergencyListener.test.tsx`

Vitest + Testing Library (environnement jsdom, `@testing-library/jest-dom` déjà chargé par `vitest.setup.ts`). S'inspirer de la forme de `src/hooks/useAuth.test.tsx`. Textes de `describe`/`it` en français.

Mocks (avant l'import du composant, avec `vi.hoisted` pour les variables utilisées dans les fabriques) :
- `vi.mock("@/hooks/useAuth", () => ({ useAuth: () => etatAuth }))` où `etatAuth` est un objet mutable `{ user, profile }` réinitialisé dans `beforeEach`.
- `vi.mock("socket.io-client", () => ({ io: ioMock }))` où `ioMock = vi.fn(() => socketFactice)` et `socketFactice = { on: vi.fn((evt, cb) => { gestionnaires[evt] = cb; }), off: vi.fn(), disconnect: vi.fn() }`, `gestionnaires` étant un `Record<string, (data: unknown) => void>` vidé dans `beforeEach`.
- `vi.mock("@/lib/api_carnet", () => ({ takeChargeSOS: vi.fn() }))`.
- `vi.mock("next/link", ...)` seulement si le rendu l'exige (sinon ne pas le mocker).
- Audio : `vi.stubGlobal("Audio", class { loop = false; currentTime = 0; play = vi.fn().mockResolvedValue(undefined); pause = vi.fn(); })`.
- `beforeEach` : `localStorage.clear()`, `localStorage.setItem("access_token", "jeton-test")`, `vi.clearAllMocks()` ou réinitialisation équivalente. `afterEach` : `cleanup()`, `vi.unstubAllGlobals()`.

Données : `user` de base `{ id: "u1", email: "agent@exemple.com", nom: "Camara", prenom: "Awa", role: <selon le cas> }` ; `profile` = même identité + `role`, `isActive: true`, `createdAt`/`updatedAt` quelconques, `permissions` selon le cas (caster en `UserProfile` si besoin, sans `any`).

Cas obligatoires (un `it` chacun) :
1. Rôle personnalisé (`role: "INFIRMIER_URGENCES"`) avec `permissions: ["sos:respond"]` : `ioMock` appelé une fois avec `auth: { token: "jeton-test" }` ; puis, dans `act`, appeler `gestionnaires.emergencyAlert({ urgenceId: "urg1", patientId: "p1", patientName: "Mariama Bah", latitude: 9.5, longitude: -13.7, message: "Aide", createdAt: new Date().toISOString() })` ; `screen.getByText("Mariama Bah")` est dans le document.
2. `role: "MEDECIN"` avec `permissions: ["carnet:read"]` (sans sos:respond) : `ioMock` jamais appelé.
3. `role: "MEDECIN"` avec `profile: null` (profil pas encore chargé) : `ioMock` jamais appelé.
4. `user: null`, `profile: null` : `ioMock` jamais appelé.
5. Retrait du droit : rendu avec `permissions: ["sos:respond"]` (connexion ouverte), puis modifier `etatAuth.profile` avec `permissions: []` et `rerender(<EmergencyListener />)` : `socketFactice.disconnect` appelé.
6. Rafraîchissement sans changement de droit : rendu avec `["sos:respond"]`, puis nouvel objet `profile` (même permissions) et `rerender` : `ioMock` toujours appelé une seule fois.

## Contraintes

Faire uniquement ce qui est demandé : pas de refactors, helpers ou abstractions non demandés. Discipline de code dans l'ordre : réutiliser l'existant > ranger au bon endroit > n'abstraire qu'à la règle de trois. Règles d'audience, visuelles, typographiques et de langue : docs/ORCHESTRATOR.md. Ne pas modifier docs/plans/. Écrire les fichiers uniquement avec Write et Edit, jamais par redirection shell : le hook de garde ne voit pas les écritures faites par Bash.

Spécifique : commentaires et libellés de test en français ; aucun tiret cadratin ni demi-cadratin ; pas de `any` dans le fichier de test ; ne toucher à aucun autre fichier que les deux listés ; pas de commit.

## Done when

Toutes les commandes lancées depuis `D:\souleymane\perso-archive-20260923\perso\medconnecte` :
1. `docker compose exec -T frontend npx tsc --noEmit` : sortie vide, code 0.
2. `docker compose exec -T frontend npx eslint src/components/EmergencyListener.tsx src/components/EmergencyListener.test.tsx` : 0 erreur (les 3 avertissements préexistants d'EmergencyListener.tsx sont tolérés, aucun nouvel avertissement dans le fichier de test).
3. `docker compose exec -T frontend npx vitest run` : tous les tests verts, dont les 6 cas de `src/components/EmergencyListener.test.tsx`.
4. `git -C front_medconnect diff --name-only` plus `git -C front_medconnect status --porcelain` : seuls `src/components/EmergencyListener.tsx` (modifié) et `src/components/EmergencyListener.test.tsx` (nouveau) côté `src/`.
5. `grep -n "user.role" front_medconnect/src/components/EmergencyListener.tsx` : aucun résultat ; `grep -n "sos:respond" front_medconnect/src/components/EmergencyListener.tsx` : au moins une ligne.

## Return

Chemin des 2 fichiers + preuve des 5 commandes du « Done when » (commande lancée, résultat en une ligne chacune). Ou un bloc BLOCKED. Pas de prose.

## Historique

<!-- une ligne par tentative : AAAA-MM-JJ | tier | résultat | raison si échec -->

## Validation

<!-- commande relancée par l'orchestrateur | résultat en une ligne | hash du commit -->
docker compose exec -T frontend npx tsc --noEmit | code 0, sortie vide | voir commit (F1)
docker compose exec -T frontend npx eslint (2 fichiers) | 0 erreur, 3 avertissements préexistants | voir commit (F1)
docker compose exec -T frontend npx vitest run | 10 fichiers, 60 tests verts (6 nouveaux) | voir commit (F1)
