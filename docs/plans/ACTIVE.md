# ACTIVE - MedConnecte (frontend)

Index du run orchestré en cours. 150 lignes max. Protocole : docs/ORCHESTRATOR.md, section 9.
Reprise : lire ce fichier, puis seulement le fichier de la prochaine tâche.

Run: 2026-10-25-pharmacie-t1 (tranche pharmacie 1, partie front) | Branche: orch/pharmacie-t1-front | Parallélisme: 1 | Audience: non-dev (écrans de la pharmacie)
Détails du run (fiches, décisions, rapports) : dans le dépôt back, back_medconnect/docs/plans/runs/2026-10-25-pharmacie-t1/ (tasks/PF*.md, decisions.md D683 à D709, rapports/). Suivi complet : back_medconnect/docs/plans/ACTIVE.md. Contrat du back : orch/pharmacie-t1-back (tête 0ae19c1, PB01 à PB19 validés ; puis correctif D707 de l'upsert du stock commité avec PF02b), non fusionné vers dev.
Run précédent terminé : docs/plans/runs/2026-10-22-lot9/ (F14 = 430e02d, F15 = d338e70, fusionnés par la PR #39).

## À faire et en cours (ordre d'exécution, un commit par fiche)

| ID | Tâche | Statut |
|----|-------|--------|
| PF01a | Socle front de la caisse | validé (D705, rapports/PF01a-chef.md du run) |
| PF01b | Écran de vente : unité, paiements | validé (D706, rapports/PF01b-chef.md du run) |
| PF02a | Page stock : correction, aperçu | validé (rapports/PF02a-chef.md du run) |
| PF02b | Fiche produit : deux prix, qualification | validé (D707 avec correction du back, rapports/PF02b-chef.md du run) |
| PF07a | Réception, livraison, fournisseurs | validé (D708, rapports/PF07a-chef.md du run) |
| PF07b | Détail d'une réception, sorties de stock | validé (D709, rapports/PF07b-chef.md du run) |
| PF07c | Inventaire par lot | validé (D710, rapports/PF07c-chef.md du run) |
| PF07d | Import Excel livraison et inventaire | à faire |
| PF03a | Ma caisse : ouverture, comptage | à faire |
| PF03b | Ma caisse : mouvements, fermeture | à faire |
| PF04 | Annulation et ventes du jour | à faire |
| PF05 | Clôture journalière | à faire |
| PF06a | File d'anomalies | à faire |
| PF06b | Alertes de péremption et marge | à faire |

Arrêt obligatoire avant le desktop (PD01 à PD05) : le porteur teste d'abord.

## Faites (preuve = commit)

- (lot9) F14 Ma pharmacie = 430e02d ; F15 Accueil pilotage et comptoir = d338e70 (PR #39)
- (lot8) F13 Reçu et ventes du jour = PR #35
- (lot7) F12 Nouvelle vente = 67bc6eb

## Questions parquées

- (lot3) Noms des champs de position du SOS et en-tête `Idempotency-Key` : à confirmer avec B6 (orch/lot3-back) avant l'intégration (lot3 D02)
- (lot4) Emplacement exact de `invitationEnvoyee` (data ou racine) et forme du 503 EMAIL_INDISPONIBLE : à confirmer avec orch/lot4-back ; le front accepte les deux (lot4 D01, D02)
- (lot5) Règles du mot de passe dans `UserModal` (création d'utilisateur par un administrateur, 8 caractères seulement) : à aligner si le back exige aussi majuscule, minuscule et chiffre (lot5 D20)
- (lot7) Lecture du stock par le vendeur : `GET /pharmacie/stock/:structureId` exige `stock:read` ET `stock:write` (lot7 D06, lot7b D02) ; à revoir avec la tranche pharmacie 1
- (pharmacie-t1) Le rôle Pharmacien n'a ni `reception:write` ni `inventaire:write` (D598, D704) : le porteur dit s'il faut les lui donner

## Dernières décisions (5 max, historique complet dans le decisions.md du run, dépôt back)

- D709 Une quantité de lot se lit avec le coefficient du lot (`coefficientDuLot`, repli sur la fiche)
- D708 Garde de navigation : `couvreSousPages` étend la règle d'une entrée à ses sous-pages (réceptions)
- D687 Message du serveur affiché tel quel, réessai seulement sur erreur réseau, jamais sur un 409
- D688 Un identifiant client par saisie, réutilisé après échec réseau
- D698 Coût ou marge nul affiché « inconnu », jamais 0 GNF
