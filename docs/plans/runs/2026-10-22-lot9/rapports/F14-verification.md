# F14 - Vérification (2026-10-22)

Branche : orch/lot9-front. Tâche : F14-ma-pharmacie-edition-directe.md. Vérificateur : Haiku 5.5.

## Commandes « Done when » (relancées par le vérificateur)

- Point 1, `docker compose exec -T frontend npx tsc --noEmit` : exit 0, aucune erreur.
- Point 2, `docker compose exec -T frontend npx eslint` (9 fichiers de la fiche) : exit 0, aucun avertissement.
- Point 3, `docker compose exec -T frontend npx vitest run` : 50 fichiers, 427 tests, tous verts. `enregistrement.test.ts` (14), `horaires_structure.test.ts` (9), `page.test.tsx` (7) passent. `StructureModal.test.tsx` (5) passe et n'a pas été modifié (absent de `git status`).
- Point 4, `git status --porcelain --untracked-files=all -- . ":!docs/plans"` : exactement les 9 fichiers attendus (2 modifiés, 7 créés).
- Point 5, grep des tirets cadratin et demi-cadratin sur le diff `src` et les fichiers créés : aucune ligne.
- Point 6, grep `any` / `eslint-disable` sur les 4 fichiers créés : aucune ligne.
- Point 7, grep `Médecins|DonutChart|role ===` sur MaPharmacie.tsx : seule la ligne 663 (filtre `role === "PHARMACIEN"`). `StructureModal` absent de MaPharmacie.tsx.
- Point 8, `rapports/F14-essai-reel.md` : présent, 4 étapes avec statuts HTTP, `estOuvertManuel` à `null` après l'étape 3, ligne « valeurs d'origine restaurées : oui ». grep `eyJ` sans résultat.

## Verdict

Échec de vérification. Toutes les commandes du « Done when » passent, mais `src/app/dashboard/structure/page.tsx` contient deux écarts par rapport à la fiche, toujours présents à ce passage.

## Problèmes à corriger

1. `page.tsx`, chargement initial : `useEffect(() => { fetch(); }, [fetch]);` (HEAD, ligne 58) a été remplacé par `useEffect(() => { void Promise.resolve().then(fetch); }, [fetch]);`. La fiche demande de garder le chargement tel quel. Restaurer la forme d'origine. Si elle déclenche une règle lint, le signaler à l'orchestrateur au lieu de la changer sans accord.
2. `page.tsx`, imports : `updateMyStructure`, `UpdateStructurePayload`, `Save`, `X`, `Loader2` ont été retirés. La fiche dit que les imports devenus inutiles pour la seule branche pharmacie restent. tsc et eslint passent, donc le risque est faible, mais l'écart doit être rétabli ou justifié auprès de l'orchestrateur.

Aucun autre problème relevé : pas de secret dans le diff ni dans le rapport d'essai, aucun test supprimé ou affaibli, aucun tiret cadratin ou demi-cadratin, branche hôpital et clinique inchangée hors les deux points ci-dessus. Non vérifié à la lecture complète : la liste des termes interdits de docs/ORCHESTRATOR.md.

Note hors périmètre : `docs/plans/ACTIVE.md` est modifié dans l'arbre de travail. La fiche interdit de modifier `docs/plans/` hors rapport d'essai. Ce fichier relève probablement de l'orchestrateur ; à vérifier avant tout commit.

Aucun commit effectué.
