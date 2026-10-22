# ACTIVE - MedConnecte (frontend)

Index du run orchestré en cours. 150 lignes max. Protocole : docs/ORCHESTRATOR.md, section 9.
Reprise : lire ce fichier, puis seulement le fichier de la prochaine tâche.

Run: 2026-10-22-lot7 | Branche: orch/lot7-front | Parallélisme: 5 (1 seul sur l'arbre principal, les autres en worktree) | Audience: mixte par surface (non-dev partout sauf /debug)
Détails: docs/plans/runs/2026-10-22-lot7/ (tasks/, rapports/, decisions.md). Spécification : SPEC-VENTES-PHARMACIE.md (racine du monorepo). Runs précédents à archiver : docs/plans/runs/2026-10-21-lot3/ (F7 = 39fa4b1), docs/plans/runs/2026-10-21-lot4/ (F8 = b3b4ff6), docs/plans/runs/2026-10-21-lot5/ (F9 = 0ebb5f3, F10 = 71ebfe2), docs/plans/runs/2026-10-21-lot6/ (F11 = 46944b1, correctif f8c6890)

## À faire et en cours

| ID | Tâche | Tier | Statut | Tent. |
|----|-------|------|--------|-------|
| F12 | Page « Nouvelle vente » d'une pharmacie : recherche dans le stock, panier, validation, écran de succès (tasks/F12-nouvelle-vente.md) | spécifié | à faire | 0 |

## Faites (preuve = commit)

## Questions parquées

- (lot3) Noms des champs de position du SOS et en-tête `Idempotency-Key` : à confirmer avec B6 (orch/lot3-back) avant l'intégration (lot3 D02)
- (lot4) Emplacement exact de `invitationEnvoyee` (data ou racine) et forme du 503 EMAIL_INDISPONIBLE : à confirmer avec orch/lot4-back ; le front accepte les deux (lot4 D01, D02)
- (lot5) Règles du mot de passe dans `UserModal` (création d'utilisateur par un administrateur, 8 caractères seulement) : à aligner si le back exige aussi majuscule, minuscule et chiffre (lot5 D20)
- (lot7) Contrat des ventes écrit d'après la spécification (orch/lot7-back sans code au 2026-10-22) : à confirmer avant l'intégration, route `POST /pharmacie/:structureId/ventes`, réponse enveloppée `{ data }`, emplacement des lignes d'erreur (`details`, `donnees.details` ou `donnees.lignes`, le front lit les trois), nom de l'objet pharmacie de la réponse (D03, D04, D05)
- (lot7) Lecture du stock par le vendeur : `GET /pharmacie/stock/:structureId` exige `stock:read` ET `stock:write` ; l'administrateur de pharmacie (`vente:write` sans droit sur le stock) ne pourra pas charger la page tant que le back n'ouvre pas cette lecture à `vente:write` (D06)

## Dernières décisions (5 max, historique complet dans decisions.md)

- D07 clé d'idempotence créée avec le panier, gardée jusqu'au succès ou au panier vidé
- D08 panier rangé dans le navigateur sous `medconnecte:panier-vente:<pharmacie>:<utilisateur>`, rapproché du stock à chaque chargement
- D10 409 STOCK_INSUFFISANT : quantité ramenée au disponible, ligne retirée à 0, stock relu, message listant les corrections
- D13 menu « Nouvelle vente » en tête de la section Pharmacie, avec raccourci, invisible en repli
- D15 montants : `formaterGNF` partagé dans `src/lib/format_gnf.ts` (espace insécable, sans décimales)
