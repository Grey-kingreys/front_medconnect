# F13 - Contrat des ventes aligné, reçu imprimable et « Ventes du jour »

Tier: spécifié (agent implementeur-specifie)
Audience: non-dev (pharmacien, administrateur de pharmacie)
Visuel: préventif
Background-safe: oui

## Spec

Sources qui font foi : `D:\souleymane\perso-archive-20260923\perso\medconnecte\SPEC-VENTES-PHARMACIE.md` (écrans « Reçu » et « Ventes du jour ») et le **code réel du back** (`back_medconnect`, branche `orch/lot8-back` : `src/pharmacie/vente.controller.ts`, `src/pharmacie/dto/vente.dto.ts`, `src/pharmacie/vente.service.ts`, `src/common/filters/all-exceptions.filter.ts`, puce B13 de son `CLAUDE.md`). Décisions du run : `docs/plans/runs/2026-10-22-lot8/decisions.md` (D01 à D24). Les noms ci-dessous sont **exactement** ceux à employer. Ne rien modifier dans `back_medconnect`.

Avant d'écrire du code Next, lire `node_modules/next/dist/docs/` pour les points utilisés : segment dynamique `[venteId]` de l'App Router, `useParams` de `next/navigation` dans une page client, `next/link`.

Rappel des composants et fonctions à réutiliser (ne rien recréer) : `authFetch`, `ApiError` (`@/lib/api_auth`), `formaterGNF` (`@/lib/format_gnf`), `messageErreurPour` et `useToast` (`@/hooks/useToast`), `useDialogA11y` (`@/hooks/useDialogA11y`), `useAuth` (`@/hooks/useAuth`), `lireContexteAcces` (`@/lib/acces`), `estRouteAutorisee` (`@/lib/navigation_tableau_de_bord`), `ImageWithFallback` (`@/components/ImageWithFallback`), styles des cartes, champs et boutons de `src/app/dashboard/vente/page.tsx` (constantes `CARTE`, `CHAMP`, `FOCUS`, `BOUTON_PRIMAIRE` : recopier leurs valeurs dans les nouvelles pages, ne pas les exporter), structure du dialogue de `src/app/dashboard/vente/ConfirmationVente.tsx`.

### Fichiers à créer ou modifier (et aucun autre)

| Fichier | Action |
|---|---|
| `src/lib/api_ventes.ts` + `src/lib/api_ventes.test.ts` | aligner sur le back, ajouter liste, détail, annulation (voir 0) |
| `src/app/dashboard/vente/panier.ts` + `panier.test.ts` | limites 50 lignes et 10000 unités (voir 0.4) |
| `src/app/dashboard/vente/page.tsx` + `page.test.tsx` | STOCK_INTROUVABLE, limites, rejeu, lien « Ventes du jour » (voir 0.5 et 3) |
| `src/app/dashboard/ventes/affichage.ts` + `affichage.test.ts` | créer (voir 1.1) |
| `src/app/dashboard/ventes/[venteId]/recu/page.tsx` + `page.test.tsx` | créer, reçu (voir 1) |
| `src/app/dashboard/ventes/page.tsx` + `page.test.tsx` | créer, ventes du jour (voir 2) |
| `src/app/dashboard/ventes/AnnulationVente.tsx` | créer, dialogue d'annulation (voir 2.4) |
| `src/app/dashboard/layout.tsx` | classes `print:` seulement (voir 1.4) |
| `src/lib/navigation_tableau_de_bord.ts` + `src/lib/navigation_tableau_de_bord.pharmacie.test.ts` | entrée « Ventes du jour » (voir 3.1) |
| `src/components/dashboard/ApercuPharmacie.tsx` + `ApercuPharmacie.test.tsx` | barre d'actions, `formaterGNF` (voir 3.2) |
| `src/app/dashboard/page.tsx` + `src/app/dashboard/page.test.tsx` | passer les deux nouvelles props (voir 3.2) |
| `src/lib/apercu_pharmacie.ts` + `src/lib/apercu_pharmacie.test.ts` | supprimer `formaterMontantGNF` et son `describe` (D19) |

### 0. Alignement sur le contrat réel du back (D01 à D07)

#### 0.1 Écarts constatés à corriger (à recopier tels quels dans le rapport)

| Élément | Front lot 7 | Back réel | Correction |
|---|---|---|---|
| `Vente.structureId` | présent | absent | supprimer |
| `Vente.vendeurId` | présent | absent | supprimer |
| `Vente.vendeur` | facultatif `{ id, nom, prenom }` | obligatoire `{ id, nom }` (`nom` = « prénom nom ») | `vendeur: { id: string; nom: string }` |
| `Vente.pharmacie` | facultatif, sans `id`, champs facultatifs | obligatoire `{ id, nom, adresse, ville, telephone, logoUrl }`, valeurs absentes = `null` | `PharmacieVente` ci-dessous |
| `Vente.rejeu` | absent | `true` au rejeu d'une même clé | `rejeu?: boolean` |
| `LigneVente.venteId` | présent | absent | supprimer |
| `LigneVente.stockMedicamentId` | présent | nommé `stockId` | renommer en `stockId` |
| `LigneErreurVente.demande` | absent | présent sur STOCK_INSUFFISANT | ajouter `demande?: number` |
| Emplacement des lignes d'erreur | 4 emplacements essayés | `details` à la racine du corps uniquement | lire `err.details.details` seulement (D03) |
| Codes | 5 codes | + `STOCK_INTROUVABLE` (404, `details: [{ stockId }]`), `VENTE_DEJA_ANNULEE`, `ANNULATION_HORS_DELAI` (409) | compléter la liste (D04) |
| Nombre de lignes | illimité | 1 à 50 (`@ArrayMaxSize(50)`) | plafond 50 dans le panier (D06) |
| Quantité d'une ligne | bornée au stock | 1 à 10000 (`@Max(10000)`) | borne `min(stock, 10000)` (D06) |
| `Idempotency-Key` | UUID | 8 à 128 caractères `[A-Za-z0-9._:-]` | inchangé (un UUID convient) |
| `clientNom` 100, `clientTelephone` 30 au plus | 100 et 20 (format du téléphone) | compatibles | inchangé |
| Liste, détail, annulation | absents | `GET .../ventes`, `GET .../ventes/:venteId`, `POST .../ventes/:venteId/annuler` | ajouter (0.3) |

