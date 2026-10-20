# Vérification F1 - Écoute des alertes SOS selon sos:respond

Date : 2026-10-20
Dépôt : front_medconnect, branche orch/lot1-front (non committé)
Tâche : docs/plans/runs/2026-10-20-lot1/tasks/F1-sos-permission-ecoute.md

## Commandes relancées (depuis medconnecte)

1. `docker compose exec -T frontend npx tsc --noEmit` : sortie vide, code 0. PASS.
2. `docker compose exec -T frontend npx eslint src/components/EmergencyListener.tsx src/components/EmergencyListener.test.tsx` : 0 erreur, 3 avertissements, tous préexistants dans EmergencyListener.tsx (eslint-disable inutile, useCallback inutilisé, Phone inutilisé). Aucun avertissement dans le fichier de test. PASS.
3. `docker compose exec -T frontend npx vitest run` : 10 fichiers, 60 tests verts, dont les 6 cas de src/components/EmergencyListener.test.tsx. PASS.
4. `git diff --name-only` et `git status --porcelain` : côté src/, seuls EmergencyListener.tsx (modifié) et EmergencyListener.test.tsx (nouveau). Voir note ci-dessous sur docs/plans/ACTIVE.md. PASS sur src/.
5. `grep "user.role"` sur EmergencyListener.tsx : aucun résultat. `grep "sos:respond"` : 1 occurrence (ligne 47). PASS.

## Relecture du diff

- EmergencyListener.tsx : conforme à la spec (const { user, profile } ; peutRepondreSOS et utilisateurId ajoutés ; condition `!utilisateurId || !peutRepondreSOS` ; dépendances `[utilisateurId, peutRepondreSOS]`). Aucun autre changement de rendu, texte, ou nettoyage.
- Test : 6 cas conformes à la spec, mocks via vi.hoisted, libellés en français, aucun `any`, pas de test supprimé ou affaibli.
- Tirets cadratin ou demi-cadratin dans les lignes ajoutées : aucun.
- Aucun secret détecté. Le jeton de test "jeton-test" est une valeur factice.

## Verdict

PASS.

## Problèmes

- Note (non bloquante) : docs/plans/ACTIVE.md est modifié dans l'arbre de travail, et docs/plans/runs/ est non suivi. La spec demande de ne pas modifier docs/plans/ côté codeur ; ces changements semblent relever de l'orchestration du run. À confirmer par l'orchestrateur, sans les inclure dans le commit de la tâche.
- Note : les 3 avertissements ESLint dans EmergencyListener.tsx sont préexistants et tolérés par la spec.
