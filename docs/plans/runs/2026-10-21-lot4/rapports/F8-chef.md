# F8 - Validation du chef d'équipe front (Opus)

Date : 2026-10-21
Branche : orch/lot4-front
Verdict : validé

## Ce qui a été fait

- `api_auth.ts` : un 502/503/504 dont le corps JSON porte un `code` texte est rendu tel quel (sans nouvel essai), son message atteint l'utilisateur (D02). Un 503 sans `code` garde l'ancien comportement.
- `api_admin.ts` : type `StructureCreee` et `invitationNonEnvoyee` (data ou racine, absent = envoyée, D01).
- `StructureModal.tsx` : écran « Structure créée » avec avertissement, renvoi, message du serveur en cas d'échec, confirmation après renvoi (D03, D04).
- `structures/page.tsx` : le renvoi affiche le message du serveur au lieu de « Erreur lors de l'envoi » ; lint du fichier assaini.
- `useNotifications.tsx` (nouveau) + `NotificationBell.tsx` + `layout.tsx` : un seul sondage de 30 s par onglet, suspendu onglet caché, partagé par les deux cloches (D05, D06, D07).
- 3 fichiers de tests nouveaux (14 cas).

## Preuves (relancées par le chef)

- `tsc --noEmit` : code 0, aucune sortie.
- `eslint` sur les 10 fichiers : 0 erreur, 2 avertissements tolérés (`ApiError`, `apiFetch` dans `api_admin.ts`, préexistants).
- `vitest run` : 28 fichiers, 161 tests passés.
- `NotificationBell` : seuls usages dans `dashboard/layout.tsx` (l.328 et l.524), tous deux sous `NotificationsProvider` ; aucun `setInterval` dans la cloche.
- Aucun tiret cadratin ni demi-cadratin dans les lignes ajoutées ni dans les nouveaux fichiers.

## Revue du diff

Conforme à la spec point par point. Pas de `any` ajouté, textes à l'écran en français, sans « serveur », « 503 » ni « code ». Aucune autre page n'utilise la cloche hors fournisseur, donc pas de risque d'exception `useNotifications` hors contexte. Le dépôt mobile n'est pas touché (le changement de `api_auth.ts` ne concerne que le web).

## Décisions

- `docs/plans/ACTIVE.md` inclus dans le commit (consigne de l'orchestrateur), malgré la remarque du vérificateur qui le visait pour le codeur.
- Indentation non retouchée des enfants de `NotificationsProvider` dans `layout.tsx` : cosmétique, laissée telle quelle (pas de diff de bruit).

## Réserves

- Rendu clair et sombre du bloc d'avertissement non vérifié dans un navigateur (classes prescrites par la spec, couleurs existantes).
- Emplacement de `invitationEnvoyee` et forme du 503 `EMAIL_INDISPONIBLE` à confirmer avec orch/lot4-back à l'intégration (le front accepte data et racine).
