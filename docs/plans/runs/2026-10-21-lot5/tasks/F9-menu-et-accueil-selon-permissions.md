# F9 - Menu latéral et accueil du tableau de bord selon les permissions et le type de structure, garde de page

Tier: spécifié (agent implementeur-specifie)
Audience: non-dev (menu latéral et accueil du tableau de bord de tous les profils ; message « page non disponible »)
Visuel: préventif (un seul nouveau bloc, le message de page non disponible, construit avec les classes déjà utilisées par les cartes de l'accueil ; menu et accueil gardent exactement leur rendu ; clair et sombre)
Background-safe: non, car docker compose exec (typage, lint et tests dans le conteneur frontend)

## Spec

Dépôt : `D:\souleymane\perso-archive-20260923\perso\medconnecte\front_medconnect`, branche `orch/lot5-front` (arbre principal, ne pas changer de branche, ne pas committer). Le back (`back_medconnect`, branche orch/lot5-back en cours) ne doit PAS être modifié. Décisions du run : `docs/plans/runs/2026-10-21-lot5/decisions.md` (D01 à D13), déjà tranchées, ne pas les rediscuter.

### Problème

Signalé par le porteur : un administrateur de pharmacie voit la même chose qu'un administrateur d'hôpital (menu latéral compris : « Mes Patients », « Équipe médicale »). Aujourd'hui `src/app/dashboard/layout.tsx` (`getNavSections(role)`, ligne 65) et `src/app/dashboard/page.tsx` (`getQuickActions`, `getStatsCards`) et `src/lib/compteurs_tableau_de_bord.ts` (`sourcesCompteurs(role, ...)`) ne regardent que le rôle, chacun avec sa propre liste.

Le nouveau back renverra dans GET /auth/me, à la racine de `data` : `structureType` (`"HOPITAL"`, `"CLINIQUE"`, `"PHARMACIE"` ou `null`) et `permissions` (codes effectifs, déjà filtrés par type de structure). L'ancien back renvoie déjà `permissions` mais pas `structureType`. Un refus de droit répond 403 avec `{ code: "PERMISSION_REFUSEE", message, ... }`.

### Ce qui est livré (tout dans cette tâche, les morceaux ne marchent qu'ensemble)

#### 1. `src/lib/api_auth.ts` (modifier)

- Dans `UserProfile`, après `permissions?: string[];`, ajouter :
  `/** Type de la structure de rattachement (absent sur un ancien serveur, null sans structure). */`
  `structureType?: StructureType | null;`
  avec `import type { StructureType } from "./api_admin";` en tête de fichier (import de type seulement : pas de cycle à l'exécution).
- `authFetch` : envelopper l'appel existant dans un `try { return await avecRafraichissement(...) } catch (err) { ... throw err; }`. Dans le `catch`, si `(options.method ?? "GET").toUpperCase() === "GET"` et `estPermissionRefusee(err)` (importé de `./acces`), appeler `signalerAccesRefuse()` (importé de `./acces`) avant de relancer l'erreur. Ne rien changer d'autre (ni `apiFetch`, ni `authDownload`, ni les messages).

#### 2. `src/lib/acces.ts` (nouveau, sans JSX, sans `any`)

Commentaire d'en-tête en français : contexte d'accès de l'utilisateur connecté (rôle, type de structure, permissions) et signal de refus d'accès envoyé par le serveur.

Contenu exact attendu :

- `export type RoleUtilisateur = "PATIENT" | "MEDECIN" | "PHARMACIEN" | "STRUCTURE_ADMIN" | "ACCUEIL" | "ADMIN" | "SUPER_ADMIN";`
- `export type CodePermission =` union des 21 codes, avec le commentaire « Miroir du catalogue du serveur (back_medconnect/src/common/rbac/permissions.constants.ts) » : `"carnet:read" | "consultation:write" | "ordonnance:write" | "analyse:write" | "vaccination:write" | "rendezvous:write" | "patient:read" | "sos:respond" | "stock:read" | "stock:write" | "catalogue:write" | "catalogue:manage" | "structure:read" | "structure:write" | "membre:read" | "membre:manage" | "role:manage" | "chat:structure" | "user:admin" | "platform:structures" | "platform:admin"`.
- `export interface ContexteAcces { mode: "permissions" | "repli"; role: string; typeStructure: StructureType | null; permissions: ReadonlySet<string>; }` (`StructureType` importé en type depuis `./api_admin`, réutilisé, pas redéclaré).
- `export function lireContexteAcces(user: Pick<AuthUser, "role">, profile: UserProfile | null): ContexteAcces` (types importés en `import type` depuis `./api_auth`) :
  - mode `"permissions"` si `profile !== null` ET `Array.isArray(profile.permissions)` ET `profile.structureType !== undefined`. Alors `typeStructure` = `profile.structureType` s'il vaut `"HOPITAL"`, `"CLINIQUE"` ou `"PHARMACIE"`, sinon `null` ; `permissions` = `new Set(profile.permissions)`.
  - sinon mode `"repli"` : `typeStructure` = `"PHARMACIE"` si `user.role === "PHARMACIEN"`, sinon `null` ; `permissions` = ensemble vide.
  - `role` = `user.role` dans les deux cas.
- `export const EVENEMENT_ACCES_REFUSE = "mc:acces-refuse";`
- `export function estPermissionRefusee(err: unknown): boolean` : vrai si `err instanceof ApiError` (import de valeur depuis `./api_auth`), `err.status === 403` et `err.details?.code === "PERMISSION_REFUSEE"`.
- `export function signalerAccesRefuse(): void` : si `typeof window !== "undefined"`, `window.dispatchEvent(new Event(EVENEMENT_ACCES_REFUSE))`.

L'import de valeur `ApiError` depuis `./api_auth` et l'import de `./acces` dans `api_auth.ts` forment un cycle de modules : il est sans risque car aucun des deux n'utilise l'autre au chargement (uniquement dans des fonctions). Le garder ainsi.

#### 3. `src/lib/navigation_tableau_de_bord.ts` (nouveau, sans JSX, sans `any`) : la source de vérité unique

Commentaire d'en-tête en français : « Source unique du menu latéral (ordinateur et téléphone), des raccourcis et des compteurs de l'accueil du tableau de bord, et de la garde des pages. Une entrée sans le droit requis n'apparaît nulle part. »

Types :

```ts
import type { ComponentType } from "react";
type IconeComposant = ComponentType<{ className?: string }>;
type TexteSelonType = { defaut: string } & Partial<Record<StructureType, string>>;
type IdSection = "general" | "carnet" | "services" | "activite" | "etablissement" | "administration";

export type RegleAcces =
  | { genre: "tous" }
  | { genre: "patient" }
  | { genre: "permissions"; auMoinsUne: readonly CodePermission[]; sauf?: readonly CodePermission[]; typesStructure?: readonly StructureType[] };

interface EntreeTableauDeBord {
  id: string;
  section: IdSection;
  href: string;
  icone: IconeComposant;
  libelle: TexteSelonType;
  acces: RegleAcces;
  /** Ancien serveur (sans structureType) : rôles qui voient l'entrée, comme avant F9. */
  rolesRepli: readonly RoleUtilisateur[];
  raccourci?: { libelle?: TexteSelonType; description: TexteSelonType; degrade: string; rolesRepli: readonly RoleUtilisateur[] };
}

interface DefinitionCarte { cle: CleCompteur; libelle: string; icone: IconeComposant; couleur: string; acces: RegleAcces; rolesRepli: readonly RoleUtilisateur[] }
```

Types exportés vers l'interface (ce que consomment layout et page) :

```ts
export interface LienMenu { id: string; libelle: string; href: string; icone: IconeComposant }
export interface SectionMenu { id: IdSection; titre: string; liens: LienMenu[] }
export interface Raccourci { id: string; libelle: string; description: string; href: string; icone: IconeComposant; degrade: string }
export interface CarteCompteur { cle: CleCompteur; libelle: string; icone: IconeComposant; couleur: string }
```

Règles d'évaluation (fonction interne `estVisible(acces, rolesRepli, ctx)`) :
- mode `"repli"` : `rolesRepli.includes(ctx.role)` (la règle `acces` est ignorée).
- mode `"permissions"` : `"tous"` donne vrai ; `"patient"` donne `ctx.role === "PATIENT"` ; `"permissions"` donne vrai si au moins un code de `auMoinsUne` est dans `ctx.permissions`, ET aucun code de `sauf` n'y est, ET (`typesStructure` absent OU (`ctx.typeStructure !== null` et `typesStructure` le contient)).
- Texte selon le type (fonction interne) : `t[ctx.typeStructure]` s'il existe, sinon `t.defaut`.

Sections, dans cet ordre, titre selon le type :

| id | titre |
|---|---|
| general | Général |
| carnet | Mon Carnet |
| services | Services |
| activite | Activité (PHARMACIE : Pharmacie) |
| etablissement | Établissement |
| administration | Administration |

Entrées, dans cet ordre exact (l'ordre du registre fait l'ordre du menu et des raccourcis). Icônes de `lucide-react`. Abréviations : HC = `["HOPITAL", "CLINIQUE"]`, HCP = `["HOPITAL", "CLINIQUE", "PHARMACIE"]`, P = `["PHARMACIE"]`. « perm » = `{ genre: "permissions", auMoinsUne: [...], sauf?, typesStructure? }`.

| id | section | href | icône | libellé | accès (mode permissions) | rolesRepli |
|---|---|---|---|---|---|---|
| tableau-de-bord | general | /dashboard | LayoutDashboard | Tableau de bord | tous | les 7 rôles |
| carnet | carnet | /dashboard/carnet | FileText | Carnet de Santé | patient | PATIENT |
| consultations-patient | carnet | /dashboard/consultations | Stethoscope | Consultations | patient | PATIENT |
| ordonnances-patient | carnet | /dashboard/ordonnances | Pill | Ordonnances | patient | PATIENT |
| analyses-patient | carnet | /dashboard/analyses | Activity | Analyses | patient | PATIENT |
| vaccinations-patient | carnet | /dashboard/vaccinations | Syringe | Vaccinations | patient | PATIENT |
| messagerie-patient | services | /dashboard/chat | MessageSquare | Messagerie | patient | PATIENT |
| diagnostic | services | /dashboard/diagnostic | Bot | Auto-Diagnostic IA | patient | PATIENT |
| carte | services | /dashboard/map | MapPin | Trouver un Médecin | patient | PATIENT |
| medicaments | services | /dashboard/medicaments | Pill | Recherche Médicaments | patient | PATIENT |
| pharmacies | services | /dashboard/pharmacies | Building2 | Pharmacies | patient | PATIENT |
| mes-structures | services | /dashboard/mes-structures | Building2 | Mes Structures | patient | PATIENT |
| rendez-vous-patient | services | /dashboard/rendez-vous | Calendar | Rendez-vous | patient | PATIENT |
| messagerie-pro | activite | /dashboard/chat | MessageSquare | Messagerie | perm [chat:structure, carnet:read], HCP | MEDECIN, ACCUEIL |
| accueil-patient | activite | /dashboard/accueil | Headset | Accueil patient | perm [patient:read], sauf [carnet:read], HC | ACCUEIL |
| patients | activite | /dashboard/patients | Users | Patients | perm [patient:read, carnet:read], HC | MEDECIN, STRUCTURE_ADMIN, ACCUEIL |
| consultations-soins | activite | /dashboard/consultations | Stethoscope | Consultations | perm [consultation:write, carnet:read], HC | MEDECIN |
| ordonnances-soins | activite | /dashboard/ordonnances | Pill | Ordonnances | perm [ordonnance:write, carnet:read], HC | MEDECIN |
| ordonnances-recues | activite | /dashboard/ordonnances | ClipboardList | Ordonnances reçues | perm [stock:read, stock:write], P | PHARMACIEN |
| analyses-soins | activite | /dashboard/analyses | Activity | Analyses | perm [analyse:write, carnet:read], HC | MEDECIN |
| stock | activite | /dashboard/stock | Package | Stock Médicaments | perm [stock:read, stock:write], P | PHARMACIEN |
| catalogue | activite | /dashboard/catalogue | Pill | Catalogue Médicaments | perm [catalogue:write, catalogue:manage, stock:read, stock:write, ordonnance:write], HCP | MEDECIN, PHARMACIEN |
| rendez-vous-pro | activite | /dashboard/rendez-vous | Calendar | Rendez-vous | perm [rendezvous:write, patient:read], HC | MEDECIN, ACCUEIL |
| structure | etablissement | /dashboard/structure | Building2 | Ma structure (PHARMACIE : Ma pharmacie) | perm [structure:read, structure:write], HCP | MEDECIN, PHARMACIEN, STRUCTURE_ADMIN |
| equipe | etablissement | /dashboard/membres | Users | Équipe médicale (PHARMACIE : Équipe de la pharmacie) | perm [membre:read, membre:manage], HCP | STRUCTURE_ADMIN |
| utilisateurs | administration | /dashboard/utilisateurs | Users | Utilisateurs | perm [user:admin] | ADMIN, SUPER_ADMIN |
| structures | administration | /dashboard/structures | Building2 | Structures | perm [platform:structures] | ADMIN, SUPER_ADMIN |
| catalogue-plateforme | administration | /dashboard/catalogue | Pill | Catalogue Médicaments | perm [catalogue:write, catalogue:manage] | ADMIN, SUPER_ADMIN |

Les pages `/dashboard/stats`, `/dashboard/config` et `/dashboard/securite` n'existent pas : aucune entrée (D07). Supprimer `ROUTES_NON_DISPONIBLES` du layout ; à la place, une ligne de commentaire au-dessus du registre : « Page pas encore créée = pas d'entrée ici (statistiques, configuration, sécurité). »

Raccourcis (champ `raccourci` des entrées ; libellé du raccourci = libellé de l'entrée sauf indication) :

| entrée | libellé du raccourci | description | dégradé | rolesRepli |
|---|---|---|---|---|
| carnet | Mon Carnet de Santé | Consultez votre profil médical, allergies, traitements | from-primary-500 to-cyan-500 | PATIENT |
| consultations-patient | Mes Consultations | Historique de vos visites médicales | from-amber-500 to-orange-500 | PATIENT |
| ordonnances-patient | (idem) | Vos ordonnances et prescriptions médicales | from-rose-500 to-pink-500 | PATIENT |
| diagnostic | (idem) | Décrivez vos symptômes et obtenez une orientation | from-accent-500 to-primary-500 | PATIENT |
| carte | (idem) | Localisez les structures de santé proches de vous | from-secondary-500 to-cyan-500 | PATIENT |
| pharmacies | (idem) | Trouvez les pharmacies et médicaments disponibles | from-emerald-500 to-teal-500 | PATIENT |
| messagerie-pro | (idem) | Messages adressés à la structure | from-primary-500 to-cyan-500 | ACCUEIL |
| accueil-patient | (idem) | Enregistrer le partage d'un dossier (code / QR / SMS) | from-violet-500 to-purple-500 | ACCUEIL |
| patients | (idem) | Liste des patients suivis par la structure | from-primary-500 to-cyan-500 | MEDECIN, ACCUEIL |
| consultations-soins | (idem) | Gérez vos consultations du jour | from-secondary-500 to-cyan-500 | MEDECIN |
| ordonnances-soins | (idem) | Créez et consultez les ordonnances | from-accent-500 to-primary-500 | MEDECIN |
| ordonnances-recues | (idem) | Consultez les ordonnances en attente | from-primary-500 to-cyan-500 | PHARMACIEN |
| stock | Mon Stock | Gérez votre inventaire de médicaments | from-accent-500 to-primary-500 | PHARMACIEN |
| rendez-vous-pro | (idem) | Prenez et suivez les rendez-vous de la structure | from-amber-500 to-orange-500 | MEDECIN, ACCUEIL |
| structure | (idem, selon le type) | défaut : Paramètres et informations de votre structure ; PHARMACIE : Gérez les informations de votre pharmacie | from-primary-500 to-cyan-500 | PHARMACIEN, STRUCTURE_ADMIN |
| equipe | (idem, selon le type) | défaut : Gérez l'équipe de votre structure ; PHARMACIE : Gérez l'équipe de votre pharmacie | from-secondary-500 to-cyan-500 | STRUCTURE_ADMIN |
| utilisateurs | (idem) | Gérez tous les utilisateurs de la plateforme | from-primary-500 to-cyan-500 | ADMIN, SUPER_ADMIN |
| structures | (idem) | Gérez les hôpitaux, cliniques et pharmacies | from-secondary-500 to-cyan-500 | ADMIN, SUPER_ADMIN |

Cartes de compteurs, dans cet ordre (libellé, icône, couleur repris tels quels de `getStatsCards`) :

| clé | libellé | icône | couleur | accès (mode permissions) | rolesRepli |
|---|---|---|---|---|---|
| patientConsultations | Consultations | Stethoscope | text-primary-400 | patient | PATIENT |
| patientOrdonnances | Ordonnances | ClipboardList | text-secondary-400 | patient | PATIENT |
| patientVaccinations | Vaccinations | Activity | text-accent-400 | patient | PATIENT |
| patientDiagnosticsIA | Diagnostics IA | Bot | text-cyan-400 | patient | PATIENT |
| medecinPatients | Patients de la structure | Users | text-primary-400 | perm [carnet:read], HC | MEDECIN |
| medecinConsultationsAujourdhui | Consultations aujourd'hui | Stethoscope | text-secondary-400 | perm [consultation:write, carnet:read], HC | MEDECIN |
| medecinRendezVousAVenir | Rendez-vous à venir | Calendar | text-amber-400 | perm [carnet:read], HC | MEDECIN |
| pharmacieMedicamentsEnStock | Médicaments en stock | Package | text-primary-400 | perm [stock:read, stock:write], P | PHARMACIEN |
| pharmacieRuptures | Ruptures de stock | Pill | text-emergency-500 | perm [stock:read, stock:write], P | PHARMACIEN |
| adminUtilisateurs | Utilisateurs | Users | text-primary-400 | perm [user:admin] | ADMIN, SUPER_ADMIN |
| adminStructures | Structures en service | Building2 | text-secondary-400 | perm [platform:structures, user:admin] | ADMIN, SUPER_ADMIN |
| structureMedecins | Médecins | Stethoscope | text-primary-400 | perm [membre:manage], HC | STRUCTURE_ADMIN |
| structurePharmaciens | Pharmaciens | Pill | text-secondary-400 | perm [membre:manage], P | STRUCTURE_ADMIN |
| structurePatients | Patients de la structure | Users | text-accent-400 | perm [patient:read], sauf [carnet:read], HC | STRUCTURE_ADMIN |
| accueilRdvEnAttente | RDV en attente | Clock | text-amber-400 | perm [rendezvous:write], sauf [carnet:read], HC | ACCUEIL |
| accueilRdvAujourdhui | RDV aujourd'hui | Calendar | text-primary-400 | perm [rendezvous:write], sauf [carnet:read], HC | ACCUEIL |
| accueilRdvAVenir | RDV à venir | Activity | text-secondary-400 | perm [rendezvous:write], sauf [carnet:read], HC | ACCUEIL |

Fonctions exportées (pures, testables sans React) :

- `export function sectionsMenu(ctx: ContexteAcces): SectionMenu[]` : entrées visibles, dans l'ordre du registre, une seule par `href` (la première visible l'emporte, D08), regroupées par section dans l'ordre des sections, sections vides omises. Cas unique : si `ctx.role === "SUPER_ADMIN"`, le lien `tableau-de-bord` pointe vers `/dashboard/super-admin` (comportement actuel, dans les deux modes).
- `export function raccourcis(ctx: ContexteAcces): Raccourci[]` : entrées ayant un `raccourci`, visibles selon `estVisible(entree.acces, entree.raccourci.rolesRepli, ctx)` (en mode permissions, la règle de l'entrée ; en repli, les `rolesRepli` du raccourci), ordre du registre, une seule par `href`.
- `export function cartesCompteurs(ctx: ContexteAcces): CarteCompteur[]` : cartes visibles, ordre du registre.
- `export function estRouteAutorisee(chemin: string, ctx: ContexteAcces): boolean` : retirer une éventuelle barre finale de `chemin` ; vrai si `chemin === "/dashboard"` ; sinon prendre toutes les entrées dont `href === chemin` (correspondance exacte, D09) ; aucune entrée donne vrai (page non répertoriée : profil, appareils, carnet/[patientId], super-admin) ; sinon vrai si au moins une est visible. Cette fonction ne regarde pas le mode : c'est le layout qui ne l'applique qu'en mode permissions.

Ensembles attendus en repli (contrôlés par les tests, identiques à l'avant F9 moins les pages inexistantes) :
- liens du menu : PATIENT : /dashboard, carnet, consultations, ordonnances, analyses, vaccinations, chat, diagnostic, map, medicaments, pharmacies, mes-structures, rendez-vous (13) ; MEDECIN : /dashboard, chat, patients, consultations, ordonnances, analyses, catalogue, rendez-vous, structure (9) ; PHARMACIEN : /dashboard, ordonnances, stock, catalogue, structure (5, libellé « Ma pharmacie ») ; STRUCTURE_ADMIN : /dashboard, patients, structure, membres (4) ; ACCUEIL : /dashboard, chat, accueil, patients, rendez-vous (5) ; ADMIN : /dashboard, utilisateurs, structures, catalogue (4) ; SUPER_ADMIN : /dashboard/super-admin, utilisateurs, structures, catalogue (4).
- raccourcis : PATIENT : carnet, consultations, ordonnances, diagnostic, map, pharmacies ; MEDECIN : patients, consultations, ordonnances, rendez-vous ; PHARMACIEN : ordonnances, stock, structure ; STRUCTURE_ADMIN : structure, membres ; ACCUEIL : chat, accueil, patients, rendez-vous ; ADMIN et SUPER_ADMIN : utilisateurs, structures.

#### 4. `src/lib/compteurs_tableau_de_bord.ts` (modifier, D12)

- Nouvelle signature : `export function sourcesCompteurs(cles: readonly CleCompteur[], utilisateur: { id: string; structureId?: string }, maintenant: Date = new Date()): SourceCompteurs[]`.
- Remplacer le `switch (role)` par une liste à plat des 11 sources existantes, dans cet ordre, chacune avec exactement le même `charger` qu'aujourd'hui : (1) carnet résumé [patientConsultations, patientOrdonnances, patientVaccinations] ; (2) auto-diagnostics [patientDiagnosticsIA] ; (3) mes patients [medecinPatients] ; (4) consultations [medecinConsultationsAujourdhui] ; (5) rendez-vous du médecin [medecinRendezVousAVenir] ; (6) stock [pharmacieMedicamentsEnStock, pharmacieRuptures] (même `throw` sans structure) ; (7) statistiques utilisateurs [adminUtilisateurs] ; (8) toutes les structures [adminStructures] ; (9) ma structure [structureMedecins, structurePharmaciens] ; (10) patients de la structure [structurePatients] ; (11) rendez-vous de l'accueil [accueilRdvEnAttente, accueilRdvAujourdhui, accueilRdvAVenir].
- Renvoyer les sources dont au moins une clé est dans `cles`, dans cet ordre. Aucun appel réseau à la construction (les appels restent dans `charger`). Mettre à jour le commentaire d'en-tête (« les cartes visibles décident des sources chargées »).

#### 5. `src/components/PageNonDisponible.tsx` (nouveau)

Composant présentationnel, export par défaut `PageNonDisponible`, sans props, sans logique métier :

```tsx
<section aria-labelledby="titre-page-non-disponible" className="max-w-xl mx-auto mt-8 bg-white dark:bg-[#0f172a]/80 border border-slate-200 dark:border-slate-800/50 rounded-2xl p-6 sm:p-8 text-center">
  <div className="mx-auto mb-4 w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center text-slate-500 dark:text-slate-400">
    <Lock className="w-6 h-6" aria-hidden="true" />
  </div>
  <h1 id="titre-page-non-disponible" className="text-lg font-semibold text-slate-900 dark:text-white mb-2" style={{ fontFamily: "var(--font-outfit, var(--font-inter))" }}>
    Cette page n&apos;est pas disponible pour votre compte.
  </h1>
  <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
    Si vous pensez en avoir besoin, adressez-vous à l&apos;administrateur de votre établissement.
  </p>
  <Link href="/dashboard" className="inline-flex px-4 py-2 rounded-xl text-sm font-medium bg-primary-500/10 text-primary-700 dark:text-primary-400 hover:bg-primary-500/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
    Retour à l&apos;accueil
  </Link>
</section>
```

(`Lock` de `lucide-react`, `Link` de `next/link`. Délimitation par bordure seule, sans ombre. Les classes sont celles déjà employées par les cartes et le bouton « Réessayer » de l'accueil.)

#### 6. `src/app/dashboard/layout.tsx` (modifier)

- Supprimer `NavItem`, `NavSection`, `ROUTES_NON_DISPONIBLES`, `getNavSections` et les imports d'icônes devenus inutiles. Garder `getRoleLabel`, `getRoleColor` et tout le rendu tels quels (D13).
- `Sidebar` : lire `profile` en plus de `user` dans `useAuth()` ; `const sections = sectionsMenu(lireContexteAcces(user, profile));`. Rendu : `section.id` comme clé, `section.titre` à la place de `section.title`, `section.liens` à la place de `section.items`, `lien.libelle`, et l'icône rendue par `<lien.icone className="w-5 h-5" />` à la même place que `{item.icon}`. Classes, `isActive` (règle exacte pour `/dashboard` et `/dashboard/super-admin`), `onClick`, `title` inchangés. C'est le même composant pour ordinateur et téléphone : rien d'autre à faire pour le menu mobile.
- `DashboardLayout` :
  - lire `profile` dans `useAuth()`, ajouter `const pathname = usePathname();` (avant les `return` anticipés) ;
  - état `const [refusSur, setRefusSur] = useState<string | null>(null);` ;
  - `useEffect` qui écoute `EVENEMENT_ACCES_REFUSE` sur `window` et fait `setRefusSur(window.location.pathname)`, avec retrait de l'écouteur au démontage ;
  - `useEffect(() => { setRefusSur(null); }, [pathname]);` (remise à zéro à chaque changement d'adresse ; la règle set-state-in-effect est déjà désactivée en tête du fichier) ;
  - après les `return` de chargement : `const contexte = lireContexteAcces(user, profile);` puis `const pageNonDisponible = (contexte.mode === "permissions" && !estRouteAutorisee(pathname, contexte)) || (refusSur === pathname && pathname !== "/dashboard");` ;
  - dans `<main>` : `{pageNonDisponible ? <PageNonDisponible /> : children}`. Tout le reste du layout (providers, barre du haut mobile, bouton d'urgence, écouteur d'urgence) inchangé.

#### 7. `src/app/dashboard/page.tsx` (modifier)

- Supprimer `QuickAction`, `StatCard`, `getQuickActions`, `getStatsCards` et les imports d'icônes devenus inutiles. Garder `getWelcomeMessage`, `EtatCompteur`, `SHOW_CHARTS`, la redirection du super-admin et tout le rendu (D13).
- `StatsGrid` reçoit `cards: CarteCompteur[]` : clé `card.cle`, `card.libelle`, `card.couleur`, icône `<card.icone className="w-5 h-5" />` à la place de `{card.icon}`. Rendu identique sinon.
- `QuickActionsGrid` reçoit `actions: Raccourci[]` : `action.libelle`, `action.description`, `action.degrade`, icône `<action.icone className="w-6 h-6" />`. Rendu identique sinon.
- Dans `DashboardPage` : `const contexte = user ? lireContexteAcces(user, profile) : null;` puis `const cartes = contexte ? cartesCompteurs(contexte) : [];` et `const clesCompteurs = cartes.map((c) => c.cle).join(",");` calculés AVANT les `return` anticipés.
- L'effet de chargement des compteurs dépend de `[utilisateurId, structureId, clesCompteurs, essaiCompteurs]` (plus de `role`) ; il sort si `!utilisateurId || !clesCompteurs` ; il appelle `sourcesCompteurs(clesCompteurs.split(",") as CleCompteur[], { id: utilisateurId, structureId })`. Le reste de l'effet (masquage sur 403, erreurs, `actif`) inchangé.
- Après les `return` anticipés : `const quickActions = raccourcis(contexte)` (contexte non nul à ce stade, utiliser une garde de type plutôt que `!`) ; `const statsCards = cartes.filter((c) => etatsCompteurs[c.cle]?.statut !== "masque");`.
- Si `quickActions` est vide, ne pas afficher la section « Accès rapide » (même règle que la section « Aperçu » quand il n'y a aucune carte).

### Tests Vitest (tous nouveaux ou mis à jour dans cette tâche)

1. `src/lib/navigation_tableau_de_bord.test.ts` (nouveau). Fabrique locale de contexte via `lireContexteAcces` (profil minimal typé `UserProfile`, champs requis remplis par des valeurs factices). Fonctions d'aide : `hrefs(sections)` à plat et `libelles(sections)` à plat. Cas :
   - administrateur de pharmacie (rôle STRUCTURE_ADMIN, `structureType: "PHARMACIE"`, permissions `["structure:read", "structure:write", "membre:read", "membre:manage", "role:manage"]`) : libellés du menu contiennent « Ma pharmacie » et « Équipe de la pharmacie » ; ne contiennent ni « Patients », ni « Équipe médicale », ni « Ma structure », ni « Rendez-vous », ni « Accueil patient » ; aucun lien `/dashboard/patients` ; cartes = `["structurePharmaciens"]` ; raccourcis : hrefs `["/dashboard/structure", "/dashboard/membres"]` et libellés « Ma pharmacie », « Équipe de la pharmacie » ; `estRouteAutorisee` : `/dashboard/patients` faux, `/dashboard/membres` vrai, `/dashboard/membres/` vrai, `/dashboard` vrai, `/dashboard/profil` vrai.
   - administrateur d'hôpital (STRUCTURE_ADMIN, `"HOPITAL"`, mêmes permissions + `"patient:read"`) : libellés contiennent « Ma structure », « Équipe médicale », « Patients », « Rendez-vous », « Accueil patient » ; ne contiennent ni « Stock Médicaments », ni « Catalogue Médicaments », ni « Ma pharmacie », ni « Ordonnances reçues » ; cartes = `["structureMedecins", "structurePatients"]` ; `estRouteAutorisee("/dashboard/stock")` faux.
   - rôle personnalisé (PHARMACIEN, `"PHARMACIE"`, `["stock:read"]`) : hrefs du menu = `["/dashboard", "/dashboard/ordonnances", "/dashboard/stock", "/dashboard/catalogue"]`, `estRouteAutorisee("/dashboard/structure")` faux ; puis le même avec la permission ajoutée `"structure:write"` : « Ma pharmacie » apparaît et `estRouteAutorisee("/dashboard/structure")` vrai.
   - super-administrateur en mode permissions (les 21 codes, `structureType: null`) : hrefs = `["/dashboard/super-admin", "/dashboard/utilisateurs", "/dashboard/structures", "/dashboard/catalogue"]`.
   - repli : `lireContexteAcces` renvoie `mode: "repli"` pour un profil `null` et pour un profil avec `permissions` sans `structureType` ; `mode: "permissions"` pour un profil avec `structureType: null`. Puis `it.each` sur les 7 rôles en repli : ensemble des hrefs du menu et des raccourcis égal aux listes « Ensembles attendus en repli » ci-dessus (comparer triés) ; PHARMACIEN en repli a le libellé « Ma pharmacie ».
   - aucun lien vers `/dashboard/stats`, `/dashboard/config`, `/dashboard/securite` pour aucun des 7 rôles en repli ni pour le super-administrateur en mode permissions.
2. `src/lib/acces.test.ts` (nouveau) : `estPermissionRefusee` (vrai pour `new ApiError("x", 403, { code: "PERMISSION_REFUSEE" })`, faux pour 403 sans code, faux pour 403 avec `code: "SOS_ROLE_INTERDIT"`, faux pour une `Error`) ; `authFetch` avec `fetch` simulé (même schéma que `src/lib/api_auth.indisponible.test.ts` : `vi.stubGlobal("fetch", ...)`, jeton en `localStorage`, `console.warn` muet) répondant 403 `{ code: "PERMISSION_REFUSEE", message: "Accès refusé" }` : en GET, l'événement `EVENEMENT_ACCES_REFUSE` est reçu une fois et l'erreur est relancée ; en POST, aucun événement ; en GET avec un 403 sans code, aucun événement.
3. `src/app/dashboard/layout.test.tsx` (nouveau). Mocks : `@/hooks/useAuth` (`useAuth` renvoie `{ user, profile, loading: false, logout: vi.fn() }` à partir de variables modifiables par test), `next/navigation` (`usePathname` renvoie une variable modifiable), `next/image` (composant qui rend `null`), `@/components/ThemeSwitcher` (`ThemeSwitcher: () => null`), `@/components/PWAInstallButton` (`PWAInstallButton: () => null`), `@/components/EmergencyButton`, `@/components/EmergencyListener`, `@/components/NotificationBell` (`default: () => null`), `@/components/Toast` (`default` qui rend ses enfants), `@/hooks/useNotifications` (`NotificationsProvider` qui rend ses enfants). Le layout est rendu avec l'enfant `<p>Contenu de la page</p>`. Cas :
   - administrateur de pharmacie (mode permissions) sur `/dashboard/patients` : « Cette page n'est pas disponible pour votre compte. » affiché, lien « Retour à l'accueil » vers `/dashboard`, « Contenu de la page » absent ; le menu montre « Ma pharmacie » et pas « Équipe médicale ».
   - administrateur d'hôpital sur `/dashboard/patients` : « Contenu de la page » affiché ; le menu montre « Ma structure », « Équipe médicale », « Patients ».
   - même administrateur de pharmacie avec `profile: null` (repli) sur `/dashboard/patients` : « Contenu de la page » affiché (pas de garde en repli).
   - pharmacien (mode permissions, permissions par défaut `["stock:read", "stock:write", "catalogue:write", "chat:structure", "structure:read", "membre:read"]`) sur `/dashboard/stock` (`window.history.pushState({}, "", "/dashboard/stock")` et `usePathname` à `/dashboard/stock`) : contenu affiché, puis `act(() => { window.dispatchEvent(new Event(EVENEMENT_ACCES_REFUSE)); })` : le message remplace le contenu.
   - même événement sur `/dashboard` (pushState et `usePathname` à `/dashboard`) : le contenu reste affiché.
4. `src/app/dashboard/page.test.tsx` (mettre à jour) : les 5 cas existants restent tels quels et verts (le mock actuel a `profile: null`, donc mode repli MEDECIN, mêmes 3 cartes). Rendre le profil du mock modifiable (variable `let profil: UserProfile | null = null;` lue par le mock, remise à `null` dans `beforeEach`) et ajouter, avec `vi.mock("@/lib/api_structure", () => ({ getMyStructure: vi.fn(), getAllStructures: vi.fn() }))` :
   - administrateur de pharmacie (user STRUCTURE_ADMIN, profil mode permissions PHARMACIE comme au test 1), `getMyStructure` résolu avec `{ membres: [{ role: "PHARMACIEN" }, { role: "PHARMACIEN" }] }` : carte « Pharmaciens » à 2 ; aucune carte « Patients de la structure » ni « Médecins » ; « Accès rapide » contient « Ma pharmacie » et « Équipe de la pharmacie » ; `getMyPatients` jamais appelé.
   Le mock `useAuth` devient un mock dont le `user` peut aussi être changé par test (variable `let utilisateur = ...` remise au médecin dans `beforeEach`).
5. `src/lib/compteurs_tableau_de_bord.test.ts` (mettre à jour) : `charger` prend une liste de clés au lieu d'un rôle. Ajouter dans le fichier une constante `CLES_PAR_ROLE` (PATIENT : 4 clés patient ; MEDECIN : 3 clés médecin ; PHARMACIEN : 2 clés pharmacie ; ADMIN : 2 clés admin ; STRUCTURE_ADMIN : 3 clés structure ; ACCUEIL : 3 clés accueil) et l'utiliser dans les cas existants, assertions de valeurs inchangées. Le cas « ne renvoie aucune source pour le rôle %s » devient « ne renvoie aucune source sans clé demandée » (`sourcesCompteurs([], ...)` vaut `[]`, aucun appel). Le cas « clés annoncées » boucle sur toutes les sources de `sourcesCompteurs(<les 17 clés>, ...)`. Ajouter : `sourcesCompteurs(["structurePharmaciens"], ...)` renvoie une seule source dont les clés sont `["structureMedecins", "structurePharmaciens"]`.

### Hors périmètre (ne pas toucher)

Message d'accueil, libellé et couleur du profil dans le menu, redirection du super-admin, graphiques (`SHOW_CHARTS`), `EmergencyListener`, page catalogue, toutes les pages sous `src/app/dashboard/*/` (la garde est faite dans le layout), le texte préexistant de la ligne « structure » de l'accueil, `src/proxy.ts`, `useAuth.tsx`.

## Contraintes

Faire uniquement ce qui est demandé : pas de refactors, helpers ou abstractions non demandés. Discipline de code dans l'ordre : réutiliser l'existant > ranger au bon endroit > n'abstraire qu'à la règle de trois. Règles d'audience, visuelles, typographiques et de langue : docs/ORCHESTRATOR.md. Ne pas modifier docs/plans/. Écrire les fichiers uniquement avec Write et Edit, jamais par redirection shell : le hook de garde ne voit pas les écritures faites par Bash.

Spécifique : aucun `any` (ni `as any`) dans les fichiers créés ou modifiés par la tâche, hors lignes préexistantes ; aucun code brut (rôle, permission, type de structure) affiché à l'écran ; textes visibles en français, sans tiret cadratin ni demi-cadratin ; commentaires en français. Next.js 16 : `usePathname` et `Link` s'utilisent comme dans le layout actuel, rien de nouveau côté Next.

## Done when

Toutes les commandes lancées depuis `D:\souleymane\perso-archive-20260923\perso\medconnecte` :

1. `docker compose exec -T frontend npx tsc --noEmit` : aucune sortie, code 0.
2. `docker compose exec -T frontend npx eslint src/lib/api_auth.ts src/lib/acces.ts src/lib/acces.test.ts src/lib/navigation_tableau_de_bord.ts src/lib/navigation_tableau_de_bord.test.ts src/lib/compteurs_tableau_de_bord.ts src/lib/compteurs_tableau_de_bord.test.ts src/components/PageNonDisponible.tsx src/app/dashboard/layout.tsx src/app/dashboard/layout.test.tsx src/app/dashboard/page.tsx src/app/dashboard/page.test.tsx` : 0 erreur, 0 avertissement (code 0).
3. `docker compose exec -T frontend npx vitest run` : tous les tests passent (aucun test existant cassé), dont les 3 nouveaux fichiers et les 2 fichiers mis à jour ; au moins 25 cas pour ces 5 fichiers réunis au-delà des cas existants.
4. `grep -rn "getNavSections\|getQuickActions\|getStatsCards\|ROUTES_NON_DISPONIBLES" front_medconnect/src` ne renvoie rien ; `grep -rn "sourcesCompteurs(" front_medconnect/src --include=*.tsx | grep -v test` ne renvoie que `src/app/dashboard/page.tsx`.
5. `grep -nE "\bany\b" front_medconnect/src/lib/acces.ts front_medconnect/src/lib/navigation_tableau_de_bord.ts front_medconnect/src/components/PageNonDisponible.tsx` ne renvoie rien.
6. Aucun tiret cadratin ni demi-cadratin ajouté : aucun blocage du hook de garde (route-guard ou orchestrator-guard) sur les écritures de la tâche ; le validateur le revérifie au pre-commit.

## Return

Liste des fichiers touchés + preuve (les commandes 1 à 5 du Done when lancées, résultat en une ligne chacune, nombre de tests passés). Ou un bloc BLOCKED. Pas de prose.

## Historique

<!-- une ligne par tentative : AAAA-MM-JJ | tier | résultat | raison si échec -->

## Validation

<!-- commande relancée par l'orchestrateur | résultat en une ligne | hash du commit -->
