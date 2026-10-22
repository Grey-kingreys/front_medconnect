# ACTIVE - MedConnecte (frontend)

Index du run orchestré en cours. 150 lignes max. Protocole : docs/ORCHESTRATOR.md, section 9.
Reprise : lire ce fichier, puis seulement le fichier de la prochaine tâche.

Run: 2026-10-22-lot7b | Branche: orch/lot7b-front | Parallélisme: 5 (1 seul sur l'arbre principal, les autres en worktree) | Audience: mixte par surface (non-dev partout sauf /debug)
Détails: docs/plans/runs/2026-10-22-lot7b/ (tasks/, rapports/, decisions.md). Worktree D:\tmp\wt-front-lot7b, gate locale (npx --no-install). Runs précédents à archiver : docs/plans/runs/2026-10-21-lot3/ (F7 = 39fa4b1), docs/plans/runs/2026-10-21-lot4/ (F8 = b3b4ff6), docs/plans/runs/2026-10-21-lot5/ (F9 = 0ebb5f3, F10 = 71ebfe2), docs/plans/runs/2026-10-21-lot6/ (F11 = 46944b1, correctif f8c6890)

## À faire et en cours

| ID | Tâche | Tier | Statut | Tent. |
|----|-------|------|--------|-------|
| D1 | Tableau de bord d'une pharmacie : aperçu du stock, « À surveiller », accès rapides Importer et Catalogue (tasks/D1-apercu-pharmacie.md) | spécifié | à faire | 0 |

## Faites (preuve = commit)

## Questions parquées

- (lot3) Noms des champs de position du SOS et en-tête `Idempotency-Key` : à confirmer avec B6 (orch/lot3-back) avant l'intégration (lot3 D02)
- (lot4) Emplacement exact de `invitationEnvoyee` (data ou racine) et forme du 503 EMAIL_INDISPONIBLE : à confirmer avec orch/lot4-back ; le front accepte les deux (lot4 D01, D02)
- (lot5) Règles du mot de passe dans `UserModal` (création d'utilisateur par un administrateur, 8 caractères seulement) : à aligner si le back exige aussi majuscule, minuscule et chiffre (lot5 D20)
- (lot7b) Back : l'administrateur de pharmacie n'a ni `stock:read` ni `stock:write` (rôle par défaut) et `GET /pharmacie/stock/:structureId` exige les deux ; sans tâche back, ni menu « Stock » ni chiffres du stock pour lui (D01, D02)

## Dernières décisions (5 max, historique complet dans decisions.md)

- D01 règle de l'entrée `stock` du registre inchangée : la cause est le rôle par défaut côté back
- D03 aperçu dédié `ApercuPharmacie` à la place des cartes génériques pour une pharmacie
- D05 seuils : stock bas < 10, péremption proche 0 à 60 jours, jour UTC
- D11 raccourcis « Importer le stock » et « Catalogue des médicaments » sans entrée de menu
- D12 la page Stock ouvre l'import sur `?importer=1`