Valeurs vérifiées identiques (aucune correction) : route `POST /pharmacie/:structureId/ventes`, enveloppe `{ data, message, success }`, statuts `VALIDEE` et `ANNULEE`, champs du corps `lignes[].stockId`, `lignes[].quantite`, `clientNom`, `clientTelephone`, `ordonnanceVerifiee`, montants entiers en GNF.

#### 0.2 Types de `src/lib/api_ventes.ts`

Remplacer le commentaire d'en-tête par : contrat aligné sur back_medconnect (orch/lot8-back, `vente.controller.ts` et `vente.service.ts`). Aucun `any`.

```ts
export type StatutVente = "VALIDEE" | "ANNULEE";

export const CODES_ERREUR_VENTE = [
  "STOCK_INSUFFISANT", "MEDICAMENT_EXPIRE", "PRIX_MANQUANT", "ORDONNANCE_NON_CONFIRMEE",
  "STOCK_INTROUVABLE", "VALIDATION", "VENTE_DEJA_ANNULEE", "ANNULATION_HORS_DELAI",
] as const;
export type CodeErreurVente = (typeof CODES_ERREUR_VENTE)[number];

export interface LigneVenteDemandee { stockId: string; quantite: number }   // inchangé
export interface CorpsCreationVente { ... }                                  // inchangé
export interface LigneVente {
  id: string; stockId: string; medicamentId: string; nomMedicament: string;
  prixUnitaire: number; quantite: number; sousTotal: number;
}
export interface PharmacieVente {
  id: string; nom: string; adresse: string | null; ville: string | null;
  telephone: string | null; logoUrl: string | null;
}
export interface VendeurVente { id: string; nom: string }
export interface Vente {
  id: string; numero: string; statut: StatutVente; createdAt: string; total: number;
  ordonnanceVerifiee: boolean; clientNom: string | null; clientTelephone: string | null;
  vendeur: VendeurVente;
  annuleeLe: string | null; annuleeParId: string | null; motifAnnulation: string | null;
  lignes: LigneVente[];
  pharmacie: PharmacieVente;
  /** Vrai quand la même clé a déjà servi : vente renvoyée sans second retrait du stock. */
  rejeu?: boolean;
}
export interface VenteResume {
  id: string; numero: string; createdAt: string; statut: StatutVente; total: number;
  nombreArticles: number; vendeur: VendeurVente; clientNom: string | null;
}
export interface VentesDuJour {
  date: string; totalJour: number; nombre: number; page: number; parPage: number;
  totalPages: number; ventes: VenteResume[];
}
export interface LigneErreurVente { stockId: string; nom?: string; disponible?: number; demande?: number }
```

#### 0.3 Fonctions de `src/lib/api_ventes.ts`

- `creerVente` : inchangée.
- `listerVentes(structureId: string, options: { date?: string; page?: number } = {})` = `authFetch<VentesDuJour>(...)` sur `` `/pharmacie/${encodeURIComponent(structureId)}/ventes` `` suivi de `?` + `URLSearchParams` construit avec `date` puis `page` (seulement les options définies ; aucune option = pas de `?`).
- `getVente(structureId: string, venteId: string)` = `authFetch<Vente>` sur `` `/pharmacie/${encodeURIComponent(structureId)}/ventes/${encodeURIComponent(venteId)}` ``.
- `annulerVente(structureId: string, venteId: string, motif: string)` = `authFetch<Vente>` sur `.../ventes/${encodeURIComponent(venteId)}/annuler`, `{ method: "POST", body: JSON.stringify({ motif }) }` (motif envoyé tel que reçu ; la page le passe déjà sans espaces autour).
- `codeErreurVente` : inchangée (la liste élargie suffit).
- `lignesErreurVente(err)` : si `err` n'est pas une `ApiError` ou n'a pas de `details` : `[]`. Lire **uniquement** `err.details.details` ; si ce n'est pas un tableau : `[]`. Garder les éléments objets dont `stockId` est une chaîne non vide ; recopier `nom` s'il est une chaîne, `disponible` et `demande` s'ils sont des entiers `>= 0` ; ignorer le reste. Supprimer la lecture de `donnees` et de `lignes`.

#### 0.4 `src/app/dashboard/vente/panier.ts`

