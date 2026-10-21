# F7 - Verification (geolocalisation precise) - 2026-10-21

Verificateur : Haiku 5.5. Depot : front_medconnect, branche orch/lot3-front. Aucun commit.

## Commandes « Done when »

1. `docker compose exec -T frontend npx tsc --noEmit` : OK, aucune erreur (code de sortie 0).
2. `docker compose exec -T frontend npx eslint <10 fichiers>` : ECHEC, 0 erreur mais 2 avertissements (code de sortie 0, critere « 0 avertissement » non atteint) :
   - `src/components/EmergencyButton.tsx` l.3 : `Unused eslint-disable directive (no problems were reported from 'prefer-const')`.
   - `src/lib/api_carnet.ts` l.2 : `Unused eslint-disable directive (no problems were reported from '@typescript-eslint/no-explicit-any')`.
3. `docker compose exec -T frontend npx vitest run` : OK, 25 fichiers de test, 147 tests passes (dont geolocalisation.test.ts 12 tests, api_config.test.ts 6 tests, api_carnet.test.ts 9 tests).
4. `git status` hors docs/plans : OK, exactement les 10 fichiers attendus (6 modifies : chat/page.tsx, medicaments/page.tsx, EmergencyButton.tsx, GlobePicker.tsx, api_carnet.ts, api_carnet.test.ts ; 4 nouveaux : geolocalisation.ts, geolocalisation.test.ts, api_config.ts, api_config.test.ts).
5. Recherche `getCurrentPosition` : OK, aucune occurrence hors tests. Note : le motif `geolocation.watchPosition` du critere ne matche pas le code reel, qui est `geo.watchPosition` (src/lib/geolocalisation.ts l.78). Ecart de formulation du critere, pas du code.
6. `tel:15` / `(SAMU)` / `Position GPS acquise` / `toFixed(4)` dans EmergencyButton.tsx : OK, aucune sortie. `Idempotency-Key` dans api_carnet.ts : OK, 1 ligne (l.220).
7. Tirets cadratin/demi-cadratin dans les lignes ajoutees (diff) et dans les 4 nouveaux fichiers : OK, aucune sortie.

Controles complementaires (lecture du diff) : `demarrerRecherche`, `handleSendSOS` attendant la recherche, `numeroRecherche.current++` dans `reset`, commentaire et directive `exhaustive-deps` au-dessus de la fermeture du compte a rebours, `relancer(!envoiEchoue)` et `relancer(true)`, `tel:${numeroUrgence}` et « Appeler le {numeroUrgence} », `localiserPrecisement(REGLAGES_RAPIDES)` dans chat, medicaments et GlobePicker : presents et conformes a la spec. Aucun `any` dans les fichiers nouveaux. Aucun test supprime ou affaibli (api_carnet.test.ts n'a que des ajouts).

## Verdict

ECHEC (critere 2 non atteint). Tout le reste est conforme. Correction minimale demandee, sans toucher au reste :

## Problemes actionnables

1. `src/components/EmergencyButton.tsx` l.3 : retirer `prefer-const` de la directive `/* eslint-disable ... */` (la regle n'a plus d'occurrence dans le fichier). Le reste de l'en-tete reste tel quel. Remarque : la spec demande de laisser l'en-tete tel quel, mais le critere 2 exige 0 avertissement ; retirer seulement la regle devenue inutile est le compromis le plus petit.
2. `src/lib/api_carnet.ts` l.2 : supprimer la ligne `/* eslint-disable @typescript-eslint/no-explicit-any */` (le fichier ne contient plus de `any`). Garder la ligne de commentaire « Dette preexistante » si besoin.
3. Relancer eslint sur les 10 fichiers : doit afficher 0 erreur et 0 avertissement. Relancer tsc et vitest apres correction.

Hors perimetre de la verification (a signaler seulement) : `docs/plans/ACTIVE.md` est modifie et `docs/plans/runs/` est non suivi. Ces fichiers sont exclus du controle 4 par la spec ; a verifier que c'est bien l'orchestrateur qui les modifie.
