# ACTIVE - MedConnecte (frontend)

Index du run orchestré en cours. 150 lignes max. Protocole : docs/ORCHESTRATOR.md, section 9.
Reprise : lire ce fichier, puis seulement le fichier de la prochaine tâche.

Run: 2026-10-06-p3-fond | Branche: orch/p3-fond | Parallélisme: 5 (1 seul sur l'arbre principal, les autres en worktree) | Audience: mixte par surface (non-dev partout sauf /debug)
Détails: docs/plans/runs/2026-10-06-p3-fond/ (niveau P3 du BACKLOG-PRIORISE racine : 20 tests, 21 typage, 23 accessibilité, 24 hors connexion). Volet back : run homonyme dans back_medconnect.

## À faire et en cours

| ID | Tâche | Tier | Statut | Tent. |
|----|-------|------|--------|-------|

Run terminé : plus aucune tâche ouverte côté front (reprise 2026-10-07 par l'orchestrateur, sans sous-agent).

## Faites (preuve = commit)

- T06 schémas Zod des 5 envois, typage api_carnet, zod ^4.6.5, 32 tests (6461953)
- T05 socle Vitest, 12 tests, pre-push (commit « test(socle) »)
- T07 accessibilité des modales (de4b337, merge c330a6e)
- T08 page hors connexion honnête (commit « fix(hors-connexion) »)

## Questions parquées

- Pour P2 (bug existant, appelants non modifiés, D04) : les formulaires de vaccination (DoctorAddRecordModal.tsx et AddRecordForms.tsx) envoient `prochainRappel: ""` quand le rappel est laissé vide. Le back le refuse (@IsDateString) ; le front le refuse désormais avant l'envoi avec « Indiquez une date de rappel valide, ou laissez le champ vide. ». Correction côté appelant : ne pas envoyer le champ s'il est vide.
- Pour le porteur : numéro d'urgence 15 réutilisé sur la page hors connexion, à confirmer pour la Guinée (D07).

## Dernières décisions (5 max, historique complet dans decisions.md)

- D04 : DoctorAddRecordModal.tsx et AddRecordForms.tsx non modifiés (P2).
- D05 : serwist reste désactivé, page hors connexion sans promesse de mode hors connexion.
- D06 : lint préexistant d'un fichier touché neutralisé par eslint-disable justifié (révisable).
- D07 : numéro 15 réutilisé sur la page hors connexion, à confirmer (révisable).
- D08 : messages d'erreur des schémas affichables tels quels, `z.guid()` plus souple que @IsUUID (révisable).