- Ajouter `export const MAX_LIGNES_PANIER = 50;` et `export const QUANTITE_MAX_LIGNE = 10000;`.
- Ajouter `export function quantiteMaxLigne(stock: StockMedicament): number` = `Math.max(0, Math.min(stock.quantite, QUANTITE_MAX_LIGNE))`.
- Remplacer toutes les bornes « au stock » par `quantiteMaxLigne(stock)` : `ajouterAuPanier` (ligne présente : +1 refusé si `>= quantiteMaxLigne`), `changerQuantite` (borne haute), `reconcilierPanier` (quantité ramenée à `quantiteMaxLigne`, correction comme aujourd'hui).
- `ajouterAuPanier` : si la ligne est absente et que `panier.lignes.length >= MAX_LIGNES_PANIER`, renvoyer le **même** objet `panier`.
- Ajouter `export function panierPlein(panier: PanierVente): boolean` = `panier.lignes.length >= MAX_LIGNES_PANIER`.
- `lirePanierStocke` : après filtrage des éléments invalides, garder les `MAX_LIGNES_PANIER` premières lignes.
- Rien d'autre ne change.

#### 0.5 `src/app/dashboard/vente/page.tsx`

- Dans `gererEchec`, nouveau cas **avant** `VALIDATION` : `code === "STOCK_INTROUVABLE"` → même traitement que `MEDICAMENT_EXPIRE` (`enregistrerEtAppliquer(retirerLignes(...))`, `setEssai(n + 1)`), bandeau `` `Certains médicaments ne sont plus dans le stock de la pharmacie et ont été retirés du panier${suiteNoms()}. Vérifiez le panier puis validez à nouveau.` `` (les noms viennent du stock chargé via `nomsCites`, déjà en place) (D05).
- Liste des résultats : pour un médicament vendable absent du panier alors que `panierPlein(panier)` : pas de bouton « Ajouter », texte `text-sm text-slate-600 dark:text-slate-400` « Panier complet ». La condition « Tout le stock est dans le panier » devient `dansPanier >= quantiteMaxLigne(s)`.
- Bouton « + » du panier : désactivé à `quantiteMaxLigne(stock)` (au lieu de `stock.quantite`).
- Panier : si `panierPlein(panier)`, paragraphe `role="status"` sous la liste des lignes : « Le panier contient 50 médicaments différents, le maximum pour une vente. Validez cette vente puis commencez-en une nouvelle. »
- Écran de succès :
  - si `succes.rejeu === true` : paragraphe sous le titre « Cette vente était déjà enregistrée : elle n'a pas été comptée deux fois. » (D07) ;
  - le lien « Voir et imprimer le reçu » reste tel quel (`/dashboard/ventes/${encodeURIComponent(succes.id)}/recu`) ;
  - ajouter, après le bouton « Nouvelle vente », un lien `next/link` « Voir les ventes du jour » vers `/dashboard/ventes`, même style que le bouton « Nouvelle vente », affiché seulement si `estRouteAutorisee("/dashboard/ventes", lireContexteAcces(user, profile ?? null))` (lire `profile` dans `useAuth()`) (D23).

### 1. Reçu, `src/app/dashboard/ventes/[venteId]/recu/page.tsx`

#### 1.1 `src/app/dashboard/ventes/affichage.ts` (pur, aucun import React)

```ts
export type FormatRecu = "58" | "80" | "A4";
export const FORMATS_RECU: readonly { valeur: FormatRecu; libelle: string }[] = [
  { valeur: "58", libelle: "Ticket 58 mm" },
  { valeur: "80", libelle: "Ticket 80 mm" },
  { valeur: "A4", libelle: "Feuille A4" },
];
export const FORMAT_RECU_PAR_DEFAUT: FormatRecu = "58";
export const CLE_FORMAT_RECU = "medconnecte:format-recu";
export const LONGUEUR_MIN_MOTIF = 3;
export const LONGUEUR_MAX_MOTIF = 300;
```
Fonctions :
- `lireFormatRecu(): FormatRecu` : `typeof window === "undefined"` → défaut ; sinon `localStorage.getItem(CLE_FORMAT_RECU)` dans un `try/catch` ; valeur parmi `"58" | "80" | "A4"` → elle, sinon défaut (D11).
- `enregistrerFormatRecu(format: FormatRecu): void` : `localStorage.setItem` dans un `try/catch` (échec ignoré).
- `jourConakry(date: Date): string` = `date.toISOString().slice(0, 10)` (D10).
- `formaterDateCourte(iso: string): string` : `Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Conakry", day: "2-digit", month: "2-digit", year: "numeric" })` → « 22/10/2026 ».
- `formaterHeure(iso: string): string` : même `Intl` avec `{ timeZone: "Africa/Conakry", hour: "2-digit", minute: "2-digit" }` → « 10:05 ».
- `formaterDateHeure(iso: string): string` = `` `${formaterDateCourte(iso)} à ${formaterHeure(iso)}` ``.
- `formaterJour(jour: string): string` : jour `AAAA-MM-JJ` → `Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" })` sur `` new Date(`${jour}T00:00:00.000Z`) `` → « jeudi 22 octobre 2026 ».
- `motifValide(motif: string): boolean` : longueur de `motif.trim()` entre `LONGUEUR_MIN_MOTIF` et `LONGUEUR_MAX_MOTIF` inclus.
- `libelleArticles(n: number): string` : `1` → « 1 article », sinon « N articles ».
- `LIBELLES_STATUT: Record<StatutVente, string>` = `{ VALIDEE: "Validée", ANNULEE: "Annulée" }` (type importé de `@/lib/api_ventes`).

#### 1.2 Chargement

`"use client"`, export par défaut `RecuVentePage`. Lint propre **sans** `eslint-disable`, modèle de chargement de `src/app/dashboard/vente/page.tsx` (setState seulement dans `.then` et `.catch`, compteur `essai`).

- `const { venteId } = useParams<{ venteId: string }>()` ; `const { user, loading, profile } = useAuth()` ; `contexte = user ? lireContexteAcces(user, profile ?? null) : null` ; `peutVoirVentes = contexte !== null && estRouteAutorisee("/dashboard/ventes", contexte)`.
- `loading` ou `user === null` : `role="status"` « Chargement... » (même bloc que la page Nouvelle vente).
- Sans `user.structureId` : même bloc que Nouvelle vente (« Votre compte n'est rattaché à aucune pharmacie... », lien « Retour à l'accueil »).
- `getVente(user.structureId, venteId)` dans un `useEffect` dépendant de `[user?.structureId, venteId, essai]`.
- État d'attente : `role="status"` « Chargement du reçu... » (icône `Loader2` animée, `aria-hidden`).
- Échec : `err instanceof ApiError && err.status === 404` → carte « Cette vente est introuvable. Vérifiez que vous êtes bien dans la bonne pharmacie. » et lien « Voir les ventes du jour » (`/dashboard/ventes`) si `peutVoirVentes`, sinon « Retour à l'accueil » (`/dashboard`) ; autre échec → `role="alert"` `messageErreurPour(err, "Impossible d'afficher le reçu. Vérifiez votre connexion puis réessayez.")` et bouton « Réessayer » (`essai + 1`, retour à l'état d'attente).
- `const [format, setFormat] = useState<FormatRecu>(() => lireFormatRecu())`. Le choix du format n'est rendu qu'une fois la vente chargée (le rendu serveur montre seulement « Chargement... » : pas d'écart d'hydratation).

#### 1.3 Mise en page (vente chargée)

Commandes, toutes dans un bloc `print:hidden` :
- `h1` « Reçu de la vente » (style des titres de Nouvelle vente, police Outfit) ; sous-titre « Choisissez le format de votre imprimante puis appuyez sur « Imprimer ». ».
- Lien retour (texte, sans bordure, icône `ArrowLeft` `aria-hidden`) : « Retour aux ventes du jour » vers `/dashboard/ventes` si `peutVoirVentes`, sinon « Retour à l'accueil » vers `/dashboard`.
- `fieldset` avec `legend` « Format du ticket » : trois boutons radio natifs (`name="format-recu"`, un `label` par radio, libellés de `FORMATS_RECU`), présentés en rangée ; radio coché = bordure `border-primary-600` et texte `text-primary-700 dark:text-primary-300`, sinon `border-slate-200 dark:border-slate-700` ; focus visible sur le label via `has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-500` ; au changement : `setFormat` puis `enregistrerFormatRecu`.
- Bouton « Imprimer » (`BOUTON_PRIMAIRE`, icône `Printer` `aria-hidden`) : `onClick={() => window.print()}`.

Feuille du reçu (`<article aria-label={`Reçu ${vente.numero}`}>`), **blanche à texte noir dans les deux thèmes** (D14) : `bg-white text-black border border-slate-300 print:border-0 mx-auto mt-6 print:mt-0`, polices système, `font-variant-numeric: tabular-nums` (classe `tabular-nums`). Classes par format :

| Format | Classes de l'article |
|---|---|
| `58` | `w-[58mm] max-w-full px-[3mm] py-[4mm] text-[11px] leading-snug` |
| `80` | `w-[80mm] max-w-full px-[4mm] py-[5mm] text-[12px] leading-snug` |
| `A4` | `w-full max-w-[180mm] p-[10mm] print:p-0 text-sm` |

`<style>` rendu dans la page (D12), contenu selon le format :
- `58` et `80` : `@media print { @page { margin: 0; } }`
- `A4` : `@media print { @page { size: A4; margin: 15mm; } }`

Contenu de la feuille, dans cet ordre, séparateurs = `border-t border-dashed border-black/40 my-2` :
1. Si `vente.statut === "ANNULEE"` : bandeau `role="status"` centré, `border-2 border-black font-extrabold tracking-widest text-center py-1`, texte « ANNULÉE », puis ligne « Annulée le <formaterDateHeure(annuleeLe)> » si `annuleeLe` existe. Le motif n'est pas affiché (D15).
2. En-tête centré : logo par `ImageWithFallback` (`src={vente.pharmacie.logoUrl}`, `alt={`Logo de ${vente.pharmacie.nom}`}`, `className="mx-auto h-12 w-auto object-contain"` en 58 et 80 mm, `h-16` en A4, `fallback={null}`) ; nom de la pharmacie en gras ; `adresse`, `ville`, puis « Tél. : <telephone> », chacun seulement s'il n'est pas `null` ni vide.
3. « Reçu n° <numero> » ; « Le <formaterDateHeure(createdAt)> » ; « Vendeur : <vendeur.nom> » ; « Client : <clientNom> » si présent ; « Téléphone du client : <clientTelephone> » si présent.
4. Lignes (`ul`) : pour chaque ligne, nom (`nomMedicament`) sur sa ligne, puis en dessous, aligné à droite : `` `${quantite} × ${formaterGNF(prixUnitaire)} = ${formaterGNF(sousTotal)}` ``.
5. « Total » à gauche et `formaterGNF(total)` à droite, en gras, taille un cran au-dessus.
6. Pied centré : « Merci de votre confiance » puis « Reçu : ne vaut pas facture ».

Classes `print:` complémentaires sur la page : conteneur racine `max-w-4xl mx-auto print:max-w-none print:m-0`.

#### 1.4 `src/app/dashboard/layout.tsx` (classes seulement, D13)

Ne changer **que** des chaînes de classes, rien d'autre :
- voile mobile (`fixed inset-0 bg-black/60 ...`) : ajouter `print:hidden` ;
- `aside` du menu : ajouter `print:hidden` ;
- `div` racine `min-h-screen bg-slate-50 ...` : ajouter `print:min-h-0 print:bg-white` ;
- `div` du contenu (`transition-all duration-300 ${collapsed ? ...}`) : ajouter `print:ml-0` ;
- `header` mobile : ajouter `print:hidden` ;
- `main` : ajouter `print:p-0` ;
- entourer `<EmergencyButton />` et `<EmergencyListener />` d'un `<div className="print:hidden">`.

### 2. Ventes du jour, `src/app/dashboard/ventes/page.tsx`

`"use client"`, export par défaut `VentesDuJourPage`. Lint propre sans `eslint-disable`, même modèle de chargement.

#### 2.1 État et chargement

- `useAuth()` (`user`, `loading`, `profile`), `contexte = lireContexteAcces(user, profile ?? null)`, `peutAnnuler = contexte.permissions.has("vente:annuler")`, `peutVendre = estRouteAutorisee("/dashboard/vente", contexte)`.
- Mêmes états que le reçu pour `loading` et l'absence de `structureId`.
- `aujourdhui = jourConakry(new Date())` ; `date` initialisée à `aujourdhui` ; `page` à 1.
- `listerVentes(structureId, { date, page })` dans un `useEffect` dépendant de `[structureId, date, page, essai]`, résultat dans un état `{ statut: "chargement" } | { statut: "pret"; donnees: VentesDuJour } | { statut: "erreur"; message: string }`. Les gestionnaires qui changent `date`, `page` ou `essai` repassent l'état à `chargement` dans le gestionnaire lui-même (jamais dans l'effet).
- Erreur : `role="alert"`, `messageErreurPour(err, "Impossible d'afficher les ventes. Vérifiez votre connexion puis réessayez.")`, bouton « Réessayer ».

