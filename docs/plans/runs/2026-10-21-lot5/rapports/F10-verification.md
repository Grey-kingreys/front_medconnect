# F10 - Vérification (changement de mot de passe)

Date : 2026-10-21
Dépôt : `front_medconnect`, branche `orch/lot5-front`
Tâche : `docs/plans/runs/2026-10-21-lot5/tasks/F10-changement-mot-de-passe.md`

## Commandes (relancées par le vérificateur)

1. `docker compose exec -T frontend npx tsc --noEmit` : code 0, aucune sortie.
2. `docker compose exec -T frontend npx eslint <14 fichiers touchés>` : code 0, aucune erreur ni avertissement.
3. `docker compose exec -T frontend npx vitest run` : code 0, 36 fichiers et 238 tests passés, 0 échec.
4. `grep passwordRules|failedRules src` : aucune occurrence. `grep <ReglesMotDePasse src/app` : exactement 4 pages (profil, reset-password, register, setup-structure).
5. `grep minLength={8}` sur les 4 pages : aucune occurrence. `grep \bany\b` sur `regles_mot_de_passe.ts` et `ReglesMotDePasse.tsx` : aucune occurrence.
6. `grep CODES_JETON_A_RENOUVELER src/lib/api_auth.ts` : constante (ligne 237) et usage dans `doitRafraichir` (ligne 243). `git diff --stat -- src` : 7 fichiers suivis modifiés, tous dans la liste de la tâche (`api_auth.ts`, `profil/page.tsx`, `profil/page.test.tsx`, `register/page.tsx`, `register/page.test.tsx`, `reset-password/page.tsx`, `setup-structure/[token]/page.tsx`).
7. Scan des lignes ajoutées (suivies et non suivies) pour tiret cadratin ou demi-cadratin : aucune occurrence.

## Diff relu

- `api_auth.ts` : seul `avecRafraichissement` change, plus la constante et `doitRafraichir` au-dessus. Le `try` du rafraîchissement ne contient que le rafraîchissement et l'enregistrement du jeton ; la nouvelle tentative est hors de ce `try` (D15). Les commentaires « 401 de jeton » sont mis à jour. `apiFetch`, `authFetch`, `authDownload`, `refreshAccessToken` et `logout` ne sont pas touchés.
- `regles_mot_de_passe.ts` et `ReglesMotDePasse.tsx` : conformes à la spec (contenu exact, lecture défensive sans `any`).
- `profil/page.tsx`, `reset-password/page.tsx`, `register/page.tsx`, `setup-structure/[token]/page.tsx` : contrôles dans le bon ordre, `catch` de `register` inchangé pour le téléphone et le bandeau, `minLength` retiré, `maxLength`, `autoComplete`, `aria-invalid` et `aria-describedby` ajoutés.
- Tests : `profil/page.test.tsx` et `register/page.test.tsx` ajoutent des cas (6 `it(` ajoutés au total) et ne suppriment aucune ligne. Les nouveaux fichiers de test totalisent 39 cas (10 + 18 + 6 + 3 + 2), au-delà du minimum de 33.
- Aucun secret détecté dans les lignes ajoutées.
- Hors périmètre : `docs/plans/ACTIVE.md` et `docs/plans/runs/2026-10-21-lot5/decisions.md` apparaissent modifiés dans `git status`. La spec interdit de modifier `docs/plans/` ; ces modifications ne sont pas dans les fichiers de la tâche et doivent être vérifiées avant commit par le porteur (probablement tenues par l'orchestrateur, non introduites par le codeur de F10). Non bloquant pour la vérification du code.
- Avertissements Git « LF will be replaced by CRLF » : sans impact sur le code.

## Verdict

PASS. Les 7 critères du « Done when » sont satisfaits. Aucun problème bloquant dans le code de la tâche.

## Problèmes

1. (Hors code F10, à vérifier avant commit) `docs/plans/ACTIVE.md` et `docs/plans/runs/2026-10-21-lot5/decisions.md` sont modifiés dans l'arbre alors que la spec demande de ne pas toucher `docs/plans/`. Ne pas committer ces fichiers avec la tâche.
