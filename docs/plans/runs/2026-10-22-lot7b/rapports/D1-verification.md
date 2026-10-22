# Vérification D1 : aperçu pharmacie (branche orch/lot7b-front)

Date : 2026-10-22
Dépôt : D:\tmp\wt-front-lot7b (worktree isolé, gate locale, aucun docker compose)

## Commandes relancées

1. `npx --no-install tsc --noEmit` : code 0, aucune sortie.
2. `npx --no-install eslint` sur les 10 fichiers touchés par D1 : code 0, 0 erreur, 0 avertissement. Vérification complémentaire `--report-unused-disable-directives` sur `ApercuPharmacie.tsx` : code 0, la directive `eslint-disable-next-line` est utilisée.
3. `npx --no-install vitest run` : 44 fichiers de test, 345 tests, tous passés, code 0.
4. Greps du Done when : `Aperçu de votre pharmacie|À surveiller|Valeur indicative du stock|Expirent dans les 60 jours` dans `ApercuPharmacie.tsx` = 4 ; `SEUIL_STOCK_BAS = 10` dans `apercu_pharmacie.ts` = 1 ligne ; `importer-stock|catalogue-pharmacie` dans `navigation_tableau_de_bord.ts` = 2 lignes.
5. `\bany\b` dans les deux fichiers source = aucun résultat ; `format_gnf` dans les deux fichiers = aucun résultat.
6. `git diff -- src/lib/navigation_tableau_de_bord.ts` : hunks 4a (import `FileSpreadsheet`), 4b (`RaccourciSupplementaire`, `RACCOURCIS_SUPPLEMENTAIRES`), 4c (corps de `raccourcis`), plus l'entrée `vente` et l'icône `ShoppingCart` d'F12 (autorisées). L'entrée `stock` est inchangée.
7. Tirets cadratin et demi-cadratin (U+2014, U+2013) dans les lignes ajoutées de la tâche : 0 occurrence (contrôle octet par octet, LC_ALL=C).

Tests nouveaux : `apercu_pharmacie.test.ts` 10, `ApercuPharmacie.test.tsx` 12, `navigation_tableau_de_bord.pharmacie.test.ts` 6, `page.test.tsx` 1 nouveau et 1 remplacé, `stock/page.test.tsx` 2. Total : 31 nouveaux cas, plus 1 remplacé. Le total « au moins 32 » du Done when ne se retrouve pas en additionnant la répartition de la spec (29 + 1 remplacé) : écart d'arithmétique de la spec, pas un défaut du code.

## Relecture du diff

- `apercu_pharmacie.ts` : exports et formules conformes à la section 1 (seuils, bornes de péremption, ordre des groupes, détails, coupe à 5, `formaterMontantGNF` avec espaces insécables U+00A0).
- `ApercuPharmacie.tsx` : conforme à la section 2 (états, effets avec garde `actif`, textes exacts, ARIA, bloc « À surveiller », états vide, erreur, sans accès).
- `dashboard/page.tsx` : conforme à la section 3 (`estPharmacie`, `estRouteAutorisee`, placement avant « Stats »).
- `dashboard/stock/page.tsx` : `useEffect` d'ouverture de l'import conforme à la section 5.
- Aucun secret, aucun `any`, aucun test supprimé. Les tests existants de `navigation_tableau_de_bord.test.ts` sont dans le diff F12 (hors périmètre de D1).

## Verdict

PASS. Les quatre gates (tsc, eslint, vitest, greps) sont verts et le code suit la spec.

## Problèmes (non bloquants, à trancher par l'orchestrateur)

1. `src/app/dashboard/stock/page.tsx` : l'import `Loader2` de lucide-react a été retiré. La spec dit « rien d'autre ne change dans ce fichier ». L'import était inutilisé dans HEAD (une seule occurrence, l'import), donc le retrait est sans effet fonctionnel et probablement requis pour le zéro avertissement eslint. À mentionner dans le commit ou à confirmer.
2. `docs/plans/ACTIVE.md` apparaît modifié dans le worktree (index du run : ligne D1 ajoutée, F11 retirée, décisions lot7b). La spec dit « Ne pas modifier docs/plans/ ». Le changement ressemble à une mise à jour de l'orchestrateur et non au codeur, mais il faut le confirmer avant commit pour qu'il ne parte pas avec le code D1.
3. Fichiers modifiés non suivis par D1 mais présents dans le worktree (F12, à ne pas committer avec D1) : `src/lib/acces.ts`, `src/lib/navigation_tableau_de_bord.test.ts`, `src/app/dashboard/vente/`, `src/lib/api_ventes*.ts`, `src/lib/format_gnf*.ts`, et l'entrée `vente` dans `navigation_tableau_de_bord.ts`. Aucun échec de gate n'en vient.

Aucun commit effectué.
