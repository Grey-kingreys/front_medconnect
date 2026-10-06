# T09 - Résilience réseau dans authFetch et remplacement des alert() natifs (point 18)

Tier: dur (agent implementeur-dur)
Audience: non-dev (tous profils, connexions mobiles instables)
Visuel: préventif
Background-safe: oui

## Spec

Contexte : `src/lib/api_auth.ts` (`apiFetch`, `authFetch`, `ApiError`). Tous les appels du front passent par `authFetch` (ou `apiFetch` pour l'authentification). Décisions D11 et D12 dans `docs/plans/runs/2026-10-06-p2-fonctionnalites/decisions.md`. Ce fichier est aussi modifié par un autre chantier : changements localisés dans `apiFetch`/`authFetch`/`ApiError`, ne pas réorganiser le fichier.

A. `apiFetch` / `authFetch` :
1. Délai d'attente de 20 s par tentative via `AbortController` (en respectant un `signal` éventuellement fourni par l'appelant : si l'appelant annule, ne pas réessayer et propager l'annulation).
2. Nouvelle tentative avec attente croissante (1 s puis 3 s, 2 nouvelles tentatives max) **uniquement** pour les lectures (`GET` ou méthode absente, et `HEAD`), et uniquement sur erreur réseau, dépassement du délai ou statut 502, 503, 504. Jamais pour POST, PATCH, PUT, DELETE, ni sur 4xx. La logique de rafraîchissement sur 401 reste identique.
3. Hors connexion (`navigator.onLine === false` avant l'appel, ou échec réseau final) : lever une `ApiError` avec `status: 0` et le message « Vous semblez hors connexion. Vérifiez votre connexion internet puis réessayez. » ; dépassement du délai final : « Le service met trop de temps à répondre. Vérifiez votre connexion puis réessayez. » ; 502/503/504 final : « Le service est momentanément indisponible, réessayez dans quelques instants. ». Réponse non lisible : remplacer « Erreur de réponse du serveur » par « Un problème est survenu, réessayez dans un instant. ». Ne jamais afficher de terme technique.
4. Retirer la journalisation console de chaque requête et de chaque succès (`[API Request]`, `[API Success]`) ; ne garder qu'un `console.warn` concis des échecs finaux, sans corps de réponse ni données (méthode, chemin sans paramètres de requête, statut).
5. `ApiError` : ajouter un champ facultatif `details?: Record<string, unknown>` contenant le corps JSON de l'erreur (pour les écrans qui ont besoin d'un champ supplémentaire), rétrocompatible.
6. Corps `FormData` : ne pas forcer `Content-Type: application/json` quand `options.body` est un `FormData` (le navigateur fixe la frontière multipart).
7. Nouvelle fonction exportée `authDownload(endpoint: string): Promise<{ blob: Blob; filename: string | null }>` : même jeton, même rafraîchissement sur 401, même délai et mêmes nouvelles tentatives (c'est une lecture), renvoie le contenu binaire et le nom tiré de `Content-Disposition` ; erreurs converties en `ApiError` avec les mêmes messages humains. Partager la logique avec `apiFetch`/`authFetch` plutôt que la recopier (petite fonction interne commune si nécessaire).

B. Notifications à l'écran :
1. Créer `src/components/Toast.tsx` (fournisseur + affichage) et `src/hooks/useToast.tsx` (ou un seul fichier si plus naturel, mais hook dans `src/hooks/`) : `const { notifier } = useToast(); notifier("message", "erreur" | "succes" | "info")`. Affichage empilé en haut à droite (en bas centré sur mobile), disparition après 5 s, fermable, `role="status"` (succès, info) ou `role="alert"` (erreur). Style : s'inspirer des toasts locaux existants (`src/app/dashboard/membres/page.tsx` vers la ligne 82, `structures/page.tsx` vers 148) mais en respectant le régime anti-slop (une seule délimitation, contraste AA clair et sombre, tokens existants `secondary-*`, `emergency-*`).
2. Monter le fournisseur dans `src/app/dashboard/layout.tsx` (changement minimal : envelopper le contenu, ce fichier est modifié par une autre tâche sur le menu).
3. Remplacer **tous** les `alert(` natifs de `src/` (liste actuelle : `app/dashboard/carnet/[patientId]/components/AddRecordForms.tsx`, `app/dashboard/chat/page.tsx`, `app/dashboard/diagnostic/page.tsx`, `app/dashboard/mes-structures/page.tsx`, `app/dashboard/rendez-vous/page.tsx`, `components/DoctorAddRecordModal.tsx` ; refaire le grep, d'autres ont pu apparaître) par `notifier(..., "erreur")`. Messages : utiliser `err.message` quand c'est une `ApiError` (déjà humain), sinon un texte humain qui dit quoi faire (« L'ordonnance n'a pas pu être enregistrée. Vérifiez votre connexion puis réessayez. »). Remplacer aussi les textes génériques « Erreur lors de ... » par des formulations de ce type. Ne pas migrer les toasts locaux existants (D11).
4. Ne pas toucher aux `confirm(` natifs s'il y en a (hors tâche), mais les lister dans le Return.

## Contraintes

Faire uniquement ce qui est demandé : pas de refactors, helpers ou abstractions non demandés. Règles d'audience, visuelles, typographiques et de langue : docs/ORCHESTRATOR.md (sections 1 à 5, 14). Next.js 16 : composants client (`"use client"`), lire `node_modules/next/dist/docs/` si une API Next est concernée. Ne pas modifier docs/plans/. Écrire les fichiers uniquement avec Write et Edit, jamais par redirection shell. Aucun tiret cadratin ou demi-cadratin dans les lignes ajoutées. Aucun commit.

## Done when

- `npx --no-install tsc --noEmit` sans erreur ; eslint des fichiers touchés : aucune erreur nouvelle (lister à part les préexistantes).
- `grep -rn "alert(" src --include=*.ts --include=*.tsx` : 0 appel natif restant (les occurrences dans des noms comme `emergencyAlert` ou `setAlert` ne comptent pas, les montrer).
- `grep -n "console.log" src/lib/api_auth.ts` : 0 résultat.
- Les nouvelles tentatives ne s'appliquent qu'aux lectures (lignes citées) ; `FormData` respecté ; `authDownload` exporté.
- Termes interdits : 0 occurrence dans les chaînes visibles ajoutées (grep montré).

## Return

Fichiers modifiés et créés + preuves (commande lancée, résultat en une ligne). Ou un bloc BLOCKED. Pas de prose.

## Historique

## Validation
