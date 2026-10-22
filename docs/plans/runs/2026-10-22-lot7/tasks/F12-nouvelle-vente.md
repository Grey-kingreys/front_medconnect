# F12 - Page « Nouvelle vente » d'une pharmacie

Tier: spécifié (agent implementeur-specifie)
Audience: non-dev (pharmacien, administrateur de pharmacie)
Visuel: préventif
Background-safe: oui

## Spec

Source qui fait foi : `D:\souleymane\perso-archive-20260923\perso\medconnecte\SPEC-VENTES-PHARMACIE.md` (section « Écrans (front) », écran « Nouvelle vente »). Décisions du run : `docs/plans/runs/2026-10-22-lot7/decisions.md` (D01 à D21). Le back des ventes n'est pas encore écrit : on code contre la spécification, les noms ci-dessous sont **exactement** ceux à employer. Ne rien modifier dans `back_medconnect`.

Avant d'écrire du code Next, lire `node_modules/next/dist/docs/` pour les points utilisés (page client de l'App Router, `next/link`).

### Fichiers à créer ou modifier (et aucun autre)

| Fichier | Action |
|---|---|
| `src/lib/acces.ts` | ajouter `"vente:read" \| "vente:write" \| "vente:annuler"` au type `CodePermission` (D19) |
| `src/lib/navigation_tableau_de_bord.ts` | nouvelle entrée de menu (voir 3) |
| `src/lib/navigation_tableau_de_bord.test.ts` | nouveaux cas (voir Tests) ; ne pas modifier les cas existants |
| `src/lib/format_gnf.ts` + `src/lib/format_gnf.test.ts` | créer (voir 1) |
| `src/lib/api_ventes.ts` + `src/lib/api_ventes.test.ts` | créer (voir 2) |
| `src/app/dashboard/vente/panier.ts` + `src/app/dashboard/vente/panier.test.ts` | créer, logique pure du panier (voir 4) |
| `src/app/dashboard/vente/ConfirmationVente.tsx` | créer, dialogue de confirmation (voir 6) |
| `src/app/dashboard/vente/page.tsx` + `src/app/dashboard/vente/page.test.tsx` | créer (voir 5 à 8) |

### 1. `src/lib/format_gnf.ts` (D15)

```ts
/** Montant en francs guinéens : entier arrondi, milliers séparés par une espace insécable, suffixe « GNF ». */
export function formaterGNF(montant: number): string
```
- `Math.round(montant)`, puis séparateur de milliers U+00A0 par regex (`/\B(?=(\d{3})+(?!\d))/g`), puis `"\u00A0GNF"`. Pas d'`Intl` (le séparateur varie selon le moteur). Gère le signe moins devant les chiffres.
- Exemples à tester : `0` → `"0\u00A0GNF"`, `500` → `"500\u00A0GNF"`, `12500` → `"12\u00A0500\u00A0GNF"`, `1234567.6` → `"1\u00A0234\u00A0568\u00A0GNF"`.
- Ne pas toucher aux affichages GNF existants (stock, médicaments, import).

### 2. `src/lib/api_ventes.ts` (D02 à D05)

En-tête de fichier : commentaire français indiquant que le contrat suit SPEC-VENTES-PHARMACIE.md, à confirmer avec orch/lot7-back. Aucun `any`.

