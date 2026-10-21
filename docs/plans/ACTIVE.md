# ACTIVE - MedConnecte (frontend)

Index du run orchestré en cours. 150 lignes max. Protocole : docs/ORCHESTRATOR.md, section 9.
Reprise : lire ce fichier, puis seulement le fichier de la prochaine tâche.

Run: 2026-10-20-lot2 | Branche: orch/lot2-front | Parallélisme: 5 (1 seul sur l'arbre principal, les autres en worktree) | Audience: mixte par surface (non-dev partout sauf /debug)
Détails: docs/plans/runs/2026-10-20-lot2/ (tasks/, rapports/, decisions.md)

## À faire et en cours

| ID | Tâche | Tier | Statut | Tent. |
|----|-------|------|--------|-------|
| F4 | Mes appareils connectés, déconnexion à distance et déconnexion forcée (tasks/F4-appareils-connectes.md) | spécifié | à faire | 0 |

## Faites (preuve = commit)

## Questions parquées

## Dernières décisions (5 max, historique complet dans decisions.md)

- D01 page /dashboard/appareils, ouverte depuis la carte Sécurité du profil
- D03 déconnexion forcée centralisée (src/lib/deconnexion_forcee.ts), motif par sessionStorage
- D05 sessionRevoquee écouté sur les 2 connexions en direct existantes, pas de nouvelle connexion
- D07 confirmation par DeleteConfirmModal étendu (icone, libelleEnCours)
- D08 case « Déconnecter mes autres appareils » cochée par défaut, succès visible formulaire fermé
