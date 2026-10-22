# Vérification F12 - Nouvelle vente (pharmacie)

Date : 2026-10-22
Dépôt vérifié : `front_medconnect`, branche `orch/lot7-front` (commit de base 8e59994, fichiers F12 non commités)
Tâche : `docs/plans/runs/2026-10-22-lot7/tasks/F12-nouvelle-vente.md`

Ce rapport remplace la version précédente, qui constatait l'absence des fichiers F12 sur cette branche. Les fichiers sont désormais présents dans le worktree principal.

## Commandes et résultats

1. `docker compose exec -T frontend npx tsc --noEmit` : exit 0, aucune erreur.
2. `docker compose exec -T frontend npx eslint` sur les 12 fichiers de la tâche : exit 0, aucune erreur ni avertissement.
3. `docker compose exec -T frontend npx vitest run` : exit 0, 40 fichiers et 314 tests verts, dont `format_gnf.test.ts` (5), `api_ventes.test.ts` (11), `panier.test.ts` (32), `page.test.tsx` vente (10), `navigation_tableau_de_bord.test.ts` (23).
4. `git status --porcelain -- . ":!docs/plans"` : 12 fichiers exactement (3 modifiés : `src/lib/acces.ts`, `src/lib/navigation_tableau_de_bord.ts`, `src/lib/navigation_tableau_de_bord.test.ts` ; 9 non suivis : `src/app/dashboard/vente/` avec 5 fichiers, `src/lib/api_ventes.ts` et son test, `src/lib/format_gnf.ts` et son test).
5. Tirets cadratin et demi-cadratin dans les lignes ajoutées (`git diff -U0 -- src`) : aucune ligne. Dans les fichiers non suivis (`format_gnf`, `api_ventes`, `src/app/dashboard/vente/`) : aucune ligne.
6. `any` (`:\s*any`, `<any>`, `as any`) et `eslint-disable` sur `api_ventes.ts`, `format_gnf.ts`, `src/app/dashboard/vente/` : aucune ligne.

Contrôles complémentaires :
- Le séparateur de milliers de `formaterGNF` et le suffixe sont bien U+00A0 (octets C2 A0), conforme à la spécification.
- Aucun terme interdit à l'écran (ID, null, undefined, NaN, serveur, requête, session, idempotence, localStorage, STOCK_INSUFFISANT, VALIDEE) dans `page.tsx` et `ConfirmationVente.tsx`.
- Ajout de `ShoppingCart` et de l'entrée « vente » placée avant `ordonnances-recues` ; type `CodePermission` étendu avec les trois codes `vente:*`. Rien d'autre modifié dans ces deux fichiers.
- Aucune modification de `back_medconnect` ni de `docs/plans` dans le périmètre vérifié.

## Verdict

PASS. Les six commandes « Done when » sont vertes, le périmètre est conforme (12 fichiers), et aucune règle de texte ou de typage n'est enfreinte. Aucun commit créé.

## Problèmes actionnables

Aucun bloquant.