#### 2.2 Mise en page

- `h1` « Ventes du jour », sous-titre « Retrouvez les ventes d'une journée, réimprimez un reçu ou annulez une vente du jour. ».
- Barre : `label` « Date » + `input type="date"` (classes `CHAMP`, largeur auto), `max={aujourdhui}`, `value={date}` ; au changement, si la valeur respecte `^\d{4}-\d{2}-\d{2}$` : `setDate`, `setPage(1)`, état `chargement` ; sinon rien. Si `peutVendre` : lien `BOUTON_PRIMAIRE` « Nouvelle vente » (icône `ShoppingCart`) vers `/dashboard/vente`.
- Résumé (carte `CARTE`, une fois chargé) : titre `h2` `formaterJour(date)` (première lettre en majuscule via la classe `first-letter:uppercase`) ; « Total des ventes validées : <formaterGNF(totalJour)> » en gras dans une zone `aria-live="polite"` ; sous-texte « Montant indicatif, sans les ventes annulées. » ; « <nombre> vente(s) » : `0` → « Aucune vente », `1` → « 1 vente », sinon « N ventes » (D20).
- Liste (`ul` `divide-y`, dans une carte `CARTE`) : chaque `li` en `flex flex-col sm:flex-row sm:items-center justify-between gap-3` avec :
  - numéro en gras ; dessous en `text-sm text-slate-600 dark:text-slate-400` : `` `${formaterHeure(createdAt)} · ${libelleArticles(nombreArticles)} · ${vendeur.nom}` `` puis `` ` · Client : ${clientNom}` `` si présent ;
  - total `formaterGNF(total)` en gras ;
  - badge de statut `LIBELLES_STATUT[statut]`, sans bordure : Validée = `bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300`, Annulée = `bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300` ;
  - lien « Réimprimer » (icône `Printer`, `aria-label` « Réimprimer le reçu <numero> ») vers `/dashboard/ventes/${encodeURIComponent(id)}/recu`, style secondaire (texte `text-primary-700 dark:text-primary-300`, `FOCUS`) ;
  - bouton « Annuler » (icône `Ban`, `aria-label` « Annuler la vente <numero> », texte `text-rose-700 dark:text-rose-300`, `FOCUS`) seulement si `peutAnnuler && statut === "VALIDEE" && date === aujourdhui` (D21).