```ts
import { ApiError, authFetch } from "./api_auth";

export type StatutVente = "VALIDEE" | "ANNULEE";

export const CODES_ERREUR_VENTE = [
  "STOCK_INSUFFISANT", "MEDICAMENT_EXPIRE", "PRIX_MANQUANT", "ORDONNANCE_NON_CONFIRMEE", "VALIDATION",
] as const;
export type CodeErreurVente = (typeof CODES_ERREUR_VENTE)[number];

export interface LigneVenteDemandee { stockId: string; quantite: number }
export interface CorpsCreationVente {
  lignes: LigneVenteDemandee[];
  clientNom?: string;
  clientTelephone?: string;
  ordonnanceVerifiee?: boolean;
}
export interface LigneVente {
  id: string; venteId: string; medicamentId: string; stockMedicamentId: string;
  nomMedicament: string; prixUnitaire: number; quantite: number; sousTotal: number;
}
export interface PharmacieVente {
  nom: string; adresse?: string | null; ville?: string | null; telephone?: string | null; logoUrl?: string | null;
}
export interface Vente {
  id: string; structureId: string; numero: string; vendeurId: string;
  vendeur?: { id: string; nom: string; prenom: string };
  clientNom: string | null; clientTelephone: string | null; ordonnanceVerifiee: boolean;
  total: number; statut: StatutVente;
  annuleeLe: string | null; annuleeParId: string | null; motifAnnulation: string | null;
  createdAt: string; lignes: LigneVente[];
  pharmacie?: PharmacieVente;
}
/** Ligne citée par une erreur de vente (409 STOCK_INSUFFISANT, 400 MEDICAMENT_EXPIRE, PRIX_MANQUANT, ORDONNANCE_NON_CONFIRMEE). */
export interface LigneErreurVente { stockId: string; nom?: string; disponible?: number }

export function creerVente(structureId: string, corps: CorpsCreationVente, cleIdempotence: string)
// = authFetch<Vente>(`/pharmacie/${encodeURIComponent(structureId)}/ventes`,
//     { method: "POST", body: JSON.stringify(corps), headers: { "Idempotency-Key": cleIdempotence } })

export function codeErreurVente(err: unknown): CodeErreurVente | null
// ApiError dont details.code est une chaîne de CODES_ERREUR_VENTE, sinon null.

export function lignesErreurVente(err: unknown): LigneErreurVente[]
// Si err n'est pas une ApiError ou n'a pas de details : [].
// Prendre le PREMIER tableau trouvé dans cet ordre : details.details, details.donnees.details,
// details.donnees.lignes, details.lignes (D04). Garder les éléments objets dont stockId est une chaîne
// non vide ; recopier nom s'il est une chaîne, disponible s'il est un entier >= 0 ; ignorer le reste.
```

### 3. Menu (D13), `src/lib/navigation_tableau_de_bord.ts`

- Importer `ShoppingCart` depuis `lucide-react`.
- Insérer dans `ENTREES`, **juste avant** l'entrée `id: "ordonnances-recues"` :
```ts
{
  id: "vente",
  section: "activite",
  href: "/dashboard/vente",
  icone: ShoppingCart,
  libelle: { defaut: "Nouvelle vente" },
  acces: perm(["vente:write"], { typesStructure: P }),
  rolesRepli: [],
  raccourci: {
    description: { defaut: "Enregistrez la vente de médicaments de votre stock" },
    degrade: "from-emerald-500 to-teal-500",
    rolesRepli: [],
  },
},
```
- Rien d'autre ne change dans ce fichier.

### 4. Logique du panier, `src/app/dashboard/vente/panier.ts` (pur, sans React, testable)

Types :
```ts
import type { StockMedicament } from "@/lib/api_pharmacie";
import type { CorpsCreationVente, LigneErreurVente } from "@/lib/api_ventes";

export type RaisonNonVendable = "perime" | "rupture" | "sans-prix";
export const LIBELLES_RAISON: Record<RaisonNonVendable, string> = {
  perime: "Date de péremption dépassée",
  rupture: "Rupture de stock",
  "sans-prix": "Prix non renseigné",
};
export interface LignePanier { stockId: string; quantite: number }
export interface PanierVente {
  cleIdempotence: string | null;
  lignes: LignePanier[];
  clientNom: string;
  clientTelephone: string;
  ordonnanceVue: boolean;
}
export const PANIER_VIDE: PanierVente; // { cleIdempotence: null, lignes: [], clientNom: "", clientTelephone: "", ordonnanceVue: false }
/** Changement imposé au panier : apres = 0 veut dire ligne retirée. */
export interface CorrectionPanier { nom: string; avant: number; apres: number }
export const NOMBRE_MAX_RESULTATS = 50;
export const LONGUEUR_MAX_NOM_CLIENT = 100;
export const FORMAT_TELEPHONE_CLIENT = /^\+?[0-9 ]{8,20}$/;
```

