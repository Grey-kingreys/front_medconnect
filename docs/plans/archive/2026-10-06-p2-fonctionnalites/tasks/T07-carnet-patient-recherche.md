# T07 - Carnet d'un patient vu par le soignant : recherche et filtre par type (F3)

Tier: spécifié (agent implementeur-specifie)
Audience: non-dev (médecin, agent d'accueil, administrateur d'établissement)
Visuel: préventif
Background-safe: oui

## Spec

Contexte : `src/app/dashboard/carnet/[patientId]/page.tsx` affiche le carnet d'un patient (données `getPatientCarnet` de `src/lib/api_carnet.ts`, type `PatientCarnet`) avec son historique (consultations, ordonnances, analyses, vaccinations, rendez-vous, selon ce que la page affiche réellement : le vérifier). Champ de recherche de référence à réutiliser tel quel visuellement : `src/app/dashboard/patients/page.tsx` vers la ligne 102 (icône `Search` de lucide-react positionnée dans le champ, mêmes classes).

1. Ajouter au-dessus de l'historique : un champ de recherche (placeholder « Rechercher dans le carnet (diagnostic, médicament, analyse, vaccin...) ») et un filtre par type sous forme de boutons segmentés ou d'onglets (« Tout », puis un par type réellement présent dans la page, libellés humains au pluriel : Consultations, Ordonnances, Analyses, Vaccinations, Rendez-vous), chacun avec son nombre d'éléments.
2. Filtrage entièrement côté client sur les données déjà chargées (aucun nouvel appel réseau) : recherche insensible à la casse et aux accents (`normalize('NFD')`) sur les champs textuels pertinents de chaque type (ex. consultation : motif, diagnostic, notes, nom du médecin ; ordonnance : noms des médicaments, notes ; analyse : type/nom, résultat ; vaccination : nom du vaccin ; rendez-vous : motif). Garder l'ordre et la présentation actuels des éléments.
3. État vide filtré : message « Aucun élément ne correspond à votre recherche. » + bouton « Effacer la recherche » qui réinitialise recherche et filtre. L'état vide existant (carnet sans historique) reste inchangé.
4. Si la page affiche l'historique en plusieurs sections séparées par type, le filtre « type » masque les autres sections et la recherche filtre à l'intérieur de chacune (masquer une section devenue vide) ; ne pas restructurer la page.
5. Accessibilité : `aria-label` sur le champ, boutons de filtre avec `aria-pressed`, nombre de résultats annoncé (`aria-live="polite"`).
6. Logique de filtrage dans la page (ou un petit hook local au dossier de la route si la page devient trop longue) ; pas d'abstraction partagée.

## Contraintes

Faire uniquement ce qui est demandé : pas de refactors, helpers ou abstractions non demandés. Ne pas modifier `components/AddRecordForms.tsx` (autre tâche). Règles d'audience, visuelles, typographiques et de langue : docs/ORCHESTRATOR.md (sections 1 à 5, 14). Ne pas modifier docs/plans/. Écrire les fichiers uniquement avec Write et Edit, jamais par redirection shell. Aucun tiret cadratin ou demi-cadratin dans les lignes ajoutées. Aucun commit.

## Done when

- `npx --no-install tsc --noEmit` sans erreur ; eslint des fichiers touchés : aucune erreur nouvelle (lister à part les préexistantes).
- Termes interdits : 0 occurrence dans les chaînes visibles ajoutées (grep montré).
- État vide filtré présent avec son action (ligne de code citée).

## Return

Fichiers modifiés et créés + preuves (commande lancée, résultat en une ligne). Ou un bloc BLOCKED. Pas de prose.

## Historique

- Tentative 1 (implementeur-specifie, worktree `front-p2-voieB`) : travail laissé non commité. Repris le 2026-10-07 : expression de retrait des accents réécrite en `\p{Diacritic}` (caractères combinants littéraux illisibles), en-tête de dette eslint (D15). La page n'affiche pas de rendez-vous : 4 types filtrés.

## Validation

- `npx --no-install tsc --noEmit` : 0 erreur.
- `npx --no-install eslint` (page) : 0 erreur, 3 avertissements préexistants.
- État vide filtré : « Aucun élément ne correspond à votre recherche. » + bouton `onClick={effacerRecherche}` (réinitialise recherche et filtre).
- Tirets et termes interdits : 0 occurrence dans les lignes ajoutées.
- Commit 5f3ba3e sur `task/T07-carnet-recherche`, merge e0b7a4b dans `orch/p2-fonctionnalites`.