- Liste vide : « Aucune vente le <formaterJour(date)>. » et, si `date === aujourdhui && peutVendre`, lien « Nouvelle vente ».
- Pagination si `totalPages > 1` : « Page <page> sur <totalPages> » et boutons « Page précédente » (désactivé à 1) et « Page suivante » (désactivé à `totalPages`).
- Bandeau de page (`role="alert"`, mêmes classes rose que Nouvelle vente, bouton « Fermer » avec `aria-label` « Fermer le message ») pour les refus de l'annulation (2.4).

#### 2.3 Libellés

Tous en français. Aucun code de statut brut à l'écran (pas de `VALIDEE`, `ANNULEE`, ni de code d'erreur).

#### 2.4 Annulation, `src/app/dashboard/ventes/AnnulationVente.tsx` (D21, D22)

- Props : `{ isOpen: boolean; numero: string; total: number; envoiEnCours: boolean; erreur: string | null; onClose: () => void; onConfirmer: (motif: string) => void }`.
- Structure reprise de `ConfirmationVente.tsx` (fond, `useDialogA11y({ isOpen, onClose, closeOnEscape: !envoiEnCours })`, `{...dialogProps}`, `titleId`), pastille d'icône `Ban` en `bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300`.
- Contenu : titre « Annuler la vente <numero> ? » ; « Montant : <formaterGNF(total)> » ; « Les quantités seront remises dans votre stock. La vente restera visible dans la liste, marquée « Annulée ». » ; `label` « Motif de l'annulation » lié à un `textarea` (`rows={3}`, `maxLength={LONGUEUR_MAX_MOTIF}`, classes `CHAMP`), aide `aria-describedby` « Entre 3 et 300 caractères. » et compteur « <n> / 300 » ; état local du motif remis à vide à chaque ouverture (clé de rendu `key={numero}` côté page).
- « Annuler la vente » (rose plein `bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-bold`, `FOCUS`) : si `!motifValide(motif)` → message `role="alert"` « Indiquez un motif de 3 à 300 caractères. » sous le champ et focus sur le champ ; sinon `onConfirmer(motif.trim())`. Pendant l'envoi : `Loader2` animé et « Annulation... », bouton désactivé.
- « Garder la vente » (secondaire, `onClose`, désactivé pendant l'envoi).
- `erreur` non nulle : bloc `role="alert"` rose dans le dialogue.

Côté page :
- Succès : fermer, `notifier(res.message, "succes")` (`useToast`), recharger la liste (`essai + 1`).
- `codeErreurVente(err) === "VENTE_DEJA_ANNULEE"` : fermer, bandeau « Cette vente avait déjà été annulée. La liste a été mise à jour. », recharger.
- `"ANNULATION_HORS_DELAI"` : fermer, bandeau « Cette vente ne peut plus être annulée : une vente s'annule seulement le jour même. », recharger.
- `"VALIDATION"` : dialogue ouvert, `erreur = messageErreurPour(err, "Indiquez un motif de 3 à 300 caractères.")`.
- `ApiError` de statut 0, 502, 503 ou 504 : dialogue ouvert, `erreur` « L'annulation n'a pas pu être envoyée. Vérifiez votre connexion puis réessayez. ».
- Autre : dialogue ouvert, `erreur = messageErreurPour(err, "Un problème est survenu, réessayez dans un instant.")`.
- Double envoi impossible (garde `useRef` comme `envoiEnCours` de Nouvelle vente).

### 3. Menu et aperçu pharmacie

#### 3.1 `src/lib/navigation_tableau_de_bord.ts` (D16)

Importer `Receipt` depuis `lucide-react`. Insérer dans `ENTREES`, **juste après** l'entrée `id: "vente"` :
```ts
{
  id: "ventes",
  section: "activite",
  href: "/dashboard/ventes",
  icone: Receipt,
  libelle: { defaut: "Ventes du jour" },
  acces: perm(["vente:read"], { typesStructure: P }),
  rolesRepli: [],
  raccourci: {
    description: { defaut: "Retrouvez les ventes, réimprimez un reçu" },
    degrade: "from-primary-500 to-cyan-500",
    rolesRepli: [],
  },
},
```
Rien d'autre ne change dans ce fichier.

#### 3.2 `src/components/dashboard/ApercuPharmacie.tsx` et `src/app/dashboard/page.tsx` (D18, D19)

- `ApercuPharmacieProps` : ajouter `peutVendre?: boolean` et `peutVoirVentes?: boolean` (commentaires : « Le registre ouvre Nouvelle vente à ce profil », « Le registre ouvre Ventes du jour à ce profil »), défaut `false`.
- Sous le `h2` « Aperçu de votre pharmacie », si l'une des deux est vraie, une rangée `flex flex-wrap gap-3`, affichée quel que soit l'état du stock :
  - `peutVendre` : `Link` « Nouvelle vente » vers `/dashboard/vente`, icône `ShoppingCart` `aria-hidden`, classes `inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500` (celles du bouton « Ouvrir le stock » existant) ;
  - `peutVoirVentes` : `Link` « Ventes du jour » vers `/dashboard/ventes`, icône `Receipt` `aria-hidden`, classes du lien « Importer un fichier Excel » existant.
- Remplacer `formaterMontantGNF` par `formaterGNF` (import `@/lib/format_gnf`) ; supprimer `formaterMontantGNF` de `src/lib/apercu_pharmacie.ts` et le `describe("formaterMontantGNF")` de `src/lib/apercu_pharmacie.test.ts`.
- `src/app/dashboard/page.tsx` : passer `peutVendre={estRouteAutorisee("/dashboard/vente", contexte)}` et `peutVoirVentes={estRouteAutorisee("/dashboard/ventes", contexte)}` à `ApercuPharmacie`. Rien d'autre.

### Textes

Tous en français, vocabulaire de l'utilisateur. Aucun tiret cadratin ni demi-cadratin. Interdits à l'écran : ID, UUID, identifiant, clé, idempotence, serveur, requête, session, navigateur, localStorage, code d'erreur, codes en majuscules (`VALIDEE`, `ANNULEE`, `STOCK_INTROUVABLE`, `VENTE_DEJA_ANNULEE`, `ANNULATION_HORS_DELAI`...), code HTTP, null, undefined, NaN, permission. Seule majuscule voulue : le tampon « ANNULÉE » (accentué) du reçu (D15).

### Tests (Vitest, `src/**/*.test.{ts,tsx}`)

Les cas existants restent verts ; ne modifier un cas existant que pour suivre les nouveaux types (fixtures `Vente`) ou la suppression décidée (emplacements `donnees` et `lignes`, `formaterMontantGNF`).

- `api_ventes.test.ts` : `listerVentes` (route encodée sans `?` quand aucune option ; `?date=2026-10-22&page=2` avec les deux) ; `getVente` (route encodée) ; `annulerVente` (`POST`, corps `{"motif":"Erreur de quantité"}`) ; `codeErreurVente` reconnaît `STOCK_INTROUVABLE`, `VENTE_DEJA_ANNULEE`, `ANNULATION_HORS_DELAI` ; `lignesErreurVente` lit `details` à la racine, recopie `demande`, **ignore** désormais `donnees.details`, `donnees.lignes` et `lignes` (renvoie `[]`), filtre toujours les éléments invalides.
- `panier.test.ts` : 51e médicament refusé (même objet renvoyé) ; `panierPlein` ; `quantiteMaxLigne` avec un stock de 20000 → 10000 ; `changerQuantite` bornée à 10000 ; `lirePanierStocke` garde 50 lignes sur 60.
- `vente/page.test.tsx` : fixture `VENTE` au nouveau type (avec `vendeur` et `pharmacie`) ; 404 `new ApiError("...", 404, { code: "STOCK_INTROUVABLE", details: [{ stockId: "s1" }] })` → ligne retirée, bandeau avec « Paracétamol », `getMyStock` rappelé ; succès avec `rejeu: true` → phrase du rejeu ; contrôle des termes interdits (regex existante complétée par `STOCK_INTROUVABLE`) dans ces deux états.
- `ventes/affichage.test.ts` : `lireFormatRecu` (défaut sans valeur, valeur valide, valeur inconnue, `getItem` qui lève) ; `enregistrerFormatRecu` (écrit, n'échoue pas si `setItem` lève) ; `formaterDateHeure("2026-10-22T10:05:00.000Z")` → « 22/10/2026 à 10:05 » ; `formaterJour("2026-10-22")` → « jeudi 22 octobre 2026 » ; `jourConakry` ; `motifValide` (2, 3, 300, 301 caractères, espaces seuls) ; `libelleArticles`.
- `ventes/[venteId]/recu/page.test.tsx` (mocker `next/navigation` `useParams` → `{ venteId: "v1" }`, `@/hooks/useAuth` avec `user` et `profile` portant `permissions: ["vente:read"]` et `structureType: "PHARMACIE"`, `@/lib/api_ventes` `getVente` en gardant le reste via `importOriginal` ; `localStorage.clear()` avant chaque test ; `window.print = vi.fn()`) : en-tête (nom, adresse, ville, « Tél. : »), numéro, « Le 22/10/2026 à 10:05 », vendeur, client, ligne « 2 × 1 500 GNF = 3 000 GNF » (espaces insécables, comparer avec `formaterGNF`), total, « Merci de votre confiance », « Reçu : ne vaut pas facture » ; logo affiché (`img` d'`alt` « Logo de ... ») quand `logoUrl` existe, absent sinon ; « ANNULÉE » seulement pour une vente annulée ; format 58 coché par défaut, choix « Feuille A4 » mémorisé sous `medconnecte:format-recu` et relu au rendu suivant ; « Imprimer » appelle `window.print` ; 404 → message « Cette vente est introuvable » ; échec réseau puis « Réessayer » rappelle `getVente` ; termes interdits (regex du dessus + `ANNULEE` sans accent) et tirets U+2013 et U+2014 absents de `document.body.textContent`.
- `ventes/page.test.tsx` (mocker `useAuth` avec deux profils selon le cas : `["vente:read", "vente:write"]` et `["vente:read", "vente:write", "vente:annuler"]`, `@/lib/api_ventes` `listerVentes` et `annulerVente` en gardant `codeErreurVente` réel, `@/hooks/useToast` `useToast` → `{ notifier: vi.fn() }` en gardant `messageErreurPour` ; date fixée par `vi.useFakeTimers({ toFake: ["Date"] })` et `vi.setSystemTime(new Date("2026-10-22T10:00:00Z"))`, rétablie après chaque test) : premier appel `listerVentes("p1", { date: "2026-10-22", page: 1 })` ; liste (numéro, heure, « 3 articles », total, « Validée » ou « Annulée ») et total du jour ; changement de date → nouvel appel avec cette date et page 1, bouton « Annuler » absent sur une autre date ; « Annuler » absent sans `vente:annuler` et sur une vente annulée ; motif de 2 caractères refusé avec le message, motif valide → `annulerVente("p1", "v1", "Erreur de quantité")`, `notifier` appelé, liste rechargée ; `VENTE_DEJA_ANNULEE` et `ANNULATION_HORS_DELAI` → leurs messages ; liste vide → « Aucune vente le jeudi 22 octobre 2026. » et lien « Nouvelle vente » ; erreur puis « Réessayer » ; « Réimprimer » pointe vers `/dashboard/ventes/v1/recu` ; pagination (deux pages) ; termes interdits.
- `navigation_tableau_de_bord.pharmacie.test.ts` : avec `["vente:read", "vente:write"]` en PHARMACIE, « Ventes du jour » (`/dashboard/ventes`) suit immédiatement « Nouvelle vente » dans la section et figure dans les raccourcis ; mêmes droits en HOPITAL : absent ; sans `vente:read` : `estRouteAutorisee("/dashboard/ventes", ctx)` faux ; repli PHARMACIEN : absent.
- `ApercuPharmacie.test.tsx` : liens « Nouvelle vente » et « Ventes du jour » présents avec leurs `href` quand les props sont vraies (y compris en `peutVoirStock={false}`), absents par défaut.
- `src/app/dashboard/page.test.tsx` : un pharmacien dont le profil porte `vente:read` et `vente:write` voit les deux liens dans l'aperçu de sa pharmacie.

## Contraintes

Faire uniquement ce qui est demandé : pas de refactors, helpers ou abstractions non demandés. Discipline de code dans l'ordre : réutiliser l'existant > ranger au bon endroit > n'abstraire qu'à la règle de trois. Règles d'audience, visuelles, typographiques et de langue : docs/ORCHESTRATOR.md. Ne pas modifier docs/plans/. Écrire les fichiers uniquement avec Write et Edit, jamais par redirection shell : le hook de garde ne voit pas les écritures faites par Bash.

Aucun `fetch` brut, aucun `any`, aucun `eslint-disable` dans les fichiers créés ou dans les lignes modifiées. Pas d'ombre colorée, une seule délimitation par surface (bordure OU fond), contraste AA en clair et en sombre (`-700` en clair, `-300` en sombre pour les textes colorés). Tous les éléments interactifs ont `focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500` ; icônes décoratives `aria-hidden="true"`. Commentaires de code en français. Ne pas modifier `back_medconnect` ni d'autres composants partagés que ceux du tableau. Ne pas committer : l'orchestrateur committe après validation.

Rapport : écrire dans le retour la table des écarts de 0.1 (« écarts corrigés ») telle qu'appliquée.

## Done when

Depuis `D:\souleymane\perso-archive-20260923\perso\medconnecte` (conteneur `frontend` démarré) :
1. `docker compose exec -T frontend npx tsc --noEmit` : aucune erreur.
2. `docker compose exec -T frontend npx eslint src/lib/api_ventes.ts src/lib/api_ventes.test.ts src/app/dashboard/vente/panier.ts src/app/dashboard/vente/panier.test.ts src/app/dashboard/vente/page.tsx src/app/dashboard/vente/page.test.tsx src/app/dashboard/ventes/affichage.ts src/app/dashboard/ventes/affichage.test.ts "src/app/dashboard/ventes/[venteId]/recu/page.tsx" "src/app/dashboard/ventes/[venteId]/recu/page.test.tsx" src/app/dashboard/ventes/page.tsx src/app/dashboard/ventes/page.test.tsx src/app/dashboard/ventes/AnnulationVente.tsx src/app/dashboard/layout.tsx src/lib/navigation_tableau_de_bord.ts src/lib/navigation_tableau_de_bord.pharmacie.test.ts src/components/dashboard/ApercuPharmacie.tsx src/components/dashboard/ApercuPharmacie.test.tsx src/app/dashboard/page.tsx src/app/dashboard/page.test.tsx src/lib/apercu_pharmacie.ts src/lib/apercu_pharmacie.test.ts` : aucune erreur ni avertissement (l'`eslint-disable-next-line` déjà présent dans `ApercuPharmacie.tsx` est conservé tel quel).
3. `docker compose exec -T frontend npx vitest run` : tous les tests verts, dont les nouveaux fichiers ci-dessus.
4. `git -C front_medconnect status --porcelain --untracked-files=all -- . ":!docs/plans"` ne liste que les 22 fichiers de la commande du point 2.
5. Depuis `front_medconnect`, en Git Bash : `git diff -U0 -- src | LC_ALL=C.UTF-8 grep -n $'^+.*\(\xe2\x80\x93\|\xe2\x80\x94\)'` et `LC_ALL=C.UTF-8 grep -rn $'\xe2\x80\x93\|\xe2\x80\x94' src/app/dashboard/ventes/ src/lib/api_ventes.ts src/lib/api_ventes.test.ts` : aucune ligne.
6. Depuis `front_medconnect` : `grep -rnE ":\s*any\b|<any>|as any\b" src/lib/api_ventes.ts src/app/dashboard/ventes/ src/app/dashboard/vente/` et `grep -rn "eslint-disable" src/lib/api_ventes.ts src/app/dashboard/ventes/ src/app/dashboard/vente/` : aucune ligne.
7. Depuis `front_medconnect` : `grep -rnE "stockMedicamentId|vendeurId|donnees|formaterMontantGNF" src/lib/api_ventes.ts src/app/dashboard/vente/ src/app/dashboard/ventes/ src/components/dashboard/ src/lib/apercu_pharmacie.ts` : aucune ligne.

## Return

Chemin de l'artefact + preuve (commande lancée, résultat en une ligne), plus la table « écarts corrigés ». Ou un bloc BLOCKED. Pas de prose.

## Historique

<!-- une ligne par tentative : AAAA-MM-JJ | tier | résultat | raison si échec -->

## Validation

<!-- commande relancée par l'orchestrateur | résultat en une ligne | hash du commit -->
