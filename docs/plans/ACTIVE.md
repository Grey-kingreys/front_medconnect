# ACTIVE - MedConnecte (frontend)

Index du run orchestré en cours. 150 lignes max. Protocole : docs/ORCHESTRATOR.md, section 9.
Reprise : lire ce fichier, puis seulement le fichier de la prochaine tâche.

Run: 2026-10-20-lot1 | Branche: orch/lot1-front | Parallélisme: 5 (1 seul sur l'arbre principal, les autres en worktree) | Audience: mixte par surface (non-dev partout sauf /debug)
Détails: docs/plans/runs/2026-10-20-lot1/ (tasks/, rapports/, decisions.md)

## À faire et en cours

| ID | Tâche | Tier | Statut | Tent. |
|----|-------|------|--------|-------|

## Faites (preuve = commit)

- F1 Alertes SOS selon la permission sos:respond : validé par le chef front (commit « fix(sos): ... (F1) », rapports/F1-chef.md)

## Questions parquées

## Dernières décisions (5 max, historique complet dans decisions.md)

- D02 SOS : aucune écoute tant que le profil n'est pas chargé, pas de repli sur le rôle
- D03 SOS : reconnexion seulement si utilisateur ou droit change, perte du droit = déconnexion
- D04 code `sos:respond` en littéral, pas de fichier de constantes
- D05 EmergencyButton (patient) hors périmètre F1
- D06 dette lint d'EmergencyListener non traitée dans F1
