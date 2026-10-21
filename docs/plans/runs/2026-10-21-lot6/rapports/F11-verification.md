# F11 - Vérification (Haiku, vérificateur front)

Date : 2026-10-21
Dépôt : `front_medconnect`, branche `orch/lot6-front` (aucun commit créé)
Tâche : `docs/plans/runs/2026-10-21-lot6/tasks/F11-import-stock-mode-et-evolution.md`

## Commandes du « Done when »

1. `docker compose exec -T frontend npx tsc --noEmit` : code 0, aucune sortie.
2. `docker compose exec -T frontend npx eslint src/lib/api_pharmacie.ts src/lib/api_pharmacie.test.ts src/components/modals/ImportStockModal.tsx src/components/modals/ImportStockModal.test.tsx` : code 0, 0 erreur, 3 avertissements (tous dans `src/lib/api_pharmacie.ts`, lignes 5 et 7 : `ApiError`, `ApiResponse`, `API_URL` inutilisés). Ces lignes ne sont pas modifiées par la tâche (présentes dans HEAD). Le critère « 0 avertissement » n'est donc pas atteint.
3. `docker compose exec -T frontend npx vitest run` : code 0, 36 fichiers et 252 tests passés (référence 238 : +14 nouveaux cas, dont 4 dans `api_pharmacie.test.ts`, 10 dans `ImportStockModal.test.tsx`). Les tests du catalogue passent.
4. `grep -n 'formulaire.append("mode", mode)'` sur `src/lib/api_pharmacie.ts` : 1 ligne (ligne 167). Compte des libellés et explications dans `ImportStockModal.tsx` : 3 (au moins 4 demandés).
5. `git diff --stat -- src` : 4 fichiers seulement, ceux de la commande 2. `grep -nE "\bany\b"` sur `ImportStockModal.tsx` : aucune occurrence.
6. Tirets cadratin et demi-cadratin : 0 dans les lignes ajoutées et dans les 4 fichiers. Les flèches « → » sont autorisées par la spec.

## Relecture du diff

- Le diff suit la spec : type `ModeImportStock`, champs `quantiteAvant`/`quantiteApres`, `corpsImport` avec mode facultatif, `ChoixModeImport`, rappel « Mode choisi », colonne « Stock », confirmations par mode, retour au mode précédent si l'aperçu échoue, remise à « Inventaire » à la fermeture, catalogue sans bloc de mode.
- Aucun test supprimé ni affaibli. Les seules lignes retirées sont l'ancienne assertion de la 3e consigne (remplacée par la nouvelle, prévu par la spec) et des ajustements d'imports et de `choisirFichier`.
- Aucun secret ajouté.
- Hors périmètre : `docs/plans/ACTIVE.md` est modifié et `docs/plans/runs/2026-10-21-lot6/` est non suivi. Ce sont des fichiers de l'orchestrateur ; la spec demande de ne pas modifier `docs/plans/`, à vérifier par l'orchestrateur.
- Les avertissements LF/CRLF de git sont un réglage de fin de ligne, sans impact sur le code.

## Verdict

FAIL (critère 2 non atteint : 3 avertissements eslint dans un fichier touché).

## Problèmes à corriger

1. `src/lib/api_pharmacie.ts` lignes 5 et 7 : retirer les imports inutilisés `ApiError` et `ApiResponse` (ligne 5) et la constante `API_URL` (ligne 7), ou justifier leur conservation. Le problème est antérieur à la tâche, mais le « Done when » exige 0 avertissement et la règle du projet impose qu'un fichier touché soit propre. Après correction, relancer eslint sur les 4 fichiers et vitest.
2. `docs/plans/ACTIVE.md` et `docs/plans/runs/2026-10-21-lot6/` apparaissent modifiés ou non suivis dans le dépôt : à confirmer par l'orchestrateur (la spec interdit de modifier `docs/plans/`).
