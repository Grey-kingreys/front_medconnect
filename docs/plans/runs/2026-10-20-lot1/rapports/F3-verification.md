# F3 - Vérification (Haiku, vérificateur front)

Date : 2026-10-20
Branche : `orch/lot1-front`
Tâche : `docs/plans/runs/2026-10-20-lot1/tasks/F3-liens-vides-accueil.md`

Ce rapport remplace la version précédente, qui datait d'avant les dernières modifications de `Footer.tsx` (elle signalait une erreur ESLint qui n'existe plus à la relance).

## Commandes relancées (depuis le monorepo)

1. `grep -rnE "href\s*(=|:)\s*\{?\s*[\"'\`]#[\"'\`]" front_medconnect/src` : aucune sortie, code 1. OK.
2. `docker compose exec -T frontend npx tsc --noEmit` : code 0, 0 erreur. OK.
3. `docker compose exec -T frontend npx eslint src/components/Footer.tsx src/components/liens_accueil.test.ts` : code 0, aucune sortie (0 erreur, 0 avertissement). OK.
4. `docker compose exec -T frontend npx vitest run src/components/liens_accueil.test.ts` : 2 tests passent, code 0. OK.
5. `docker compose exec -T frontend npx vitest run` : 13 fichiers, 76 tests passent, code 0. OK.
6. `git diff --numstat -- src/components/Footer.tsx` : 8 lignes ajoutées, 3 supprimées par rapport à HEAD. ECHEC (voir problème 1). `git status --short` liste aussi `docs/plans/ACTIVE.md` et `docs/plans/runs/2026-10-20-lot1/decisions.md` (modifiés) : voir problème 2.
7. Recherche de tirets cadratin (U+2014) et demi-cadratin (U+2013) dans les lignes ajoutées de `Footer.tsx` et dans `liens_accueil.test.ts` : aucun. OK.

## Contrôle du diff

- `Footer.tsx`, ligne 46 du commentaire : texte conforme à la spec (« un lien vers « # » seul en »). OK.
- `Footer.tsx`, autres changements hors spec (par rapport à HEAD) :
  - import `Link` from `next/link` ajouté ;
  - deux lignes de commentaire et deux directives `eslint-disable` / `eslint-enable` `@typescript-eslint/no-unused-vars` autour des icônes ;
  - le `<a href="/">` du logo et sa balise fermante remplacés par `<Link href="/">`.
  La spec dit « Rien d'autre ne change dans ce fichier ». Ces changements ne sont pas dans le périmètre F3. Ils peuvent venir d'un travail antérieur non commité ou d'une autre tâche : je ne peux pas l'attribuer à partir du diff seul.
- `liens_accueil.test.ts` : 51 lignes, deux tests, contenu conforme à la spec. Aucune suppression ni affaiblissement de test.
- Aucun secret détecté dans les fichiers touchés.

## Verdict

ECHEC sur le critère 6 de « Done when » (diff de `Footer.tsx` limité à une ligne, et `git status` limité aux deux fichiers de la spec). Les critères 1 à 5 et 7 passent.

## Problèmes

1. `Footer.tsx` contient des modifications hors spec, non commitées (import `Link`, remplacement `<a href="/">` par `<Link>`, directives `eslint-disable` autour des icônes inutilisées). La spec exige que seule la ligne 46 change. Décision à prendre : les retirer de F3 (les remettre dans HEAD ou dans une tâche dédiée) ou accorder une dérogation explicite par l'orchestrateur. Note : ces changements suppriment aussi le besoin de corriger le lint, qui passe désormais à 0 erreur et 0 avertissement.
2. `git status` liste `docs/plans/ACTIVE.md` et `docs/plans/runs/2026-10-20-lot1/decisions.md` comme modifiés, et la tâche `F3-liens-vides-accueil.md` comme non suivie. Ce sont probablement des fichiers d'orchestration et non du code du codeur, mais la spec ne les autorise pas dans la liste. À confirmer par l'orchestrateur.

## Action demandée

Trancher le problème 1 (retirer les changements hors spec de `Footer.tsx` ou accorder une dérogation écrite) et confirmer le problème 2. Puis relancer le critère 6. Aucun commit effectué.
