# ACTIVE - MedConnecte (frontend)

Index du run orchestré en cours. 150 lignes max. Protocole : docs/ORCHESTRATOR.md, section 9.
Reprise : lire ce fichier, puis seulement le fichier de la prochaine tâche.

Run: 2026-10-06-p2-fonctionnalites | Branche: orch/p2-fonctionnalites | Parallélisme: 2 (voie A dans le worktree du run : T05, T09, T10 ; voie B en worktree de tâche : T07, T08, T06) | Audience: mixte par surface (non-dev partout sauf /debug)
Détails: docs/plans/runs/2026-10-06-p2-fonctionnalites/ (niveau P2 du BACKLOG-PRIORISE racine ; back : run jumeau dans back_medconnect, tâches T01 à T04)

## À faire et en cours

| ID | Tâche | Tier | Statut | Tent. |
|----|-------|------|--------|-------|

## Faites (preuve = commit)

- T05 Ordonnance : saisie avec suggestions du catalogue (F2) : validé, e7ad1b4
- T11 Vaccination : rappel vide non envoyé (signalé par P3) : validé, 4bbb9e6
- T06 SOS : délai et compte à rebours (F5) : validé, 4d86c52
- T07 Carnet patient : recherche et filtre (F3) : validé, 5f3ba3e (merge e0b7a4b)
- T08 Crédibilité et navigation (17) : validé, 03578ef
- T09 Résilience réseau et notifications (18) : validé, b770453
- T10 Import Excel du stock (F1) : validé, 9709242

Toutes les tâches validées le 2026-10-07 ; `npm run build` vert sur orch/p2-fonctionnalites. Archivage du run après relecture du porteur (merge vers la branche principale sur sa demande uniquement).

## Questions parquées

- Q1 Parcours navigateur et relecture « utilisateur novice » non joués (aucun serveur ni base) : à faire avant merge.
- Q2 D01, D02, D12, D14 révisables : délai expiré = relance par le patient, anti-doublon 5 min, 20 s et 2 tentatives réseau, relecture SOS toutes les 20 s.

## Dernières décisions (5 max, historique complet dans decisions.md)

- D13 Liens de menu morts masqués par liste centrale
- D14 Patient SOS : interrogation périodique de l'alerte en cours (révisable)
- D15 Lint : dette préexistante neutralisée par en-tête eslint ciblé
- D16 Run repris sans sous-agents, parcours navigateur non joué
- D17 T11 ajoutée : rappel de vaccination vide non envoyé (signalé par P3)
