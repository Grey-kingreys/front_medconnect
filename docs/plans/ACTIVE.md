# ACTIVE - MedConnecte (frontend)

Index du run orchestré en cours. 150 lignes max. Protocole : docs/ORCHESTRATOR.md, section 9.
Reprise : lire ce fichier, puis seulement le fichier de la prochaine tâche.

Run: 2026-10-06-p3-fond | Branche: orch/p3-fond | Parallélisme: 5 (1 seul sur l'arbre principal, les autres en worktree) | Audience: mixte par surface (non-dev partout sauf /debug)
Détails: docs/plans/runs/2026-10-06-p3-fond/ (niveau P3 du BACKLOG-PRIORISE racine : 20 tests, 21 typage, 23 accessibilité, 24 hors connexion). Volet back : run homonyme dans back_medconnect.

## À faire et en cours

| ID | Tâche | Tier | Statut | Tent. |
|----|-------|------|--------|-------|
| T06 | Schémas Zod des 5 envois médicaux, typage api_carnet | dur | dispatché | 1 |

## Faites (preuve = commit)

- T05 socle Vitest, 12 tests, pre-push (commit « test(socle) »)
- T07 accessibilité des modales (de4b337, merge c330a6e)
- T08 page hors connexion honnête (commit « fix(hors-connexion) »)

## Questions parquées

## Dernières décisions (5 max, historique complet dans decisions.md)

- D01 : Vitest + Testing Library pour le socle de tests (révisable).
- D02 : Zod pour les schémas, module src/lib/schemas/carnet.ts (révisable).
- D03 : accessibilité des modales par un hook unique useDialogA11y (révisable).
- D04 : DoctorAddRecordModal.tsx et AddRecordForms.tsx non modifiés (P2).
- D05 : serwist reste désactivé, page hors connexion sans promesse de mode hors connexion.
