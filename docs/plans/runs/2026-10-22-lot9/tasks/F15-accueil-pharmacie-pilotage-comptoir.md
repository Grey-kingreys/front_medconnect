# F15 - Accueil d'une pharmacie : vue « pilotage » (administrateur) et vue « comptoir » (pharmacien)

Tier: spécifié (agent implementeur-specifie)
Audience: non-dev (administrateur de pharmacie, pharmacien)
Visuel: préventif
Background-safe: non, car essai réel contre le back local (`curl` sur http://localhost:3101) et conteneur `frontend`

## Spec

Page concernée : `src/app/dashboard/page.tsx` (route `/dashboard`). Décisions du run : `docs/plans/runs/2026-10-22-lot9/decisions.md`, **D15 à D24**, à lire en entier avant de coder. Le back **n'est pas modifié**. Avant d'écrire du code Next, lire dans `node_modules/next/dist/docs/` ce qui concerne `"use client"` et `next/link`.

### Constat de départ (pour le rapport)

Sur la démo (Pharmacie de Kaloum), l'administrateur et le pharmacien voient le même accueil (aperçu du stock) et presque le même menu, alors que leurs permissions diffèrent. Rien n'indique à l'administrateur les ventes du jour ni l'équipe ; rien ne met « Nouvelle vente » en avant pour le pharmacien.

### Contrats du back (vérifiés dans back_medconnect origin/dev, ne pas les redemander)

- `GET /auth/me` sur la démo, `structureType: "PHARMACIE"`, permissions :
  - pharmacien (`ousmane.keita@demo.medconnecte.gn`) : `catalogue:write, chat:structure, membre:read, stock:read, stock:write, structure:read, vente:read, vente:write` ;
  - administrateur (`admin.kaloum@demo.medconnecte.gn`) : `membre:manage, membre:read, role:manage, stock:read, stock:write, structure:read, structure:write, vente:annuler, vente:read, vente:write`.
  Les deux comptes ont un `structureId` (le même).
- `GET /pharmacie/:structureId/ventes` : voir D15. Appel existant : `listerVentes(structureId)` de `@/lib/api_ventes` (sans option : jour courant, page 1), type `VentesDuJour`. `totalJour` = validées seulement ; `nombre` = toutes, annulées comprises ; `ventes[].statut` vaut exactement `"VALIDEE"` ou `"ANNULEE"` ; `ventes[].vendeur.id` = identifiant de l'utilisateur vendeur ; 50 ventes au plus par page.
- `GET /structures/my` : `getMyStructure()` de `@/lib/api_structure` ; `data.membres: Membre[]` avec `isActive: boolean` (rôles MEDECIN, PHARMACIEN, ACCUEIL, sans l'administrateur).
- Montants : toujours `formaterGNF` de `@/lib/format_gnf` (espace insécable déjà gérée). Nombres : `toLocaleString("fr-FR")` comme `ApercuPharmacie`.

### Fichiers à créer ou modifier (et aucun autre)

| Fichier | Action |
|---|---|
| `src/lib/navigation_tableau_de_bord.ts` | ajouter `vuePharmacie` (voir 1.1) ; changer une description (voir 1.2) ; rien d'autre |
| `src/lib/navigation_tableau_de_bord.pharmacie.test.ts` | ajouter un bloc de tests (voir 7.1), sans toucher aux tests existants |
| `src/lib/ventes_tableau_de_bord.ts` + `src/lib/ventes_tableau_de_bord.test.ts` | créer (voir 2) |
| `src/components/dashboard/ApercuPharmacie.tsx` | prop `titre` et exports nommés (voir 3) ; rien d'autre |
| `src/components/dashboard/PilotagePharmacie.tsx` + `PilotagePharmacie.test.tsx` | créer (voir 4) |
| `src/components/dashboard/ComptoirPharmacie.tsx` + `ComptoirPharmacie.test.tsx` | créer (voir 5) |
| `src/app/dashboard/page.tsx` | aiguillage (voir 6) |
| `src/app/dashboard/page.test.tsx` | adapter les 3 tests pharmacie existants et en ajouter (voir 7.5) |

### 1. Registre `src/lib/navigation_tableau_de_bord.ts`

1.1 Ajouter, dans la partie « Fonctions exportées » :

```ts
export type VuePharmacie = "pilotage" | "comptoir";

/** Vue d'accueil d'une pharmacie, décidée sur les permissions (D16). null = accueil habituel. */
export function vuePharmacie(ctx: ContexteAcces): VuePharmacie | null {
  if (ctx.mode === "repli" || ctx.typeStructure !== "PHARMACIE") return null;
  return ctx.permissions.has("structure:write") || ctx.permissions.has("vente:annuler") ? "pilotage" : "comptoir";
}
```

1.2 Entrée `structure`, `raccourci.description.PHARMACIE` : remplacer `"Gérez les informations de votre pharmacie"` par `"Informations, horaires et garde de votre pharmacie"` (D22). Aucune autre modification du registre : ni `acces`, ni ordre, ni libellé, ni entrée ajoutée ou retirée.

### 2. `src/lib/ventes_tableau_de_bord.ts` (D17, D18)

Fonctions pures, sans `any`, importent seulement le type `VentesDuJour` de `./api_ventes` :

```ts
export interface ResumeVentesDuJour {
  totalJour: number;     // data.totalJour
  nombre: number;        // data.nombre
  annulees: number;      // ventes de data.ventes au statut "ANNULEE"
  partiel: boolean;      // data.totalPages > 1
  ventesLues: number;    // data.ventes.length
}
export function resumerVentesDuJour(data: VentesDuJour): ResumeVentesDuJour;

export interface ResumeMesVentes {
  total: number;         // somme des total des ventes VALIDEE dont vendeur.id === utilisateurId
  nombre: number;        // nombre de ces ventes VALIDEE
  annulees: number;      // ventes ANNULEE dont vendeur.id === utilisateurId
  partiel: boolean;      // data.totalPages > 1
  ventesLues: number;    // data.ventes.length
}
export function resumerMesVentes(data: VentesDuJour, utilisateurId: string): ResumeMesVentes;
```

`data.ventes` absent ou non tableau : traiter comme `[]`.

### 3. `src/components/dashboard/ApercuPharmacie.tsx` (D21)

- Ajouter à `ApercuPharmacieProps` : `/** Titre de la section ; par défaut « Aperçu de votre pharmacie ». */ titre?: string;` et l'utiliser dans le `<h2>` existant (défaut `"Aperçu de votre pharmacie"`).
- Ajouter `export` devant les déclarations existantes de `Carte`, `Valeur`, `Chargement` et `pluriel`, sans changer leur code.
- Aucun autre changement : `ApercuPharmacie.test.tsx` doit rester vert sans modification.

### 4. `src/components/dashboard/PilotagePharmacie.tsx` (administrateur)

`"use client"`. Exports :

```ts
export interface DroitsPilotage {
  peutModifier: boolean;    // structure:write ET route /dashboard/structure autorisée
  peutVoirEquipe: boolean;  // route /dashboard/membres autorisée
  peutVoirVentes: boolean;  // route /dashboard/ventes autorisée
  peutAnnuler: boolean;     // permission vente:annuler
  peutVoirStock: boolean;   // route /dashboard/stock autorisée
}
export interface LienVue { href: string; libelle: string; icone: ComponentType<{ className?: string }> }
export function liensPilotage(d: DroitsPilotage): LienVue[];
export default function PilotagePharmacie(props: { structureId: string | undefined; droits: DroitsPilotage });
```

`liensPilotage` renvoie, dans cet ordre et seulement si le droit est vrai : `{ href: "/dashboard/structure", libelle: "Modifier ma pharmacie", icone: Building2 }` (peutModifier), `{ href: "/dashboard/membres", libelle: "Équipe", icone: Users }` (peutVoirEquipe), `{ href: "/dashboard/ventes", libelle: "Ventes du jour", icone: Receipt }` (peutVoirVentes).

Rendu : un fragment contenant, dans cet ordre :

**4.1 Section pilotage** : `<section aria-labelledby={id} aria-busy={chargement en cours}>` avec `<h2 id>` « Pilotage de la pharmacie » (mêmes classes et style de police que le `h2` d'`ApercuPharmacie`), `space-y-4`.

- **Raccourcis** (si `liensPilotage(droits)` non vide) : rangée `flex flex-wrap gap-3` de `Link` ; le premier lien avec le style principal du bouton « Nouvelle vente » d'`ApercuPharmacie` (`bg-primary-600 text-white ...`), les suivants avec le style secondaire du bouton « Ventes du jour » d'`ApercuPharmacie` ; icône `w-4 h-4 aria-hidden`. Nom accessible = exactement le libellé.
- Si `peutAnnuler && peutVoirVentes` : sous la rangée, `<p className="text-sm text-slate-600 dark:text-slate-400">` « Pour annuler une vente enregistrée par erreur, ouvrez « Ventes du jour ». »
- **Grille** `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4` réutilisant `Carte`, `Valeur`, `Chargement` exportés :
  - **Ventes** (si `peutVoirVentes`, chargées une fois au montage par `listerVentes(structureId)`, relancées par « Réessayer ») :
    - chargement : 3 cartes « Encaissé aujourd'hui », « Ventes enregistrées », « Ventes annulées » avec `<Chargement />` ;
    - prêt, `nombre > 0` : carte « Encaissé aujourd'hui » (icône `Wallet`, couleur `text-emerald-600 dark:text-emerald-400`, valeur `formaterGNF(totalJour)`, sous-texte « Ventes validées, sans les annulations ») ; carte « Ventes enregistrées » (icône `Receipt`, `text-primary-600 dark:text-primary-400`, valeur `nombre`, sous-texte « Aujourd'hui, annulations comprises ») ; carte « Ventes annulées » (icône `Ban`, `text-rose-600 dark:text-rose-400`, valeur `annulees`, sous-texte `partiel ? "Compté sur les ${ventesLues} dernières ventes du jour" : "Aujourd'hui"`) ;
    - prêt, `nombre === 0` : à la place des 3 cartes, un bloc `sm:col-span-2 lg:col-span-3` aux classes de `CLASSES_BLOC` d'`ApercuPharmacie` (recopier la chaîne de classes) contenant `<p className="text-sm text-slate-600 dark:text-slate-400">` « Aucune vente enregistrée aujourd'hui pour le moment. » ;
    - `structureId` absent ou erreur réseau : pas de carte de ventes ; sous la grille, `<div role="alert">` reprenant la présentation du bloc d'erreur du stock d'`ApercuPharmacie`, texte « Les ventes du jour n'ont pas pu être chargées. Vérifiez votre connexion puis réessayez. » et bouton « Réessayer » (même classes) qui repasse en chargement et relance ;
    - `ApiError` de statut 403 : rien du tout pour les ventes (D20).
  - **Équipe** (si `peutVoirEquipe`, `getMyStructure()` au montage) : carte « Membres actifs » (icône `Users`, `text-secondary-600 dark:text-secondary-400`) ; chargement = `<Chargement />` ; prêt = valeur = nombre de `membres` avec `isActive === true`, sous-texte `` `sur ${pluriel(total, "membre de l'équipe", "membres de l'équipe")}` `` ; si `total === 0`, sous-texte « Aucun membre dans l'équipe pour l'instant » ; erreur réseau = même rendu que la carte équipe en erreur d'`ApercuPharmacie` (« Indisponible » + bouton « Réessayer » avec `aria-label="Réessayer de charger l'équipe"`) ; 403 = carte absente.
  - Si la grille n'a aucun enfant, ne pas la rendre.

**4.2 Stock** : `<ApercuPharmacie structureId={structureId} titre="Votre stock" peutVoirStock={droits.peutVoirStock} peutVoirEquipe={false} />` (D19, D21), rendu **toujours**, en dehors de la section pilotage, quel que soit l'état des ventes.

Chargements protégés par un drapeau `actif` dans chaque `useEffect` (même schéma qu'`ApercuPharmacie`). `aria-busy` de la section = ventes ou équipe en chargement.

### 5. `src/components/dashboard/ComptoirPharmacie.tsx` (pharmacien)

`"use client"`. Exports :

```ts
export interface DroitsComptoir {
  peutVendre: boolean;          // route /dashboard/vente autorisée
  peutVoirVentes: boolean;      // route /dashboard/ventes autorisée
  peutVoirOrdonnances: boolean; // route /dashboard/ordonnances autorisée
  peutVoirStock: boolean;       // route /dashboard/stock autorisée
  peutVoirEquipe: boolean;      // route /dashboard/membres autorisée
}
export function liensComptoir(d: DroitsComptoir): LienVue[]; // LienVue importé de ./PilotagePharmacie
export default function ComptoirPharmacie(props: { structureId: string | undefined; utilisateurId: string; droits: DroitsComptoir });
```

`liensComptoir` renvoie, dans cet ordre, si le droit est vrai : `{ href: "/dashboard/vente", libelle: "Nouvelle vente", icone: ShoppingCart }`, `{ href: "/dashboard/ordonnances", libelle: "Ordonnances reçues", icone: ClipboardList }`, `{ href: "/dashboard/ventes", libelle: "Voir toutes les ventes du jour", icone: Receipt }`.

Rendu, fragment dans cet ordre :

**5.1 Section comptoir** `<section aria-labelledby aria-busy className="space-y-4">`, `<h2>` « Au comptoir » (même style que 4.1). Si la section n'a ni action ni bloc de ventes (aucun des trois droits `peutVendre`, `peutVoirOrdonnances`, `peutVoirVentes`), ne pas la rendre.

- **Actions** (rangée `flex flex-col sm:flex-row gap-3`) :
  - si `peutVendre` : **premier lien de la vue**, grand : `Link href="/dashboard/vente"` aux classes `inline-flex items-center justify-center gap-3 px-6 py-4 rounded-2xl text-lg font-semibold bg-primary-600 text-white hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 w-full sm:w-auto`, icône `ShoppingCart w-6 h-6 aria-hidden`, texte « Nouvelle vente » ;
  - si `peutVoirOrdonnances` : `Link href="/dashboard/ordonnances"` au style secondaire (4.1) mais `px-6 py-4 rounded-2xl text-base`, icône `ClipboardList`, texte « Ordonnances reçues ».
- **Mes ventes du jour** (si `peutVoirVentes`) : `<h3 className="text-base font-semibold text-slate-900 dark:text-white">` « Mes ventes du jour », puis grille `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4` :
  - chargement : cartes « Montant de mes ventes » et « Mes ventes » avec `<Chargement />` ;
  - prêt (calcul `resumerMesVentes(data, utilisateurId)`), si `nombre > 0 || annulees > 0` : carte « Montant de mes ventes » (`Wallet`, emerald, `formaterGNF(total)`, sous-texte « Ventes validées, sans les annulations ») ; carte « Mes ventes » (`Receipt`, primary, valeur `nombre`, sous-texte `annulees > 0 ? pluriel(annulees, "vente annulée, non comptée", "ventes annulées, non comptées") : "Aujourd'hui"`) ;
  - prêt, `nombre === 0 && annulees === 0` : bloc `sm:col-span-2` (classes `CLASSES_BLOC`) avec « Vous n'avez encore enregistré aucune vente aujourd'hui. » ;
  - si `partiel` : sous la grille, `<p className="text-sm text-slate-600 dark:text-slate-400">` `` `Calculé sur les ${ventesLues} dernières ventes de la pharmacie.` `` ;
  - toujours (sauf erreur 403) : sous la grille, `Link href="/dashboard/ventes"` au style du lien « Voir tout le stock » d'`ApercuPharmacie`, texte « Voir toutes les ventes du jour » + `ArrowRight` ;
  - erreur réseau ou `structureId` absent : `role="alert"` « Vos ventes du jour n'ont pas pu être chargées. Vérifiez votre connexion puis réessayez. » + bouton « Réessayer » (comme 4.1) ;
  - 403 : titre, grille et lien absents.
- Les ventes des autres vendeurs ne sont **jamais** affichées ni additionnées dans cette vue.

**5.2 Stock** : `<ApercuPharmacie structureId={structureId} titre="Votre stock" peutVoirStock={droits.peutVoirStock} peutVoirEquipe={droits.peutVoirEquipe} />`, toujours rendu.

### 6. `src/app/dashboard/page.tsx`

- Importer `vuePharmacie` (registre), `PilotagePharmacie`, `liensPilotage`, `ComptoirPharmacie`, `liensComptoir`.
- `const vue = contexte ? vuePharmacie(contexte) : null;` (à côté de `estPharmacie`, qui reste inchangé).
- Après les deux `return` de chargement, calculer :

```ts
const droitsPilotage: DroitsPilotage = {
  peutModifier: contexte.permissions.has("structure:write") && estRouteAutorisee("/dashboard/structure", contexte),
  peutVoirEquipe: estRouteAutorisee("/dashboard/membres", contexte),
  peutVoirVentes: estRouteAutorisee("/dashboard/ventes", contexte),
  peutAnnuler: contexte.permissions.has("vente:annuler"),
  peutVoirStock: estRouteAutorisee("/dashboard/stock", contexte),
};
const droitsComptoir: DroitsComptoir = {
  peutVendre: estRouteAutorisee("/dashboard/vente", contexte),
  peutVoirVentes: estRouteAutorisee("/dashboard/ventes", contexte),
  peutVoirOrdonnances: estRouteAutorisee("/dashboard/ordonnances", contexte),
  peutVoirStock: estRouteAutorisee("/dashboard/stock", contexte),
  peutVoirEquipe: estRouteAutorisee("/dashboard/membres", contexte),
};
const hrefsDeLaVue = vue === "pilotage" ? liensPilotage(droitsPilotage).map((l) => l.href)
  : vue === "comptoir" ? liensComptoir(droitsComptoir).map((l) => l.href) : [];
const quickActions = raccourcis(contexte).filter((a) => !hrefsDeLaVue.includes(a.href));
```

- Message d'accueil (D24) : `vue === "pilotage"` : « Suivez l'activité de votre pharmacie : ventes du jour, équipe et stock. » ; `vue === "comptoir"` : « Enregistrez vos ventes et gardez un œil sur les ruptures de stock. » ; sinon `getWelcomeMessage(user.role)` inchangé.
- À la place du bloc `{estPharmacie && <ApercuPharmacie ... />}` :
  - `vue === "pilotage"` : `<PilotagePharmacie structureId={user.structureId} droits={droitsPilotage} />` ;
  - `vue === "comptoir"` : `<ComptoirPharmacie structureId={user.structureId} utilisateurId={user.id} droits={droitsComptoir} />` ;
  - sinon, si `estPharmacie` (mode repli) : **le bloc `ApercuPharmacie` actuel, à l'identique**.
- Titre de la grille d'accès rapides : `vue !== null ? "Autres accès" : "Accès rapide"` ; grille masquée si `quickActions` est vide (déjà le cas).
- Rien d'autre ne change : compteurs, graphiques, redirection super admin, en-tête.

### 7. Tests Vitest

7.1 `navigation_tableau_de_bord.pharmacie.test.ts`, nouveau `describe("vue d'accueil et menu de la pharmacie (démo)")` avec les permissions exactes de la démo (section « Contrats ») :
- `vuePharmacie` : admin démo = `"pilotage"` ; pharmacien démo = `"comptoir"` ; pharmacien + `vente:annuler` = `"pilotage"` ; `contexte("MEDECIN", "HOPITAL", [...])` = `null` ; `enRepli("PHARMACIEN")` = `null` ; `enRepli("STRUCTURE_ADMIN")` = `null`.
- Menu : pour chacun des deux comptes, la section `etablissement` existe et son premier lien a le libellé « Ma pharmacie » et l'adresse `/dashboard/structure`.
- Aucune page retirée : pour chacun des deux comptes, chaque adresse de la liste `["/dashboard/vente", "/dashboard/ventes", "/dashboard/ordonnances", "/dashboard/stock", "/dashboard/catalogue", "/dashboard/structure", "/dashboard/membres"]` donne `estRouteAutorisee(...) === true` et figure dans `hrefs(sectionsMenu(ctx))` ; `/dashboard/chat` figure dans le menu du pharmacien.
- Le raccourci « Ma pharmacie » a pour description « Informations, horaires et garde de votre pharmacie ».

7.2 `ventes_tableau_de_bord.test.ts` : jeu de 4 ventes (2 du vendeur `u1` dont une `ANNULEE`, 2 de `u2` dont une `ANNULEE`), `totalPages: 1` puis `2` ; vérifier tous les champs des deux résumés, dont `partiel`, et que `resumerMesVentes` ignore les ventes de `u2` et les annulées dans `total`.

7.3 `PilotagePharmacie.test.tsx` (mocks : `@/lib/api_ventes` `{ listerVentes }`, `@/lib/api_structure` `{ getMyStructure }`, `@/lib/api_pharmacie` `{ getMyStock }`) :
- tous droits vrais : titre « Pilotage de la pharmacie » ; liens « Modifier ma pharmacie » (`/dashboard/structure`), « Équipe » (`/dashboard/membres`), « Ventes du jour » (`/dashboard/ventes`) ; carte « Encaissé aujourd'hui » contient `formaterGNF(12000)` ; « Ventes enregistrées » = `10` ; « Ventes annulées » = nombre d'`ANNULEE` du jeu ; « Membres actifs » = 1 avec un membre inactif dans le jeu et le sous-texte « sur 2 membres de l'équipe » ; le titre « Votre stock » est présent ; `getMyStructure` appelé **une seule fois** ;
- `totalPages: 2` : texte « Compté sur les N dernières ventes du jour » ;
- `nombre: 0` : « Aucune vente enregistrée aujourd'hui pour le moment. » ;
- `listerVentes` rejeté (`new Error`) : `role="alert"` avec le message des ventes, **et** les cartes du stock affichées (ex. groupe « Médicaments disponibles » avec sa valeur) ; clic sur « Réessayer » rappelle `listerVentes` (2 appels) et affiche les cartes ;
- `listerVentes` rejeté par `new ApiError(403, ...)` (construire comme dans `ApercuPharmacie.test.tsx`) : aucune carte de ventes, aucun `role="alert"` ;
- `peutModifier: false` : pas de lien « Modifier ma pharmacie » ; `liensPilotage` testé directement sur deux combinaisons.

7.4 `ComptoirPharmacie.test.tsx` (mêmes mocks) :
- le premier lien de la vue (`screen.getAllByRole("link")[0]`) est « Nouvelle vente » → `/dashboard/vente` ; lien « Ordonnances reçues » → `/dashboard/ordonnances` ;
- avec `utilisateurId="u1"` et des ventes de `u1` et `u2` : « Montant de mes ventes » = `formaterGNF(<somme des VALIDEE de u1>)`, « Mes ventes » = nombre de VALIDEE de u1, sous-texte « 1 vente annulée, non comptée » ; le montant de `u2` n'apparaît nulle part ; aucun texte « Pilotage de la pharmacie » ;
- aucune vente de `u1` : « Vous n'avez encore enregistré aucune vente aujourd'hui. » ;
- `listerVentes` rejeté : alerte des ventes **et** stock affiché ;
- `peutVendre: false` : pas de lien « Nouvelle vente ».

7.5 `src/app/dashboard/page.test.tsx` : ajouter `vi.mock("@/lib/api_ventes", () => ({ listerVentes: vi.fn() }))` et l'import correspondant. Adapter les trois tests pharmacie existants, sans toucher aux autres :
- « n'affiche à l'administrateur de pharmacie que ce qui concerne sa pharmacie » (permissions inchangées, avec `structure:write`, donc pilotage) : membres simulés avec `isActive: true` ; attendre le groupe « Membres actifs » à `2` ; garder les vérifications « stock pas ouvert », absence de « Pharmaciens », « Patients de la structure », « Médecins », `getMyStock` et `getMyPatients` non appelés ; remplacer « Aperçu de votre pharmacie » par « Votre stock » ; remplacer les vérifications « Accès rapide » par : liens « Modifier ma pharmacie » et « Équipe » présents, texte « Accès rapide » et « Autres accès » absents ; `listerVentes` non appelé (pas de `vente:read`).
- « montre les liens de vente au pharmacien… » (comptoir) : `listerVentes` résolu avec une journée vide ; lien « Nouvelle vente » → `/dashboard/vente` et lien « Voir toutes les ventes du jour » → `/dashboard/ventes` dans la section « Au comptoir ».
- « montre au pharmacien l'aperçu de son stock et ses accès rapides » (comptoir sans droit de vente) : mêmes vérifications du stock ; la grille s'appelle « Autres accès » et contient « Mon Stock », « Importer le stock », « Catalogue des médicaments ».
- Nouveaux tests : (a) permissions exactes de l'administrateur démo : « Pilotage de la pharmacie » présent, « Au comptoir » absent, message « Suivez l'activité de votre pharmacie : ventes du jour, équipe et stock. » ; la grille « Autres accès » ne contient ni « Ma pharmacie » ni « Équipe de la pharmacie » ni « Ventes du jour » mais contient « Nouvelle vente » ; (b) permissions exactes du pharmacien démo : « Au comptoir » présent, « Pilotage de la pharmacie » absent, « Autres accès » contient « Ma pharmacie » et « Messagerie » ; (c) `listerVentes` rejeté pour l'administrateur démo : alerte des ventes et titre « Votre stock » présents.

### 8. Essai réel contre le back local (obligatoire, une fois, lecture seule)

Back sur http://localhost:3101, démo active. Avec `curl` (Git Bash) : `GET /auth/demo/comptes`, relever les `id` de `admin.kaloum@demo.medconnecte.gn` et `ousmane.keita@demo.medconnecte.gn` ; pour chacun `POST /auth/demo/connexion` `{ "userId": "<id>" }`, jeton = `data.access_token`. Puis, avec `Authorization: Bearer <jeton>`, **uniquement des GET** :
1. `GET /auth/me` : noter `id`, `structureId`, `structureType`, `permissions`, et la vue attendue selon D16.
2. `GET /pharmacie/<structureId>/ventes` : noter `totalJour`, `nombre`, `totalPages`, le nombre de `ANNULEE` dans `ventes`, et pour le pharmacien le résultat de D18 (somme et nombre de ses `VALIDEE`, ses `ANNULEE`), calculé avec `node -e`.
3. `GET /structures/my` : nombre de `membres` et de `membres` actifs.
4. Écrire, pour chaque compte, les chiffres que la vue doit afficher (ex. « Encaissé aujourd'hui : 12 000 GNF »), et vérifier qu'un test de 7.3 ou 7.4 couvre la même forme de données.

Aucun `POST` autre que la connexion de démo, aucun `PATCH`, aucune vente créée ni annulée. Consigner dans `docs/plans/runs/2026-10-22-lot9/rapports/F15-essai-reel.md` (seul fichier de `docs/plans/` que la tâche écrit) : commandes (jeton masqué en `<jeton>`), statut HTTP, extraits des champs, chiffres attendus par vue, et la ligne finale « aucune écriture : oui ». Ne jamais y recopier le jeton.

## Contraintes

Faire uniquement ce qui est demandé : pas de refactors, helpers ou abstractions non demandés. Discipline de code dans l'ordre : réutiliser l'existant > ranger au bon endroit > n'abstraire qu'à la règle de trois. Règles d'audience, visuelles, typographiques et de langue : docs/ORCHESTRATOR.md. Ne pas modifier docs/plans/, sauf le rapport d'essai réel de la section 8. Écrire les fichiers uniquement avec Write et Edit, jamais par redirection shell : le hook de garde ne voit pas les écritures faites par Bash.

Précisions :
- Ne modifier ni `back_medconnect`, ni `api_ventes.ts`, ni `api_structure.ts`, ni `format_gnf.ts`, ni `acces.ts`, ni les pages `/dashboard/ventes`, `/dashboard/vente`, `/dashboard/structure`.
- La décision d'affichage ne lit jamais `user.role` dans les nouvelles vues ni dans `vuePharmacie` (D16) ; `getWelcomeMessage(user.role)` ne sert plus que hors pharmacie.
- Aucun `any`, aucun `eslint-disable` dans les fichiers créés ; dans `ApercuPharmacie.tsx` et `page.tsx`, les `eslint-disable-next-line` déjà présents sont conservés tels quels et aucun n'est ajouté. Commentaires de code en français.
- Textes visibles en français pour des non-techniciens, **exactement** ceux de cette fiche ; aucun terme de la liste des termes interdits (docs/ORCHESTRATOR.md, sections 1 et 14) dans les chaînes affichées ; aucun tiret cadratin ni demi-cadratin. Aucun chiffre inventé : tous les chiffres viennent de `listerVentes`, `getMyStructure` ou `getMyStock`. Tout montant passe par `formaterGNF`.
- Thèmes clair et sombre : chaque couleur de texte, fond et bordure a sa variante `dark:`, en reprenant les classes d'`ApercuPharmacie`. Pas de boîte dans une boîte (les cartes sont posées directement dans la grille, pas dans un bloc encadré).
- Accessibilité : tout est utilisable au clavier (ordre naturel, focus visible `focus-visible:ring-2 focus-visible:ring-primary-500` sur chaque lien et bouton), chaque section a un `h2` relié par `aria-labelledby`, chaque carte est un `role="group"` nommé (via `Carte`), les erreurs sont en `role="alert"`, les chargements ont un texte `sr-only` (via `Chargement`).

## Done when

Depuis `D:\souleymane\perso-archive-20260923\perso\medconnecte` (conteneur `frontend` démarré) :
1. `docker compose exec -T frontend npx tsc --noEmit` : aucune erreur.
2. `docker compose exec -T frontend npx eslint src/lib/navigation_tableau_de_bord.ts src/lib/navigation_tableau_de_bord.pharmacie.test.ts src/lib/ventes_tableau_de_bord.ts src/lib/ventes_tableau_de_bord.test.ts src/components/dashboard/ApercuPharmacie.tsx src/components/dashboard/PilotagePharmacie.tsx src/components/dashboard/PilotagePharmacie.test.tsx src/components/dashboard/ComptoirPharmacie.tsx src/components/dashboard/ComptoirPharmacie.test.tsx src/app/dashboard/page.tsx src/app/dashboard/page.test.tsx` : aucune erreur ni avertissement.
3. `docker compose exec -T frontend npx vitest run` : tous les tests verts, dont les quatre fichiers de test nouveaux ou modifiés de la commande du point 2, `ApercuPharmacie.test.tsx` et `navigation_tableau_de_bord.test.ts` inchangés.
4. `git -C front_medconnect status --porcelain --untracked-files=all -- . ":!docs/plans"` ne liste que les 11 fichiers de la commande du point 2.
5. Depuis `front_medconnect`, en Git Bash : `git diff -U0 -- src | LC_ALL=C.UTF-8 grep -n $'^+.*\(\xe2\x80\x93\|\xe2\x80\x94\)'` et `LC_ALL=C.UTF-8 grep -n $'\xe2\x80\x93\|\xe2\x80\x94' src/lib/ventes_tableau_de_bord.ts src/lib/ventes_tableau_de_bord.test.ts src/components/dashboard/PilotagePharmacie.tsx src/components/dashboard/PilotagePharmacie.test.tsx src/components/dashboard/ComptoirPharmacie.tsx src/components/dashboard/ComptoirPharmacie.test.tsx` : aucune ligne.
6. Depuis `front_medconnect` : `grep -nE ":\s*any\b|<any>|as any\b|eslint-disable|user\.role|\.role ===" src/lib/ventes_tableau_de_bord.ts src/components/dashboard/PilotagePharmacie.tsx src/components/dashboard/ComptoirPharmacie.tsx` : aucune ligne ; `git diff -U0 -- src/components/dashboard/ApercuPharmacie.tsx src/app/dashboard/page.tsx | grep -n "^+.*eslint-disable"` : aucune ligne.
7. Depuis `front_medconnect` : `grep -n "Gérez les informations de votre pharmacie" src/lib/navigation_tableau_de_bord.ts` : aucune ligne ; `git diff -U0 -- src/lib/navigation_tableau_de_bord.ts | grep -nE "^[-+].*(acces:|rolesRepli:|typesStructure)"` : aucune ligne (aucun droit d'accès modifié).
8. `docs/plans/runs/2026-10-22-lot9/rapports/F15-essai-reel.md` existe, contient les étapes 1 à 4 de la section 8 pour les deux comptes avec leurs statuts HTTP, la vue attendue (« pilotage » pour l'administrateur, « comptoir » pour le pharmacien) et la ligne « aucune écriture : oui » ; `grep -nE "eyJ[A-Za-z0-9_-]{10,}" docs/plans/runs/2026-10-22-lot9/rapports/F15-essai-reel.md` : aucune ligne.

## Return

Chemin des fichiers + preuve (commande lancée, résultat en une ligne) pour chaque point du « Done when », plus le chemin du rapport d'essai réel. Ou un bloc BLOCKED. Pas de prose.

## Historique

<!-- une ligne par tentative : AAAA-MM-JJ | tier | résultat | raison si échec -->

## Validation

<!-- commande relancée par l'orchestrateur | résultat en une ligne | hash du commit -->
