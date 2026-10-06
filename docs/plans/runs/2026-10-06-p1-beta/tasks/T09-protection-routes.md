# T09 - Point 7 : protection serveur des routes + /debug hors production

Tier: dur (agent implementeur-dur)
Audience: non-dev pour le tableau de bord et la connexion ; dev pour `/debug`
Visuel: n/a (aucune nouvelle UI ; si un texte visible est ajouté, régime non-dev de docs/ORCHESTRATOR.md section 1 et 14)
Background-safe: oui

## Spec

Lire d'abord : `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`, `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` (ou le fichier équivalent trouvé par grep « proxy » dans ce dossier), la section « Optimistic checks with Proxy » de `node_modules/next/dist/docs/01-app/02-guides/authentication.md`, et la section `middleware` to `proxy` de `02-guides/upgrading/version-16.md`. Next.js 16 : le fichier s'appelle `proxy.ts`, la fonction exportée `proxy`, runtime nodejs.

Contexte (vérifié) :
- L'access token est en `localStorage` (invisible au serveur). Le cookie httpOnly `refresh_token` est posé par l'API (`back_medconnect/src/auth/auth.service.ts`, `res.cookie('refresh_token', ...)`, sans attribut `domain`, `sameSite` none en prod) : en production il appartient à l'hôte de l'API et n'est **jamais** envoyé au domaine du front. On ne peut donc pas s'y fier (décision D01).
- `src/hooks/useAuth.tsx` gère la session côté client et redirige vers `/auth/login` (effet lignes 234 à 250) ; `src/app/dashboard/layout.tsx` affiche un spinner tant que l'état n'est pas connu.
- `src/app/debug/page.tsx` (client) affiche la configuration et les réponses brutes du serveur ; elle est publique.

À faire :
1. **Cookie témoin** : dans `useAuth.tsx`, poser un cookie `mc_connecte=1` (aucun secret, `path=/`, `SameSite=Lax`, `max-age` 30 jours, `Secure` si `location.protocol === 'https:'`) à chaque fois qu'une session est établie ou confirmée (connexion `loginUser`, restauration réussie au chargement, refresh réussi), et le supprimer (`max-age=0`) partout où la session est effacée (déconnexion, échec de refresh, nettoyage du localStorage). Mettre ces deux opérations dans deux petites fonctions locales au fichier (pas de nouveau module partagé). **Le cookie doit être posé avant** toute redirection vers `/dashboard`, sinon boucle : un utilisateur déjà connecté avant ce déploiement n'a pas encore le cookie ; à sa visite de `/auth/login`, `useAuth` le voit connecté, pose le cookie, puis redirige.
2. **`src/proxy.ts`** (au même niveau que `src/app`) : `matcher` limité à `/dashboard/:path*` (et `/dashboard`). Si le cookie `mc_connecte` est absent : redirection vers `/auth/login`. Ne rien faire d'autre (pas d'appel réseau, pas d'en-têtes CSP : ils restent dans `next.config.ts`). Commentaire en tête du fichier expliquant que c'est une vérification optimiste et que l'autorisation réelle est faite par l'API (décision D02).
3. **`/debug`** : créer `src/app/debug/layout.tsx` (composant serveur) qui appelle `notFound()` (de `next/navigation`) quand `process.env.NODE_ENV === 'production'`, sinon rend `children`. Ne pas modifier ni supprimer `src/app/debug/page.tsx`. Vérifier qu'aucun lien de l'interface ne pointe vers `/debug` (grep), sinon le signaler.
4. Ne pas changer le comportement existant d'affichage du tableau de bord à partir de l'utilisateur en cache (choix de confort sur réseau lent), ni la logique de refresh.
5. Mettre à jour la ligne « Auth » de la section « Conventions importantes » du `CLAUDE.md` de ce dépôt (une phrase : garde serveur optimiste via `src/proxy.ts` et le cookie témoin `mc_connecte`, autorisation réelle par l'API).

## Contraintes

Faire uniquement ce qui est demandé : pas de refactors, helpers ou abstractions non demandés. Règles d'audience, typographiques et de langue : docs/ORCHESTRATOR.md (commentaires en français, aucun tiret cadratin ni demi-cadratin). Ne pas modifier docs/plans/. Écrire les fichiers uniquement avec Write et Edit, jamais par redirection shell. Ne pas commiter : l'orchestrateur commite. Ne pas toucher à `next.config.ts` (d'autres niveaux de priorité y travaillent).

## Done when

- `npx --no-install tsc --noEmit` : 0 erreur ; `npx --no-install eslint <fichiers touchés>` : 0 erreur, en appliquant la procédure D05 de `docs/plans/runs/2026-10-06-p1-beta/decisions.md` (`useAuth.tsx` porte 8 erreurs préexistantes, par exemple `react-hooks/set-state-in-effect`).
- `npm run build` : succès, et la sortie liste le proxy (ligne « Proxy » ou « ƒ Proxy (Middleware) »).
- Preuve d'exécution avec `npx --no-install next start -p 3117` lancé en arrière-plan dans ce worktree (puis arrêté) :
  - `curl -s -o /dev/null -w "%{http_code} %{redirect_url}" http://localhost:3117/dashboard` : 307 (ou 308) vers `/auth/login` ;
  - même requête avec `-H "Cookie: mc_connecte=1"` : 200 ;
  - `curl -s -o /dev/null -w "%{http_code}" http://localhost:3117/debug` : 404 ;
  - `http://localhost:3117/` : 200.
- Grep : le cookie `mc_connecte` est posé dans `loginUser` et dans les chemins de restauration réussie, et supprimé dans chaque chemin qui retire `access_token` du localStorage.

## Return

Liste des fichiers modifiés ou créés + preuves (commandes lancées, résultat en une ligne chacune). Ou un bloc BLOCKED. Pas de prose.

## Historique

## Validation
