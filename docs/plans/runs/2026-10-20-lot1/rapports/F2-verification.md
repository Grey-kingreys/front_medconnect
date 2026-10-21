# F2 - Vérification : compteurs du tableau de bord

Date : 2026-10-20
Dépôt : front_medconnect, branche orch/lot1-front
Tâche : docs/plans/runs/2026-10-20-lot1/tasks/F2-compteurs-tableau-de-bord.md

## Commandes (lancées depuis la racine medconnecte)

1. `docker compose exec -T frontend npx tsc --noEmit` : code 0, sortie vide.
2. `docker compose exec -T frontend npx eslint src/app/dashboard/page.tsx src/app/dashboard/page.test.tsx src/lib/compteurs_tableau_de_bord.ts src/lib/compteurs_tableau_de_bord.test.ts` : code 0, aucune erreur ni avertissement.
3. `docker compose exec -T frontend npx vitest run` : code 0, 12 fichiers et 74 tests verts (dont 10 tests dans `compteurs_tableau_de_bord.test.ts`, couvrant les 9 cas demandés, et 4 tests dans `page.test.tsx`).
4. `git status --porcelain -- src` : ` M src/app/dashboard/page.tsx` et 3 fichiers nouveaux (`page.test.tsx`, `compteurs_tableau_de_bord.ts`, `compteurs_tableau_de_bord.test.ts`) ; rien d'autre dans `src`.
5. Contrôles de contenu sur `page.tsx` : `value:` = 0 occurrence ; aucun « Ordonnances émises », « Ordonnances traitées », « Croissance », « Consultations / mois » ; aucun « TODO: Connect ».

## Revue du diff

- Périmètre conforme : seul `page.tsx` est modifié, les 3 fichiers listés sont créés. Aucun fichier hors périmètre dans `src`.
- Tirets : aucun tiret long dans les lignes ajoutées (diff et 3 nouveaux fichiers). Le seul tiret long restant dans `page.tsx` (ligne 545, séparateur entre le nom de la structure et son type) est préexistant et explicitement hors périmètre.
- `any` : aucun dans les fichiers ajoutés ou modifiés.
- Suppressions de tests : aucune (les tests sont des fichiers nouveaux).
- Suppression de `eslint-disable` : aucune ; un seul `eslint-disable-next-line react-hooks/set-state-in-effect` ajouté, au-dessus de `setMounted(true)`, conforme à la spec.
- Logique : rôles, sources, états chargement/pret/erreur/masque, réessai et `aria-busy` conformes à la spec.
- Visible : libellés « Indisponible », « Chargement », « Réessayer », message d'erreur en français, sans termes techniques interdits.

## Points de vigilance (non bloquants)

- `git -C back_medconnect status` montre de nombreuses modifications et renommages qui ne viennent pas de cette tâche. Je n'ai pas de référence « avant la tâche », donc je ne peux pas confirmer que le back est inchangé par F2. Le contrôle doit être refait avec une référence de départ.
- Avertissement Git : fins de ligne LF remplacées par CRLF sur `page.tsx` (réglage du dépôt, pas une erreur de la tâche).

## Verdict

PASS. Les 3 commandes du « Done when » sont vertes, la revue du diff ne révèle rien hors spec. Point ouvert : vérification du back à refaire avec une référence de départ.
