# ACTIVE - MedConnecte (frontend)

Index du run orchestré en cours. 150 lignes max. Protocole : docs/ORCHESTRATOR.md, section 9.
Reprise : lire ce fichier, puis seulement le fichier de la prochaine tâche.

Run: 2026-10-06-p2-fonctionnalites | Branche: orch/p2-fonctionnalites | Parallélisme: 2 (voie A dans le worktree du run : T05, T09, T10 ; voie B en worktree de tâche : T07, T08, T06) | Audience: mixte par surface (non-dev partout sauf /debug)
Détails: docs/plans/runs/2026-10-06-p2-fonctionnalites/ (niveau P2 du BACKLOG-PRIORISE racine ; back : run jumeau dans back_medconnect, tâches T01 à T04)

## À faire et en cours

| ID | Tâche | Tier | Statut | Tent. |
|----|-------|------|--------|-------|
| T07 | Carnet patient : recherche et filtre (F3) | spécifié | dispatché | 1 |
| T08 | Crédibilité et navigation (17) | spécifié | à faire | 0 |
| T09 | Résilience réseau et notifications (18) | dur | à faire | 0 |
| T10 | Import Excel du stock (F1) | spécifié | à faire | 0 |

## Faites (preuve = commit)

- T05 Ordonnance : saisie avec suggestions du catalogue (F2) : validé, e7ad1b4
- T11 Vaccination : rappel vide non envoyé (signalé par P3) : validé, 4bbb9e6
- T06 SOS : délai et compte à rebours (F5) : validé, commit T06

## Questions parquées

## Dernières décisions (5 max, historique complet dans decisions.md)

- D10 Un seul composant de saisie des médicaments d'ordonnance
- D11 Toast et hook partagés remplacent les alert() ; toasts locaux non migrés (révisable)
- D12 Réseau : 20 s, 2 nouvelles tentatives sur les lectures seulement (révisable)
- D13 Liens de menu morts masqués par liste centrale
- D14 Patient SOS : interrogation périodique de l'alerte en cours (révisable)
