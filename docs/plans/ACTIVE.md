# ACTIVE - MedConnecte (frontend)

Index du run orchestré en cours. 150 lignes max. Protocole : docs/ORCHESTRATOR.md, section 9.
Reprise : lire ce fichier, puis seulement le fichier de la prochaine tâche.

Run: 2026-10-20-lot1 | Branche: orch/lot1-front | Parallélisme: 5 (1 seul sur l'arbre principal, les autres en worktree) | Audience: mixte par surface (non-dev partout sauf /debug)
Détails: docs/plans/runs/2026-10-20-lot1/ (tasks/, rapports/, decisions.md)

## À faire et en cours

| ID | Tâche | Tier | Statut | Tent. |
|----|-------|------|--------|-------|
| F2 | Compteurs du tableau de bord sur les vraies données (tasks/F2-compteurs-tableau-de-bord.md) | spécifié | à faire | 0 |

## Faites (preuve = commit)

- F1 Alertes SOS selon la permission sos:respond : validé par le chef front (commit « fix(sos): ... (F1) », rapports/F1-chef.md)

## Questions parquées

## Dernières décisions (5 max, historique complet dans decisions.md)

- D08 libellés exacts : « Patients de la structure », « Structures en service »
- D09 RDV à venir du médecin : affectés, futurs, PROGRAMME ou CONFIRME
- D10 compteurs chargés source par source, « Réessayer », 403 = carte masquée
- D11 page du tableau de bord propre au lint, logique dans lib/compteurs_tableau_de_bord.ts
- D12 graphiques fictifs (DashboardCharts) hors périmètre F2, signalés
