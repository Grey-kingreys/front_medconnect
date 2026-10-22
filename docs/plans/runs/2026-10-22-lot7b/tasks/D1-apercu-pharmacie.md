# D1 - Tableau de bord d'une pharmacie : aperçu du stock, liste « À surveiller », accès rapides

Tier: spécifié (agent implementeur-specifie)
Audience: non-dev (pharmacien et administrateur de pharmacie, page d'accueil du tableau de bord `/dashboard`)
Visuel: préventif (un bloc de cartes et une liste qui reprennent les classes des cartes existantes de `src/app/dashboard/page.tsx` ; clair et sombre)
Background-safe: oui (gate locale par `npx --no-install`, pas de docker compose)

## Spec

Dépôt : `D:\tmp\wt-front-lot7b` (worktree isolé), branche `orch/lot7b-front`. Ne pas changer de branche, ne pas committer. Ne jamais utiliser `docker compose` ni l'arbre principal `D:\souleymane\perso-archive-20260923\perso\medconnecte\front_medconnect`. Le back ne doit PAS être modifié. Décisions du run : `docs/plans/runs/2026-10-22-lot7b/decisions.md` (D01 à D14, tranchées, ne pas les rediscuter).

Attention : un autre lot (F12, « Nouvelle vente ») peut avoir des fichiers modifiés ou créés dans ce même dossier (`src/lib/acces.ts`, `src/lib/navigation_tableau_de_bord.ts`, `src/lib/navigation_tableau_de_bord.test.ts`, `src/lib/api_ventes*.ts`, `src/lib/format_gnf*.ts`, `src/app/dashboard/vente/`). Ne pas les modifier, ne pas les annuler, ne pas les utiliser (en particulier ne PAS importer `format_gnf`). Dans `navigation_tableau_de_bord.ts`, ne toucher qu'aux trois endroits décrits en section 4 ; une entrée `vente` peut s'y trouver, la laisser telle quelle. Si un échec de `tsc`, `eslint` ou `vitest` vient uniquement de ces fichiers d'F12, ne pas le corriger : le signaler dans le Return (fichier, erreur en une ligne).

Avant d'écrire du code Next, lire dans `node_modules/next/dist/docs/` ce qui concerne `next/link` et les composants client de l'App Router.

### Contexte (lu dans le code, ne pas revérifier)

- `GET /pharmacie/stock/:structureId` (front : `getMyStock(structureId)` de `src/lib/api_pharmacie.ts`, type `StockInfo`) renvoie `{ data: { stocks: StockMedicament[], alertes: {...} } }`. Chaque `StockMedicament` a `id`, `quantite` (entier >= 0), `prixUnitaire?` (nombre, peut valoir `null` à l'exécution), `dateExpiration?` (chaîne ISO, peut valoir `null`), `medicament.nom`. Le back exige `stock:read` ET `stock:write`.
- L'administrateur de pharmacie par défaut n'a aucun droit sur le stock (D01, D02) : pour lui, l'aperçu affiche un message calme à la place des chiffres du stock, sans appel au stock. Ce n'est pas un bug à corriger dans cette tâche.
- `GET /structures/my` (front : `getMyStructure()` de `src/lib/api_structure.ts`) : `data.membres` = membres de l'équipe (sans l'administrateur).
- Un 403 sur une lecture déclenche `signalerAccesRefuse()` dans `authFetch`, mais le layout l'ignore sur `/dashboard` : rien à faire.

### Fichiers touchés (10, et aucun autre)

1. `src/lib/apercu_pharmacie.ts` (créer)
2. `src/lib/apercu_pharmacie.test.ts` (créer)
3. `src/components/dashboard/ApercuPharmacie.tsx` (créer, dossier nouveau)
4. `src/components/dashboard/ApercuPharmacie.test.tsx` (créer)
5. `src/app/dashboard/page.tsx` (modifier)
6. `src/app/dashboard/page.test.tsx` (modifier un test, en ajouter un)
7. `src/lib/navigation_tableau_de_bord.ts` (modifier, 3 endroits)
8. `src/lib/navigation_tableau_de_bord.pharmacie.test.ts` (créer, D13)
9. `src/app/dashboard/stock/page.tsx` (modifier, un `useEffect`)
10. `src/app/dashboard/stock/page.test.tsx` (créer)

### 1. `src/lib/apercu_pharmacie.ts` (D04 à D08)

En-tête : `/** Chiffres de l'aperçu d'une pharmacie, calculés à partir de son stock (aucune valeur inventée). */`

Exports, exactement :

```ts
import type { StockMedicament } from "./api_pharmacie";

/** Même seuil que le serveur (alerte « stock bas » sous 10 unités). */
export const SEUIL_STOCK_BAS = 10;
/** Fenêtre des péremptions proches, en jours (aujourd'hui compris). */
export const JOURS_EXPIRATION_PROCHE = 60;
/** Nombre de lignes de la liste « À surveiller ». */
export const LIGNES_A_SURVEILLER = 5;

export type RaisonSurveillance = "perime" | "rupture" | "stockBas" | "expireBientot";

export interface LigneASurveiller {
  stockId: string;
  nom: string;
  raison: RaisonSurveillance;
  /** Phrase affichée sous le nom, par exemple « Plus que 4 unités en stock ». */
  detail: string;
}

export interface ApercuStock {
  /** Nombre de lignes du stock. */
  total: number;
  disponibles: number;
  ruptures: number;
  stockBas: number;
  expirentBientot: number;
  perimes: number;
  /** Somme quantité × prix des lignes disponibles qui ont un prix, en GNF. */
  valeur: number;
  /** Lignes disponibles exclues de la valeur faute de prix. */
  sansPrix: number;
  /** Au plus LIGNES_A_SURVEILLER lignes, les plus urgentes d'abord. */
  aSurveiller: LigneASurveiller[];
  /** Nombre total de médicaments à surveiller (avant la coupe à LIGNES_A_SURVEILLER). */
  aSurveillerTotal: number;
}

export function formaterMontantGNF(montant: number): string;
export function calculerApercuStock(stocks: readonly StockMedicament[], maintenant: Date): ApercuStock;
```

Fonctions locales (non exportées) :

- `const pluriel = (n: number, singulier: string, plurielTexte: string) => \`${n} ${n > 1 ? plurielTexte : singulier}\`;` (même forme que dans `ImportStockModal.tsx`, ne pas l'exporter de là-bas).
- `const JOUR_MS = 24 * 60 * 60 * 1000;`
- `jourUTC(date: Date): number` = `Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())`.
- `joursRestants(dateExpiration: string | null | undefined, maintenant: Date): number | null` : `null` si la valeur est absente, vide ou donne une date invalide (`Number.isNaN(d.getTime())`) ; sinon `Math.round((jourUTC(d) - jourUTC(maintenant)) / JOUR_MS)` (négatif = périmé).
- `dateCourte(iso: string): string` = `new Date(iso).toLocaleDateString("fr-FR", { timeZone: "UTC" })` (« 03/11/2026 »).
- `prixValide(prix: unknown): prix is number` = `typeof prix === "number" && Number.isFinite(prix) && prix > 0`.

`formaterMontantGNF(montant)` : `const entier = Math.round(montant);` puis `String(Math.abs(entier)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0")`, préfixé de `-` si `entier < 0`, suivi de `"\u00A0GNF"`. Exemples : `0` donne `"0\u00A0GNF"`, `999` donne `"999\u00A0GNF"`, `1234567.4` donne `"1\u00A0234\u00A0567\u00A0GNF"`.

`calculerApercuStock(stocks, maintenant)` : pour chaque ligne `s`, `q = s.quantite`, `j = joursRestants(s.dateExpiration, maintenant)` :

- `perime = q > 0 && j !== null && j < 0` ;
- `rupture = q <= 0` ;
- `bas = q > 0 && q < SEUIL_STOCK_BAS` ;
- `expireBientot = q > 0 && j !== null && j >= 0 && j <= JOURS_EXPIRATION_PROCHE` ;
- `disponible = q > 0 && !perime`.

Compteurs : `total = stocks.length` ; `disponibles`, `ruptures`, `stockBas`, `expirentBientot`, `perimes` = nombre de lignes où le booléen correspondant est vrai (indépendants : une ligne peut compter dans `stockBas` et `perimes`). Valeur : pour chaque ligne `disponible`, si `prixValide(s.prixUnitaire)` ajouter `q * s.prixUnitaire`, sinon `sansPrix += 1`.

Liste « À surveiller » : chaque ligne reçoit au plus UNE raison, la première vraie dans l'ordre `perime`, `rupture`, `bas`, `expireBientot` (sinon elle n'est pas listée). Détails :

- `perime` : `` `Périmé depuis le ${dateCourte(s.dateExpiration)}` `` ;
- `rupture` : `"Rupture de stock"` ;
- `stockBas` : `` `Plus que ${pluriel(q, "unité", "unités")} en stock` `` ;
- `expireBientot` : `j === 0` donne `` `Expire aujourd'hui (${date})` `` ; `j === 1` donne `` `Expire demain (${date})` `` ; sinon `` `Expire le ${date}, dans ${j} jours` `` (avec `date = dateCourte(...)`).

Ordre : groupes dans l'ordre périmé, rupture, stock bas, expire bientôt. Dans chaque groupe : périmés par `j` croissant (le plus ancien d'abord) ; ruptures par nom (`localeCompare(b, "fr")`) ; stock bas par quantité croissante puis nom ; expire bientôt par `j` croissant puis nom. `nom = s.medicament.nom`. `aSurveillerTotal` = nombre de lignes listables, `aSurveiller` = les `LIGNES_A_SURVEILLER` premières.

