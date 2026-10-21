# ACTIVE - MedConnecte (frontend)

Index du run orchestré en cours. 150 lignes max. Protocole : docs/ORCHESTRATOR.md, section 9.
Reprise : lire ce fichier, puis seulement le fichier de la prochaine tâche.

Run: 2026-10-21-lot4 | Branche: orch/lot4-front | Parallélisme: 5 (1 seul sur l'arbre principal, les autres en worktree) | Audience: mixte par surface (non-dev partout sauf /debug)
Détails: docs/plans/runs/2026-10-21-lot4/ (tasks/, rapports/, decisions.md). Run précédent à archiver : docs/plans/runs/2026-10-21-lot3/ (F7 = 39fa4b1)

## À faire et en cours

| ID | Tâche | Tier | Statut | Tent. |
|----|-------|------|--------|-------|
| F8 | Structure créée sans invitation (avertissement, renvoi, 503 lisible) et un seul sondage des notifications, suspendu onglet caché (tasks/F8-invitation-et-sondage-notifications.md) | spécifié | à faire | 0 |

## Faites (preuve = commit)

## Questions parquées

- (lot3) Noms des champs de position du SOS et en-tête `Idempotency-Key` : à confirmer avec B6 (orch/lot3-back) avant l'intégration (lot3 D02)
- Emplacement exact de `invitationEnvoyee` (data ou racine) et forme du 503 EMAIL_INDISPONIBLE : à confirmer avec orch/lot4-back ; le front accepte les deux (D01, D02)

## Dernières décisions (5 max, historique complet dans decisions.md)

- D01 invitation non envoyée = `invitationEnvoyee === false` (data ou racine), absent = envoyée
- D02 502/503/504 avec `code` dans le corps : réponse du serveur rendue telle quelle, sans nouvel essai
- D03 création sans invitation : fenêtre gardée ouverte, écran de résultat avec renvoi
- D06 un seul sondage : NotificationsProvider dans le layout, cloches abonnées à l'état partagé
- D07 sondage 30 s suspendu onglet caché, reprise immédiate, pas de requêtes en parallèle
