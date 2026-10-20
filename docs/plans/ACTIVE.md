# ACTIVE - MedConnecte (frontend)

Index du run orchestré en cours. 150 lignes max. Protocole : docs/ORCHESTRATOR.md, section 9.
Reprise : lire ce fichier, puis seulement le fichier de la prochaine tâche.

Run: 2026-10-20-lot1 | Branche: orch/lot1-front | Parallélisme: 5 (1 seul sur l'arbre principal, les autres en worktree) | Audience: mixte par surface (non-dev partout sauf /debug)
Détails: docs/plans/runs/2026-10-20-lot1/ (tasks/, rapports/, decisions.md)

## À faire et en cours

| ID | Tâche | Tier | Statut | Tent. |
|----|-------|------|--------|-------|

## Faites (preuve = commit)

- F3 Plus aucun lien vide sur la page d'accueil, test de garde : validé par le chef front (commit « fix(accueil): ... (F3) », rapports/F3-chef.md)

- F2 Compteurs du tableau de bord sur les vraies données : commit a7e1c33 « feat(dashboard): ... (F2) », rapports/F2-chef.md

- F1 Alertes SOS selon la permission sos:respond : validé par le chef front (commit « fix(sos): ... (F1) », rapports/F1-chef.md)

## Questions parquées

## Dernières décisions (5 max, historique complet dans decisions.md)

- D13 seul « href="#" » restant = commentaire de Footer.tsx, reformulé
- D14 test de garde des liens de la page d'accueil (liens_accueil.test.ts)
- D15 juridique et contacts du pied de page non touchés (attente porteur)
- D16 Footer.tsx : Link pour le logo et eslint-disable borné aux icônes, pour passer le pre-commit
- D12 graphiques fictifs (DashboardCharts) hors périmètre F2, signalés
