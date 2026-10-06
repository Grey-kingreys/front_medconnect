# T11 - Point 13 (CI front) : GitHub Actions minimale

Tier: spécifié (agent implementeur-specifie)
Audience: dev
Visuel: n/a
Background-safe: oui

## Spec

Constat : aucun dossier `.github/` dans ce dépôt, donc aucune CI. Le projet n'a pas de tests automatisés : le build de production tient lieu de gate (docs/ORCHESTRATOR.md section 13).

À faire : créer `.github/workflows/ci.yml` :
- déclencheurs : `push` sur `master` et `orch/**`, `pull_request` vers `master` ;
- un job `verification` sur `ubuntu-latest`, Node : lire la version de l'image `node:<version>` du `Dockerfile` de ce dépôt, `actions/setup-node@v4` avec `cache: npm` ;
- étapes : `npm ci --no-audit --no-fund`, `npx --no-install tsc --noEmit`, `npm run build` ;
- variables `NEXT_PUBLIC_*` nécessaires au build avec des valeurs factices et publiques (par exemple `NEXT_PUBLIC_API_URL: http://localhost:3001`, `NEXT_PUBLIC_BASE_URL: http://localhost:3000`) ; aucun vrai jeton (pas de jeton Mapbox réel : valeur vide ou factice) ; commentaire en français ;
- pas de lint global (dette d'environ 190 erreurs, backlog point 22) : commentaire en français qui le dit ;
- `concurrency` pour annuler les exécutions obsolètes d'une même branche ; `permissions: contents: read`.

Vérifier localement : dans ce worktree, `npx --no-install tsc --noEmit` puis `npm run build` avec seulement les variables factices du YAML (en Git Bash : `env -i PATH="$PATH" HOME="$HOME" NEXT_PUBLIC_API_URL=... npm run build`, adapter si nécessaire) ; ajouter au YAML toute variable réellement nécessaire.

Vérifier la syntaxe YAML avec un analyseur déjà présent dans `node_modules` (ne rien installer).

## Contraintes

Faire uniquement ce qui est demandé. Commentaires en français, aucun tiret cadratin ni demi-cadratin. Ne pas modifier docs/plans/. Écrire les fichiers uniquement avec Write et Edit, jamais par redirection shell. Ne pas commiter, ne rien pousser. Ne jamais lire ni afficher un fichier `.env*`.

## Done when

- `.github/workflows/ci.yml` existe et s'analyse sans erreur (commande et résultat donnés).
- `tsc --noEmit` et `npm run build` passent localement avec seulement les variables factices du YAML (preuve en une ligne chacune).

## Return

Fichier créé + preuves (commandes lancées, résultat en une ligne chacune). Ou un bloc BLOCKED. Pas de prose.

## Historique

## Validation
