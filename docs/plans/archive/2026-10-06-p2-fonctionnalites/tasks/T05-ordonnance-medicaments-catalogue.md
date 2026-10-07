# T05 - Ordonnance : saisie des médicaments avec suggestions du catalogue (F2, côté front)

Tier: spécifié (agent implementeur-specifie)
Audience: non-dev (médecin)
Visuel: préventif
Background-safe: oui

## Spec

Contexte : le formulaire d'ordonnance existe en double : `src/components/DoctorAddRecordModal.tsx` (fonction `OrdonnanceForm`, vers la ligne 244) et `src/app/dashboard/carnet/[patientId]/components/AddRecordForms.tsx` (`OrdonnanceForm`, vers la ligne 147). Catalogue : `getMedicaments(search?, categorie?)` dans `src/lib/api_pharmacie.ts` (appelle `GET /pharmacie/catalogue?search=`, type `Medicament` avec `id`, `nom`, `nomGenerique`, `categorie`, `formes`). Création : `createOrdonnance` dans `src/lib/api_carnet.ts`. Côté serveur (fait en parallèle, contrat figé) : chaque ligne `{ nom, dosage, duree, instructions?, medicamentId? }`, `medicamentId` = identifiant catalogue facultatif ; `nom`, `dosage`, `duree` obligatoires ; au moins une ligne ; messages d'erreur serveur déjà en français humain. Décision D10 dans `docs/plans/runs/2026-10-06-p2-fonctionnalites/decisions.md`.

1. Créer **un seul** composant `src/components/OrdonnanceMedicamentsInput.tsx` (client), contrôlé : props `value: LigneMedicament[]`, `onChange(lignes)`. Type `LigneMedicament = { nom: string; dosage: string; duree: string; instructions?: string; medicamentId?: string }` exporté depuis `src/lib/api_carnet.ts` (seul endroit de vérité, réutilisé par `createOrdonnance` à la place du type actuel des médicaments si un type existe déjà : l'étendre plutôt que dupliquer).
2. Pour chaque ligne : champ « Nom du médicament » avec suggestions du catalogue pendant la frappe (à partir de 2 caractères, attente de 300 ms après la dernière frappe, requête annulée ou ignorée si une plus récente part ; 8 suggestions max affichant `nom`, et `nomGenerique`/`categorie` en secondaire). Choisir une suggestion remplit `nom` et `medicamentId`. Modifier ensuite le texte à la main efface `medicamentId` (texte libre). Un petit indicateur discret montre si la ligne est liée au catalogue (« Du catalogue ») ou en saisie libre ; aucune obligation de choisir une suggestion. Aucun résultat : texte « Aucun médicament trouvé dans le catalogue, vous pouvez saisir le nom librement. ». Erreur réseau des suggestions : ne bloque pas la saisie, message discret « Suggestions indisponibles, saisissez le nom librement. ».
3. Champs `dosage` (placeholder actuel conservé), `duree`, `instructions` : reprendre exactement les champs et libellés actuels des deux formulaires (les harmoniser s'ils diffèrent, en gardant les plus clairs). Boutons « Ajouter un médicament » et retirer une ligne (pas de retrait s'il n'en reste qu'une), comme aujourd'hui.
4. Accessibilité : pattern combobox (`role="combobox"`, `aria-expanded`, `aria-controls`, liste `role="listbox"`, options `role="option"`, `aria-activedescendant`), clavier : flèches haut et bas, Entrée pour choisir, Échap pour fermer ; fermeture au clic extérieur. Le champ ne doit pas perdre le focus à chaque frappe (attention : dans `AddRecordForms.tsx`, `OrdonnanceForm` est défini comme composant à l'intérieur d'un autre composant ; vérifier que la saisie ne perd pas le focus et, si c'est le cas, corriger de la façon la plus locale possible).
5. Remplacer le bloc de saisie des médicaments dans les **deux** `OrdonnanceForm` par ce composant ; le reste des formulaires (notes, ordonnance scannée, envoi, gestion d'erreur actuelle) reste inchangé. Les `alert()` présents restent (traités par une autre tâche).
6. Visuel : réutiliser les classes et tokens des champs actuels (fond, bordure, rayon) ; liste de suggestions en surface `bg-white dark:bg-[#0f172a]` avec une seule délimitation (bordure OU ombre, pas les deux en plus d'un fond teinté) ; contraste AA en clair et en sombre.

## Contraintes

Faire uniquement ce qui est demandé : pas de refactors, helpers ou abstractions non demandés. Discipline de code : réutiliser l'existant (`getMedicaments`, types existants) > ranger au bon endroit > n'abstraire qu'à la règle de trois. Règles d'audience, visuelles, typographiques et de langue : docs/ORCHESTRATOR.md (sections 1 à 5, 14). Next.js 16 : lire `node_modules/next/dist/docs/` pertinent si tu touches à une API Next. Ne pas modifier docs/plans/. Écrire les fichiers uniquement avec Write et Edit, jamais par redirection shell. Aucun tiret cadratin ou demi-cadratin dans les lignes ajoutées. Aucun commit.

## Done when

- `npx --no-install tsc --noEmit` sans erreur.
- `npx --no-install eslint <fichiers touchés>` : aucune erreur dans le nouveau composant ; aucune erreur nouvelle dans les fichiers modifiés (lister à part les erreurs préexistantes, en les comparant avec `git stash`-free : `git show HEAD:<fichier>` dans un fichier scratch hors dépôt si besoin).
- `grep` des deux fichiers de formulaire : le bloc de saisie des médicaments n'y est plus dupliqué, les deux importent `OrdonnanceMedicamentsInput`.
- Termes interdits (docs/ORCHESTRATOR.md sections 1 et 14) : 0 occurrence dans les chaînes visibles ajoutées (montrer le grep).
- Le payload envoyé contient `medicamentId` pour une ligne choisie dans les suggestions et ne le contient pas pour une saisie libre (montrer le code concerné en une ligne).

## Return

Fichiers modifiés et créés + preuves (commande lancée, résultat en une ligne). Ou un bloc BLOCKED. Pas de prose.

## Historique

- Tentative 1 (implementeur-specifie) : travail laissé non commité, orchestrateur figé. Repris et validé le 2026-10-07 par l'orchestrateur de reprise ; en-têtes eslint de dette préexistante ajoutés (D15). Suggestions lues via `getCatalogue` (nom réel de la fonction de catalogue dans `api_pharmacie.ts`).

## Validation

- `npx --no-install tsc --noEmit` : 0 erreur.
- `npx --no-install eslint` (4 fichiers touchés) : 0 erreur, 2 avertissements préexistants (variables inutilisées).
- Les deux `OrdonnanceForm` importent `OrdonnanceMedicamentsInput`, plus aucun bloc de saisie dupliqué.
- Saisie manuelle : `delete suivante.medicamentId` ; choix d'une suggestion : `onChange({ ...ligne, nom: m.nom, medicamentId: m.id })`.
- Termes interdits et tirets : 0 occurrence dans les lignes ajoutées.
- Parcours navigateur non joué : aucun serveur ne tourne pendant ce run.
