# ACTIVE - MedConnecte (frontend)

Index du run orchestré en cours. 150 lignes max. Protocole : docs/ORCHESTRATOR.md, section 9.
Reprise : lire ce fichier, puis seulement le fichier de la prochaine tâche.

Run: 2026-10-20-lot2 | Branche: orch/lot2-front | Parallélisme: 5 (1 seul sur l'arbre principal, les autres en worktree) | Audience: mixte par surface (non-dev partout sauf /debug)
Détails: docs/plans/runs/2026-10-20-lot2/ (tasks/, rapports/, decisions.md)

## À faire et en cours

| ID | Tâche | Tier | Statut | Tent. |
|----|-------|------|--------|-------|
| F4 | Mes appareils connectés, déconnexion à distance et déconnexion forcée (tasks/F4-appareils-connectes.md) | spécifié | à faire | 0 |
| F5 | Message « numéro déjà utilisé » et aide au format du téléphone (tasks/F5-numero-deja-utilise.md) | spécifié | à faire | 0 |

## Faites (preuve = commit)

## Questions parquées

## Dernières décisions (5 max, historique complet dans decisions.md)

- D08 case « Déconnecter mes autres appareils » cochée par défaut, succès visible formulaire fermé
- D13 erreurs du téléphone lues par src/lib/erreur_telephone.ts (3 formulaires)
- D14 détection par details.code : TELEPHONE_DEJA_UTILISE, ou VALIDATION avec champ telephone
- D15 pas de bandeau général si l'erreur ne concerne que le téléphone
- D17 périmètre F5 : inscription, profil, UserModal (setup-structure et structures exclus)
