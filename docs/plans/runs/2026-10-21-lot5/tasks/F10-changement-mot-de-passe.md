# F10 - Changement de mot de passe : rafraîchissement seulement sur un 401 de jeton, règles du mot de passe partagées, erreurs sous le bon champ

Tier: spécifié (agent implementeur-specifie)
Audience: non-dev (profil du tableau de bord, réinitialisation du mot de passe, inscription, configuration d'une structure invitée)
Visuel: préventif (un seul nouveau bloc, la liste des règles, qui reprend le rendu de l'indicateur déjà présent sur l'inscription et la réinitialisation ; message d'erreur de champ identique à `telephone-erreur` ; clair et sombre)
Background-safe: non, car docker compose exec (typage, lint et tests dans le conteneur frontend)

## Spec

Dépôt : `D:\souleymane\perso-archive-20260923\perso\medconnecte\front_medconnect`, branche `orch/lot5-front` (arbre principal, ne pas changer de branche, ne pas committer). Le back (`back_medconnect`, branche orch/lot5-back en cours) ne doit PAS être modifié. Décisions du run : `docs/plans/runs/2026-10-21-lot5/decisions.md`, en particulier D14 à D20, déjà tranchées, ne pas les rediscuter.

### Problème (signalé par le porteur)

1. `src/lib/api_auth.ts`, `avecRafraichissement` : tout 401 déclenche un rafraîchissement puis une nouvelle tentative. Si la nouvelle tentative échoue encore (ex. ancien serveur : mot de passe actuel faux = 401 sans code), l'erreur tombe dans le `catch` du rafraîchissement, qui vide le stockage local et lève « Vous avez été déconnecté ». L'utilisateur est déconnecté pour une simple faute de saisie.
2. `src/app/dashboard/profil/page.tsx` ne vérifie que 8 caractères alors que le back exige aussi une majuscule, une minuscule et un chiffre ; le refus du serveur arrive dans un bandeau générique.

### Contrat du back (orch/lot5-back, ne pas modifier, déjà décidé)

- `POST /auth/change-password` avec un mot de passe actuel faux : **400**, corps `{ statusCode: 400, message: "Le mot de passe actuel est incorrect.", code: "MOT_DE_PASSE_ACTUEL_INCORRECT" }`.
- 401 du garde d'authentification : `code` = `JETON_ABSENT`, `JETON_EXPIRE` ou `JETON_INVALIDE`. Révocation : `SESSION_REVOQUEE`, `COMPTE_DESACTIVE` (et `REFRESH_REUTILISE`, `SESSION_EXPIREE` sur `/auth/refresh`). Plus aucun code par défaut sur les autres 401.
- Validation : 400 `{ message, code: "VALIDATION", champs: [{ champ: "newPassword", contraintes: [...], message?: "Le nouveau mot de passe doit contenir de 8 à 50 caractères, dont au moins une majuscule, une minuscule et un chiffre." }] }`. Le `message` d'une entrée de `champs` est facultatif (ancien serveur : absent).
- Règle du mot de passe (change-password `newPassword`, reset-password `newPassword`, register `password`, setup-structure `password`) : longueur 8 à 50, et `/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/`.

### 1. `src/lib/api_auth.ts` (modifier)

Seule la fonction `avecRafraichissement` change, plus une constante et une fonction privées juste au-dessus d'elle. Rien d'autre dans le fichier (ne pas toucher `apiFetch`, `envoyer`, `authFetch`, `authDownload`, `refreshAccessToken`, `logout`), hormis la mise à jour des deux commentaires qui disent « en cas de 401 (jeton expiré) » (docstring de `avecRafraichissement` et de `authFetch`) pour dire « 401 de jeton (expiré, invalide ou absent, ou sans code) ».

```ts
/** Codes d'un 401 qui demandent de renouveler le jeton de connexion (D14). */
const CODES_JETON_A_RENOUVELER = ["JETON_ABSENT", "JETON_EXPIRE", "JETON_INVALIDE"];

/** Vrai si un 401 appelle un rafraîchissement : code de jeton, ou pas de code (ancien serveur). */
function doitRafraichir(err: ApiError): boolean {
  if (err.status !== 401) return false;
  const code = err.details?.code;
  return typeof code !== "string" || CODES_JETON_A_RENOUVELER.includes(code);
}
```

Nouveau déroulé de `avecRafraichissement` (même signature) :

1. `try { return await appel(lireJeton()); } catch (err) { ... }` :
   - si `!(err instanceof ApiError) || err.status !== 401` : `throw err` ;
   - `const motifImmediat = motifDepuisReponse(err.status, err.details); if (motifImmediat) throw arreterConnexion(motifImmediat, err.details);` (inchangé) ;
   - si `!doitRafraichir(err)` : `throw err` (relancée telle quelle, aucun nettoyage local, aucun événement).
2. Rafraîchissement : même code qu'aujourd'hui (promesse partagée `refreshPromise`, remise à `null` après succès comme après échec, enregistrement du nouveau jeton dans `localStorage`), dans son propre `try/catch` dont le `catch` est **exactement** le `catch (errRafraichissement)` actuel (motif connu : déconnexion forcée ; sinon nettoyage du stockage local et du cookie témoin, puis `ApiError("Vous avez été déconnecté. Reconnectez-vous pour continuer.", 401)`). Ce `try` ne contient QUE le rafraîchissement et l'enregistrement du jeton ; il produit le nouveau jeton (variable `let nouveauJeton: string` déclarée avant le `try`, ou retour d'une petite valeur, au choix tant que le typage est strict).
3. Nouvelle tentative, HORS du `try` du rafraîchissement (D15) : `try { return await appel(nouveauJeton); } catch (err) { if (err instanceof ApiError) { const motif = motifDepuisReponse(err.status, err.details); if (motif) throw arreterConnexion(motif, err.details); } throw err; }`. Aucun second rafraîchissement, aucun nettoyage local.

Effets attendus : 400 `MOT_DE_PASSE_ACTUEL_INCORRECT` remonte directement à la page (1 seul appel réseau) ; ancien serveur (401 sans code sur un mot de passe faux) : 3 appels (requête, rafraîchissement, nouvelle tentative), l'erreur 401 du serveur remonte avec son message, le jeton reste en `localStorage`, pas d'événement de déconnexion. Les tests existants de `src/lib/api_auth.revocation.test.ts`, `api_auth.test.ts`, `api_auth.indisponible.test.ts`, `api_auth.demo.test.ts`, `acces.test.ts` doivent passer sans modification.

### 2. `src/lib/regles_mot_de_passe.ts` (nouveau)

Commentaire d'en-tête en français (rôle du fichier, pages qui l'utilisent, rappel « mêmes règles que le serveur »). Contenu exact :

