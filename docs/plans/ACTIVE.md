# ACTIVE - MedConnecte (frontend)

Index du run orchestré en cours. 150 lignes max. Protocole : docs/ORCHESTRATOR.md, section 9.
Reprise : lire ce fichier, puis seulement le fichier de la prochaine tâche.

Run: 2026-10-21-lot3 | Branche: orch/lot3-front | Parallélisme: 5 (1 seul sur l'arbre principal, les autres en worktree) | Audience: mixte par surface (non-dev partout sauf /debug)
Détails: docs/plans/runs/2026-10-21-lot3/ (tasks/, rapports/, decisions.md)

## À faire et en cours

| ID | Tâche | Tier | Statut | Tent. |
|----|-------|------|--------|-------|
| F7 | Géolocalisation précise : utilitaire partagé, précision du SOS, numéro d'urgence configuré, clé d'idempotence (tasks/F7-geolocalisation-precise.md) | spécifié | à faire | 0 |

## Faites (preuve = commit)

## Questions parquées

- Noms des champs de position du SOS (`precision`, `horodatagePosition`, `source` = `navigateur`) et en-tête `Idempotency-Key` : à confirmer avec B6 (orch/lot3-back) avant l'intégration (D02)

## Dernières décisions (5 max, historique complet dans decisions.md)

- D01 utilitaire unique src/lib/geolocalisation.ts, jamais d'exception, réglages SOS (50 m, 10 s) et rapides
- D02 champs envoyés au SOS : precision, horodatagePosition, source « navigateur » (à aligner sur B6)
- D04 attente de la position bornée à 10 s depuis l'appui ; annulation pendant l'attente abandonne l'envoi
- D05 clé d'idempotence : nouvelle à chaque appui et à chaque relance volontaire, gardée sur « Réessayer l'envoi »
- D07 numéro d'urgence lu dans GET /app/config, « 15 » en repli, « (SAMU) » retiré
