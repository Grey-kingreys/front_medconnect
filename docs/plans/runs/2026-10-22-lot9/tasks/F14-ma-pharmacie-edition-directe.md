# F14 - « Ma pharmacie » modifiable sur place, par blocs

Tier: spécifié (agent implementeur-specifie)
Audience: non-dev (administrateur de pharmacie, pharmacien)
Visuel: préventif
Background-safe: non, car essai réel contre le back local (`curl` sur http://localhost:3101) et conteneur `frontend`

## Spec

Page concernée : `src/app/dashboard/structure/page.tsx` (route `/dashboard/structure`, libellée « Ma pharmacie » pour une pharmacie). Décisions du run : `docs/plans/runs/2026-10-22-lot9/decisions.md` (D01 à D14), à lire en entier avant de coder. Le back **n'est pas modifié**. Avant d'écrire du code Next, lire dans `node_modules/next/dist/docs/` ce qui concerne `"use client"` et `next/link`.

### Constat de départ (pour le rapport)

Sur la base de démo (Pharmacie de Kaloum), l'administrateur ne peut modifier qu'au travers d'un petit bouton « Modifier » qui ouvre `StructureModal` (« Modifier la structure ») ; le bouton « Sauvegarder » est hors de l'écran sans défilement ; « De garde » et l'ouverture manuelle sont au fond du formulaire ; la page affiche « Médecins 0 » et un graphique médecins/pharmaciens absurde pour une pharmacie ; le bouton est conditionné au rôle `STRUCTURE_ADMIN` au lieu des permissions.

### Contrat du back (vérifié dans back_medconnect origin/dev, ne pas le redemander)

- `GET /structures/my` (permission `structure:read`) renvoie `{ data, message, success }` ; `data` contient `id, nom, type ("HOPITAL" | "CLINIQUE" | "PHARMACIE"), email, telephone, adresse, ville, description, latitude, longitude, horaires, estDeGarde, estOuvertManuel, isActive, isConfigured, logoUrl, admin { id, nom, prenom, email, telephone }, membres [{ id, nom, prenom, email, role, isActive }]` (membres de rôle MEDECIN, PHARMACIEN ou ACCUEIL seulement). **Les champs absents valent `null`** (pas `undefined`) : toujours lire avec `?? ""` ou un test `!= null`.
- `PATCH /structures/my` (permission `structure:write`, et côté service l'utilisateur doit être `STRUCTURE_ADMIN` de cette structure) : corps `UpdateStructureDto`, tous les champs facultatifs : `nom` (chaîne 2 à 150), `adresse` (3 à 200), `ville` (2 à 100), `telephone` (8 à 20), `description` (0 à 500), `latitude` (nombre), `longitude` (nombre), `horaires` (chaîne), `estDeGarde` (booléen), `estOuvertManuel` (booléen ou `null`). Le ValidationPipe refuse tout champ hors de cette liste (`forbidNonWhitelisted`) : ne jamais envoyer `email`, `type`, `logoUrl`, `id`. Le service ne touche que les champs `!== undefined` (D02) : **un champ absent n'est jamais effacé**. Les chaînes sont `trim()` côté serveur. La réponse `data` contient seulement `id, nom, type, email, telephone, adresse, ville, description, latitude, longitude, horaires, estDeGarde, estOuvertManuel, updatedAt` (D12).
- `estOuvertManuel` : `null` = selon les horaires (automatique), `true` = ouverte (forcé), `false` = fermée (forcé). Retour à l'automatique = `{ estOuvertManuel: null }` (D03).
- Erreur de validation : `ApiError` de statut 400 avec `details.code === "VALIDATION"` et un message technique en anglais, **à ne jamais afficher** (D11).
- Logo : `setMyLogo(fileId)` / `removeMyLogo()` de `@/lib/api_structure`, inchangés.

Permissions réelles de la démo (`GET /auth/me`, `structureType: "PHARMACIE"`) : pharmacien = `catalogue:write, chat:structure, membre:read, stock:read, stock:write, structure:read, vente:read, vente:write` ; administrateur = `membre:manage, membre:read, role:manage, stock:read, stock:write, structure:read, structure:write, vente:annuler, vente:read, vente:write`.

### Fichiers à créer ou modifier (et aucun autre)

| Fichier | Action |
|---|---|
| `src/lib/horaires_structure.ts` + `src/lib/horaires_structure.test.ts` | créer (voir 1) |
| `src/components/modals/StructureModal.tsx` | remplacer le corps de `getInitialSchedule` par `lireHoraires` (voir 1.3), rien d'autre |
| `src/app/dashboard/structure/page.tsx` | aiguillage pharmacie (voir 2) ; branche hôpital et clinique inchangée |
| `src/app/dashboard/structure/MaPharmacie.tsx` | créer, vue pharmacie (voir 3 à 6) |
| `src/app/dashboard/structure/BlocModifiable.tsx` | créer, cadre d'un bloc avec son bouton « Enregistrer » (voir 4.1) |
| `src/app/dashboard/structure/enregistrement.ts` | créer, validation et corps envoyés par bloc, message d'erreur (voir 4.2 à 4.5) |
| `src/app/dashboard/structure/enregistrement.test.ts` | créer (voir 7) |
| `src/app/dashboard/structure/page.test.tsx` | créer (voir 7) |

### 1. `src/lib/horaires_structure.ts` (D08, D09)

1.1 Exports, sans `any` :

```ts
export const JOURS_SEMAINE = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const;
export type JourSemaine = (typeof JOURS_SEMAINE)[number];
export type Horaires = Record<JourSemaine, string>;
export const HORAIRES_PAR_DEFAUT: Horaires = {
  Lundi: "08:00-18:00", Mardi: "08:00-18:00", Mercredi: "08:00-18:00", Jeudi: "08:00-18:00",
  Vendredi: "08:00-18:00", Samedi: "08:00-12:00", Dimanche: "Fermé",
};
export const VALEUR_FERME = "Fermé";

/** Lecture du JSON des horaires ; même logique que l'ancien getInitialSchedule de StructureModal. */
export function lireHoraires(json: string | null | undefined): Horaires;
/** "08:00-21:00" -> { ferme: false, ouverture: "08:00", fermeture: "21:00" } ; "Fermé" -> { ferme: true, ouverture: "", fermeture: "" } ; autre texte -> { ferme: false, ouverture: "", fermeture: "" }. */
export function lirePlage(valeur: string): PlageHoraire;
/** Inverse : ferme -> "Fermé", sinon `${ouverture}-${fermeture}`. */
export function ecrirePlage(plage: PlageHoraire): string;
export interface PlageHoraire { ferme: boolean; ouverture: string; fermeture: string }
```

1.2 `lireHoraires` reproduit exactement `getInitialSchedule` : `JSON.parse(json || "{}")`, pour chaque jour `parsed[jour] || HORAIRES_PAR_DEFAUT[jour]`, et en cas d'exception renvoie une copie de `HORAIRES_PAR_DEFAUT`. Résultat dans l'ordre Lundi à Dimanche. Si le JSON est valide mais n'est pas un objet (ex. `"null"`, `"3"`), renvoyer les valeurs par défaut. Pour `lirePlage`, l'expression reconnue est `/^(\d{2}:\d{2})-(\d{2}:\d{2})$/` après `trim()`, et `"Fermé"` exact (après `trim()`).

1.3 `StructureModal.tsx` : `getInitialSchedule` devient `const getInitialSchedule = () => lireHoraires(structure?.horaires);` (import depuis `@/lib/horaires_structure`). Aucun autre changement dans ce fichier : son test existant `StructureModal.test.tsx` doit rester vert sans modification.

### 2. `page.tsx` : aiguillage

- Garder tel quel le chargement (`getMyStructure`), les gestionnaires de logo (`handleLogoUploaded`, `handleLogoRemove`), les états de chargement et d'erreur, et **tout le JSX actuel pour HOPITAL et CLINIQUE** (D07), y compris `StructureModal`, le bouton « Modifier » et les tests sur `user?.role === 'STRUCTURE_ADMIN'` de cette branche.
- Après les retours de chargement et d'erreur, si `structure.type === "PHARMACIE"` (D06), rendre :

```tsx
<MaPharmacie
  structure={structure}
  peutModifier={peutModifier}
  peutGererEquipe={peutGererEquipe}
  peutVoirEquipe={peutVoirEquipe}
  onStructureModifiee={(maj) => setStructure((prev) => (prev ? { ...prev, ...maj } : prev))}
  logo={{ occupe: logoBusy, erreur: logoError, onEnvoye: handleLogoUploaded, onSupprimer: handleLogoRemove }}
/>
```

- Droits (D05), calculés avec `const { user, profile } = useAuth();` puis `const contexte = user ? lireContexteAcces(user, profile ?? null) : null;` :
  - `peutModifier` = `contexte?.mode === "permissions" ? contexte.permissions.has("structure:write") : user?.role === "STRUCTURE_ADMIN"` ;
  - `peutGererEquipe` = même forme avec `"membre:manage"` ;
  - `peutVoirEquipe` = `contexte !== null && estRouteAutorisee("/dashboard/membres", contexte)` (import depuis `@/lib/navigation_tableau_de_bord`).
- Ces trois valeurs ne servent qu'à la branche pharmacie. Les hooks restent appelés avant tout `return` conditionnel (règles des hooks).
- Les imports devenus inutiles pour la seule branche pharmacie restent, puisque la branche hôpital les utilise encore ; eslint ne doit signaler aucun import inutilisé.

### 3. `MaPharmacie.tsx` : composition de la page (client)

Props :

```ts
interface MaPharmacieProps {
  structure: MyStructure;
  peutModifier: boolean;
  peutGererEquipe: boolean;
  peutVoirEquipe: boolean;
  onStructureModifiee: (maj: Partial<MyStructure>) => void;
  logo: { occupe: boolean; erreur: string; onEnvoye: (f: StoredFileView) => void; onSupprimer: () => void };
}
```

Ordre de haut en bas, conteneur `max-w-7xl mx-auto space-y-8 animate-fade-in` comme aujourd'hui :

1. **En-tête** : reprendre l'en-tête actuel de `page.tsx` (fond, logo via `ImageWithFallback`, pastilles « Pharmacie » et « Active »/« Inactive », nom en `h1`, ville et adresse). Sous le nom, à la place du bouton « Modifier » : si `peutModifier`, le `FileUpload` du logo et « Supprimer le logo » exactement comme aujourd'hui (mêmes props `visibility="public" prefix="logos" accept="image/jpeg,image/png,image/webp" maxSizeMb={5}`, libellé « Changer le logo » ou « Ajouter un logo », « Mise à jour… », erreur en `role="alert"`). Sans `peutModifier`, aucun contrôle de logo. Pas d'email ni de téléphone dans l'en-tête (ils sont dans le bloc 4.3).
2. **Bandeau d'état** (section « Ouverture et garde », voir 5).
3. Si `!peutModifier` : paragraphe `role="note"` « Pour modifier ces informations, contactez l'administrateur de votre pharmacie. » (texte exact), placé juste sous le bandeau d'état.
4. **Grille des blocs** `grid grid-cols-1 lg:grid-cols-2 gap-6` : « Informations et contact » (4.3), « Horaires d'ouverture » (4.4), « Position sur la carte » (4.5).
5. **Équipe** (6).

Styles : reprendre les classes de cartes et de champs déjà utilisées dans `src/app/dashboard/ventes/page.tsx` (`CARTE`, `CHAMP`, `FOCUS`, `BOUTON_PRIMAIRE`) en recopiant leurs valeurs dans des constantes locales de `MaPharmacie.tsx` et `BlocModifiable.tsx`, sans les exporter. Thèmes clair et sombre sur chaque élément (classes `dark:`). Aucune nouvelle couleur hors des tokens déjà employés (`primary-*`, `secondary-*`, `emergency-*`, `slate-*`, `emerald-*`, `amber-*`). Icônes `lucide-react` déjà dans le projet. Aucune boîte dans une boîte : les champs sont directement dans la carte du bloc.

### 4. Blocs modifiables

#### 4.1 `BlocModifiable.tsx`

Composant présentationnel :

```ts
interface BlocModifiableProps {
  titre: string;                 // rendu en h2, id relié à la section par aria-labelledby
  description?: string;          // phrase d'aide sous le titre
  modifiable: boolean;           // false : pas de formulaire, pas de bouton
  etat: EtatBloc;                // voir enregistrement.ts
  modifie: boolean;              // true si la saisie diffère des valeurs enregistrées
  onEnregistrer: () => void;
  children: React.ReactNode;
}
```

- `modifiable` : contenu dans un `<form noValidate onSubmit>` (préventer le défaut, appeler `onEnregistrer`), bouton `type="submit"` « Enregistrer » (icône `Save`) **toujours visible en bas du bloc**, désactivé si `etat.statut === "enregistrement"` ou `!modifie` ; pendant l'envoi, libellé « Enregistrement… » avec `Loader2` animé.
- Zone de message sous le bouton : `etat.statut === "succes"` → `role="status"` « Modifications enregistrées. » (icône `CheckCircle2`, vert) ; `etat.statut === "erreur"` → `role="alert"` avec `etat.message` (icône `AlertCircle`, `emergency`). Une nouvelle saisie dans le bloc remet l'état à `repos` (géré par le parent).
- Non `modifiable` : seulement le titre, la description et `children` (affichage en lecture).

#### 4.2 `enregistrement.ts` : types et message d'erreur

```ts
export type EtatBloc =
  | { statut: "repos" }
  | { statut: "enregistrement" }
  | { statut: "succes" }
  | { statut: "erreur"; message: string };

export function messageErreurEnregistrement(err: unknown): string;
```

`messageErreurEnregistrement` (D11) : si `estPermissionRefusee(err)` (de `@/lib/acces`) → appeler `signalerAccesRefuse()` et renvoyer « Vous n'avez plus l'autorisation de modifier ces informations. » ; si `err instanceof ApiError && err.details?.code === "VALIDATION"` → « Certaines informations n'ont pas été acceptées. Vérifiez ce bloc puis réessayez. » ; sinon `messageErreurPour(err, "L'enregistrement n'a pas abouti. Vérifiez votre connexion puis réessayez.")` (de `@/hooks/useToast`).

Chaque fonction de bloc ci-dessous renvoie `{ ok: true; corps: UpdateStructurePayload } | { ok: false; message: string }`. En cas de `ok: false`, le parent met le bloc en état `erreur` avec ce message, sans appel réseau. Le parent appelle `updateMyStructure(corps)`, puis `onStructureModifiee(reponse.data)` et l'état `succes`, ou l'état `erreur` avec `messageErreurEnregistrement(err)`.

#### 4.3 Bloc « Informations et contact »

Description : « Ces informations sont visibles par les patients qui cherchent une pharmacie. »

- Champs modifiables (labels visibles reliés par `htmlFor`) : « Nom de la pharmacie » (obligatoire), « Téléphone » (`type="tel"`, `autoComplete="tel"`), « Ville », « Adresse », « Description » (`textarea` 3 lignes, compteur « n / 500 »).
- Non modifiables, affichés en texte sous les champs : « Email » (`structure.email`) avec l'aide « L'email sert à la connexion de l'administrateur, il ne se modifie pas ici. » et « Type » = « Pharmacie ».
- Fonction `corpsInformations(saisie, origine: MyStructure)` (D10), `saisie = { nom, telephone, ville, adresse, description }`, valeurs `trim()` :
  - `nom` : 2 à 150 caractères, sinon « Le nom de la pharmacie doit contenir entre 2 et 150 caractères. » ; toujours envoyé.
  - `telephone` (8 à 20), `ville` (2 à 100), `adresse` (3 à 200) : vide et origine vide (`null` ou `""`) → non envoyé ; vide et origine renseignée → message « Le champ <libellé en minuscules : téléphone, ville, adresse> ne peut pas être vidé. Saisissez une nouvelle valeur. » ; longueur hors bornes → « Le téléphone doit contenir entre 8 et 20 caractères. », « La ville doit contenir entre 2 et 100 caractères. », « L'adresse doit contenir entre 3 et 200 caractères. » ; sinon envoyé.
  - `description` : plus de 500 caractères → « La description ne doit pas dépasser 500 caractères. » ; sinon toujours envoyée (chaîne vide permise, elle efface la description).
  - Le corps ne contient **que** des clés parmi `nom, telephone, ville, adresse, description`.
- Lecture seule : liste de définitions (`dl`) Nom, Téléphone, Ville, Adresse, Description, Email ; valeur absente → « Non renseigné ».

#### 4.4 Bloc « Horaires d'ouverture »

Description : « Les patients voient la pharmacie ouverte ou fermée selon ces horaires, sauf si vous choisissez autre chose dans Ouverture. »

- Une ligne par jour de `JOURS_SEMAINE`, saisie initiale `lirePlage(lireHoraires(structure.horaires)[jour])`. Par ligne : nom du jour, case à cocher « Fermé » (label `Fermé le <jour en minuscules>` pour les lecteurs d'écran via `aria-label`), deux champs `type="time"` « Ouverture » et « Fermeture » (labels accessibles `Heure d'ouverture le <jour>` et `Heure de fermeture le <jour>`), désactivés quand « Fermé » est coché. Disposition en ligne dès `sm:`, empilée sur téléphone.
- Phrase d'aide sous la liste : « Pour une ouverture jour et nuit, utilisez plutôt « De garde ». »
- Fonction `corpsHoraires(plages: Record<JourSemaine, PlageHoraire>)` (D09) : pour chaque jour non fermé, ouverture et fermeture obligatoires, sinon « Indiquez l'heure d'ouverture et de fermeture du <jour en minuscules>, ou cochez Fermé. » ; fermeture strictement après ouverture (comparaison des chaînes `HH:MM`), sinon « Le <jour en minuscules>, l'heure de fermeture doit être après l'heure d'ouverture. » ; premier jour fautif dans l'ordre de la semaine. Corps = `{ horaires: JSON.stringify(objet Lundi à Dimanche de ecrirePlage) }`, et rien d'autre.
- Lecture seule : tableau simple jour / horaire (« 08:00 à 21:00 », ou « Fermé » ; valeur non reconnue affichée telle quelle).

#### 4.5 Bloc « Position sur la carte »

Description : « Elle permet aux patients de trouver la pharmacie sur la carte. »

- Champs « Latitude » et « Longitude » (`type="number"`, `step="any"`, `inputMode="decimal"`), saisie initiale `String(structure.latitude)` / `String(structure.longitude)` si `!= null`, sinon `""`.
- Bouton secondaire « Choisir sur la carte » (icône `Navigation`) qui ouvre `MapModal` (`@/components/modals/MapModal`) en `mode="picker"`, `initialLat`/`initialLng` = valeurs numériques actuelles si valides, `onLocationSelect={(lat, lng) => ...}` qui remplit les deux champs (arrondis à 6 décimales avec `toFixed(6)`) et marque le bloc modifié ; `isOpen`/`onClose` gérés par un état local. MapModal n'est pas modifié.
- Fonction `corpsPosition(saisie: { latitude: string; longitude: string })` (D14) : les deux vides → « Choisissez la position sur la carte ou saisissez la latitude et la longitude. » ; un seul rempli ou non numérique (`Number(...)` non fini) → « Indiquez la latitude et la longitude. » ; latitude hors -90 à 90 → « La latitude doit être comprise entre -90 et 90. » ; longitude hors -180 à 180 → « La longitude doit être comprise entre -180 et 180. ». Corps = `{ latitude, longitude }` (nombres), rien d'autre.
- Lecture seule : « Latitude » et « Longitude » en texte (6 décimales), ou « Position non renseignée. » si absente. Pas de bouton de carte.

Pour les trois blocs : `modifie` = la saisie diffère des valeurs enregistrées (comparaison après `trim()` pour le texte). Après un succès, les valeurs enregistrées deviennent la nouvelle référence (via la structure fusionnée renvoyée par `onStructureModifiee`), donc le bouton redevient désactivé.

### 5. Bandeau « Ouverture et garde » (D03, D04)

Section avec titre h2 « Ouverture et garde », en tête, juste sous l'en-tête. Deux contrôles côte à côte dès `md:`, empilés sur téléphone :

- **De garde** : interrupteur `button type="button" role="switch" aria-checked={estDeGarde}` avec le libellé visible « De garde » et l'aide « La pharmacie apparaît ouverte aux patients, même en dehors des horaires. ». État affiché « Oui » / « Non ». Au clic (Espace et Entrée natifs du bouton) : envoi immédiat `updateMyStructure({ estDeGarde: !valeur })`, et rien d'autre.
- **Ouverture** : `fieldset` avec `legend` « Ouverture », trois boutons radio natifs (`input type="radio"` stylés en segments, navigation aux flèches native) : « Selon les horaires » (`null`), « Ouverte maintenant » (`true`), « Fermée maintenant » (`false`). Valeur cochée = `structure.estOuvertManuel` (`null` ou absent → « Selon les horaires »). Au changement : envoi immédiat `updateMyStructure({ estOuvertManuel: valeur })` avec `null` littéral pour « Selon les horaires », et rien d'autre. Aide sous le groupe selon la valeur : `null` → « La pharmacie s'ouvre et se ferme selon vos horaires. » ; `true` → « Affichée ouverte jusqu'à ce que vous reveniez aux horaires. » ; `false` → « Affichée fermée jusqu'à ce que vous reveniez aux horaires. ».
- Chaque contrôle a son propre `EtatBloc` : pendant l'envoi, le contrôle est désactivé et affiche « Enregistrement… » ; succès → `role="status"` « Enregistré. » ; erreur → la valeur affichée reste l'ancienne (aucune mise à jour optimiste) et `role="alert"` avec `messageErreurEnregistrement(err)`. Succès → `onStructureModifiee(reponse.data)`.
- Sans `peutModifier` : même présentation en lecture, sous forme d'état et non de contrôle : « De garde : Oui » ou « De garde : Non », « Ouverture : Selon les horaires » / « Ouverte maintenant » / « Fermée maintenant », avec les mêmes aides ; aucun `role="switch"`, aucun `input`.

### 6. Équipe (D13)

- Trois `StatCard` (`@/components/charts/StatCard`, mêmes props visuelles qu'aujourd'hui) : « Membres de l'équipe » = `structure.membres.length`, « Pharmaciens » = membres de `role === "PHARMACIEN"`, « Membres actifs » = membres `isActive`. Grille `grid grid-cols-1 sm:grid-cols-3 gap-4`. **Pas** de carte « Médecins », **pas** de `DonutChart`.
- Carte « Équipe » sous les compteurs : si `peutVoirEquipe`, `Link` vers `/dashboard/membres` avec le titre « Gérer l'équipe » et le sous-titre « Ajouter ou désactiver des pharmaciens » si `peutGererEquipe`, sinon « Voir l'équipe » et « Consulter la liste des membres » ; puis le bloc « Administrateur » (initiales, nom, email) repris tel quel de la page actuelle si `structure.admin`. `structure.membres.length === 0` → phrase « Aucun membre pour l'instant. » suivie du lien (si `peutVoirEquipe`).

### 7. Tests (Vitest, `@testing-library/react`, modèle `src/app/dashboard/ventes/page.test.tsx`)

`src/app/dashboard/structure/enregistrement.test.ts` :
- `corpsInformations` : corps avec seulement `nom, telephone, ville, adresse, description` ; champ facultatif vide d'origine vide non envoyé ; champ vidé alors qu'il était renseigné refusé avec le message de 4.3 ; nom trop court refusé ; description vide envoyée `""`.
- `corpsHoraires` : `{ horaires }` seul, JSON aux 7 jours dans l'ordre, « Fermé » pour un jour fermé ; heure manquante et fermeture avant ouverture refusées avec les messages de 4.4.
- `corpsPosition` : nombres, bornes, champs manquants.
- `messageErreurEnregistrement` : VALIDATION → message fixe (jamais le message anglais du serveur) ; `ApiError(…, 403, { code: "PERMISSION_REFUSEE" })` → message d'autorisation et `signalerAccesRefuse` appelé (espionner `window.dispatchEvent`) ; autre `ApiError` → son message.

`src/lib/horaires_structure.test.ts` : `lireHoraires` (JSON complet, JSON partiel complété par défaut, JSON invalide, `null`, `"null"`), `lirePlage`, `ecrirePlage`, aller-retour.

`src/app/dashboard/structure/page.test.tsx` (mocks : `@/hooks/useAuth` avec un objet `droits` modifiable comme dans `ventes/page.test.tsx`, `@/lib/api_structure` avec `getMyStructure`, `updateMyStructure`, `setMyLogo`, `removeMyLogo` et `ApiError` réel via `importOriginal`, `@/components/modals/MapModal` → `() => null`, `@/components/FileUpload` → composant minimal, `@/components/charts/DonutChart` → composant minimal avec un texte repérable « graphique-equipe ») :
1. Administrateur de pharmacie (permissions de l'administrateur de la démo, données Pharmacie de Kaloum de l'essai réel) : modifier « Téléphone » puis cliquer « Enregistrer » du bloc « Informations et contact » → `updateMyStructure` appelé une fois, avec un objet dont les clés sont exactement un sous-ensemble de `nom, telephone, ville, adresse, description` (aucune clé `horaires`, `latitude`, `longitude`, `estDeGarde`, `estOuvertManuel`, `email`) ; « Modifications enregistrées. » affiché.
2. Administrateur : « Horaires d'ouverture », cocher « Fermé » pour dimanche puis enregistrer → appel avec la seule clé `horaires` et `"Dimanche":"Fermé"`.
3. Administrateur : cliquer l'interrupteur « De garde » → appel `{ estDeGarde: false }` exactement (`toHaveBeenCalledWith`) ; choisir « Selon les horaires » depuis un état `estOuvertManuel: true` → appel `{ estOuvertManuel: null }` exactement.
4. Administrateur : `updateMyStructure` rejette `new ApiError("nom must be longer…", 400, { code: "VALIDATION" })` → message humain de D11 visible, le texte anglais absent.
5. Pharmacien (permissions du pharmacien de la démo) : aucun bouton « Enregistrer », aucun `role="switch"`, aucun champ de saisie, phrase « Pour modifier ces informations, contactez l'administrateur de votre pharmacie. » présente, lien « Voir l'équipe » présent, « Gérer l'équipe » absent, aucun contrôle de logo ; `updateMyStructure` jamais appelé.
6. Pharmacie : aucun texte « Médecins », pas de « graphique-equipe » ; « Pharmaciens » et « Membres actifs » présents.
7. Hôpital inchangé : structure `type: "HOPITAL"`, utilisateur `role: "STRUCTURE_ADMIN"` → bouton « Modifier », carte « Médecins » et « graphique-equipe » présents (au moins un médecin dans `membres`), aucun bloc « Informations et contact ».

### 8. Essai réel contre le back local (obligatoire, une fois)

Back sur http://localhost:3101, démo active. Avec `curl` (Git Bash) : `GET /auth/demo/comptes`, prendre l'`id` de `admin.kaloum@demo.medconnecte.gn`, `POST /auth/demo/connexion` avec `{ "userId": "<id>" }`, jeton = `data.access_token`. Puis, avec `Authorization: Bearer <jeton>` :
1. `GET /structures/my` : noter `telephone`, `estDeGarde`, `estOuvertManuel`, `horaires` d'origine (valeurs vues par l'orchestrateur le 2026-10-22 : `+224 621 33 44 55`, `true`, `null`).
2. `PATCH /structures/my` `{ "telephone": "+224 621 00 00 00" }` puis `GET` : téléphone changé, `horaires`, `estDeGarde`, `adresse` inchangés (preuve de D02).
3. `PATCH` `{ "estOuvertManuel": false }`, puis `PATCH` `{ "estOuvertManuel": null }` puis `GET` : `estOuvertManuel` vaut `null` (preuve de D03). Si le retour à `null` est refusé ou ignoré : bloc BLOCKED, ne pas livrer l'option « Selon les horaires » sans retour à l'orchestrateur.
4. Remettre toutes les valeurs d'origine (`PATCH` avec le téléphone d'origine ; `estOuvertManuel` d'origine) et vérifier par un dernier `GET` qu'elles sont identiques à l'étape 1.

Consigner dans `docs/plans/runs/2026-10-22-lot9/rapports/F14-essai-reel.md` (seul fichier de `docs/plans/` que la tâche écrit) : commandes (jeton masqué en `<jeton>`), statut HTTP et extrait des champs concernés à chaque étape, verdict final « valeurs d'origine restaurées : oui ». Ne jamais y recopier le jeton.

## Contraintes

Faire uniquement ce qui est demandé : pas de refactors, helpers ou abstractions non demandés. Discipline de code dans l'ordre : réutiliser l'existant > ranger au bon endroit > n'abstraire qu'à la règle de trois. Règles d'audience, visuelles, typographiques et de langue : docs/ORCHESTRATOR.md. Ne pas modifier docs/plans/, sauf le rapport d'essai réel de la section 8. Écrire les fichiers uniquement avec Write et Edit, jamais par redirection shell : le hook de garde ne voit pas les écritures faites par Bash.

Précisions :
- Ne modifier ni `back_medconnect`, ni `MapModal.tsx`, ni `FileUpload.tsx`, ni `api_structure.ts`, ni le registre de navigation.
- Aucun `any`, aucun `eslint-disable` dans les fichiers créés. Commentaires de code en français.
- Textes visibles en français pour des non-techniciens, exactement ceux de cette fiche ; aucun terme de la liste des termes interdits (section 1 et 14 de docs/ORCHESTRATOR.md) dans les chaînes affichées ; aucun tiret cadratin ni demi-cadratin. Aucun chiffre inventé : les compteurs viennent de `structure.membres`. La page n'affiche pas de montant ; si un montant apparaissait, il passerait par `formaterGNF`.
- Accessibilité : tout est utilisable au clavier (ordre de tabulation naturel, `FOCUS` visible sur chaque bouton, lien, case et champ), chaque champ a un label, les messages d'état sont annoncés (`role="status"` ou `role="alert"`), les sections ont un titre h2 relié par `aria-labelledby`.
- La décision d'affichage ne lit jamais `user.role` dans la branche pharmacie, sauf en mode `repli` (D05).

## Done when

Depuis `D:\souleymane\perso-archive-20260923\perso\medconnecte` (conteneur `frontend` démarré) :
1. `docker compose exec -T frontend npx tsc --noEmit` : aucune erreur.
2. `docker compose exec -T frontend npx eslint src/lib/horaires_structure.ts src/lib/horaires_structure.test.ts src/components/modals/StructureModal.tsx src/app/dashboard/structure/page.tsx src/app/dashboard/structure/MaPharmacie.tsx src/app/dashboard/structure/BlocModifiable.tsx src/app/dashboard/structure/enregistrement.ts src/app/dashboard/structure/enregistrement.test.ts src/app/dashboard/structure/page.test.tsx` : aucune erreur ni avertissement (l'`eslint-disable-next-line` déjà présent dans `StructureModal.tsx` est conservé tel quel).
3. `docker compose exec -T frontend npx vitest run` : tous les tests verts, dont les trois nouveaux fichiers de test et `StructureModal.test.tsx` inchangé.
4. `git -C front_medconnect status --porcelain --untracked-files=all -- . ":!docs/plans"` ne liste que les 9 fichiers de la commande du point 2.
5. Depuis `front_medconnect`, en Git Bash : `git diff -U0 -- src | LC_ALL=C.UTF-8 grep -n $'^+.*\(\xe2\x80\x93\|\xe2\x80\x94\)'` et `LC_ALL=C.UTF-8 grep -rn $'\xe2\x80\x93\|\xe2\x80\x94' src/app/dashboard/structure/ src/lib/horaires_structure.ts src/lib/horaires_structure.test.ts` : aucune ligne.
6. Depuis `front_medconnect` : `grep -rnE ":\s*any\b|<any>|as any\b|eslint-disable" src/app/dashboard/structure/MaPharmacie.tsx src/app/dashboard/structure/BlocModifiable.tsx src/app/dashboard/structure/enregistrement.ts src/lib/horaires_structure.ts` : aucune ligne.
7. Depuis `front_medconnect` : `grep -nE "Médecins|DonutChart|role ===" src/app/dashboard/structure/MaPharmacie.tsx` ne renvoie que la ligne du filtre `role === "PHARMACIEN"` des compteurs ; `grep -n "StructureModal" src/app/dashboard/structure/MaPharmacie.tsx` : aucune ligne.
8. `docs/plans/runs/2026-10-22-lot9/rapports/F14-essai-reel.md` existe, contient les 4 étapes de la section 8 avec leurs statuts HTTP, `estOuvertManuel` à `null` après l'étape 3, et la ligne « valeurs d'origine restaurées : oui » ; `grep -nE "eyJ[A-Za-z0-9_-]{10,}" docs/plans/runs/2026-10-22-lot9/rapports/F14-essai-reel.md` : aucune ligne.

## Return

Chemin des fichiers + preuve (commande lancée, résultat en une ligne) pour chaque point du « Done when », plus le chemin du rapport d'essai réel. Ou un bloc BLOCKED. Pas de prose.

## Historique

<!-- une ligne par tentative : AAAA-MM-JJ | tier | résultat | raison si échec -->

## Validation

<!-- commande relancée par l'orchestrateur | résultat en une ligne | hash du commit -->
