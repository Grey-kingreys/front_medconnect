# ACTIVE - MedConnecte (frontend)

Index du run orchestré en cours. 150 lignes max. Protocole : docs/ORCHESTRATOR.md, section 9.
Reprise : lire ce fichier, puis seulement le fichier de la prochaine tâche.

Run: 2026-10-21-lot6 | Branche: orch/lot6-front | Parallélisme: 5 (1 seul sur l'arbre principal, les autres en worktree) | Audience: mixte par surface (non-dev partout sauf /debug)
Détails: docs/plans/runs/2026-10-21-lot6/ (tasks/, rapports/, decisions.md). Runs précédents à archiver : docs/plans/runs/2026-10-21-lot3/ (F7 = 39fa4b1), docs/plans/runs/2026-10-21-lot4/ (F8 = b3b4ff6), docs/plans/runs/2026-10-21-lot5/ (F9 = 0ebb5f3, F10 = 71ebfe2)

## À faire et en cours

| ID | Tâche | Tier | Statut | Tent. |
|----|-------|------|--------|-------|
| F11 | Import Excel du stock : choix du mode Inventaire ou Livraison, colonne « avant → après » dans l'aperçu (tasks/F11-import-stock-mode-et-evolution.md) | spécifié | à faire | 0 |

## Faites (preuve = commit)

## Questions parquées

- (lot3) Noms des champs de position du SOS et en-tête `Idempotency-Key` : à confirmer avec B6 (orch/lot3-back) avant l'intégration (lot3 D02)
- (lot4) Emplacement exact de `invitationEnvoyee` (data ou racine) et forme du 503 EMAIL_INDISPONIBLE : à confirmer avec orch/lot4-back ; le front accepte les deux (lot4 D01, D02)
- (lot5) Règles du mot de passe dans `UserModal` (création d'utilisateur par un administrateur, 8 caractères seulement) : à aligner si le back exige aussi majuscule, minuscule et chiffre (lot5 D20)
- Import du stock (orch/lot6-back) : valeurs du champ multipart `mode` (`remplacer`, `ajouter`, absent = remplacer) et noms `quantiteAvant`, `quantiteApres` dans chaque ligne de l'aperçu, à confirmer avant l'intégration ; déployer le back avant le front (D01, D07)

## Dernières décisions (5 max, historique complet dans decisions.md)

- D01 champ `mode` : `remplacer` (défaut) ou `ajouter`
- D02 mode à l'étape 1 et 2, changement = nouvel aperçu, échec = retour au mode précédent
- D03 mode gardé au changement de fichier, remis à Inventaire à la fermeture
- D04 colonne « Stock » après « Quantité », vide sur un ancien serveur
- D05 option `modes` facultative dans la modale générique, catalogue et page du stock inchangés