```ts
import { ApiError } from "./api_auth";

export const LONGUEUR_MIN_MOT_DE_PASSE = 8;
export const LONGUEUR_MAX_MOT_DE_PASSE = 50;

export interface RegleMotDePasse {
  id: "longueur" | "majuscule" | "minuscule" | "chiffre";
  libelle: string;
  test: (motDePasse: string) => boolean;
}

export const REGLES_MOT_DE_PASSE: readonly RegleMotDePasse[] = [
  { id: "longueur", libelle: "Au moins 8 caractères", test: (m) => m.length >= LONGUEUR_MIN_MOT_DE_PASSE },
  { id: "majuscule", libelle: "Une lettre majuscule", test: (m) => /[A-Z]/.test(m) },
  { id: "minuscule", libelle: "Une lettre minuscule", test: (m) => /[a-z]/.test(m) },
  { id: "chiffre", libelle: "Un chiffre", test: (m) => /\d/.test(m) },
];

export const MSG_REGLES_NON_RESPECTEES = "Le mot de passe ne respecte pas encore toutes les règles ci-dessous.";
export const MSG_NOUVEAU_MOT_DE_PASSE_REFUSE =
  "Le nouveau mot de passe doit contenir de 8 à 50 caractères, dont au moins une majuscule, une minuscule et un chiffre.";
```

Fonctions exportées :

- `motDePasseValide(motDePasse: string): boolean` : toutes les règles vraies ET `motDePasse.length <= LONGUEUR_MAX_MOT_DE_PASSE`.
- `estMotDePasseActuelIncorrect(err: unknown): boolean` : `err instanceof ApiError && err.status === 400 && err.details?.code === "MOT_DE_PASSE_ACTUEL_INCORRECT"`.
- `messageErreurNouveauMotDePasse(err: unknown, champ = "newPassword"): string | null` : si `err instanceof ApiError`, `err.details?.code === "VALIDATION"` et `err.details.champs` est un tableau contenant un objet dont `champ` vaut `champ` : renvoie le `message` de cet objet s'il est une chaîne non vide, sinon `MSG_NOUVEAU_MOT_DE_PASSE_REFUSE`. Dans tous les autres cas : `null`. Lecture défensive (pas de `any`, `unknown` puis contrôles `typeof`).

