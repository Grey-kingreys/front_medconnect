# ACTIVE - MedConnecte (frontend)

Index du run orchestré en cours. 150 lignes max. Protocole : docs/ORCHESTRATOR.md, section 9.
Reprise : lire ce fichier, puis seulement le fichier de la prochaine tâche.

Run: 2026-10-22-lot8 | Branche: orch/lot8-front | Parallélisme: 5 (1 seul sur l'arbre principal, les autres en worktree) | Audience: mixte par surface (non-dev partout sauf /debug)
Détails: docs/plans/runs/2026-10-22-lot8/ (tasks/, rapports/, decisions.md). Spécification : SPEC-VENTES-PHARMACIE.md (racine du monorepo). Contrat du back : back_medconnect branche orch/lot8-back (B13 = 6912430). Runs précédents à archiver : docs/plans/runs/2026-10-21-lot3/ (F7 = 39fa4b1), docs/plans/runs/2026-10-21-lot4/ (F8 = b3b4ff6), docs/plans/runs/2026-10-21-lot5/ (F9 = 0ebb5f3, F10 = 71ebfe2), docs/plans/runs/2026-10-21-lot6/ (F11 = 46944b1, correctif f8c6890), docs/plans/runs/2026-10-22-lot7/ (F12 = 67bc6eb), docs/plans/runs/2026-10-22-lot7b/ (D1 = 213a5ec)

## À faire et en cours

| ID | Tâche | Tier | Statut | Tent. |
|----|-------|------|--------|-------|
| F13 | Contrat des ventes aligné sur le back, reçu imprimable, « Ventes du jour » avec annulation, accès depuis l'aperçu pharmacie (tasks/F13-recu-et-ventes-du-jour.md) | spécifié | à faire | 0 |

## Faites (preuve = commit)

- (lot7) F12 Nouvelle vente = 67bc6eb
- (lot7b) D1 Aperçu pharmacie = 213a5ec

## Questions parquées

- (lot3) Noms des champs de position du SOS et en-tête `Idempotency-Key` : à confirmer avec B6 (orch/lot3-back) avant l'intégration (lot3 D02)
- (lot4) Emplacement exact de `invitationEnvoyee` (data ou racine) et forme du 503 EMAIL_INDISPONIBLE : à confirmer avec orch/lot4-back ; le front accepte les deux (lot4 D01, D02)
- (lot5) Règles du mot de passe dans `UserModal` (création d'utilisateur par un administrateur, 8 caractères seulement) : à aligner si le back exige aussi majuscule, minuscule et chiffre (lot5 D20)
- (lot7) Lecture du stock par le vendeur : `GET /pharmacie/stock/:structureId` exige `stock:read` ET `stock:write` ; l'administrateur de pharmacie (`vente:write` sans droit sur le stock) ne peut pas charger « Nouvelle vente » tant que le back n'ouvre pas cette lecture (lot7 D06, lot7b D02)

## Dernières décisions (5 max, historique complet dans decisions.md)

- D01 contrat des ventes pris dans le code de orch/lot8-back (remplace les hypothèses du lot 7)
- D06 panier limité à 50 lignes et 10000 unités par ligne, comme le back
- D11 format du reçu 58 mm par défaut, mémorisé par appareil
- D13 impression isolée par classes `print:` dans le layout du tableau de bord
- D18 « Nouvelle vente » et « Ventes du jour » en barre d'actions de l'aperçu pharmacie