### 2. `src/components/dashboard/ApercuPharmacie.tsx`

`"use client";` Export par défaut `ApercuPharmacie`. Props :

```ts
export interface ApercuPharmacieProps {
  structureId: string | undefined;
  /** Le registre ouvre la page Stock à ce profil (D09). */
  peutVoirStock: boolean;
  /** Le registre ouvre la page Équipe à ce profil (D09). */
  peutVoirEquipe: boolean;
  /** Date de référence, pour les tests ; par défaut l'instant du calcul. */
  maintenant?: Date;
}
```

Imports : `useEffect`, `useState`, `useId` de React ; `Link` de `next/link` ; icônes `lucide-react` : `Package`, `XCircle`, `AlertTriangle`, `CalendarClock`, `Ban`, `Wallet`, `Users`, `ArrowRight` ; `getMyStock` de `@/lib/api_pharmacie` ; `getMyStructure` de `@/lib/api_structure` ; `ApiError` de `@/lib/api_auth` ; `calculerApercuStock`, `formaterMontantGNF`, `type ApercuStock`, `type RaisonSurveillance` de `@/lib/apercu_pharmacie`.

#### État et chargement

```ts
type EtatStock = { statut: "chargement" } | { statut: "pret"; apercu: ApercuStock } | { statut: "erreur" } | { statut: "sansAcces" };
type EtatEquipe = { statut: "chargement" } | { statut: "pret"; nombre: number } | { statut: "erreur" } | { statut: "masque" };
```

