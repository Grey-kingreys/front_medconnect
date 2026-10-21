# F8 - Vérification (Haiku, vérificateur front)

Date : 2026-10-21
Branche : orch/lot4-front (arbre principal, aucun commit fait)
Tâche : tasks/F8-invitation-et-sondage-notifications.md

## Commandes (relancées par le vérificateur)

- `docker compose exec -T frontend npx tsc --noEmit` : code 0, aucune sortie.
- `docker compose exec -T frontend npx eslint` sur les 10 fichiers de la tâche : code 0, 0 erreur, 2 avertissements, tous deux tolérés par la spec (`ApiError` et `apiFetch` inutilisés dans `src/lib/api_admin.ts`). Aucun avertissement dans les 9 autres fichiers.
- `docker compose exec -T frontend npx vitest run` : code 0, 28 fichiers et 161 tests passés, dont les 3 nouveaux fichiers (3 + 5 + 6 = 14 cas) et `api_auth.demo.test.ts` (8 tests verts).
- `grep NotificationBell src/app/dashboard/layout.tsx` : 2 cloches (l.328 et l.524).
- `grep setInterval src/components/NotificationBell.tsx` : aucune occurrence.
- `grep getNotifications` hors tests : seul `src/hooks/useNotifications.tsx` appelle l'API (la définition reste dans `src/lib/api_notifications.ts`, non modifié).
- Tirets cadratin et demi-cadratin dans les lignes ajoutées : aucun (diff des fichiers suivis et des fichiers non suivis).
- Secrets ou jetons dans les lignes ajoutées : aucun.
- `any` dans les lignes ajoutées : aucun (le `any` de `StructureModal.tsx` l.23 est préexistant).

## Revue du diff

- Changement 1 (`api_auth.ts`) : conforme. `estReponseApplicative` vérifie un `code` texte, un 503 sans `code` garde le comportement existant.
- Changement 2 (`api_admin.ts`) : conforme. `StructureCreee` et `invitationNonEnvoyee` sont exportés comme spécifié.
- Changement 3 (`StructureModal.tsx`) : conforme. Avertissement `role="alert"`, renvoi, message serveur en cas d'échec, « Fermer » après succès, `closeOnEscape` adapté, imports inutilisés retirés. Les classes visuelles sont celles prescrites par la spec.
- Changement 4 (`structures/page.tsx`) : conforme. `messageErreurPour` dans `handleResend`, imports et variables inutilisés retirés, `eslint-disable` ciblé sur l'effet de montage.
- Changement 5 (`useNotifications.tsx`) : conforme. Un seul sondage, suspendu onglet caché, arrêt au démontage, pas de requêtes parallèles.
- Changement 6 (`NotificationBell.tsx`) : conforme. Rafraîchissement au clic d'ouverture hors effet, état partagé, spinner sur `premierChargement`.
- Changement 7 (`layout.tsx`) : conforme. `NotificationsProvider key={user.id}` dans `ToastProvider`, deux cloches conservées, 3 imports inutilisés retirés.
- Changement 8 (tests) : conforme à la spec (cas listés présents, mocks comme prescrits).
- Hors périmètre : aucun fichier du back, de `CreateStructureModal.tsx`, de `api_notifications.ts` ou de `super-admin/page.tsx` n'est modifié.

## Verdict

PASS. Les trois commandes du Done when passent, les greps de contrôle sont conformes, et le diff suit la spec.

## Points non bloquants

1. `docs/plans/ACTIVE.md` est modifié dans l'arbre (passage de lot3 à lot4, F8 « à faire »). Ce fichier relève de l'orchestrateur, mais la spec demande de ne pas modifier `docs/plans/`. À vérifier au moment du commit : le codeur ne doit pas l'inclure dans le commit de F8.
2. Dans `src/app/dashboard/layout.tsx`, les enfants de `<NotificationsProvider>` ne sont pas réindentés (cosmétique).
3. Le rendu clair et sombre de la fenêtre d'avertissement n'a pas été vérifié dans un navigateur (exigence « visuel » de la spec). Non couvert par cette vérification.
4. Les avertissements d'ESLint sur `api_admin.ts` restent (tolérés par la spec, dette préexistante).
