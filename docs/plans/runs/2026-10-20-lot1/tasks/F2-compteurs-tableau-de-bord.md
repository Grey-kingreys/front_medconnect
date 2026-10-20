# F2 - Compteurs du tableau de bord branchés sur les vraies données

Tier: spécifié (agent implementeur-specifie)
Audience: non-dev (dashboard de tous les rôles)
Visuel: préventif (reprendre les cartes existantes, tokens existants, clair et sombre)
Background-safe: non, car docker compose exec (typage, lint et tests dans le conteneur frontend)

## Spec

Dépôt : `D:\souleymane\perso-archive-20260923\perso\medconnecte\front_medconnect`, branche `orch/lot1-front` (arbre principal, ne pas changer de branche, ne pas committer). Le back (`back_medconnect`) ne doit PAS être modifié.

### Contexte (déjà vérifié par le chef d'équipe, ne pas re-chercher)

- `src/app/dashboard/page.tsx`, fonction `getStatsCards` (lignes 278 à 324) : 22 cartes « Aperçu » ont en dur une valeur faite du seul caractère tiret cadratin (U+2014) (6 rôles). Seuls STRUCTURE_ADMIN (Médecins, Pharmaciens via `getMyStructure`, les 2 autres à `"0"` en dur) et ACCUEIL (3 compteurs via `getRendezVous`) sont partiellement branchés, sans état de chargement ni d'erreur (`.catch(console.error)`, zéros affichés en cas d'échec).
- SUPER_ADMIN est redirigé vers `/dashboard/super-admin` : pas de compteur pour lui ici.
- `authFetch<T>` et `apiFetch<T>` renvoient `ApiResponse<T>` = `{ data: T; message; success }`. Les erreurs sont des `ApiError` (`src/lib/api_auth.ts`, champ `status`). Les lectures ont déjà délai et nouvelles tentatives.
- Sources existantes retenues (routes du back vérifiées, toutes déjà exposées par `src/lib/`) :
  - `getCarnetResume()` (`api_carnet`, GET /carnet-sante) : `data.stats.{consultations, ordonnances, analyses, vaccinations}` du patient connecté.
  - `getAutoDiagnostics()` (`api_carnet`) : tableau des auto-diagnostics du patient.
  - `getConsultations()` (`api_carnet`) : pour un MEDECIN, les consultations qu'il a rédigées (champ `dateConsultation`).
  - `getRendezVous()` (`api_carnet`) : pour le personnel d'une structure, TOUS les RDV de la structure (champs `medecinId`, `date`, `status`).
  - `getMyPatients()` (`api_patients`, GET /users/patients/my, permission `patient:read`) : patients de la structure (consultation dans la structure ou autorisation), dédoublonnés.
  - `getMyStock(structureId)` (`api_pharmacie`) : `data.stocks[]` (`quantite`) et `data.alertes.rupture[]`.
  - `getUserStats()` (`api_admin`, GET /users/stats, permission `user:admin`, que le rôle ADMIN possède) : `data.total`.
  - `getAllStructures()` (`api_structure`, GET /structures/all, public) : structures actives ET configurées.
  - `getMyStructure()` (`api_structure`) : `data.membres[]` (`role`).