### 3. `src/components/ReglesMotDePasse.tsx` (nouveau)

`"use client"` inutile si aucun hook ; composant pur. Icône `Check` de `lucide-react` (déjà utilisée par les pages). API exacte :

```ts
interface ReglesMotDePasseProps {
  /** Valeur actuelle du champ. */
  motDePasse: string;
  /** `id` du champ : la liste prend `${idChamp}-regles`, le message `${idChamp}-erreur`. */
  idChamp: string;
  /** Message affiché sous le champ (règles non remplies à l'envoi, refus du serveur). */
  erreur?: string;
}
export function descriptionMotDePasse(idChamp: string, erreur?: string): string
// renvoie `${idChamp}-regles`, précédé de `${idChamp}-erreur ` si erreur est non vide
// (ex. "password-erreur password-regles")
export default function ReglesMotDePasse(props: ReglesMotDePasseProps)
```

Rendu, dans cet ordre, dans un fragment :

1. Si `erreur` est non vide : `<p id={`${idChamp}-erreur`} role="alert" className="mt-1.5 text-xs text-emergency-500">{erreur}</p>` (même rendu que `telephone-erreur` du profil).
2. `<ul id={`${idChamp}-regles`} aria-label="Règles à respecter" className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5">` ; pour chaque règle de `REGLES_MOT_DE_PASSE` (clé `regle.id`), `const faite = regle.test(motDePasse)` :
   `<li className={`flex items-center gap-1.5 text-xs transition-colors duration-200 ${faite ? "text-secondary-600 dark:text-secondary-400" : "text-slate-500 dark:text-slate-400"}`}>` contenant `<Check aria-hidden="true" className={`w-3.5 h-3.5 flex-shrink-0 ${faite ? "opacity-100" : "opacity-30"}`} />`, puis `{regle.libelle}`, puis `<span className="sr-only">{faite ? " (fait)" : " (à faire)"}</span>`.
   La liste est TOUJOURS rendue, même quand `motDePasse` est vide (D17).
3. `<p className="sr-only" aria-live="polite">{motDePasseValide(motDePasse) ? "Le mot de passe respecte toutes les règles." : ""}</p>`.

Pas d'`aria-live` sur la liste. Aucun autre texte visible. Ne pas utiliser « mot de passe » seul comme `aria-label` (les tests existants cherchent l'étiquette exacte « Mot de passe »).

### 4. `src/app/dashboard/profil/page.tsx` (modifier, formulaire « Sécurité » uniquement)

- Imports : `ReglesMotDePasse, { descriptionMotDePasse }` depuis `@/components/ReglesMotDePasse` ; `motDePasseValide`, `estMotDePasseActuelIncorrect`, `messageErreurNouveauMotDePasse`, `MSG_REGLES_NON_RESPECTEES`, `LONGUEUR_MAX_MOT_DE_PASSE` depuis `@/lib/regles_mot_de_passe` ; `useRef` si absent.
- Nouveaux états : `const [currentPasswordError, setCurrentPasswordError] = useState("")`, `const [newPasswordError, setNewPasswordError] = useState("")`. Refs : `const champMotDePasseActuel = useRef<HTMLInputElement>(null)`, `const champNouveauMotDePasse = useRef<HTMLInputElement>(null)`.
- `handlePasswordChange` : en plus de l'existant, si `e.target.name === "currentPassword"` vider `currentPasswordError` ; si `"newPassword"` vider `newPasswordError`.
- `handleSavePassword`, dans cet ordre :
  1. vider bandeau, succès, `currentPasswordError`, `newPasswordError` ;
  2. si `!motDePasseValide(passwordForm.newPassword)` : `setNewPasswordError(MSG_REGLES_NON_RESPECTEES)`, `champNouveauMotDePasse.current?.focus()`, `return` (aucun appel) ;
  3. confirmation différente : bandeau « Les mots de passe ne correspondent pas. » (inchangé), `return` ;
  4. le contrôle `length < 8` actuel est supprimé (couvert par 2) ;
  5. appel `changePassword` inchangé ; en cas de succès, comportement inchangé ;
  6. `catch (err)` : si `estMotDePasseActuelIncorrect(err)` alors `setCurrentPasswordError((err as ApiError).message)` puis `champMotDePasseActuel.current?.focus()` ; sinon si `messageErreurNouveauMotDePasse(err)` est non nul, `setNewPasswordError(ce message)` puis focus sur le nouveau mot de passe ; sinon bandeau comme aujourd'hui (`ApiError` : `err.message`, sinon « Une erreur est survenue. »). Pas de bandeau dans les deux premiers cas. Le formulaire reste ouvert et les saisies sont conservées.