Fonctions (toutes renvoient un nouvel objet, jamais de mutation) :
- `raisonNonVendable(stock, maintenant: Date): RaisonNonVendable | null` (D09). Ordre : `perime` si `dateExpiration` existe et que `dateExpiration.slice(0, 10)` (jour UTC, comparer avec `new Date(stock.dateExpiration).toISOString().slice(0, 10)`) est strictement antérieur à `maintenant.toISOString().slice(0, 10)` ; sinon `rupture` si `quantite <= 0` ; sinon `sans-prix` si `prixUnitaire` est `undefined`, `null` ou `<= 0` ; sinon `null`. Le jour même de la date de péremption reste vendable.
- `prixArrondi(stock): number` = `Math.round(stock.prixUnitaire ?? 0)`.
- `rechercherDansStock(stocks, texte): StockMedicament[]` (D16) : comparaison sans casse ni accents (`normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()`), sur `medicament.nom` et `medicament.nomGenerique` ; texte vide (après trim) = tout le stock ; ordre d'origine conservé ; au plus `NOMBRE_MAX_RESULTATS` éléments.
- `ajouterAuPanier(panier, stock, nouvelleCle: () => string, maintenant: Date): PanierVente` : ligne absente → ajoutée avec quantité 1 ; présente → +1 bornée à `stock.quantite`. Si le panier n'avait aucune ligne → `cleIdempotence = nouvelleCle()` (D07). Si `stock.medicament.ordonnanceRequise` et que la ligne était absente → `ordonnanceVue = false` (D12). Ne rien faire (même objet renvoyé) si `raisonNonVendable(stock, maintenant) !== null` ou si la quantité est déjà au maximum. La page passe `nouvelleCleIdempotence` (importée de `@/lib/api_carnet`) et `new Date()`.
- `changerQuantite(panier, stock, delta: number): PanierVente` : nouvelle quantité bornée entre 1 et `stock.quantite`.
- `retirerDuPanier(panier, stockId): PanierVente` : si plus aucune ligne → `cleIdempotence = null` et `ordonnanceVue = false` (client conservé).
- `reconcilierPanier(panier, stocks, maintenant): { panier: PanierVente; corrections: CorrectionPanier[] }` : pour chaque ligne, stock introuvable ou non vendable → ligne retirée (correction `apres: 0`, `nom` = nom du médicament, ou « Un médicament » si le stock a disparu) ; quantité > stock → bornée (correction) ; puis même règle que `retirerDuPanier` si le panier devient vide.
- `appliquerStockInsuffisant(panier, lignesErreur: LigneErreurVente[], stocks): { panier; corrections }` (D10) : pour chaque ligne d'erreur avec `disponible` défini et présente dans le panier : quantité = `disponible`, retirée si 0 ; nom = `lignesErreur.nom`, sinon nom du stock, sinon « Un médicament » ; puis règle du panier vide.
- `retirerLignes(panier, stockIds: string[]): PanierVente` : retire ces lignes, puis règle du panier vide.
- `totalPanier(panier, stocks): number` = somme `prixArrondi(stock) * quantite` des lignes dont le stock est connu.
- `medicamentsSurOrdonnance(panier, stocks): string[]` : noms des médicaments du panier avec `ordonnanceRequise`, ordre du panier.
- `telephoneClientValide(telephone): boolean` : vide après trim → vrai ; sinon `FORMAT_TELEPHONE_CLIENT.test(trim)`.
- `corpsVente(panier, surOrdonnance: boolean): CorpsCreationVente` : `lignes` = `{ stockId, quantite }` ; `clientNom` et `clientTelephone` seulement s'ils sont non vides après trim (valeurs trimées) ; `ordonnanceVerifiee: true` seulement si `surOrdonnance && panier.ordonnanceVue`.
- `messageCorrections(corrections): string` : `"Le panier a été corrigé : "` + éléments séparés par `", "`, chaque élément `"<nom> (épuisé, retiré)"` si `apres === 0`, sinon `"<nom> (<apres> au lieu de <avant>)"`, puis `"."`.
- Stockage (D08), tout protégé par `try/catch` (un échec = panier vide pour la lecture, rien pour l'écriture) :
  - `cleStockagePanier(structureId, userId): string` = `` `medconnecte:panier-vente:${structureId}:${userId}` ``.
  - `lirePanierStocke(cle): PanierVente` : `JSON.parse` de `localStorage.getItem(cle)` ; accepté seulement si `version === 1`, `lignes` tableau de `{ stockId: string non vide, quantite: entier >= 1 }` (éléments invalides ignorés), `cleIdempotence` chaîne ou null, `clientNom`/`clientTelephone` chaînes (sinon `""`), `ordonnanceVue` booléen (sinon `false`) ; sinon `PANIER_VIDE`. Aucun `any` : passer par `unknown` et des gardes de type.
  - `enregistrerPanier(cle, panier): void` : si aucune ligne et client vide → `removeItem` ; sinon `setItem(cle, JSON.stringify({ version: 1, ...panier }))`.

### 5. Page `src/app/dashboard/vente/page.tsx` : états et chargement

`"use client"`, export par défaut `NouvelleVentePage`. Lint propre **sans** `eslint-disable` : pas de `setState` synchrone dans un `useEffect` ; suivre le modèle de `src/app/dashboard/appareils/page.tsx` (setState seulement dans les `.then` et `.catch`, compteur `essai` pour relancer).

- `const { user, loading } = useAuth()`. Tant que `loading` ou `user === null` : bloc `role="status"` « Chargement... ».
- `user.structureId` absent : bloc d'information « Votre compte n'est rattaché à aucune pharmacie. Adressez-vous à l'administrateur de votre pharmacie. » et lien « Retour à l'accueil » (`/dashboard`).
- Chargement du stock par `getMyStock(user.structureId)` (D06) dans un `useEffect` dépendant de `[user?.structureId, user?.id, essai]`. Dans le `.then` : `lirePanierStocke(cleStockagePanier(structureId, user.id))`, puis `reconcilierPanier(..., res.data.stocks, new Date())`, puis setState (stock, panier, et si des corrections existent un message d'information `messageCorrections(...)`). Le panier n'est lu qu'à ce moment, jamais avant le stock.
- Erreur de chargement : `role="alert"` avec `messageErreurPour(err, "Impossible d'afficher le stock de la pharmacie. Vérifiez votre connexion puis réessayez.")` et bouton « Réessayer ».
- Enregistrement : `useEffect(() => { if (stock chargé) enregistrerPanier(cle, panier) }, [panier, ...])` (aucun setState dedans).
- Stock vide : « Votre stock est vide. Ajoutez des médicaments à votre stock pour pouvoir les vendre. » et lien « Aller au stock » (`/dashboard/stock`).

### 6. Page : mise en page, recherche, panier, confirmation

En-tête : `h1` « Nouvelle vente » (même style que `appareils/page.tsx` : `text-2xl sm:text-3xl font-extrabold`, police Outfit), sous-titre « Recherchez les médicaments, ajustez les quantités puis validez la vente. »

Grille `grid grid-cols-1 lg:grid-cols-5 gap-6` : colonne recherche `lg:col-span-3`, colonne panier `lg:col-span-2` (`lg:sticky lg:top-6 self-start`). Sur téléphone, le panier vient après la liste.

Surfaces (anti-slop, une seule délimitation) : cartes `bg-white dark:bg-[#0f172a]/80 border border-slate-200 dark:border-slate-800/50 rounded-3xl p-6`, **sans ombre**. Champs : mêmes classes que le champ de recherche de `stock/page.tsx` (sans `shadow-sm`). Bouton principal : `bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-bold` (pas d'ombre colorée). Tous les éléments interactifs : `focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500`. Icônes décoratives `aria-hidden="true"`. Vérifier le contraste AA en clair et en sombre (utiliser `-700` en clair et `-300`/`-400` en sombre pour les textes colorés).

**Recherche** (carte gauche) :
- `label` visible « Rechercher un médicament » lié à un `input type="search"` (icône `Search`), placeholder « Nom ou nom générique ».
- Liste `ul` des résultats `rechercherDansStock(stocks, texte)`. Chaque `li` : nom (gras), nom générique s'il existe, « Reste : N » , prix `formaterGNF(prixArrondi(s))` si prix > 0, mention « Sur ordonnance » si `ordonnanceRequise`.
  - Vendable : bouton « Ajouter » (`aria-label` « Ajouter <nom> au panier », icône `Plus`). Si la quantité du panier atteint le stock : bouton désactivé et texte « Tout le stock est dans le panier ».
  - Non vendable : pas de bouton ; badge texte `LIBELLES_RAISON[raison]` (fond `bg-rose-50 dark:bg-rose-500/15`, texte `text-rose-700 dark:text-rose-300`, sans bordure) ; ligne en `opacity` normale (le texte doit rester lisible AA).
- Aucun résultat : « Aucun médicament ne correspond à « <texte> ». Vérifiez l'orthographe ou essayez le nom générique. »
- Plus de 50 correspondances : sous la liste, « Seuls les 50 premiers résultats sont affichés. Précisez votre recherche. »

**Panier** (carte droite, `aria-labelledby` sur son titre `h2` « Panier ») :
- Vide : « Le panier est vide. Recherchez un médicament puis appuyez sur « Ajouter ». »
- Chaque ligne : nom, `formaterGNF(prix)` × quantité, sous-total `formaterGNF(prix * quantite)`. Boutons « − » et « + » (icônes `Minus`, `Plus`, `aria-label` « Diminuer la quantité de <nom> » et « Augmenter la quantité de <nom> »), désactivés respectivement à 1 et au stock ; quantité affichée entre les deux ; bouton « Retirer » (icône `Trash2`, `aria-label` « Retirer <nom> du panier »).
- Total : libellé « Total » et `formaterGNF(totalPanier(...))`, dans une zone `aria-live="polite"`.
- Si `medicamentsSurOrdonnance` non vide : case à cocher native « J'ai vu l'ordonnance » (`id` stable, `label` associé) et texte d'aide « Médicaments sur ordonnance : <noms séparés par des virgules>. » (`aria-describedby`).
- Client facultatif (sous un `fieldset` avec `legend` « Client (facultatif) ») : « Nom du client » (`maxLength={LONGUEUR_MAX_NOM_CLIENT}`) et « Téléphone du client » (`type="tel"`, `inputMode="tel"`, aide `AIDE_TELEPHONE` importée de `@/lib/erreur_telephone`).
- Bouton « Valider la vente » (pleine largeur, désactivé si le panier est vide ou pendant l'envoi). Au clic :
  1. téléphone invalide (`telephoneClientValide`) → message `MSG_TELEPHONE_INVALIDE` sous le champ (`role="alert"`), focus sur le champ, pas de confirmation ;
  2. médicaments sur ordonnance et case non cochée → message « Cochez « J'ai vu l'ordonnance » pour vendre ces médicaments. » sous la case (`role="alert"`), focus sur la case, pas de confirmation (D12) ;
  3. sinon ouverture de la confirmation.
- Bouton secondaire « Vider le panier » (texte, sans bordure) visible si le panier a des lignes : remet `PANIER_VIDE` sans confirmation supplémentaire (rien n'est encore enregistré).

**Confirmation** `src/app/dashboard/vente/ConfirmationVente.tsx` (D14) :
- Props : `{ isOpen: boolean; onClose: () => void; onConfirmer: () => void; envoiEnCours: boolean; lignes: { nom: string; quantite: number; prixUnitaire: number }[]; total: number; client: string; ordonnanceVue: boolean }`.
- Reprendre la structure de `src/components/modals/DeleteConfirmModal.tsx` (fond, `useDialogA11y` avec `closeOnEscape: !envoiEnCours`, `{...dialogProps}`, `titleId`), en couleurs primaires, sans icône rouge.
- Contenu : titre « Valider la vente ? » ; liste « <quantite> × <nom> » avec `formaterGNF(prixUnitaire * quantite)` à droite ; « Total : <formaterGNF(total)> » en gras ; « Client : <client> » si non vide ; « Ordonnance vue » si `ordonnanceVue` et qu'une ligne l'exige (passer le booléen déjà calculé) ; phrase « Les quantités seront retirées de votre stock. »
- Boutons : « Revenir au panier » (onClose, désactivé pendant l'envoi) et « Confirmer la vente » (onConfirmer ; pendant l'envoi : `Loader2` animé et « Enregistrement... »).

### 7. Envoi et erreurs (D07, D10, D11)

À la confirmation : `creerVente(structureId, corpsVente(panier, surOrdonnance), panier.cleIdempotence)` (la clé existe toujours quand le panier a des lignes ; par sécurité, si elle est `null`, en créer une avec `nouvelleCleIdempotence` importée de `@/lib/api_carnet`, l'enregistrer dans le panier avant l'envoi). Pendant l'envoi : bouton désactivé, aucun double envoi possible.

- Succès : fermer la confirmation, `panier = PANIER_VIDE` (le stockage est vidé par l'effet d'enregistrement), passer à l'écran de succès (8) avec `res.data`.
- Échec : fermer la confirmation, afficher un bandeau `role="alert"` au-dessus du panier, puis selon `codeErreurVente(err)` et `err.status` :
  - `STOCK_INSUFFISANT` : `appliquerStockInsuffisant(panier, lignesErreurVente(err), stocks)`, relancer le chargement du stock (`essai + 1` ; la réconciliation du chargement s'applique au panier corrigé, donc enregistrer le panier corrigé avant la relance), bandeau « Le stock a changé pendant la vente. » suivi de `messageCorrections(corrections)` (s'il y en a) et de « Vérifiez le panier puis validez à nouveau. »
  - `MEDICAMENT_EXPIRE` : retirer les lignes citées (`retirerLignes`), relancer le stock, bandeau « Certains médicaments ont dépassé leur date de péremption et ont été retirés du panier : <noms>. » (noms de `lignesErreurVente`, sinon sans liste).
  - `PRIX_MANQUANT` : idem, bandeau « Certains médicaments n'ont pas de prix et ont été retirés du panier : <noms>. Renseignez leur prix dans le stock pour pouvoir les vendre. »
  - `ORDONNANCE_NON_CONFIRMEE` : `ordonnanceVue = false`, relancer le stock, message de la case de l'étape 6 point 2 et focus sur la case.
  - `VALIDATION` : `messageErreurPour(err, "Vérifiez les informations du client puis réessayez.")`.
  - `err.status` 0, 502, 503 ou 504 : bandeau « La vente n'a peut-être pas été enregistrée. Vérifiez votre connexion puis appuyez sur « Réessayer » : elle ne sera pas comptée deux fois. » avec bouton « Réessayer » qui renvoie la **même** demande (même clé) sans repasser par la confirmation. Panier et clé conservés.
  - Tout autre cas (dont 403) : `messageErreurPour(err, "Un problème est survenu, réessayez dans un instant.")`.
- La clé n'est jamais renouvelée après un échec (D07).
- Une relance du stock après un échec garde l'affichage courant (pas d'écran de chargement à la place de la grille) et le bandeau reste visible ; si la réconciliation de ce rechargement produit des corrections, leur message s'affiche en plus. Le bandeau disparaît à la validation suivante ou avec un bouton « Fermer » (`aria-label` « Fermer le message »). L'écran de chargement plein (5) ne sert qu'au premier chargement et après « Réessayer » d'une erreur de chargement.

### 8. Écran de succès (D17)

Remplace la grille (le titre de page reste). Contenu : icône `CircleCheck` (décorative), `h2` « Vente enregistrée » qui reçoit le focus à l'affichage (`tabIndex={-1}`, `ref` + focus dans un effet sans setState), « Numéro : <vente.numero> », « Total : <formaterGNF(vente.total)> » ; lien principal « Voir et imprimer le reçu » (`next/link`, `/dashboard/ventes/${encodeURIComponent(vente.id)}/recu`) ; bouton « Nouvelle vente » qui revient à la grille avec le panier vide et relance le chargement du stock.

### Textes

Tous en français, vocabulaire de l'utilisateur. Aucun tiret cadratin ni demi-cadratin. Interdits à l'écran : stock « ID », identifiant, clé, idempotence, serveur, requête, session, navigateur, localStorage, code d'erreur, statut en majuscules (`VALIDEE`, `STOCK_INSUFFISANT`...), code HTTP, null, undefined, NaN.

### Tests (Vitest, `src/**/*.test.{ts,tsx}`)

- `format_gnf.test.ts` : les 4 exemples du point 1.
- `api_ventes.test.ts` (modèle `api_pharmacie.test.ts`, `vi.mock("./api_auth", async (importOriginal) => ({ ...await importOriginal(), authFetch: vi.fn() }))` pour garder la vraie `ApiError`) : `creerVente` appelle `authFetch` avec la route encodée, `POST`, le corps JSON et l'en-tête `Idempotency-Key` ; `codeErreurVente` (code connu, code inconnu, erreur non ApiError) ; `lignesErreurVente` sur les quatre emplacements, ordre de priorité, éléments invalides ignorés, `[]` sans details.
- `panier.test.ts` : `raisonNonVendable` (veille de péremption = périmé, jour même = vendable, ordre périmé > rupture > sans prix, prix 0) avec un `maintenant` fixe ; `rechercherDansStock` (accents, casse, nom générique, plafond 50) ; `ajouterAuPanier` (création de la clé au premier ajout seulement, borne au stock, `ordonnanceVue` remis à false pour un nouveau médicament à ordonnance, refus d'un non vendable) ; `changerQuantite` bornes ; `retirerDuPanier` efface la clé quand le panier se vide ; `reconcilierPanier` et `appliquerStockInsuffisant` (corrections attendues) ; `totalPanier` avec un prix décimal arrondi ; `corpsVente` (client vide non envoyé, `ordonnanceVerifiee` seulement si requis et vu) ; `messageCorrections` ; `lirePanierStocke` (valeur valide, JSON cassé, version inconnue, éléments invalides filtrés, `getItem` qui lève) ; `enregistrerPanier` (retire la clé de stockage quand tout est vide).
- `navigation_tableau_de_bord.test.ts` (ajouts) : pharmacien avec `["stock:read", "stock:write", "vente:write"]` en PHARMACIE voit « Nouvelle vente » (`/dashboard/vente`) avant `/dashboard/ordonnances` et le raccourci ; même droits en HOPITAL : pas d'entrée ; sans `vente:write` : `estRouteAutorisee("/dashboard/vente", ctx)` faux ; repli PHARMACIEN : pas d'entrée (les cas existants restent verts sans modification).
- `page.test.tsx` (modèle `appareils/page.test.tsx` ; mocker `@/hooks/useAuth` avec `{ user: { id: "u1", structureId: "p1", ... }, loading: false }`, `@/lib/api_pharmacie` (`getMyStock`), `@/lib/api_ventes` (`creerVente` seulement, garder les vraies `codeErreurVente` et `lignesErreurVente` via `importOriginal`) ; `localStorage.clear()` avant chaque test). Cas :
  1. lignes non vendables affichées avec leur raison et sans bouton « Ajouter » ;
  2. ajout, « + » bloqué au stock, « − » bloqué à 1, total en direct `formaterGNF` exact (espace insécable) ;
  3. médicament sur ordonnance : validation refusée sans la case (message), acceptée après ;
  4. confirmation puis succès : `creerVente` appelé avec le bon corps et une clé, écran « Vente enregistrée » avec numéro, total et lien `/dashboard/ventes/v1/recu`, panier retiré du stockage ;
  5. échec réseau (`new ApiError("...", 0)`) puis « Réessayer » : deuxième appel avec la **même** clé ;
  6. 409 `STOCK_INSUFFISANT` avec `details: [{ stockId, nom, disponible: 1 }]` : quantité du panier ramenée à 1, message affiché, `getMyStock` rappelé ;
  7. panier relu depuis le stockage au chargement et corrigé si le stock a baissé ;
  8. termes interdits (D20) : dans les états des cas 1, 4, 5 et 6, `document.body.textContent` ne contient aucun de `/\b(ID|UUID|null|undefined|NaN|serveur|requête|session|idempotence|localStorage|STOCK_INSUFFISANT|VALIDEE)\b/` ni les caractères U+2013 et U+2014 (pas de contrôle des nombres : les prix en contiennent).

## Contraintes

Faire uniquement ce qui est demandé : pas de refactors, helpers ou abstractions non demandés. Discipline de code dans l'ordre : réutiliser l'existant > ranger au bon endroit > n'abstraire qu'à la règle de trois. Règles d'audience, visuelles, typographiques et de langue : docs/ORCHESTRATOR.md. Ne pas modifier docs/plans/. Écrire les fichiers uniquement avec Write et Edit, jamais par redirection shell : le hook de garde ne voit pas les écritures faites par Bash.

Réutiliser : `authFetch`, `ApiError` (`api_auth`), `getMyStock` et `StockMedicament` (`api_pharmacie`), `nouvelleCleIdempotence` (`api_carnet`), `messageErreurPour` (`hooks/useToast`), `useDialogA11y`, `MSG_TELEPHONE_INVALIDE` et `AIDE_TELEPHONE` (`erreur_telephone`), `useAuth`. Aucun `fetch` brut, aucun `any`, aucun `eslint-disable`. Commentaires de code en français. Ne pas modifier `back_medconnect`, ni les composants partagés existants. Ne pas committer : l'orchestrateur committe après validation.

## Done when

Depuis `D:\souleymane\perso-archive-20260923\perso\medconnecte` (conteneur `frontend` démarré) :
1. `docker compose exec -T frontend npx tsc --noEmit` : aucune erreur.
2. `docker compose exec -T frontend npx eslint src/lib/acces.ts src/lib/navigation_tableau_de_bord.ts src/lib/navigation_tableau_de_bord.test.ts src/lib/format_gnf.ts src/lib/format_gnf.test.ts src/lib/api_ventes.ts src/lib/api_ventes.test.ts src/app/dashboard/vente/panier.ts src/app/dashboard/vente/panier.test.ts src/app/dashboard/vente/ConfirmationVente.tsx src/app/dashboard/vente/page.tsx src/app/dashboard/vente/page.test.tsx` : aucune erreur ni avertissement.
3. `docker compose exec -T frontend npx vitest run` : tous les tests verts, dont les nouveaux fichiers ci-dessus.
4. `git -C front_medconnect status --porcelain -- . ":!docs/plans"` ne liste que les 12 fichiers du tableau.
5. Depuis `front_medconnect`, en Git Bash : `git diff -U0 -- src | LC_ALL=C.UTF-8 grep -n $'^+.*\(\xe2\x80\x93\|\xe2\x80\x94\)'` et `LC_ALL=C.UTF-8 grep -rn $'\xe2\x80\x93\|\xe2\x80\x94' src/lib/format_gnf.ts src/lib/format_gnf.test.ts src/lib/api_ventes.ts src/lib/api_ventes.test.ts src/app/dashboard/vente/` : aucune ligne.
6. Depuis `front_medconnect` : `grep -rnE ":\s*any\b|<any>|as any\b" src/lib/api_ventes.ts src/lib/format_gnf.ts src/app/dashboard/vente/` et `grep -rn "eslint-disable" src/lib/api_ventes.ts src/lib/format_gnf.ts src/app/dashboard/vente/` : aucune ligne.

## Return

Chemin de l'artefact + preuve (commande lancée, résultat en une ligne). Ou un bloc BLOCKED. Pas de prose.

## Historique

<!-- une ligne par tentative : AAAA-MM-JJ | tier | résultat | raison si échec -->

## Validation

<!-- commande relancée par l'orchestrateur | résultat en une ligne | hash du commit -->
