# F11 - Import Excel du stock : choix du mode Inventaire ou Livraison, colonne « avant → après » dans l'aperçu

Tier: spécifié (agent implementeur-specifie)
Audience: non-dev (pharmacien et administrateur de pharmacie, page Stock du tableau de bord, fenêtre « Importer depuis Excel »)
Visuel: préventif (un seul nouveau bloc, le choix du mode en deux boutons radio, qui reprend les tokens, rayons et couleurs de la modale existante ; une colonne de plus dans le tableau d'aperçu existant ; clair et sombre)
Background-safe: non, car docker compose exec (typage, lint et tests dans le conteneur frontend)

## Spec

Dépôt : `D:\souleymane\perso-archive-20260923\perso\medconnecte\front_medconnect`, branche `orch/lot6-front` (arbre principal, ne pas changer de branche, ne pas committer). Le back (`back_medconnect`, branche orch/lot6-back en cours) ne doit PAS être modifié. Décisions du run : `docs/plans/runs/2026-10-21-lot6/decisions.md` (D01 à D07, déjà tranchées, ne pas les rediscuter).

### Besoin (porteur)

Aujourd'hui l'import Excel du stock remplace toujours la quantité en stock par celle du fichier. La pharmacie doit pouvoir choisir, avant l'aperçu :

- « Inventaire : remplacer les quantités » (par défaut), explication « Les quantités du fichier deviennent votre stock. » ;
- « Livraison : ajouter aux quantités », explication « Les quantités du fichier s'ajoutent à votre stock actuel. ».

L'aperçu montre pour chaque ligne acceptée le stock avant et après l'import, et rappelle le mode choisi au-dessus du tableau.

### Contrat du back (orch/lot6-back, ne pas modifier ; valeurs fixées par D01)

- `POST /pharmacie/stock/:structureId/import/apercu` et `POST /pharmacie/stock/:structureId/import` : multipart avec `fichier` (inchangé) et un nouveau champ texte `mode` = `"remplacer"` ou `"ajouter"`.
- Chaque ligne acceptée du rapport peut porter `quantiteAvant` (nombre, stock actuel, 0 si le médicament n'est pas encore en stock) et `quantiteApres` (nombre, stock après import selon le mode). Ancien serveur : ces deux champs sont absents et `mode` est ignoré ; le front ne doit alors afficher aucune erreur (la colonne reste vide, D07).

### Fichiers touchés (4, et aucun autre)

1. `src/lib/api_pharmacie.ts` (modifier)
2. `src/lib/api_pharmacie.test.ts` (compléter)
3. `src/components/modals/ImportStockModal.tsx` (modifier)
4. `src/components/modals/ImportStockModal.test.tsx` (compléter et mettre à jour un test)

`src/app/dashboard/stock/page.tsx` et `src/app/dashboard/catalogue/page.tsx` ne changent pas (D05) : la page du stock utilise déjà `ImportStockModal` avec `structureId`.

### 1. `src/lib/api_pharmacie.ts`

Dans la section « Import Excel du stock (F1) » uniquement :

a) Juste avant `export interface LigneImportStock`, ajouter :

```ts
/** Mode d'import du stock : l'inventaire remplace les quantités, la livraison les ajoute (D01). */
export type ModeImportStock = "remplacer" | "ajouter";
```

b) Dans `LigneImportStock`, après `notes?: string;`, ajouter :

```ts
  /** Quantité en stock avant l'import (0 si le médicament n'est pas encore en stock) ; absente sur un ancien serveur. */
  quantiteAvant?: number | null;
  /** Quantité en stock après l'import, selon le mode choisi ; absente sur un ancien serveur. */
  quantiteApres?: number | null;
```

c) Remplacer `corpsImport` par une version qui accepte un mode facultatif (le catalogue continue de l'appeler sans mode, aucun champ `mode` n'est alors ajouté) :

```ts
const corpsImport = (fichier: File, mode?: ModeImportStock) => {
  const formulaire = new FormData();
  formulaire.append("fichier", fichier);
  if (mode) formulaire.append("mode", mode);
  return formulaire;
};
```

d) `apercuImportStock(structureId: string, fichier: File, mode: ModeImportStock = "remplacer")` et `importerStock(structureId: string, fichier: File, mode: ModeImportStock = "remplacer")` : même URL et même méthode qu'aujourd'hui, `body: corpsImport(fichier, mode)`. Docstrings : aperçu « Analyse le fichier sans rien enregistrer, selon le mode choisi. » ; import « Refait l'analyse et enregistre les lignes acceptées : la quantité remplace celle en stock (inventaire) ou s'y ajoute (livraison). ».