- Aucune source pour : ordonnances émises par un médecin (GET /carnet-sante/ordonnances ne renvoie que celles dont l'utilisateur est le PATIENT), ordonnances traitées par une pharmacie, consultations par mois (plateforme ou structure), croissance. Ces 5 cartes sont RETIRÉES (décision D07).
- `page.tsx` a une erreur de lint préexistante (`react-hooks/set-state-in-effect` sur `setMounted(true)`, ligne 404) et 2 imports inutilisés (`AlertCircle`, `MyStructure`). Le fichier étant touché, il doit sortir propre (D11).

### Changement 1 : nouveau fichier `src/lib/compteurs_tableau_de_bord.ts`

Module sans React, testable seul. Contenu attendu (à reprendre tel quel, commentaires en français) :

```ts
/**
 * Compteurs de l'aperçu du tableau de bord. Chaque source est un appel existant
 * qui alimente un ou plusieurs compteurs. Pas de source = pas de carte (aucune valeur inventée).
 */
import { getAutoDiagnostics, getCarnetResume, getConsultations, getRendezVous } from "./api_carnet";
import { getMyPatients } from "./api_patients";
import { getMyStock } from "./api_pharmacie";
import { getUserStats } from "./api_admin";
import { getAllStructures, getMyStructure } from "./api_structure";

export type CleCompteur =
  | "patientConsultations"
  | "patientOrdonnances"
  | "patientVaccinations"
  | "patientDiagnosticsIA"
  | "medecinPatients"
  | "medecinConsultationsAujourdhui"
  | "medecinRendezVousAVenir"
  | "pharmacieMedicamentsEnStock"
  | "pharmacieRuptures"
  | "adminUtilisateurs"
  | "adminStructures"
  | "structureMedecins"
  | "structurePharmaciens"
  | "structurePatients"
  | "accueilRdvEnAttente"
  | "accueilRdvAujourdhui"
  | "accueilRdvAVenir";

export type ValeursCompteurs = Partial<Record<CleCompteur, number>>;

/** Un appel qui alimente les compteurs listés dans `cles`. */
export interface SourceCompteurs {
  cles: CleCompteur[];
  charger: () => Promise<ValeursCompteurs>;
}

// Même jour calendaire, en heure locale
const memeJour = (date: string, maintenant: Date) =>
  new Date(date).toDateString() === maintenant.toDateString();

export function sourcesCompteurs(
  role: string,
  utilisateur: { id: string; structureId?: string },
  maintenant: Date = new Date(),
): SourceCompteurs[] { /* voir le tableau ci-dessous */ }
```

Implémentation de `sourcesCompteurs` (un `switch (role)`, blocs `case` entre accolades si une constante y est déclarée, chaque `charger` est une fonction `async` qui déstructure `{ data }`) :

| Rôle | Source (`cles`) | Calcul |
|---|---|---|
| PATIENT | `getCarnetResume()` → `patientConsultations`, `patientOrdonnances`, `patientVaccinations` | `data.stats.consultations`, `data.stats.ordonnances`, `data.stats.vaccinations` |
| PATIENT | `getAutoDiagnostics()` → `patientDiagnosticsIA` | `data.length` |
| MEDECIN | `getMyPatients()` → `medecinPatients` | `data.length` |
| MEDECIN | `getConsultations()` → `medecinConsultationsAujourdhui` | nombre de `c` avec `memeJour(c.dateConsultation, maintenant)` |
| MEDECIN | `getRendezVous()` → `medecinRendezVousAVenir` | nombre de `rv` avec `rv.medecinId === utilisateur.id` ET `new Date(rv.date) > maintenant` ET `rv.status` égal à `"PROGRAMME"` ou `"CONFIRME"` (D09) |
| PHARMACIEN | `getMyStock(structureId)` → `pharmacieMedicamentsEnStock`, `pharmacieRuptures` | si `utilisateur.structureId` est absent : `throw new Error("Aucune structure rattachée")` SANS appeler `getMyStock` ; sinon `data.stocks.filter((s) => s.quantite > 0).length` et `data.alertes.rupture.length` |
| ADMIN | `getUserStats()` → `adminUtilisateurs` | `data.total` |
| ADMIN | `getAllStructures()` → `adminStructures` | `data.length` |
| STRUCTURE_ADMIN | `getMyStructure()` → `structureMedecins`, `structurePharmaciens` | sur `data.membres ?? []` : nombre de `role === "MEDECIN"`, nombre de `role === "PHARMACIEN"` (tous, actifs ou non, comme aujourd'hui) |
| STRUCTURE_ADMIN | `getMyPatients()` → `structurePatients` | `data.length` |
| ACCUEIL | `getRendezVous()` → `accueilRdvEnAttente`, `accueilRdvAujourdhui`, `accueilRdvAVenir` | logique actuelle de `page.tsx` (lignes 429 à 437) déplacée telle quelle, `new Date()` remplacé par `maintenant` : `status === "EN_ATTENTE"` ; `memeJour(rv.date, maintenant)` ; `new Date(rv.date) > maintenant` et statut dans `["PROGRAMME", "CONFIRME", "EN_ATTENTE"]` |
| tout autre rôle (dont SUPER_ADMIN) | aucune | `return []` |

Pas de `any`, pas de `try/catch` dans ce module : une erreur d'appel remonte telle quelle (la page la traite).

### Changement 2 : `src/app/dashboard/page.tsx`

1. Imports : retirer `AlertCircle` de lucide-react, retirer `import { getMyStructure, MyStructure } from "@/lib/api_structure";` et `import { getRendezVous } from "@/lib/api_carnet";`. Ajouter `import { ApiError } from "@/lib/api_auth";` et `import { sourcesCompteurs, type CleCompteur } from "@/lib/compteurs_tableau_de_bord";`. Retirer toute icône lucide devenue inutilisée après le point 3 (lint = 0 avertissement).
2. Type `StatCard` remplacé par :
   ```ts
   interface StatCard {
     cle: CleCompteur;
     label: string;
     icon: React.ReactNode;
     color: string;
   }

   // État d'affichage d'un compteur (absent = en cours de chargement)
   type EtatCompteur =
     | { statut: "chargement" }
     | { statut: "pret"; valeur: number }
     | { statut: "erreur" }
     | { statut: "masque" };
   ```
3. `getStatsCards` : mêmes icônes et couleurs qu'aujourd'hui, `value`/`change` supprimés, `cle` ajoutée. Listes exactes (ordre conservé) :
   - PATIENT : `patientConsultations` « Consultations », `patientOrdonnances` « Ordonnances », `patientVaccinations` « Vaccinations », `patientDiagnosticsIA` « Diagnostics IA ».
   - MEDECIN : `medecinPatients` « Patients de la structure » (D08), `medecinConsultationsAujourdhui` « Consultations aujourd'hui », `medecinRendezVousAVenir` « Rendez-vous à venir ». Carte « Ordonnances émises » supprimée.
   - PHARMACIEN : `pharmacieMedicamentsEnStock` « Médicaments en stock », `pharmacieRuptures` « Ruptures de stock ». Carte « Ordonnances traitées » supprimée.
   - ADMIN et SUPER_ADMIN : `adminUtilisateurs` « Utilisateurs », `adminStructures` « Structures en service » (D08). Cartes « Consultations / mois » et « Croissance » supprimées.
   - STRUCTURE_ADMIN : `structureMedecins` « Médecins », `structurePharmaciens` « Pharmaciens », `structurePatients` « Patients de la structure » (D08). Carte « Consultations / mois » supprimée.
   - ACCUEIL : `accueilRdvEnAttente` « RDV en attente », `accueilRdvAujourdhui` « RDV aujourd'hui », `accueilRdvAVenir` « RDV à venir ».
4. `StatsGrid` reçoit `{ cards, etats }` avec `etats: Partial<Record<CleCompteur, EtatCompteur>>`. Le badge `card.change` disparaît. À la place du `<p>` de valeur actuel, pour `const etat = etats[card.cle] ?? { statut: "chargement" }` :
   - `pret` : le même `<p className="text-2xl font-bold text-slate-900 dark:text-white mb-1">` avec `{etat.valeur.toLocaleString("fr-FR")}` ;
   - `erreur` : `<p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1 h-8 flex items-center">Indisponible</p>` ;
   - `chargement` : `<div className="mb-1 h-8 flex items-center"><span aria-hidden="true" className="block h-6 w-12 rounded-md bg-slate-200 dark:bg-slate-700/60 animate-pulse" /><span className="sr-only">Chargement</span></div>`.
   Le libellé `<p className="text-xs text-slate-500">{card.label}</p>` reste le frère direct de la valeur dans la carte (les tests s'appuient sur `label.parentElement`).
5. Dans `DashboardPage` :
   - Supprimer les états `structureStats` et `accueilStats`, les deux `useEffect` qui les remplissent, et les deux blocs « Update ... stats dynamically » (lignes 449 à 468).
   - Ligne `setMounted(true)` : ajouter juste au-dessus `// Éviter les erreurs d'hydratation` puis `// eslint-disable-next-line react-hooks/set-state-in-effect` (même motif que `src/components/ThemeSwitcher.tsx`). Rien d'autre ne change dans cet effet.
   - Ajouter, AVANT les `return` anticipés (règle des hooks) :
     ```tsx
     const [etatsCompteurs, setEtatsCompteurs] = useState<Partial<Record<CleCompteur, EtatCompteur>>>({});
     const [essaiCompteurs, setEssaiCompteurs] = useState(0);
     const utilisateurId = user?.id;
     const role = user?.role;
     const structureId = user?.structureId;

     // Chaque source se charge indépendamment : un échec ne vide pas les autres cartes
     useEffect(() => {
       if (!utilisateurId || !role) return;
       let actif = true;
       const appliquer = (cles: CleCompteur[], etatDe: (cle: CleCompteur) => EtatCompteur) =>
         setEtatsCompteurs((prec) => {
           const suivant = { ...prec };
           for (const cle of cles) suivant[cle] = etatDe(cle);
           return suivant;
         });
       for (const source of sourcesCompteurs(role, { id: utilisateurId, structureId })) {
         source
           .charger()
           .then((valeurs) => {
             if (!actif) return;
             appliquer(source.cles, (cle) => {
               const valeur = valeurs[cle];
               return typeof valeur === "number" ? { statut: "pret", valeur } : { statut: "erreur" };
             });
           })
           .catch((err: unknown) => {
             if (!actif) return;
             // Droit absent (rôle personnalisé) : la carte disparaît au lieu d'afficher une erreur
             const masque = err instanceof ApiError && err.status === 403;
             appliquer(source.cles, () => (masque ? { statut: "masque" } : { statut: "erreur" }));
           });
       }
       return () => {
         actif = false;
       };
     }, [utilisateurId, role, structureId, essaiCompteurs]);

     // Repasse les cartes en erreur en chargement puis relance toutes les sources
     const reessayerCompteurs = () => {
       setEtatsCompteurs((prec) => {
         const suivant = { ...prec };
         for (const cle of Object.keys(suivant) as CleCompteur[]) {
           if (suivant[cle]?.statut === "erreur") suivant[cle] = { statut: "chargement" };
         }
         return suivant;
       });
       setEssaiCompteurs((n) => n + 1);
     };
     ```
     Aucun `setState` synchrone dans le corps de l'effet (seulement dans les callbacks de promesse), pour rester conforme à `react-hooks/set-state-in-effect` sans désactivation.
   - Après les `return` anticipés, remplacer `let statsCards = getStatsCards(user.role);` par :
     ```tsx
     const statsCards = getStatsCards(user.role).filter((c) => etatsCompteurs[c.cle]?.statut !== "masque");
     const compteursEnErreur = statsCards.some((c) => etatsCompteurs[c.cle]?.statut === "erreur");
     const compteursEnChargement = statsCards.some((c) => (etatsCompteurs[c.cle]?.statut ?? "chargement") === "chargement");
     ```
   - Section « Aperçu » (toujours conditionnée par `statsCards.length > 0`) : `<section aria-busy={compteursEnChargement}>`, `<StatsGrid cards={statsCards} etats={etatsCompteurs} />`, puis si `compteursEnErreur` :
     ```tsx
     <div role="status" className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
       <p>Certains chiffres n&apos;ont pas pu être chargés. Vérifiez votre connexion puis réessayez.</p>
       <button
         type="button"
         onClick={reessayerCompteurs}
         className="self-start sm:self-auto px-4 py-2 rounded-xl text-sm font-medium bg-primary-500/10 text-primary-700 dark:text-primary-400 hover:bg-primary-500/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
       >
         Réessayer
       </button>
     </div>
     ```
   - Ne rien changer d'autre : messages d'accueil, actions rapides, en-tête, `DashboardCharts` (hors périmètre, D12), redirection SUPER_ADMIN, la ligne existante `{profile.structure.nom} ... {profile.structure.type.toLowerCase()}` (elle contient un tiret cadratin préexistant : ne pas y toucher, le hook ne contrôle que les lignes modifiées).

### Changement 3 : nouveau fichier `src/lib/compteurs_tableau_de_bord.test.ts`

Vitest. Mocker `./api_carnet` (ou `@/lib/api_carnet`), `@/lib/api_patients`, `@/lib/api_pharmacie`, `@/lib/api_admin`, `@/lib/api_structure` avec `vi.fn()` pour les seules fonctions utilisées (les chemins mockés doivent correspondre à ceux importés par le module : il importe en relatif `./api_carnet`, etc. ; `vi.mock("@/lib/api_carnet")` pointe le même fichier grâce à l'alias, utiliser l'une ou l'autre forme de façon cohérente). Les mocks résolvent `{ data, message: "ok", success: true }`. `maintenant` fixe : `new Date(2026, 9, 20, 10, 0, 0)`. Helper local `async function charger(role, utilisateur)` qui exécute toutes les sources et fusionne leurs valeurs (`Object.assign`). Textes `describe`/`it` en français, pas de `any`. Cas (un `it` chacun) :
1. PATIENT : résumé `{ consultations: 3, ordonnances: 2, analyses: 9, vaccinations: 1 }` et 4 auto-diagnostics : `{ patientConsultations: 3, patientOrdonnances: 2, patientVaccinations: 1, patientDiagnosticsIA: 4 }` ; 2 sources.
2. MEDECIN (`id: "m1"`) : 2 patients ; 3 consultations dont 2 le 20/10/2026 et 1 le 19/10/2026 ; RDV : 1 à `m1` futur PROGRAMME, 1 à `m1` futur CONFIRME, 1 à `m1` futur EN_ATTENTE, 1 à `m1` futur ANNULE, 1 à `m1` passé PROGRAMME, 1 à `m2` futur PROGRAMME : `{ medecinPatients: 2, medecinConsultationsAujourdhui: 2, medecinRendezVousAVenir: 2 }`.
3. PHARMACIEN avec `structureId: "s1"` : stocks de quantités `[5, 0, 12]`, `rupture` de longueur 1 : `{ pharmacieMedicamentsEnStock: 2, pharmacieRuptures: 1 }` et `getMyStock` appelé avec `"s1"`.
4. PHARMACIEN sans `structureId` : la source rejette (`rejects.toThrow()`) et `getMyStock` n'est jamais appelé.
5. ADMIN : `total: 42` et 3 structures : `{ adminUtilisateurs: 42, adminStructures: 3 }`.
6. STRUCTURE_ADMIN : membres de rôles `MEDECIN`, `MEDECIN`, `PHARMACIEN`, `ACCUEIL` et 5 patients : `{ structureMedecins: 2, structurePharmaciens: 1, structurePatients: 5 }`.
7. ACCUEIL : jeu de RDV couvrant chaque règle : valeurs attendues calculées à la main dans le test (au moins un RDV compté et un exclu par compteur).
8. SUPER_ADMIN et un rôle inconnu (`"INFIRMIER"`) : `sourcesCompteurs` renvoie `[]` et aucun mock n'est appelé.
9. Cohérence : pour chaque rôle de 1 à 7, les clés renvoyées par chaque `charger` sont exactement celles de `cles` de la source.

### Changement 4 : nouveau fichier `src/app/dashboard/page.test.tsx`

Vitest + Testing Library (forme de `src/components/ComptesDemo.test.tsx` et `src/components/EmergencyListener.test.tsx`). Mocks :
- `@/hooks/useAuth` : `useAuth: () => ({ user: { id: "m1", email: "medecin@exemple.com", nom: "Camara", prenom: "Awa", role: "MEDECIN", structureId: "s1" }, profile: null })`.
- `next/navigation` : `useRouter: () => ({ replace: vi.fn() })`.
- `@/components/DashboardCharts` : `default: () => null`.
- `@/lib/api_carnet` : `getConsultations`, `getRendezVous` en `vi.fn()` (ne pas mocker `@/lib/api_auth`, `ApiError` réel) ; `@/lib/api_patients` : `getMyPatients` en `vi.fn()`.
- `next/link` seulement si le rendu l'exige.
- `beforeEach` : `vi.clearAllMocks()` (ou `mockReset`) ; `afterEach` : `cleanup()`.
- Helper : `const carteDe = (label: string) => screen.getByText(label).parentElement as HTMLElement;` puis `within(carteDe(...))`.

Cas (un `it` chacun, libellés en français) :
1. Chargement : les 3 mocks renvoient des promesses jamais résolues ; 3 textes « Chargement » présents ; aucune des cartes supprimées n'apparaît (`queryByText("Ordonnances émises")` absent).
2. Succès : 7 patients, consultations dont 3 aujourd'hui (date du jour réelle), 2 RDV à venir pour `m1` : chaque carte affiche sa valeur (`within(carteDe("Patients de la structure")).getByText("7")`, etc., via `findBy`/`waitFor`) ; aucun message d'erreur.
3. Erreur puis réessai : `getConsultations` rejette `new ApiError("Hors connexion", 0)` au premier appel puis résout ensuite : la carte « Consultations aujourd'hui » affiche « Indisponible », le texte « Certains chiffres n'ont pas pu être chargés. Vérifiez votre connexion puis réessayez. » est présent ; clic sur le bouton « Réessayer » : la valeur apparaît, le message disparaît, et les autres cartes ont gardé leur valeur.
4. Droit absent : `getMyPatients` rejette `new ApiError("Accès refusé", 403)` : la carte « Patients de la structure » n'est plus affichée, aucun message d'erreur, les 2 autres cartes affichent leur valeur.

## Contraintes

Faire uniquement ce qui est demandé : pas de refactors, helpers ou abstractions non demandés. Discipline de code dans l'ordre : réutiliser l'existant > ranger au bon endroit > n'abstraire qu'à la règle de trois. Règles d'audience, visuelles, typographiques et de langue : docs/ORCHESTRATOR.md. Ne pas modifier docs/plans/. Écrire les fichiers uniquement avec Write et Edit, jamais par redirection shell : le hook de garde ne voit pas les écritures faites par Bash.

Spécifique : ne modifier que `src/app/dashboard/page.tsx` et créer les 3 fichiers listés ; aucun fichier du back ; aucun texte visible contenant les termes interdits de l'audience non-dev (API, serveur, requête, erreur 500, etc.) ; aucun tiret cadratin ni demi-cadratin dans les lignes ajoutées ; pas de `any` ; commentaires et libellés de test en français ; pas de commit.

## Done when

Toutes les commandes lancées depuis `D:\souleymane\perso-archive-20260923\perso\medconnecte` :
1. `docker compose exec -T frontend npx tsc --noEmit` : sortie vide, code 0.
2. `docker compose exec -T frontend npx eslint src/app/dashboard/page.tsx src/app/dashboard/page.test.tsx src/lib/compteurs_tableau_de_bord.ts src/lib/compteurs_tableau_de_bord.test.ts` : 0 erreur, 0 avertissement.
3. `docker compose exec -T frontend npx vitest run` : tous les tests verts, dont les 9 cas de `src/lib/compteurs_tableau_de_bord.test.ts` et les 4 de `src/app/dashboard/page.test.tsx`.
4. `git -C front_medconnect status --porcelain -- src` : seulement ` M src/app/dashboard/page.tsx` et les 3 nouveaux fichiers ; `git -C back_medconnect status --porcelain` inchangé par rapport à avant la tâche.
5. `grep -cP 'value: "\x{2014}"' front_medconnect/src/app/dashboard/page.tsx` : `0` ; `grep -c "value:" front_medconnect/src/app/dashboard/page.tsx` : `0` ; `grep -nE "Ordonnances émises|Ordonnances traitées|Croissance|Consultations / mois" front_medconnect/src/app/dashboard/page.tsx` : aucun résultat ; `grep -n "TODO: Connect" front_medconnect/src/app/dashboard/page.tsx` : aucun résultat.

## Return

Chemin des 4 fichiers + preuve des 5 commandes du « Done when » (commande lancée, résultat en une ligne chacune). Ou un bloc BLOCKED. Pas de prose.

## Historique

<!-- une ligne par tentative : AAAA-MM-JJ | tier | résultat | raison si échec -->

## Validation

<!-- commande relancée par l'orchestrateur | résultat en une ligne | hash du commit -->