- `const [etatStock, setEtatStock] = useState<EtatStock>({ statut: "chargement" });`, `const [essaiStock, setEssaiStock] = useState(0);`, idem `etatEquipe` / `essaiEquipe`.
- Effet du stock, dépendances `[structureId, peutVoirStock, essaiStock]` : si `!peutVoirStock || !structureId`, `return` sans rien faire. Sinon `let actif = true;` puis `getMyStock(structureId).then((res) => { if (actif) setEtatStock({ statut: "pret", apercu: calculerApercuStock(res.data.stocks ?? [], maintenant ?? new Date()) }); }).catch((err: unknown) => { if (!actif) return; setEtatStock(err instanceof ApiError && err.status === 403 ? { statut: "sansAcces" } : { statut: "erreur" }); });` et `return () => { actif = false; };`. Aucun `setState` synchrone dans le corps de l'effet (règle `react-hooks/set-state-in-effect`). `maintenant` n'est pas dans les dépendances : ajouter juste au-dessus de la ligne du tableau de dépendances `// eslint-disable-next-line react-hooks/exhaustive-deps` UNIQUEMENT si eslint le signale.
- Effet de l'équipe, dépendances `[peutVoirEquipe, essaiEquipe]` : si `!peutVoirEquipe`, `return`. Sinon `getMyStructure()` : succès `{ statut: "pret", nombre: (res.data.membres ?? []).length }` ; 403 (`ApiError`, status 403) `{ statut: "masque" }` ; autre `{ statut: "erreur" }` ; même garde `actif`.
- `reessayerStock = () => { setEtatStock({ statut: "chargement" }); setEssaiStock((n) => n + 1); }` ; `reessayerEquipe` de même.
- État affiché du stock (dérivé, pas d'état) : `const stock: EtatStock = !peutVoirStock ? { statut: "sansAcces" } : !structureId ? { statut: "erreur" } : etatStock;` (sans structure, on n'appelle rien et on affiche l'erreur ; son bouton « Réessayer » ne fait que relancer l'effet, qui ne fait rien : accepté).
- Carte d'équipe affichée seulement si `peutVoirEquipe && etatEquipe.statut !== "masque"`.

#### Rendu (textes exacts, tous en français, aucun tiret cadratin ni demi-cadratin)

Racine : `<section aria-labelledby={titreId} aria-busy={stock.statut === "chargement" || (peutVoirEquipe && etatEquipe.statut === "chargement")} className="space-y-4">` avec `const titreId = useId();` et le titre `<h2 id={titreId} className="text-lg font-semibold text-slate-900 dark:text-white" style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}>Aperçu de votre pharmacie</h2>`.

Carte (composant local non exporté `Carte`, props `{ libelle: string; icone: ComponentType<{ className?: string }>; couleur: string; className?: string; sousTexte?: ReactNode; children: ReactNode }`, où `children` est la valeur, l'état de chargement ou l'état d'erreur) :

```tsx
<div role="group" aria-label={libelle} className={`bg-white dark:bg-[#0f172a]/80 border border-slate-200 dark:border-slate-800/50 rounded-2xl p-5 ${className ?? ""}`}>
  <div className={`inline-flex p-2 rounded-xl bg-slate-100 dark:bg-slate-800/50 mb-3 ${couleur}`}>
    <Icone className="w-5 h-5" />
  </div>
  {children}
  <p className="text-xs text-slate-600 dark:text-slate-400">{libelle}</p>
  {sousTexte && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sousTexte}</p>}
</div>
```

(`const Icone = icone;` en tête du composant.) Valeur dans une carte : `<p className="text-2xl font-bold text-slate-900 dark:text-white mb-1">…</p>`. Chargement dans une carte : `<div className="mb-1 h-8 flex items-center"><span aria-hidden="true" className="block h-6 w-12 rounded-md bg-slate-200 dark:bg-slate-700/60 animate-pulse" /><span className="sr-only">Chargement</span></div>`.

Grille : `<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">`.

a) `stock.statut === "chargement"` : dans la grille, 6 cartes en chargement avec les libellés de b) (sans sous-texte), puis la carte d'équipe ; sous la grille, le bloc de liste (classes du bloc en d)) contenant seulement `<p role="status" className="text-sm text-slate-600 dark:text-slate-400">Chargement du stock...</p>`.

b) `stock.statut === "pret"` et `apercu.total > 0` : dans la grille, dans cet ordre :