Rien d'autre dans ce fichier (fonctions du catalogue inchangées).

### 2. `src/components/modals/ImportStockModal.tsx`

#### 2a. Types (section « Paramétrage d'un import Excel »)

- Nouvelle interface, placée juste avant `ConfigImportExcel` :

```ts
/** Une option du choix du mode d'import (bouton radio). */
export interface OptionModeImport<M extends string> {
  valeur: M;
  /** « Inventaire : remplacer les quantités » */
  libelle: string;
  /** Phrase courte affichée sous le libellé. */
  explication: string;
}
```

- `ConfigImportExcel<L extends LigneImportBase, M extends string = string>` (second paramètre de type ajouté) :
  - nouveau champ facultatif, placé après `colonnes` : `/** Choix du mode d'import, la première option est celle par défaut ; absent : pas de choix. */ modes?: OptionModeImport<M>[];`
  - `textes.confirmation: (n: number, mode?: M) => string;` (les autres textes ne changent pas) ;
  - `apercu: (fichier: File, mode?: M) => Promise<{ data: RapportImport<L> }>;`
  - `importer: (fichier: File, mode?: M) => Promise<{ data: RapportImport<L>; message?: string }>;`
- `ImportExcelModalProps<L extends LigneImportBase, M extends string = string>` avec `config: ConfigImportExcel<L, M>` ; `export function ImportExcelModal<L extends LigneImportBase, M extends string = string>(...)`.
- `CONFIG_IMPORT_CATALOGUE` et `ImportCatalogueModal` ne changent pas (le type `ConfigImportExcel<LigneImportCatalogue>` reste valable, ses fonctions ignorent le mode).

#### 2b. Composant local `ChoixModeImport` (non exporté)

À placer dans le même fichier, juste avant `ImportExcelModal` (après `ImportExcelModalProps`). Props : `{ options: OptionModeImport<M>[]; valeur: M | undefined; onChange: (mode: M) => void; desactive: boolean }`, générique `function ChoixModeImport<M extends string>(...)`. Rendu exact (classes reprises de la modale ; pas de fond teinté, le choix se voit par la bordure) :

```tsx
const groupeId = useId();
return (
  <fieldset className="space-y-2" disabled={desactive}>
    <legend className="block text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 ml-1 mb-2">
      Que contient votre fichier ?
    </legend>
    {options.map((option) => {
      const choisi = option.valeur === valeur;
      const libelleId = `${groupeId}-${option.valeur}-libelle`;
      const explicationId = `${groupeId}-${option.valeur}-explication`;
      return (
        <label
          key={option.valeur}
          className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-colors ${
            choisi ? "border-primary-600 dark:border-primary-400" : "border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600"
          } ${desactive ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <input
            type="radio"
            name={groupeId}
            value={option.valeur}
            checked={choisi}
            onChange={() => onChange(option.valeur)}
            aria-labelledby={libelleId}
            aria-describedby={explicationId}
            className="mt-0.5 w-4 h-4 shrink-0 accent-primary-600"
          />
          <span>
            <span id={libelleId} className="block text-sm font-bold text-slate-900 dark:text-white">{option.libelle}</span>
            <span id={explicationId} className="block text-sm text-slate-700 dark:text-slate-300">{option.explication}</span>
          </span>
        </label>
      );
    })}
  </fieldset>
);
```

#### 2c. Comportement dans `ImportExcelModal` (D02, D03)

