# ACTIVE - MedConnecte (frontend)

Index du run orchestré en cours. 150 lignes max. Protocole : docs/ORCHESTRATOR.md, section 9.
Reprise : lire ce fichier, puis seulement le fichier de la prochaine tâche.

Run: 2026-10-21-lot5 | Branche: orch/lot5-front | Parallélisme: 5 (1 seul sur l'arbre principal, les autres en worktree) | Audience: mixte par surface (non-dev partout sauf /debug)
Détails: docs/plans/runs/2026-10-21-lot5/ (tasks/, rapports/, decisions.md). Runs précédents à archiver : docs/plans/runs/2026-10-21-lot3/ (F7 = 39fa4b1), docs/plans/runs/2026-10-21-lot4/ (F8 = b3b4ff6)

## À faire et en cours

| ID | Tâche | Tier | Statut | Tent. |
|----|-------|------|--------|-------|
| F9 | Menu latéral et accueil du tableau de bord selon les permissions et le type de structure, garde de page (tasks/F9-menu-et-accueil-selon-permissions.md) | spécifié | à faire | 0 |

## Faites (preuve = commit)

## Questions parquées

- (lot3) Noms des champs de position du SOS et en-tête `Idempotency-Key` : à confirmer avec B6 (orch/lot3-back) avant l'intégration (lot3 D02)
- (lot4) Emplacement exact de `invitationEnvoyee` (data ou racine) et forme du 503 EMAIL_INDISPONIBLE : à confirmer avec orch/lot4-back ; le front accepte les deux (lot4 D01, D02)
- Contrat de GET /auth/me (orch/lot5-back) : `structureType` à la racine de `data` (HOPITAL, CLINIQUE, PHARMACIE ou null) et `permissions` filtrées par type ; 403 avec `code: "PERMISSION_REFUSEE"` (D02, D03, D10)

## Dernières décisions (5 max, historique complet dans decisions.md)

- D02 mode permissions si `structureType` présent dans /auth/me, sinon repli par rôle
- D04 règle : au moins une permission, sauf certaines, types de structure éventuels
- D06 repli : `rolesRepli` reproduit les liens et raccourcis d'avant F9
- D09 garde de page en mode permissions seulement, adresse exacte
- D10 403 PERMISSION_REFUSEE en lecture : événement, même message, sauf sur l'accueil