| Libellé | Icône | Couleur | Valeur | Sous-texte |
|---|---|---|---|---|
| Médicaments disponibles | Package | `text-primary-600 dark:text-primary-400` | `disponibles` | `` `sur ${pluriel(total, "médicament enregistré", "médicaments enregistrés")}` `` |
| En rupture de stock | XCircle | `text-rose-600 dark:text-rose-400` | `ruptures` | Quantité à zéro |
| Stock bas | AlertTriangle | `text-amber-600 dark:text-amber-400` | `stockBas` | Moins de 10 unités |
| Expirent dans les 60 jours | CalendarClock | `text-amber-600 dark:text-amber-400` | `expirentBientot` | Date de péremption proche |
| Périmés encore en stock | Ban | `text-rose-600 dark:text-rose-400` | `perimes` | À retirer de la vente |
| Valeur indicative du stock | Wallet | `text-emerald-600 dark:text-emerald-400` | `formaterMontantGNF(valeur)` | voir ci-dessous ; carte avec `className="sm:col-span-2"` |
| Membres de l'équipe | Users | `text-secondary-600 dark:text-secondary-400` | voir e) | aucun |

Nombres : `n.toLocaleString("fr-FR")`. `pluriel` : copie locale identique à celle de la section 1 (ne pas l'exporter). Sous-texte de la valeur : `Quantité × prix, hors médicaments périmés.` et, si `sansPrix > 0`, à la suite dans le même paragraphe après un espace : `` `${pluriel(sansPrix, "médicament sans prix n'est pas compté", "médicaments sans prix ne sont pas comptés")}.` ``.

Sous la grille, le bloc « À surveiller » (d).

c) `stock.statut === "pret"` et `apercu.total === 0` : la grille ne contient que la carte d'équipe (si visible) ; à la place du bloc « À surveiller », un bloc (mêmes classes qu'en d)) avec `<h3 className="text-base font-semibold text-slate-900 dark:text-white">Votre stock est vide</h3>`, `<p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Ajoutez vos médicaments un par un ou importez votre fichier Excel pour suivre ici vos ruptures et vos dates de péremption.</p>` et deux liens côte à côte (`mt-4 flex flex-wrap gap-3`) : « Ouvrir le stock » (`/dashboard/stock`) et « Importer un fichier Excel » (`/dashboard/stock?importer=1`), classes : `inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500` pour le premier, `inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white hover:border-primary-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500` pour le second.

d) Bloc « À surveiller » : `<div className="bg-white dark:bg-[#0f172a]/80 border border-slate-200 dark:border-slate-800/50 rounded-2xl p-5">`, en-tête `flex items-center justify-between gap-3 mb-3` avec `<h3 className="text-base font-semibold text-slate-900 dark:text-white">À surveiller</h3>` et `<Link href="/dashboard/stock" className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 dark:text-primary-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded">Voir tout le stock <ArrowRight className="w-4 h-4" aria-hidden="true" /></Link>`.
  - `aSurveillerTotal === 0` : `<p className="text-sm text-slate-600 dark:text-slate-400">Rien à signaler : aucun médicament en rupture, en stock bas, périmé ou proche de la péremption.</p>`.
  - sinon `<ul className="divide-y divide-slate-200 dark:divide-slate-800">`, un `<li key={stockId} className="py-2 flex items-start gap-3">` par ligne : icône selon la raison (`perime` : Ban, `rupture` : XCircle, ces deux en `text-rose-600 dark:text-rose-400` ; `stockBas` : AlertTriangle, `expireBientot` : CalendarClock, ces deux en `text-amber-600 dark:text-amber-400` ; `w-4 h-4 mt-0.5 shrink-0`, `aria-hidden="true"`), puis `<div><p className="text-sm font-medium text-slate-900 dark:text-white">{nom}</p><p className="text-sm text-slate-600 dark:text-slate-400">{detail}</p></div>`. La table raison vers icône et couleur est un objet constant local `Record<RaisonSurveillance, ...>`.
  - si `aSurveillerTotal > aSurveiller.length` : sous la liste `<p className="mt-2 text-sm text-slate-600 dark:text-slate-400">` `` `Et ${pluriel(aSurveillerTotal - aSurveiller.length, "autre médicament", "autres médicaments")} à vérifier dans le stock.` ``.

e) Carte d'équipe (si affichée) : chargement comme en a) ; prête : valeur `nombre` ; erreur : `<p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1 h-8 flex items-center gap-2">Indisponible <button type="button" onClick={reessayerEquipe} aria-label="Réessayer de charger l'équipe" className="text-primary-700 dark:text-primary-400 underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded">Réessayer</button></p>`.