- Nouvel état : `const [mode, setMode] = useState<M | undefined>(config.modes?.[0]?.valeur);` (placé avec les autres `useState`, avant le `if (!isOpen) return null;`).
- `recommencer` : inchangé (ne touche pas au mode, D03).
- `fermer` : après `recommencer();` et avant `onClose();`, ajouter `setMode(config.modes?.[0]?.valeur);`.
- `verifier` devient `const verifier = async (modeVoulu: M | undefined = mode, modeSiEchec?: M) => { ... }` :
  - garde `if (!fichier) return;`, `setErreur(null)`, `setChargement("apercu")` comme aujourd'hui, et ajoute `setConfirmation(false)` avant l'appel ;
  - appel : `const res = await config.apercu(fichier, modeVoulu);` puis le même traitement qu'aujourd'hui (`setRapport`, `setSeulementACorriger(false)`, `setConfirmation(false)`, `setEtape("verifier")`) ;
  - dans le `catch`, AVANT le `setErreur(...)` inchangé : `if (modeSiEchec !== undefined) setMode(modeSiEchec);` (l'aperçu précédent reste affiché, l'étape ne change pas).
  - Le bouton « Vérifier le fichier » appelle désormais `onClick={() => verifier()}` (et non plus `onClick={verifier}`, qui passerait l'événement comme mode).
- Nouvelle fonction :

```ts
const changerMode = (nouveau: M) => {
  if (nouveau === mode) return;
  const precedent = mode;
  setMode(nouveau);
  // À l'étape 2, l'aperçu affiché doit toujours correspondre au mode choisi (D02)
  if (etape === "verifier") void verifier(nouveau, precedent);
};
```

- `importer` : appel `config.importer(fichier, mode)` (le mode est celui de l'aperçu affiché, garanti par le retour en arrière en cas d'échec). Le reste est inchangé.

#### 2d. Rendu

- Étape 1 (`etape === "preparer"`) : si `config.modes`, insérer `<ChoixModeImport options={config.modes} valeur={mode} onChange={changerMode} desactive={!!chargement} />` entre le bloc du champ fichier (`<div className="space-y-2">` avec le `<label>` « Votre fichier Excel ») et le bouton « Vérifier le fichier ».
- Étape 2 (`etape === "verifier" && rapport`), si `config.modes` :
  - en tout premier dans le fragment (avant le paragraphe de synthèse `textes.prets`) : le même `<ChoixModeImport ... />` ;
  - juste en dessous, seulement si `chargement === "apercu"` : `<p role="status" className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"><Loader2 className="w-4 h-4 animate-spin" /> Nouvelle vérification du fichier avec ce choix...</p>` ;
  - juste avant `<div className="overflow-x-auto">` du tableau : le rappel du mode, pour l'option dont `valeur === mode` (rien si aucune) :
    `<p className="text-sm text-slate-700 dark:text-slate-300">Mode choisi : <strong className="text-slate-900 dark:text-white">« {option.libelle} »</strong>. {option.explication}</p>`
    (texte lu : « Mode choisi : « Inventaire : remplacer les quantités ». Les quantités du fichier deviennent votre stock. »).
- Étape 2, boutons : le bouton `textes.boutonImporter(...)` et les deux boutons « Choisir un autre fichier » reçoivent `disabled={!!chargement}` et la classe `disabled:opacity-50` (pas d'import possible pendant une nouvelle vérification).
- Confirmation : `{textes.confirmation(rapport.acceptees, mode)}`.
- Sans `config.modes` (catalogue) : aucun bloc de mode, aucun rappel, rendu identique à aujourd'hui.

#### 2e. `configImportStock(structureId)` (D04, D06)

Type de retour : `ConfigImportExcel<LigneImportStock, ModeImportStock>` (importer le type `ModeImportStock` depuis `@/lib/api_pharmacie`).

- `consignes` : les deux premières inchangées ; la troisième devient exactement « Choisissez ensuite si les quantités du fichier remplacent votre stock (inventaire) ou s'y ajoutent (livraison). ».
- `modes` (dans cet ordre, Inventaire par défaut) :
  - `{ valeur: "remplacer", libelle: "Inventaire : remplacer les quantités", explication: "Les quantités du fichier deviennent votre stock." }`
  - `{ valeur: "ajouter", libelle: "Livraison : ajouter aux quantités", explication: "Les quantités du fichier s'ajoutent à votre stock actuel." }`
- `colonnes` : insérer entre « Quantité » et « Prix » : `{ titre: "Stock", rendu: renduEvolutionStock }`, avec, au niveau module juste après `formatDate` :

```tsx
/** « avant → après » pour une ligne du stock ; rien si le serveur ne fournit pas ces quantités (D04, D07). */
const renduEvolutionStock = (l: LigneImportStock) => {
  if (typeof l.quantiteApres !== "number") return null;
  const avant = typeof l.quantiteAvant === "number" ? l.quantiteAvant : 0;
  return (
    <span className="whitespace-nowrap">
      {avant} <span aria-hidden="true">→</span> <span className="sr-only">devient</span> {l.quantiteApres}
    </span>
  );
};
```

  (contenu texte de la cellule : « 5 → devient 15 » ; à l'écran : « 5 → 15 »).
- `textes.confirmation: (n, mode) =>` :
  - `mode === "ajouter"` : `` `Pour ${pluriel(n, "médicament", "médicaments")}, la quantité du fichier sera ajoutée à celle en stock. Confirmer ?` `` ;
  - sinon (texte actuel inchangé) : `` `Pour ${pluriel(n, "médicament", "médicaments")}, la quantité en stock sera remplacée par celle du fichier. Confirmer ?` ``.
- Autres textes inchangés.
- `apercu: (fichier, mode) => apercuImportStock(structureId, fichier, mode)` ; `importer: (fichier, mode) => importerStock(structureId, fichier, mode)`.
- Docstring de `configImportStock` : « Paramétrage de l'import du stock : la quantité du fichier remplace celle en stock (inventaire) ou s'y ajoute (livraison). ».

`ImportStockModal` (export par défaut) ne change pas.

### 3. Tests

#### 3a. `src/lib/api_pharmacie.test.ts` (ajouter un `describe("api_pharmacie, import Excel du stock", ...)`, importer `apercuImportStock` et `importerStock`)

1. `apercuImportStock("s1", f, "ajouter")` : endpoint `/pharmacie/stock/s1/import/apercu`, méthode POST, `FormData` avec `fichier` = f et `mode` = `"ajouter"`.
2. `apercuImportStock("s1", f)` sans mode : `mode` = `"remplacer"`.
3. `importerStock("s1", f, "ajouter")` : endpoint `/pharmacie/stock/s1/import`, POST, `mode` = `"ajouter"`, `fichier` = f.
4. Dans le `describe` du catalogue (ou le nouveau) : `apercuImportCatalogue(f)` envoie un `FormData` dont `get("mode")` est `null`.

#### 3b. `src/components/modals/ImportStockModal.test.tsx`

- Ajouter au `vi.mock("@/lib/api_pharmacie", ...)` : `apercuImportStock: vi.fn()`, `importerStock: vi.fn()`, `telechargerModeleImportStock: vi.fn()`.
- Remplacer l'assertion du test existant « garde le titre et les consignes du stock » sur l'ancienne 3e consigne par la nouvelle (« Choisissez ensuite si les quantités du fichier remplacent votre stock (inventaire) ou s'y ajoutent (livraison). »). Les tests du catalogue restent inchangés et doivent passer.
- Rapport de test du stock : 2 lignes acceptées (`ligne: 2`, `nom: "Doliprane 500"`, `medicamentNom: "Doliprane 500 mg"`, `quantite: 10`, `quantiteAvant: 5`, `quantiteApres: 15` ; `ligne: 3`, `nom: "Amoxicilline"`, `medicamentNom: "Amoxicilline 500 mg"`, `quantite: 4`, `quantiteAvant: 0`, `quantiteApres: 4`) et 1 rejetée (`ligne: 4`, raison au choix) ; un second rapport « ancien serveur » identique sans `quantiteAvant` ni `quantiteApres`.
- Nouveaux cas dans `describe("ImportStockModal en mode stock", ...)` (au moins 9) :
  1. Étape 1 : radios `getByRole("radio", { name: "Inventaire : remplacer les quantités" })` coché et `{ name: "Livraison : ajouter aux quantités" }` non coché ; chacun a sa description accessible (`toHaveAccessibleDescription("Les quantités du fichier deviennent votre stock.")`, et « Les quantités du fichier s'ajoutent à votre stock actuel. ») ; `getByRole("group", { name: "Que contient votre fichier ?" })` présent.
  2. Vérifier sans toucher au mode : `apercuImportStock` appelé avec `("s1", <le fichier>, "remplacer")` ; rappel « Mode choisi : » contenant « Inventaire : remplacer les quantités » au-dessus du tableau ; en-tête de colonne `columnheader` « Stock » ; la ligne `getByRole("row", { name: /Doliprane 500/ })` a le texte « 5 → devient 15 ».
  3. Choisir Livraison à l'étape 1 puis vérifier : `apercuImportStock` appelé avec `"ajouter"` ; rappel avec « Livraison : ajouter aux quantités » et « Les quantités du fichier s'ajoutent à votre stock actuel. ».
  4. Livraison puis import : clic sur « Importer 2 médicaments », texte de confirmation « la quantité du fichier sera ajoutée à celle en stock » visible, clic sur « Confirmer l'import » : `importerStock` appelé une fois avec `("s1", <le fichier>, "ajouter")`.
  5. Inventaire : texte de confirmation « la quantité en stock sera remplacée par celle du fichier », `importerStock` appelé avec `"remplacer"`.
  6. Changer de mode à l'étape 2 relance l'aperçu : après un premier aperçu en Inventaire, clic sur le radio Livraison : `apercuImportStock` appelé 2 fois, la seconde avec `"ajouter"` ; le rappel passe à Livraison ; puis l'import part avec `"ajouter"`.
  7. Échec de la nouvelle vérification : second appel rejeté (`mockRejectedValueOnce(new Error("x"))`) : un `role="alert"` s'affiche, le radio Inventaire est de nouveau coché, le rappel reste Inventaire, le tableau (« Doliprane 500 mg ») reste affiché ; l'import part ensuite avec `"remplacer"`.
  8. Ancien serveur (rapport sans `quantiteAvant`/`quantiteApres`) : en-tête « Stock » présent, aucune occurrence de « → » dans le tableau, aucun `role="alert"`, le bouton « Importer 2 médicaments » est utilisable.
  9. Mode remis à Inventaire à la fermeture : choisir Livraison à l'étape 1, cliquer la croix « Fermer » (premier bouton « Fermer ») : `onClose` appelé et le radio Inventaire est coché (le composant reste monté car `isOpen` reste vrai dans le test).
  10. Import du catalogue : aucun `radio` à l'étape 1 (`queryAllByRole("radio")` vide).

Utiliser `within` de `@testing-library/react` si besoin ; pas de nouveau fichier de test.

### Hors périmètre

Pas de modification du catalogue (hors typage générique), de la page du stock, du back, ni de refactor de la modale au-delà de ce qui est décrit. Pas de nouveau composant partagé dans `src/components/ui`.

## Contraintes

Faire uniquement ce qui est demandé : pas de refactors, helpers ou abstractions non demandés. Discipline de code dans l'ordre : réutiliser l'existant > ranger au bon endroit > n'abstraire qu'à la règle de trois. Règles d'audience, visuelles, typographiques et de langue : docs/ORCHESTRATOR.md (textes visibles en français, sans jargon, sans tiret cadratin ni demi-cadratin ; la flèche « → » est autorisée). Commentaires de code en français. Pas de `any`. Ne pas modifier docs/plans/. Écrire les fichiers uniquement avec Write et Edit, jamais par redirection shell : le hook de garde ne voit pas les écritures faites par Bash.

## Done when

Toutes les commandes lancées depuis `D:\souleymane\perso-archive-20260923\perso\medconnecte` :

1. `docker compose exec -T frontend npx tsc --noEmit` : aucune sortie, code 0.
2. `docker compose exec -T frontend npx eslint src/lib/api_pharmacie.ts src/lib/api_pharmacie.test.ts src/components/modals/ImportStockModal.tsx src/components/modals/ImportStockModal.test.tsx` : 0 erreur, 0 avertissement (code 0).
3. `docker compose exec -T frontend npx vitest run` : tous les tests passent (référence avant la tâche : 36 fichiers, 238 tests), dont les tests existants du catalogue ; au moins 14 nouveaux cas (4 dans `api_pharmacie.test.ts`, 10 dans `ImportStockModal.test.tsx`).
4. `grep -n 'formulaire.append("mode", mode)' front_medconnect/src/lib/api_pharmacie.ts` renvoie 1 ligne ; `grep -c "Inventaire : remplacer les quantités\|Livraison : ajouter aux quantités\|Les quantités du fichier deviennent votre stock.\|Les quantités du fichier s'ajoutent à votre stock actuel." front_medconnect/src/components/modals/ImportStockModal.tsx` renvoie au moins 4.
5. `git -C front_medconnect diff --stat -- src` ne liste que les 4 fichiers de la commande 2 ; `grep -nE "\bany\b" front_medconnect/src/components/modals/ImportStockModal.tsx` ne renvoie rien.
6. Aucun tiret cadratin ni demi-cadratin ajouté : aucun blocage du hook de garde (route-guard ou orchestrator-guard) sur les écritures de la tâche ; le validateur le revérifie au pre-commit.

## Return

Liste des fichiers touchés + preuve (les commandes 1 à 6 du Done when lancées, résultat en une ligne chacune, nombre de tests passés). Ou un bloc BLOCKED. Pas de prose.

## Historique

<!-- une ligne par tentative : AAAA-MM-JJ | tier | résultat | raison si échec -->

## Validation

<!-- commande relancée par l'orchestrateur | résultat en une ligne | hash du commit -->
