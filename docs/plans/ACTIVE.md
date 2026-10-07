# ACTIVE - MedConnecte (frontend)

Index du run orchestré en cours. 150 lignes max. Protocole : docs/ORCHESTRATOR.md, section 9.
Reprise : lire ce fichier, puis seulement le fichier de la prochaine tâche.

Run: 2026-10-06-p1-beta | Branche: orch/p1-beta | Parallélisme: 5 (1 seul sur l'arbre principal, les autres en worktree) | Audience: mixte par surface (non-dev partout sauf /debug)
Détails: docs/plans/runs/2026-10-06-p1-beta/ (backlog P1 : points 7, 11, 13b côté front ; le reste du run est indexé dans l'ACTIVE.md de back_medconnect)
État: toutes les tâches validées ; run en attente de revue du porteur (merge vers la branche principale et archivage sur sa demande)

## À faire et en cours

| ID | Tâche | Tier | Statut | Tent. |
|----|-------|------|--------|-------|

## Faites (preuve = commit)

- T09 point 7 : garde serveur optimiste du tableau de bord, /debug introuvable en production (363af6e)
- T10 point 11 : sirène SOS hébergée localement (6f35e9f, merge 5333dbf)
- T11 point 13 : CI GitHub Actions du front (da2f0a7, merge 580fdb4)

## Questions parquées

## Dernières décisions (5 max, historique complet dans decisions.md)

- D03 `/debug` introuvable en production, fichier de page conservé (plan)
- D04 sirène générée par un script Node (WAV synthétique) (révisable)
- D05 lint des fichiers touchés : `eslint --fix` puis désactivation ciblée et documentée de la dette (révisable)
- D06 le proxy couvre aussi `/debug` pour renvoyer un vrai statut 404 en production (révisable)
- D07 reprise du run sans sous-agents : validation et commits par l'orchestrateur (user)
