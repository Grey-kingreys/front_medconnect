# Vérification F5 : message « numéro déjà utilisé » et aide au format du téléphone

Date : 2026-10-21 (relance du 13:19, conteneur frontend)
Branche : orch/lot2-front (arbre principal, aucun commit)

## Commandes relancées

| Commande | Résultat |
|---|---|
| `docker compose exec -T frontend npx tsc --noEmit` | 0 erreur (exit 0) |
| `docker compose exec -T frontend npx eslint <les 8 fichiers touchés>` | 0 problème, ni erreur ni avertissement (exit 0) |
| `docker compose exec -T frontend npx vitest run` | 23 fichiers, 125 tests, tous passés (exit 0) |
| `git status --short -- src` | 8 fichiers seulement : 4 modifiés (register/page.tsx, profil/page.tsx, profil/page.test.tsx, UserModal.tsx) et 4 nouveaux (erreur_telephone.ts, erreur_telephone.test.ts, register/page.test.tsx, UserModal.test.tsx) |
| Tirets cadratin et demi-cadratin dans les lignes ajoutées (`git diff -U0 -- src`) | aucun |
| Tirets cadratin et demi-cadratin dans les 4 nouveaux fichiers de test et erreur_telephone*.ts | aucun |
| `grep -c "Exemple : 620 00 00 00" src/lib/erreur_telephone.ts` | 1 |
| Texte d'aide écrit en dur dans register, profil, UserModal | aucun (ils importent AIDE_TELEPHONE) |

## Contrôle du diff et des tests

- Les 3 formulaires suivent le motif commun de la spec (id `telephone-erreur` ou `user-telephone-erreur`, `role="alert"`, `aria-invalid`, `aria-describedby`, bordure `border-emergency-500/50`, effacement à la saisie, `setTelephoneError("")` au début de l'envoi).
- Le profil n'affiche l'aide qu'en mode modification ; le champ reste modifiable après une erreur de téléphone.
- UserModal : imports inutilisés retirés, libellé relié à l'input par `htmlFor` et `id`.
- Nombre de cas : erreur_telephone 7 (spec : 7), register 5 (spec : 5), profil 3 nouveaux (spec : 3), UserModal 3 (spec : 3). Les cas listés dans la spec sont couverts.
- Aucun test existant supprimé ou affaibli : le diff de profil/page.test.tsx n'ajoute que le champ `telephone` au profil mocké et les 3 nouveaux cas.
- Aucun secret ni valeur de numéro hors fixtures de test.
- Hors périmètre : pas de modification du back, pas de modification de la carte Sécurité, pas de changement de l'envoi du téléphone au profil.

## Remarque non bloquante

- `docs/plans/ACTIVE.md` et `docs/plans/runs/2026-10-20-lot2/decisions.md` ont des modifications non commitées (ligne F5 et décisions D13 à D19). Elles sont antérieures au codage et sont la base de la spec : elles ne sont pas une modification de la tâche par le codeur. À committer par l'orchestrateur, pas dans ce lot de code.
- Avertissement git sur les fins de ligne (LF / CRLF) : sans effet sur les résultats.

## Verdict

PASS. Les 5 points « Done when » sont satisfaits. Aucun problème actionnable dans le code.
