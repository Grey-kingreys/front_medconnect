# Décisions - run 2026-10-06-p3-fond

Append-only. Une ligne par décision. Consulter par grep avant toute question.

Format : `D<NN> | AAAA-MM-JJ | <décision> | <pourquoi> | tranché par : plan, convention, défaut (révisable) ou user | tâches : T..`

D01 | 2026-10-06 | Socle de tests front : Vitest + @testing-library/react + jsdom, script npm `test` = `vitest run`, lancé par le pre-push avant le build via run_local | Compatible TypeScript et ESM sans configuration Babel, rapide ; choix par défaut du plan de tête | défaut (révisable) | T05
D02 | 2026-10-06 | Schémas de validation Zod dans un nouveau module src/lib/schemas/carnet.ts, types des signatures de api_carnet.ts dérivés par z.infer | Une seule source de vérité des envois médicaux côté front ; Zod est le défaut du plan de tête | défaut (révisable) | T06
D03 | 2026-10-06 | Accessibilité des modales via un hook unique src/hooks/useDialogA11y.ts (rôle dialog, aria-modal, libellé, focus piégé et restauré, Échap) appliqué aux modales de src/components/modals/ | Diff minimal par modale (pas de réécriture du balisage), donc moins de conflits avec P2 | défaut (révisable) | T07
D04 | 2026-10-06 | DoctorAddRecordModal.tsx et AddRecordForms.tsx ne sont pas modifiés ; les types des envois restent compatibles avec leurs appels actuels | P2 les modifie (F2) ; l'alignement fin se fera à la fusion | plan | T06, T07
D05 | 2026-10-06 | serwist reste désactivé ; la page hors connexion dit honnêtement que l'application a besoin du réseau et propose quoi faire | Consigne du plan de tête (point 24) | plan | T08
D06 | 2026-10-06 | Erreurs de lint préexistantes d'un fichier touché, non triviales à corriger sans changer le comportement : neutralisées par eslint-disable-next-line avec commentaire « dette préexistante (point 22) » | Le pre-commit lint les fichiers entiers ; corriger exigerait un refactor hors périmètre | défaut (révisable) | T07
D07 | 2026-10-06 | Page hors connexion : réutilise le numéro 15 (SAMU) déjà présent dans EmergencyButton.tsx ; numéro à confirmer par le porteur pour la Guinée | Ne pas inventer de numéro ; cohérence avec le bouton SOS | défaut (révisable) | T08