f) `stock.statut === "erreur"` : grille avec seulement la carte d'équipe (si affichée) ; puis `<div role="alert" className="flex flex-col sm:flex-row sm:items-center gap-3 text-sm text-slate-700 dark:text-slate-300">` avec `<p>Les chiffres du stock n'ont pas pu être chargés. Vérifiez votre connexion puis réessayez.</p>` et le bouton `Réessayer` (`type="button"`, `onClick={reessayerStock}`, classes du bouton « Réessayer » existant de `src/app/dashboard/page.tsx`).

g) `stock.statut === "sansAcces"` : grille avec seulement la carte d'équipe (si affichée) ; puis `<p className="text-sm text-slate-600 dark:text-slate-400">Le stock de la pharmacie n'est pas ouvert à votre profil. Les médicaments disponibles, les ruptures et les dates de péremption s'afficheront ici dès que cet accès vous sera donné.</p>`.

Si la grille est vide (aucune carte), ne pas la rendre.

### 3. `src/app/dashboard/page.tsx` (D03)

- Imports : ajouter `estRouteAutorisee` à l'import existant de `@/lib/navigation_tableau_de_bord` ; ajouter `import ApercuPharmacie from "@/components/dashboard/ApercuPharmacie";`.
- Remplacer `const cartes = contexte ? cartesCompteurs(contexte) : [];` par :

```ts
  // Pharmacie : l'aperçu dédié remplace les cartes génériques (pas de chiffres en double)
  const estPharmacie = contexte?.typeStructure === "PHARMACIE";
  const cartes = contexte && !estPharmacie ? cartesCompteurs(contexte) : [];
```

- Dans le JSX, juste avant `{/* Stats */}` :

```tsx
      {estPharmacie && (
        <ApercuPharmacie
          structureId={user.structureId}
          peutVoirStock={estRouteAutorisee("/dashboard/stock", contexte)}
          peutVoirEquipe={estRouteAutorisee("/dashboard/membres", contexte)}
        />
      )}
```

Rien d'autre ne change dans ce fichier.

### 4. `src/lib/navigation_tableau_de_bord.ts` (D11, trois endroits seulement)

a) Import `lucide-react` : ajouter `FileSpreadsheet,` entre `Clock,` et `FileText,` (ordre alphabétique).

b) Juste après la fin du tableau `ENTREES` (après son `];`) et avant `const CARTES` :

```ts
/** Raccourci de l'accueil sans entrée de menu, placé juste après l'entrée `apres`. Invisible sur un ancien serveur. */
interface RaccourciSupplementaire {
  id: string;
  apres: string;
  href: string;
  icone: IconeComposant;
  libelle: TexteSelonType;
  description: TexteSelonType;
  degrade: string;
  acces: RegleAcces;
}

const RACCOURCIS_SUPPLEMENTAIRES: readonly RaccourciSupplementaire[] = [
  {
    id: "importer-stock",
    apres: "stock",
    href: "/dashboard/stock?importer=1",
    icone: FileSpreadsheet,
    libelle: { defaut: "Importer le stock" },
    description: { defaut: "Mettez à jour votre stock depuis un fichier Excel" },
    degrade: "from-secondary-500 to-cyan-500",
    acces: perm(["stock:read", "stock:write"], { typesStructure: P }),
  },
  {
    id: "catalogue-pharmacie",
    apres: "stock",
    href: "/dashboard/catalogue",
    icone: Pill,
    libelle: { defaut: "Catalogue des médicaments" },
    description: { defaut: "Cherchez un médicament et ajoutez-le à votre stock" },
    degrade: "from-amber-500 to-orange-500",
    acces: perm(["catalogue:write", "catalogue:manage", "stock:read", "stock:write"], { typesStructure: P }),
  },
];
```

c) Remplacer le corps de `raccourcis` par (comportement inchangé pour les entrées existantes) :

```ts
export function raccourcis(ctx: ContexteAcces): Raccourci[] {
  const dejaVus = new Set<string>();
  const resultat: Raccourci[] = [];
  const ajouter = (r: Raccourci) => {
    if (dejaVus.has(r.href)) return;
    dejaVus.add(r.href);
    resultat.push(r);
  };
  for (const entree of ENTREES) {
    const raccourci = entree.raccourci;
    if (raccourci && estVisible(entree.acces, raccourci.rolesRepli, ctx)) {
      ajouter({
        id: entree.id,
        libelle: texte(raccourci.libelle ?? entree.libelle, ctx),
        description: texte(raccourci.description, ctx),
        href: entree.href,
        icone: entree.icone,
        degrade: raccourci.degrade,
      });
    }
    for (const sup of RACCOURCIS_SUPPLEMENTAIRES) {
      if (sup.apres !== entree.id || !estVisible(sup.acces, [], ctx)) continue;
      ajouter({
        id: sup.id,
        libelle: texte(sup.libelle, ctx),
        description: texte(sup.description, ctx),
        href: sup.href,
        icone: sup.icone,
        degrade: sup.degrade,
      });
    }
  }
  return resultat;
}
```

Ne PAS modifier l'entrée `stock` ni aucune autre entrée, carte ou fonction (D01). `sectionsMenu`, `cartesCompteurs` et `estRouteAutorisee` ne changent pas.

### 5. `src/app/dashboard/stock/page.tsx` (D12)

Juste après l'effet existant `useEffect(() => { fetchData(); }, [fetchData]);`, ajouter :

```ts
  // Accès rapide « Importer le stock » du tableau de bord : ouvre directement la fenêtre d'import
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("importer") !== "1") return;
    setIsImportOpen(true);
    params.delete("importer");
    const reste = params.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${reste ? `?${reste}` : ""}`);
  }, []);
```

Rien d'autre ne change dans ce fichier (la règle `set-state-in-effect` y est déjà désactivée en tête de fichier).

### 6. Tests

#### 6a. `src/lib/apercu_pharmacie.test.ts` (au moins 9 cas)

