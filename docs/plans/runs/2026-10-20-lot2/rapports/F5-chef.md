# F5 : rapport du chef d'équipe front

Date : 2026-10-21. Branche `orch/lot2-front`. Statut : validé.

## Ce qui a été fait

- Nouveau module `src/lib/erreur_telephone.ts` (conforme mot pour mot à la spec) : message sous le champ pour 409 `TELEPHONE_DEJA_UTILISE` et 400 `VALIDATION` portant sur `telephone`, bandeau masqué seulement si l'erreur ne concerne que le téléphone.
- Motif commun appliqué aux 3 formulaires : inscription, profil (aide visible seulement en mode modification), UserModal (libellé relié par `htmlFor`, imports inutilisés retirés).
- Placeholders passés à `620 00 00 00` (inscription, UserModal) ; profil inchangé (« Non renseigné »).
- 4 fichiers de test (3 nouveaux, 1 complété) : 7 + 5 + 3 + 3 cas.

## Preuves (relancées par le chef)

- `docker compose exec -T frontend npx tsc --noEmit` : exit 0.
- `docker compose exec -T frontend npx eslint <8 fichiers>` : exit 0, aucun avertissement.
- `docker compose exec -T frontend npx vitest run` : 23 fichiers, 125 tests passés.
- Recherche de tirets cadratin et demi-cadratin dans les lignes ajoutées et les nouveaux fichiers : aucun.
- Diff relu en entier : seuls les 8 fichiers de la tâche sous `src/`.

## Décisions

- `ApiError` de `api_admin` et `api_structure` est une réexportation de celle de `api_auth` : le test `instanceof` fonctionne donc aussi dans UserModal (vérifié dans le code).
- Les modifications préexistantes de `docs/plans/ACTIVE.md` et `decisions.md` (D13 à D19, base de la spec) sont incluses dans ce commit avec le dossier du run.

## Réserves

- Dépend du contrat du back `orch/lot2-back` (code `TELEPHONE_DEJA_UTILISE`, `champs`) : sans lui, le comportement retombe sur le bandeau actuel, sans régression.
- Pas de contrôle visuel au navigateur (changement limité à des classes et textes existants, clair et sombre couverts par les tokens déjà utilisés).
- Mobile non concerné (aucun fichier partagé avec l'application mobile).
