# F9 - Rapport du chef d'équipe front (Opus)

Date : 2026-10-21 | Branche : orch/lot5-front | Statut : validé

## Ce qui a été fait

Menu latéral (ordinateur et téléphone, même composant), raccourcis et cartes de l'accueil, et garde de page tirés d'un registre unique `src/lib/navigation_tableau_de_bord.ts`, évalué sur le contexte d'accès de `src/lib/acces.ts` (mode permissions si /auth/me renvoie `structureType`, sinon repli par rôle identique à l'avant F9 moins les pages inexistantes). `sourcesCompteurs` prend les clés des cartes visibles. Nouveau bloc `PageNonDisponible` affiché par le layout quand la route n'est pas autorisée (mode permissions) ou après un 403 PERMISSION_REFUSEE en lecture (événement `mc:acces-refuse`, hors /dashboard).

Fichiers : src/lib/api_auth.ts, src/lib/acces.ts (+ test), src/lib/navigation_tableau_de_bord.ts (+ test), src/lib/compteurs_tableau_de_bord.ts (+ test), src/components/PageNonDisponible.tsx, src/app/dashboard/layout.tsx (+ test), src/app/dashboard/page.tsx (+ test).

## Preuves (relancées par le chef)

- tsc --noEmit (conteneur frontend) : code 0, aucune sortie.
- eslint sur les 12 fichiers de la tâche : code 0, 0 erreur, 0 avertissement.
- vitest run : 31 fichiers, 193 tests passés (acces 7, navigation 19, layout 5, page 6, compteurs 10).
- grep getNavSections|getQuickActions|getStatsCards|ROUTES_NON_DISPONIBLES dans src : vide.
- Tirets cadratin et demi-cadratin dans les lignes ajoutées et les fichiers créés : 0.
- Revue du diff complète : conforme à la spec (registre, ordre, libellés, rolesRepli, règles estVisible, garde exacte, authFetch limité au GET) ; rendu des cartes et raccourcis inchangé hormis les champs renommés.

## Décisions prises

- ACTIVE.md et le dossier docs/plans/runs/2026-10-21-lot5/ (modifiés par l'orchestrateur, pas par le codeur) sont inclus dans le commit, comme demandé ; le point soulevé par le vérificateur est donc levé.
- Aucune reprise demandée.

## Réserves

- La garde de page est une commodité d'interface : la sécurité reste assurée par le back (403). Sous-pages (ex. /dashboard/patients/[id]) non gardées côté front par choix (D09).
- D10 : tout GET refusé avec PERMISSION_REFUSEE pendant qu'une page est affichée la remplace, y compris si l'appel vient d'un composant du layout. Aujourd'hui seuls les notifications (personnelles) sont chargées au niveau du layout, risque faible ; à surveiller à l'intégration avec orch/lot5-back.
- Contrat /auth/me (`structureType` à la racine de `data`) à confirmer à l'intégration avec orch/lot5-back (question parquée dans ACTIVE.md). Tant que le back est ancien, le front reste en repli par rôle.
- Changement visible voulu par la spec : « Dashboard » devient « Tableau de bord », « Mes Patients » devient « Patients », titres de sections harmonisés ; liens morts stats/config/sécurité retirés aussi des raccourcis de l'accueil.
- Pas de vérification visuelle dans un navigateur (clair et sombre) faite par le chef : le bloc nouveau reprend les classes existantes.