Fabrique locale `ligne(id, nom, quantite, prixUnitaire?, dateExpiration?)` qui construit un `StockMedicament` complet (`medicamentId`, `structureId: "s1"`, `disponible: quantite > 0`, `medicament: { id, nom, categorie: "Antalgique", ordonnanceRequise: false, formes: [] }`). `const MAINTENANT = new Date("2026-10-22T10:00:00Z");`. Jeu de référence :

| id | nom | quantité | prix | expiration |
|---|---|---|---|---|
| a | Doliprane 500 | 50 | 1000 | 2027-06-01 |
| b | Amoxicilline 500 | 0 | 2500 | aucune |
| c | Ibuprofène 400 | 4 | 1500 | 2027-01-01 |
| d | Paracétamol sirop | 20 | aucun (`null` via `as never`) | 2026-11-03 |
| e | Vitamine C | 8 | 500 | 2026-10-01 |
| f | Métronidazole | 30 | 2000 | aucune |

Cas :
1. Jeu de référence : `total 6, disponibles 4, ruptures 1, stockBas 2, expirentBientot 1, perimes 1, valeur 116000, sansPrix 1, aSurveillerTotal 4`.
2. Ordre et détails de `aSurveiller` : `[e "Périmé depuis le 01/10/2026", b "Rupture de stock", c "Plus que 4 unités en stock", d "Expire le 03/11/2026, dans 12 jours"]` (raisons `perime`, `rupture`, `stockBas`, `expireBientot`) ; `e` n'apparaît qu'une fois.
3. Bornes : expiration le 2026-12-21 (60 jours) comptée dans `expirentBientot`, le 2026-12-22 (61 jours) non.
4. Expiration aujourd'hui : non périmée, `expirentBientot` 1, détail « Expire aujourd'hui (22/10/2026) » ; demain : « Expire demain (23/10/2026) » ; hier : `perimes` 1.
5. Quantité 0 avec une date dépassée : `ruptures` 1, `perimes` 0, raison `rupture`.
6. Prix 0 : ligne comptée dans `sansPrix`, pas dans `valeur`.
7. Date illisible (`"pas une date"`) : ignorée (ni périmée ni proche), aucune exception.
8. 7 ruptures : `aSurveiller.length === 5`, `aSurveillerTotal === 7`, triées par nom.
9. Stock bas trié par quantité croissante puis nom ; « Plus que 1 unité en stock » au singulier.
10. `formaterMontantGNF` : `0` donne `"0\u00A0GNF"`, `999` donne `"999\u00A0GNF"`, `1234567.4` donne `"1\u00A0234\u00A0567\u00A0GNF"`.

#### 6b. `src/components/dashboard/ApercuPharmacie.test.tsx` (au moins 10 cas)

`vi.mock("@/lib/api_pharmacie", () => ({ getMyStock: vi.fn() }))`, `vi.mock("@/lib/api_structure", () => ({ getMyStructure: vi.fn() }))` ; `ApiError` réel de `@/lib/api_auth`. Réponse simulée : `const reponse = (data: unknown) => ({ data, message: "ok", success: true }) as never;`. Passer `maintenant={new Date("2026-10-22T10:00:00Z")}` et le jeu de référence de 6a (dupliquer la fabrique dans ce fichier). Valeur d'une carte : `within(screen.getByRole("group", { name: "<libellé>" }))`. `vi.resetAllMocks()` et `cleanup()` entre les cas. Sauf mention contraire : `structureId="s1"`, `peutVoirStock` vrai, `peutVoirEquipe={false}`.

1. Chargement : `getMyStock` en attente : `getByRole("status")` contient « Chargement du stock... » ; au moins 6 « Chargement » ; la section a `aria-busy="true"`.
2. Prêt : groupes « Médicaments disponibles » 4, « En rupture de stock » 1, « Stock bas » 2, « Expirent dans les 60 jours » 1, « Périmés encore en stock » 1 ; « Valeur indicative du stock » contient `"116\u00A0000\u00A0GNF"` et « 1 médicament sans prix n'est pas compté. » ; `getMyStock` appelé avec `"s1"`.
3. Liste : les `listitem` dans l'ordre Vitamine C, Amoxicilline 500, Ibuprofène 400, Paracétamol sirop ; lien « Voir tout le stock » avec `href="/dashboard/stock"`.
4. Plus de 5 : 7 ruptures : 5 `listitem` et « Et 2 autres médicaments à vérifier dans le stock. ».
5. Rien à signaler : une seule ligne disponible (quantité 50, sans date) : texte « Rien à signaler : aucun médicament en rupture, en stock bas, périmé ou proche de la péremption. ».
6. Stock vide : « Votre stock est vide » ; liens « Ouvrir le stock » (`/dashboard/stock`) et « Importer un fichier Excel » (`/dashboard/stock?importer=1`) ; pas de « À surveiller » ; pas de groupe « Médicaments disponibles ».
7. Erreur puis reprise : premier appel rejeté par `new ApiError("Hors connexion", 0)` : `role="alert"` avec « Les chiffres du stock n'ont pas pu être chargés. Vérifiez votre connexion puis réessayez. » ; clic « Réessayer » ; second appel résolu : groupe « Médicaments disponibles » 4 ; plus d'alerte.
8. Refus 403 (`new ApiError("Refus", 403)`) : message « Le stock de la pharmacie n'est pas ouvert à votre profil... » (correspondance par début de phrase) ; aucun `role="alert"`.
9. `peutVoirStock={false}` : `getMyStock` jamais appelé ; même message qu'en 8.
10. Équipe : `peutVoirEquipe` et `getMyStructure` résolu avec `{ membres: [{}, {}, {}] }` : groupe « Membres de l'équipe » 3 ; `peutVoirEquipe={false}` : pas de groupe, `getMyStructure` jamais appelé ; 403 : pas de groupe ; échec `ApiError(…, 0)` puis succès : « Indisponible », clic sur le bouton nommé « Réessayer de charger l'équipe », valeur affichée (ces quatre variantes peuvent être 2 à 4 cas).
11. Termes interdits (D20 du lot 7) : pour les états prêt (jeu de référence), erreur et sans accès, `container.textContent` ne correspond pas à `/\b(token|payload|endpoint|API|null|undefined|NaN|UUID|exception|serveur|requête|session|cache|permission|403|500)\b/i`.

