# T08 - Page hors connexion honnête

Tier: spécifié (agent implementeur-specifie)
Audience: non-dev
Visuel: préventif (garder le design actuel : mêmes couleurs, icône, boutons ; ne retoucher que le texte)
Background-safe: oui

Worktree de travail : `D:/souleymane/perso-archive-20260923/perso/medconnecte/.worktrees/front-p3-fond` (branche `orch/p3-fond`). Ne travaille que là. Ne commite pas : l'orchestrateur commite.

## Spec

Point 24 du backlog. `src/app/offline/page.tsx` promet que « certaines fonctionnalités restent disponibles hors ligne, comme votre carnet de santé et vos patients déjà consultés » et que « MedConnecte utilise la technologie PWA pour vous accompagner même sans réseau ». C'est faux : serwist est désactivé (`next.config.ts`), rien n'est mis en cache. Décision D05 : serwist reste désactivé.

Réécrire **uniquement les textes** de cette page :
- Titre : « Pas de connexion internet » (ou équivalent ; éviter « hors ligne » jargon, préférer « hors connexion » ou « pas de connexion »).
- Explication honnête : MedConnecte a besoin d'internet pour afficher le carnet de santé et envoyer les informations ; rien n'a été perdu.
- Que faire, concrètement et dans l'ordre : vérifier les données mobiles ou le wifi, se rapprocher d'une zone mieux couverte, puis appuyer sur « Réessayer ».
- **Urgence** : en cas d'urgence vitale sans connexion, appeler directement les secours. Ne pas inventer de numéro : vérifier dans le code s'il existe déjà un numéro d'urgence utilisé ailleurs (grep `tel:` et numéros dans `src/`) ; s'il existe, le réutiliser ; sinon, écrire « appelez les secours ou rendez-vous au centre de santé le plus proche » sans numéro et le signaler dans le Return.
- Supprimer la mention PWA de bas de page (la remplacer par une phrase utile ou rien).
- Garder les deux boutons (Réessayer, Retour au tableau de bord) et leur comportement.

Termes interdits à l'écran (section 14 de docs/ORCHESTRATOR.md) : PWA, service worker, offline, cache, sync, serveur, etc. Vouvoiement, phrases courtes, littératie numérique variée.

## Contraintes

Faire uniquement ce qui est demandé : pas de refactors, helpers ou abstractions non demandés. Ne modifier que `src/app/offline/page.tsx`. Aucun tiret cadratin ni demi-cadratin. Ne pas modifier docs/plans/. Écrire les fichiers uniquement avec Write et Edit, jamais par redirection shell. Next.js 16 : ne pas changer la structure du composant (directive `"use client"`, export par défaut).

## Done when

Dans le worktree :
- `grep -niE "PWA|service worker|offline|hors ligne|cache|serveur|sync" src/app/offline/page.tsx` : aucune occurrence dans les chaînes visibles (le nom de fonction `OfflinePage` est toléré).
- `npx --no-install tsc --noEmit` : aucune erreur.
- `npx --no-install eslint src/app/offline/page.tsx` : aucune erreur (corriger les erreurs préexistantes simples du fichier, par exemple apostrophes non échappées `react/no-unescaped-entities`, et le signaler).
- `git status --porcelain` : seulement `src/app/offline/page.tsx`.

## Return

Chemin + preuves (commande lancée, résultat en une ligne) + textes finaux en clair. Ou un bloc BLOCKED. Pas de prose.

## Historique

2026-10-06 | spécifié | réussi | numéro réutilisé : tel:15 (SAMU) déjà présent dans EmergencyButton.tsx, à confirmer par le porteur pour la Guinée

## Validation

tsc --noEmit | OK | voir commit
eslint src/app/offline/page.tsx | OK (apostrophes échappées) | voir commit
grep termes interdits | seule occurrence : nom de fonction OfflinePage | voir commit
