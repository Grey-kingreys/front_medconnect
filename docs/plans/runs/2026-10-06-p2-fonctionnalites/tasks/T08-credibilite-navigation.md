# T08 - Crédibilité et navigation : mention invérifiable, liens de menu morts, sitemap (point 17)

Tier: spécifié (agent implementeur-specifie)
Audience: non-dev
Visuel: préventif
Background-safe: oui

## Spec

Décision D13 dans `docs/plans/runs/2026-10-06-p2-fonctionnalites/decisions.md`.

1. `src/app/dashboard/diagnostic/page.tsx` vers la ligne 88 à 93 : la mention « Validé par une équipe de 12 médecins » (et la rangée d'avatars « Dr » factices qui l'accompagne) est invérifiable. La neutraliser sans chiffre inventé : remplacer le texte par un rappel honnête, par exemple « Aide à l'orientation : ne remplace pas l'avis d'un médecin. » (pas de chiffre, pas d'avatars factices). Garder la mise en page (même emplacement, mêmes styles de texte). Ne pas toucher au reste de la page (les `alert()` sont traités par une autre tâche).
2. `src/app/dashboard/layout.tsx` : les entrées de menu pointant vers des routes qui n'existent pas sous `src/app/` (`/dashboard/stats` pour l'administrateur d'établissement et l'administrateur, `/dashboard/config`, `/dashboard/securite` pour le super administrateur ; vérifier la liste exacte en comparant chaque `href` du menu avec les dossiers `src/app/**/page.tsx`) sont masquées, sans supprimer leur déclaration : une constante unique en tête de fichier, par exemple `const ROUTES_NON_DISPONIBLES = new Set([...])` commentée (« pages pas encore créées : réafficher le lien en retirant la route de cette liste »), appliquée en filtrant les entrées au moment où le menu est construit. Une section de menu qui deviendrait vide ne doit pas afficher son titre seul.
3. `src/app/sitemap.ts` : ne lister que les vraies routes publiques existantes (vérifier dans `src/app/` : accueil `/`, `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/catalogue`, `/cgu`, `/confidentialite`, `/mentions-legales`, `/rgpd`). Les entrées vers des pages inexistantes (`/about`, `/features`, `/pricing`, `/contact`, `/faq`, `/privacy`, `/terms`, `/locations/*`, `/services/*`) sont retirées de la sortie ; conserver les listes de villes et de services en commentaire ou dans une constante non utilisée documentée (« à réactiver quand les pages existeront »), sans les supprimer. Garder `changeFrequency` et `priority` cohérents (accueil 1, auth 0.5 à 0.8, pages légales 0.3). Ne pas lister `/dashboard`, `/debug`, `/offline`, `/auth/reset-password`, `/auth/setup-structure`.
4. Vérifier si `src/app/robots.ts` existe : s'il référence des routes inexistantes, le signaler dans le Return sans le modifier.

## Contraintes

Faire uniquement ce qui est demandé : pas de refactors non demandés, pas de création de pages. Règles d'audience, visuelles, typographiques et de langue : docs/ORCHESTRATOR.md (sections 1 à 5, 14). Next.js 16 : lire la doc `node_modules/next/dist/docs/` sur `sitemap` (fichier de métadonnées) avant de modifier `sitemap.ts`. Ne pas modifier docs/plans/. Écrire les fichiers uniquement avec Write et Edit, jamais par redirection shell. Aucun tiret cadratin ou demi-cadratin dans les lignes ajoutées. Aucun commit.

## Done when

- `npx --no-install tsc --noEmit` sans erreur ; eslint des fichiers touchés : aucune erreur nouvelle (lister à part les préexistantes).
- `grep -n "12 médecins" src` : 0 résultat.
- Chaque URL produite par `sitemap.ts` correspond à un `page.tsx` existant (liste montrée en une ligne).
- Chaque `href` de menu restant visible correspond à un `page.tsx` existant (liste des masqués montrée).

## Return

Fichiers modifiés + preuves (commande lancée, résultat en une ligne). Ou un bloc BLOCKED. Pas de prose.

## Historique

## Validation