#### 6c. `src/lib/navigation_tableau_de_bord.pharmacie.test.ts` (au moins 5 cas, D13)

Reprendre (copier, pas importer) les aides `profil`, `contexte`, `enRepli`, `hrefs` du fichier de test existant. Constantes : `ADMIN_PHARMACIE = ["structure:read", "structure:write", "membre:read", "membre:manage", "role:manage"]` ; `PHARMACIEN = ["stock:read", "stock:write", "catalogue:write", "chat:structure", "structure:read", "membre:read"]`.

1. Administrateur de pharmacie par défaut : pas de `/dashboard/stock` dans le menu, `estRouteAutorisee("/dashboard/stock", ctx)` faux, `raccourcis(ctx).map(r => r.href)` égal à `["/dashboard/structure", "/dashboard/membres"]` (D01, comportement inchangé).
2. Administrateur de pharmacie avec `stock:read` et `stock:write` en plus (ce que le back devra lui donner, D02) : menu contient `/dashboard/stock` et `/dashboard/catalogue` ; raccourcis égaux à `["/dashboard/stock", "/dashboard/stock?importer=1", "/dashboard/catalogue", "/dashboard/structure", "/dashboard/membres"]`.
3. Pharmacien : raccourcis égaux à `["/dashboard/chat", "/dashboard/ordonnances", "/dashboard/stock", "/dashboard/stock?importer=1", "/dashboard/catalogue", "/dashboard/structure", "/dashboard/membres"]` ; libellés des deux nouveaux : « Importer le stock », « Catalogue des médicaments ».
4. Médecin d'hôpital (`contexte("MEDECIN", "HOPITAL", ["carnet:read", "consultation:write", "ordonnance:write", "analyse:write", "vaccination:write", "rendezvous:write", "sos:respond", "patient:read", "structure:read", "membre:read"])`) : aucun raccourci vers `/dashboard/stock?importer=1` ni `/dashboard/catalogue`.
5. Pharmacien sur un ancien serveur (`enRepli("PHARMACIEN")`) : aucun raccourci vers `/dashboard/stock?importer=1` ni `/dashboard/catalogue`.
6. Le menu du pharmacien ne contient aucun lien avec `?` (les raccourcis supplémentaires ne créent pas d'entrée de menu).

#### 6d. `src/app/dashboard/page.test.tsx`

- Ajouter `getMyStock` aux mocks : `vi.mock("@/lib/api_pharmacie", () => ({ getMyStock: vi.fn() }));` et l'importer.
- Remplacer le test « n'affiche à l'administrateur de pharmacie que ce qui concerne sa pharmacie » par (même profil) : groupe « Membres de l'équipe » contient « 2 » (attendre avec `findByText`) ; texte commençant par « Le stock de la pharmacie n'est pas ouvert à votre profil » présent ; « Aperçu de votre pharmacie » présent ; ni « Pharmaciens », ni « Patients de la structure », ni « Médecins » ; dans « Accès rapide » : « Ma pharmacie » et « Équipe de la pharmacie » ; `getMyStock` et `getMyPatients` jamais appelés.
- Nouveau test « montre au pharmacien l'aperçu de son stock et ses accès rapides » : utilisateur `{ id: "p1", ..., role: "PHARMACIEN", structureId: "s3" }`, profil avec `structureType: "PHARMACIE"` et `permissions` = `PHARMACIEN` de 6c ; `getMyStock` résolu avec deux lignes (quantité 12 prix 1000 sans date ; quantité 0 sans prix ni date) ; `getMyStructure` résolu avec `{ membres: [{ role: "PHARMACIEN" }] }`. Attendus : groupe « Médicaments disponibles » 1, « En rupture de stock » 1 ; `getMyStock` appelé avec `"s3"` une seule fois (pas de double appel par les anciennes cartes) ; aucune carte « Médicaments en stock » ni « Ruptures de stock » ; « Accès rapide » contient « Mon Stock », « Importer le stock », « Catalogue des médicaments ».
- Les autres tests (médecin) ne changent pas et doivent passer.

#### 6e. `src/app/dashboard/stock/page.test.tsx` (2 cas)

Mocks : `@/hooks/useAuth` (`useAuth: () => ({ user: { id: "p1", role: "PHARMACIEN", structureId: "s1", email: "p@exemple.com", nom: "Bah", prenom: "Ali" } })`), `@/lib/api_pharmacie` (`getMyStock` résolu avec `{ stocks: [], alertes: { stockBas: [], rupture: [] } }`, `removeStockItem: vi.fn()`, `updateStockQuantite: vi.fn()`), `@/components/modals/ImportStockModal` (`default: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>Fenêtre d'import ouverte</div> : null)`), `@/components/modals/StockModal` (`default: () => null`), `@/components/modals/DeleteConfirmModal` (`DeleteConfirmModal: () => null`).
1. `window.history.replaceState(null, "", "/dashboard/stock?importer=1")` avant le rendu : « Fenêtre d'import ouverte » apparaît (`findByText`) et `window.location.search` vaut `""`.
2. `window.history.replaceState(null, "", "/dashboard/stock")` : après le chargement (attendre que `getMyStock` ait été appelé puis que « Importer depuis Excel » soit visible), « Fenêtre d'import ouverte » absent.

### Hors périmètre

Back, `src/lib/acces.ts`, `src/lib/api_pharmacie.ts`, `src/lib/compteurs_tableau_de_bord.ts`, `src/lib/navigation_tableau_de_bord.test.ts`, la page `src/app/dashboard/structure`, le message d'accueil, les graphiques, tout fichier d'F12. Pas de composant partagé dans `src/components/ui`. Pas de refactor de `StatsGrid` ni de `QuickActionsGrid`.

## Contraintes

Faire uniquement ce qui est demandé : pas de refactors, helpers ou abstractions non demandés. Discipline de code dans l'ordre : réutiliser l'existant > ranger au bon endroit > n'abstraire qu'à la règle de trois. Règles d'audience, visuelles, typographiques et de langue : docs/ORCHESTRATOR.md (textes visibles en français, sans jargon, sans tiret cadratin ni demi-cadratin ; le signe « × » est autorisé). Commentaires de code en français. Pas de `any`. Ne pas modifier docs/plans/. Écrire les fichiers uniquement avec Write et Edit, jamais par redirection shell : le hook de garde ne voit pas les écritures faites par Bash.

## Done when

Toutes les commandes lancées depuis `D:\tmp\wt-front-lot7b` (gate locale, jamais `docker compose`) :

1. `npx --no-install tsc --noEmit` : aucune sortie, code 0 (hors erreurs venant uniquement de fichiers d'F12, à signaler).
2. `npx --no-install eslint src/lib/apercu_pharmacie.ts src/lib/apercu_pharmacie.test.ts src/components/dashboard/ApercuPharmacie.tsx src/components/dashboard/ApercuPharmacie.test.tsx src/app/dashboard/page.tsx src/app/dashboard/page.test.tsx src/lib/navigation_tableau_de_bord.ts src/lib/navigation_tableau_de_bord.pharmacie.test.ts src/app/dashboard/stock/page.tsx src/app/dashboard/stock/page.test.tsx` : 0 erreur, 0 avertissement (code 0).
3. `npx --no-install vitest run` : tous les tests passent ; au moins 32 nouveaux cas (10 dans `apercu_pharmacie.test.ts`, 10 dans `ApercuPharmacie.test.tsx`, 6 dans `navigation_tableau_de_bord.pharmacie.test.ts`, 1 nouveau dans `page.test.tsx`, 2 dans `stock/page.test.tsx`, plus le test remplacé) ; les tests existants de `navigation_tableau_de_bord.test.ts` passent sans modification.
4. `grep -c "Aperçu de votre pharmacie\|À surveiller\|Valeur indicative du stock\|Expirent dans les 60 jours" src/components/dashboard/ApercuPharmacie.tsx` renvoie au moins 4 ; `grep -n "SEUIL_STOCK_BAS = 10" src/lib/apercu_pharmacie.ts` renvoie 1 ligne ; `grep -n "importer-stock\|catalogue-pharmacie" src/lib/navigation_tableau_de_bord.ts` renvoie 2 lignes.
5. `grep -nE "\bany\b" src/lib/apercu_pharmacie.ts src/components/dashboard/ApercuPharmacie.tsx` ne renvoie rien ; `grep -n "format_gnf" src/lib/apercu_pharmacie.ts src/components/dashboard/ApercuPharmacie.tsx` ne renvoie rien.
6. `git diff -- src/lib/navigation_tableau_de_bord.ts` ne montre, en plus des éventuels ajouts d'F12 (entrée `vente`, icône `ShoppingCart`), que les changements 4a, 4b et 4c ; l'entrée `stock` est inchangée.
7. Aucun tiret cadratin ni demi-cadratin ajouté : aucun blocage du hook de garde sur les écritures de la tâche.

## Return

Liste des fichiers touchés + preuve (les commandes 1 à 7 du Done when lancées, résultat en une ligne chacune, nombre de tests passés). Ou un bloc BLOCKED. Pas de prose.

## Historique

<!-- une ligne par tentative : AAAA-MM-JJ | tier | résultat | raison si échec -->

## Validation

<!-- commande relancée par l'orchestrateur | résultat en une ligne | hash du commit -->