- Champ « Mot de passe actuel » : `ref={champMotDePasseActuel}`, `autoComplete="current-password"`, `aria-invalid={currentPasswordError ? true : undefined}`, `aria-describedby={currentPasswordError ? "currentPassword-erreur" : undefined}` ; sous le `div.relative` du champ : si erreur, `<p id="currentPassword-erreur" role="alert" className="mt-1.5 text-xs text-emergency-500">{currentPasswordError}</p>`.
- Champ « Nouveau mot de passe » : `ref={champNouveauMotDePasse}`, retirer `minLength={8}`, ajouter `maxLength={LONGUEUR_MAX_MOT_DE_PASSE}`, `autoComplete="new-password"`, `aria-invalid={newPasswordError ? true : undefined}`, `aria-describedby={descriptionMotDePasse("newPassword", newPasswordError)}` ; sous le `div.relative` : `<ReglesMotDePasse motDePasse={passwordForm.newPassword} idChamp="newPassword" erreur={newPasswordError} />`.
- Champ « Confirmer le nouveau mot de passe » : retirer `minLength={8}`, ajouter `maxLength={LONGUEUR_MAX_MOT_DE_PASSE}` et `autoComplete="new-password"`.
- Bouton « Annuler » : vider aussi `currentPasswordError` et `newPasswordError`.
- Aucun autre changement dans la page (ni au formulaire d'informations, ni aux classes existantes).

### 5. `src/app/auth/reset-password/page.tsx` (modifier)

- Supprimer la constante locale `passwordRules` et le bloc « Password rules » (`{form.password.length > 0 && (<div className="mt-3 grid ...">...)}`) ; retirer l'import `Check` s'il n'est plus utilisé.
- État `const [passwordError, setPasswordError] = useState("")` et ref `champMotDePasse` sur le champ `id="password"`. `handleChange` vide `passwordError` quand `name === "password"`.
- `handleSubmit` : d'abord, si `!motDePasseValide(form.password)` : `setPasswordError(MSG_REGLES_NON_RESPECTEES)`, focus, `return` ; puis le contrôle de confirmation existant (inchangé) ; supprimer l'ancien contrôle `failedRules`. Dans le `catch` : garder `err.status === 401` → `setState("invalid")` ; sinon si `messageErreurNouveauMotDePasse(err)` (champ par défaut `newPassword`, c'est le nom envoyé au serveur) est non nul → `setPasswordError(ce message)` + focus, sans bandeau ; sinon comportement actuel.
- Champ `password` : retirer `minLength={8}`, ajouter `maxLength={LONGUEUR_MAX_MOT_DE_PASSE}`, `autoComplete="new-password"`, `aria-invalid={passwordError ? true : undefined}`, `aria-describedby={descriptionMotDePasse("password", passwordError)}` ; sous le `div.relative` : `<ReglesMotDePasse motDePasse={form.password} idChamp="password" erreur={passwordError} />`.
- Champ `confirmPassword` : retirer `minLength={8}`, ajouter `maxLength` et `autoComplete="new-password"`. Le reste de la page est inchangé.

### 6. `src/app/auth/register/page.tsx` (modifier)

- Supprimer la constante `passwordRules` et le bloc « Password strength indicators » ; retirer `Check` de l'import s'il n'est plus utilisé.
- État `passwordError` + ref sur le champ `id="password"` ; `handleChange` vide `passwordError` quand `name === "password"`.
- `handleSubmit` : d'abord le contrôle `motDePasseValide` (message sous le champ, focus, `return`), puis le contrôle de confirmation existant ; supprimer `failedRules`. Le `catch` (téléphone et bandeau) reste STRICTEMENT inchangé (D19).
- Champ `password` : retirer `minLength={8}`, ajouter `maxLength`, `autoComplete="new-password"`, `aria-invalid`, `aria-describedby={descriptionMotDePasse("password", passwordError)}` ; composant `<ReglesMotDePasse motDePasse={form.password} idChamp="password" erreur={passwordError} />` sous le `div.relative`. Champ `confirmPassword` : retirer `minLength={8}`, ajouter `maxLength` et `autoComplete="new-password"`.

### 7. `src/app/auth/setup-structure/[token]/page.tsx` (modifier, étape 1 uniquement)

- Étiquette « Mot de passe » : `htmlFor="password"` ; champ : `id="password"`, `name="password"`, retirer `minLength={8}`, `placeholder="Min. 8 caractères"` remplacé par aucun placeholder (les règles sont affichées), ajouter `maxLength`, `autoComplete="new-password"`, `aria-invalid`, `aria-describedby={descriptionMotDePasse("password", passwordError)}`, ref ; `onChange` vide aussi `passwordError`. Sous le `div.relative` : `<ReglesMotDePasse motDePasse={form.password} idChamp="password" erreur={passwordError} />`.
- Étiquette « Confirmer mot de passe » : `htmlFor="passwordConfirm"` ; champ : `id="passwordConfirm"`, retirer `minLength={8}`, ajouter `maxLength`, `autoComplete="new-password"`.
- `handleSubmit`, étape 1 : d'abord `if (!motDePasseValide(form.password)) { setPasswordError(MSG_REGLES_NON_RESPECTEES); focus; return; }` (on reste à l'étape 1), puis le contrôle de confirmation existant ; supprimer le contrôle `length < 8`. L'étape 2 et le `catch` restent inchangés.

### 8. Tests Vitest

Même style que les tests existants (`@testing-library/react`, `vi.mock` partiel de `@/lib/api_auth` avec `importOriginal`, `fetch` simulé par `vi.stubGlobal` comme `src/lib/api_auth.revocation.test.ts`, `console.warn` rendu muet). Titres en français.

1. `src/lib/api_auth.rafraichissement.test.ts` (nouveau), au moins 9 cas, sur `getMe`, `changePassword` et `authDownload` :
   - 401 `JETON_EXPIRE` puis rafraîchissement 200 `{ data: { access_token: "nouveau" } }` puis 200 : succès, 3 appels, 3e appel avec `Authorization: Bearer nouveau`, jeton enregistré ;
   - même chose avec `JETON_INVALIDE`, puis avec `JETON_ABSENT` (cas paramétrés acceptés) ;
   - 401 sans code (ancien serveur) : rafraîchissement tenté (2e appel vers `/auth/refresh`) ;
   - 400 `MOT_DE_PASSE_ACTUEL_INCORRECT` sur `changePassword` : 1 seul appel, `ApiError` 400 avec le message du serveur et `details.code`, jeton conservé, aucun événement `EVENEMENT_DECONNEXION_FORCEE` ;
   - 401 avec un code inconnu (ex. `AUTRE_CODE`) et 401 `SESSION_EXPIREE` sur une requête ordinaire : 1 seul appel, erreur relancée telle quelle (même message), jeton conservé ;
   - ancien serveur, mot de passe faux : `changePassword` reçoit 401 sans code « Le mot de passe actuel est incorrect », rafraîchissement 200, nouvelle tentative 401 sans code même message : 3 appels, `ApiError` 401 avec ce message (PAS « Vous avez été déconnecté »), `localStorage.access_token` vaut le nouveau jeton, cookie témoin non retiré, aucun événement ;
   - nouvelle tentative qui répond 401 `SESSION_REVOQUEE` : déconnexion forcée (événement reçu avec `SESSION_REVOQUEE`, jeton retiré) ;
   - `authDownload` : 401 `JETON_EXPIRE`, rafraîchissement, puis 200 avec un corps binaire : succès.
2. `src/lib/regles_mot_de_passe.test.ts` (nouveau), au moins 8 cas : chaque règle sur des exemples (`"abc"`, `"abcdefgh"`, `"ABCDEFGH1"`, `"Abcdefg1"`), `motDePasseValide` (vrai pour `"Nouveau123"`, faux pour `"nouveau123"`, `"NOUVEAU123"`, `"Nouveaumdp"`, `"Nouv1"`, et pour une chaîne valide de 51 caractères) ; `estMotDePasseActuelIncorrect` (vrai pour 400 avec le code, faux pour 401 avec le code, faux pour une `Error`) ; `messageErreurNouveauMotDePasse` (message de l'entrée ; phrase fixe si l'entrée n'a pas de `message` ; `null` si `champs` ne contient que `email` ; `null` pour un code autre que `VALIDATION` ; champ `"password"` passé en argument).
3. `src/components/ReglesMotDePasse.test.tsx` (nouveau), au moins 5 cas : 4 éléments de liste rendus avec une valeur vide, tous « (à faire) » ; avec `"Abcdefg1"` tous « (fait) » et l'annonce « Le mot de passe respecte toutes les règles. » présente ; avec `"abcdefgh"` seules longueur et minuscule « (fait) » ; `erreur` fournie : élément `#<idChamp>-erreur` avec `role="alert"` et le texte ; sans `erreur` : pas d'élément d'erreur ; `descriptionMotDePasse("x")` vaut `"x-regles"` et `descriptionMotDePasse("x", "e")` vaut `"x-erreur x-regles"`.
4. `src/app/dashboard/profil/page.test.tsx` (compléter, tests existants inchangés et toujours verts), au moins 5 nouveaux cas dans un `describe("Profil : changement du mot de passe")` :
   - la liste des règles est visible dès l'ouverture du formulaire (texte « Une lettre majuscule ») et le champ « Nouveau mot de passe » a `aria-describedby` contenant `newPassword-regles` ;
   - nouveau mot de passe `"nouveau123"` (confirmé à l'identique) : `changePassword` non appelé, `#newPassword-erreur` contient `MSG_REGLES_NON_RESPECTEES`, le champ a `aria-invalid="true"` ;
   - `changePassword` rejette `new ApiError("Le mot de passe actuel est incorrect.", 400, { code: "MOT_DE_PASSE_ACTUEL_INCORRECT" })` : le texte apparaît une seule fois (`getAllByText(...).toHaveLength(1)`), dans `#currentPassword-erreur`, le champ « Mot de passe actuel » a `aria-invalid="true"`, le formulaire reste ouvert (bouton « Changer le mot de passe » présent) ;
   - après cette erreur, une saisie dans « Mot de passe actuel » retire `#currentPassword-erreur` ;
   - rejet `new ApiError("x", 400, { code: "VALIDATION", champs: [{ champ: "newPassword", contraintes: ["matches"], message: "Message du serveur" }] })` : « Message du serveur » dans `#newPassword-erreur`, une seule fois.
5. `src/app/auth/register/page.test.tsx` (compléter) : 1 nouveau cas, mot de passe `"motdepasse1"` confirmé : `register` non appelé, `#password-erreur` contient `MSG_REGLES_NON_RESPECTEES`.
6. `src/app/auth/reset-password/page.test.tsx` (nouveau), au moins 3 cas : `vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("token=jeton") }))`, `verifyResetToken` résolu `{ data: { valid: true, email: "a@exemple.com" }, message: "", success: true }`, `resetPassword` simulé ; attendre le champ « Nouveau mot de passe » (`findByLabelText`) ; mot de passe faible : `resetPassword` non appelé et `#password-erreur` présent ; rejet `VALIDATION` sur `newPassword` avec `message` : message sous le champ ; mot de passe valide confirmé : `resetPassword` appelé avec `("jeton", "Nouveau123")`.
7. `src/app/auth/setup-structure/[token]/page.test.tsx` (nouveau), au moins 2 cas : `useParams: () => ({ token: "t" })`, `useRouter: () => ({ push: vi.fn() })`, `useAuth` simulé (`loginUser`), `@/lib/api_structure` simulé (`verifyInviteToken` résolu avec `{ data: { nom: "Clinique Test", email: "admin@exemple.com" } }` complété des champs requis par le type `MyStructure` via un `as`, `setupStructure` simulé) ; mot de passe `"faible"` confirmé puis envoi du formulaire (`fireEvent.submit`) : on reste à l'étape 1 (texte « Vos informations » présent), `#password-erreur` présent, `setupStructure` non appelé ; mot de passe `"Nouveau123"` confirmé : passage à l'étape 2 (le texte « Vos informations » disparaît ou le titre de l'étape 2 apparaît, selon le rendu réel de la page).

### Textes visibles (exhaustif)

« Au moins 8 caractères », « Une lettre majuscule », « Une lettre minuscule », « Un chiffre », « (fait) », « (à faire) » (lecteurs d'écran), « Le mot de passe respecte toutes les règles. » (lecteurs d'écran), « Le mot de passe ne respecte pas encore toutes les règles ci-dessous. », « Le nouveau mot de passe doit contenir de 8 à 50 caractères, dont au moins une majuscule, une minuscule et un chiffre. », `aria-label` « Règles à respecter ». Les messages du serveur sont affichés tels quels. Aucun autre texte nouveau. Aucun terme interdit (docs/ORCHESTRATOR.md section 14), aucun tiret cadratin ni demi-cadratin.

## Contraintes

Faire uniquement ce qui est demandé : pas de refactors, helpers ou abstractions non demandés. Discipline de code dans l'ordre : réutiliser l'existant > ranger au bon endroit > n'abstraire qu'à la règle de trois. Règles d'audience, visuelles, typographiques et de langue : docs/ORCHESTRATOR.md. Ne pas modifier docs/plans/. Écrire les fichiers uniquement avec Write et Edit, jamais par redirection shell : le hook de garde ne voit pas les écritures faites par Bash.

Spécifiques : ne pas modifier `back_medconnect` ; ne pas toucher `src/lib/deconnexion_forcee.ts`, `src/lib/acces.ts`, `src/components/modals/UserModal.tsx` ni `src/app/auth/login/page.tsx` ; aucun `any` ; commentaires en français ; tests existants non modifiés (sauf ajout de cas dans `profil/page.test.tsx` et `register/page.test.tsx`). Next.js 16 : rien de propre à Next n'est ajouté (hooks `next/navigation` déjà utilisés par les pages).

## Done when

Toutes les commandes lancées depuis `D:\souleymane\perso-archive-20260923\perso\medconnecte` :

1. `docker compose exec -T frontend npx tsc --noEmit` : aucune sortie, code 0.
2. `docker compose exec -T frontend npx eslint src/lib/api_auth.ts src/lib/api_auth.rafraichissement.test.ts src/lib/regles_mot_de_passe.ts src/lib/regles_mot_de_passe.test.ts src/components/ReglesMotDePasse.tsx src/components/ReglesMotDePasse.test.tsx src/app/dashboard/profil/page.tsx src/app/dashboard/profil/page.test.tsx src/app/auth/reset-password/page.tsx src/app/auth/reset-password/page.test.tsx src/app/auth/register/page.tsx src/app/auth/register/page.test.tsx "src/app/auth/setup-structure/[token]/page.tsx" "src/app/auth/setup-structure/[token]/page.test.tsx"` : 0 erreur, 0 avertissement (code 0).
3. `docker compose exec -T frontend npx vitest run` : tous les tests passent (aucun test existant cassé, dont `api_auth.revocation.test.ts`), avec les 5 nouveaux fichiers de test et les 2 fichiers complétés ; au moins 33 nouveaux cas au total.
4. `grep -rn "passwordRules\|failedRules" front_medconnect/src` ne renvoie rien ; `grep -rln "<ReglesMotDePasse" front_medconnect/src/app` renvoie exactement les 4 pages (profil, reset-password, register, setup-structure).
5. `grep -n "minLength={8}" front_medconnect/src/app/dashboard/profil/page.tsx front_medconnect/src/app/auth/reset-password/page.tsx front_medconnect/src/app/auth/register/page.tsx "front_medconnect/src/app/auth/setup-structure/[token]/page.tsx"` ne renvoie rien ; `grep -nE "\bany\b" front_medconnect/src/lib/regles_mot_de_passe.ts front_medconnect/src/components/ReglesMotDePasse.tsx` ne renvoie rien.
6. `grep -n "CODES_JETON_A_RENOUVELER" front_medconnect/src/lib/api_auth.ts` renvoie la constante et son usage dans `doitRafraichir` ; `git -C front_medconnect diff --stat -- src` ne liste que les fichiers de la commande 2 (aucun fichier hors liste modifié).
7. Aucun tiret cadratin ni demi-cadratin ajouté : aucun blocage du hook de garde (route-guard ou orchestrator-guard) sur les écritures de la tâche ; le validateur le revérifie au pre-commit.

## Return

Liste des fichiers touchés + preuve (les commandes 1 à 6 du Done when lancées, résultat en une ligne chacune, nombre de tests passés). Ou un bloc BLOCKED. Pas de prose.

## Historique

<!-- une ligne par tentative : AAAA-MM-JJ | tier | résultat | raison si échec -->

## Validation

<!-- commande relancée par l'orchestrateur | résultat en une ligne | hash du commit -->
