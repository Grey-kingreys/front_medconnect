# F5 - Message « numéro déjà utilisé » et aide au format du téléphone

Tier: spécifié (agent implementeur-specifie)
Audience: non-dev (page d'inscription, profil de tous les rôles, création d'utilisateur par une structure ou l'administrateur)
Visuel: préventif (reprendre les champs, couleurs et petites lignes de texte existantes, tokens existants, clair et sombre ; aucun nouveau design)
Background-safe: non, car docker compose exec (typage, lint et tests dans le conteneur frontend)

## Spec

Dépôt : `D:\souleymane\perso-archive-20260923\perso\medconnecte\front_medconnect`, branche `orch/lot2-front` (arbre principal, ne pas changer de branche, ne pas committer). Le back (`back_medconnect`) ne doit PAS être modifié. Décisions du run : `docs/plans/runs/2026-10-20-lot2/decisions.md` (D13 à D19), déjà tranchées, ne pas les rediscuter.

But (TB17, côté web) : un numéro de téléphone ne peut servir qu'à un seul compte. Quand le serveur refuse un numéro (déjà pris ou invalide), l'utilisateur voit la raison juste sous le champ téléphone, avec un exemple de format, au lieu d'un bandeau d'erreur général.

### Contexte (déjà vérifié par le chef d'équipe, ne pas re-chercher)

Contrat du back (branche `orch/lot2-back`, en cours) :
- Numéro déjà pris (inscription, création par une structure ou l'administrateur, modification du profil) : statut 409, corps `{ statusCode: 409, message: "Ce numéro est déjà utilisé par un autre compte.", error, code: "TELEPHONE_DEJA_UTILISE" }`.
- Numéro invalide : statut 400, corps `{ statusCode: 400, message: "Certaines informations saisies sont manquantes ou invalides. Vérifiez le formulaire puis réessayez.", error, code: "VALIDATION", champs: [{ champ: "telephone", contraintes: ["..."] }, ...] }`. `champs` liste tous les champs refusés (nom et contraintes, jamais la valeur).

Côté front :
- `src/lib/api_auth.ts` : `apiFetch` lève `ApiError(message, status, details)` où `details` est le corps d'erreur entier (donc `details.code` et `details.champs`). `ApiError` est exportée par ce fichier.
- `src/app/auth/register/page.tsx` : état `error` affiché en bandeau en haut (lignes 115 à 120) ; `handleChange` (lignes 49 à 52) efface `error` ; `catch` lignes 88 à 94 ; champ téléphone lignes 186 à 203 (`id="telephone"`, placeholder « +224 622 123 456 »). Le bloc « confirmer le mot de passe » (lignes 329 à 343) montre le motif bordure rouge `border-emergency-500/50` et petit texte d'erreur sous un champ. Fichier propre au lint.
- `src/app/dashboard/profil/page.tsx` : états `saveError` (bandeau lignes 418 à 423) et `saveSuccess` ; `handleFormChange` lignes 175 à 179 ; `handleSaveProfile` lignes 181 à 228 (catch lignes 217 à 223, le mode modification reste ouvert en cas d'erreur) ; `cancelEdit` lignes 275 à 291 ; champ téléphone lignes 502 à 520 (`id="telephone"`, `disabled={!editing}`, placeholder « Non renseigné ») ; bouton « Modifier » (ligne 401) ouvre le mode modification ; bouton d'envoi « Enregistrer » (ligne 617). Fichier propre au lint. La ligne 385 contient un tiret cadratin préexistant : ne pas y toucher.
- `src/components/modals/UserModal.tsx` : modale utilisée par `dashboard/membres` (mode `create_membre`, appelle `createMembre` de `@/lib/api_structure`) et `dashboard/utilisateurs` (modes `create_admin_user` avec `createUser` de `@/lib/api_admin`, et `create_super_admin` avec `createSuperAdmin` de `@/lib/api_structure`). État `error` en bandeau (lignes 137 à 141), catch lignes 103 à 105 (`err.message` de toute `Error`, sinon « Une erreur est survenue. »). Champ téléphone lignes 182 à 185, libellé sans `htmlFor` et input sans `id`. Classe des champs : constante `cls` (ligne 110). Lint actuel : 4 avertissements (imports inutilisés `Stethoscope`, `Pill`, `ApiAdminError`, `ApiStructureError`).
- Tests : Vitest + Testing Library + jest-dom (`vitest.setup.ts`), environnement jsdom, alias `@/`. Exemple de mocks : `src/app/dashboard/appareils/page.test.tsx` (`vi.hoisted` + `vi.mock`). `next/link` se rend sans mock.

### Changement 1 : nouveau fichier `src/lib/erreur_telephone.ts`

Module pur, sans React. Contenu attendu (commentaires en français) :

```ts
/**
 * Erreurs du champ téléphone renvoyées par le serveur : numéro déjà pris par un
 * autre compte (TB17) ou numéro refusé par la validation.
 * Utilisé par l'inscription, le profil et la création d'utilisateur (UserModal).
 */
import { ApiError } from "./api_auth";

export const MSG_TELEPHONE_DEJA_UTILISE = "Ce numéro est déjà utilisé par un autre compte.";
export const MSG_TELEPHONE_INVALIDE = "Ce numéro de téléphone n'est pas valide.";
export const AIDE_TELEPHONE = "Exemple : 620 00 00 00";

const CHAMP_TELEPHONE = "telephone";

/** Noms des champs refusés par la validation du serveur (`details.champs`). */
function champsRefuses(details?: Record<string, unknown>): string[] {
  const champs = details?.champs;
  if (!Array.isArray(champs)) return [];
  return champs
    .map((c) => (c && typeof c === "object" ? (c as { champ?: unknown }).champ : undefined))
    .filter((c): c is string => typeof c === "string");
}

/** Message à afficher sous le champ téléphone, ou null si l'erreur ne le concerne pas. */
export function messageErreurTelephone(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null;
  const code = err.details?.code;
  if (code === "TELEPHONE_DEJA_UTILISE") return MSG_TELEPHONE_DEJA_UTILISE;
  if (code === "VALIDATION" && champsRefuses(err.details).includes(CHAMP_TELEPHONE)) {
    return MSG_TELEPHONE_INVALIDE;
  }
  return null;
}

/** Vrai si l'erreur ne concerne que le téléphone : le bandeau général est alors inutile. */
export function erreurSeulementTelephone(err: unknown): boolean {
  if (!(err instanceof ApiError) || messageErreurTelephone(err) === null) return false;
  if (err.details?.code === "TELEPHONE_DEJA_UTILISE") return true;
  return champsRefuses(err.details).every((c) => c === CHAMP_TELEPHONE);
}
```

### Motif d'affichage commun (à appliquer dans les 3 formulaires)

Pour un champ d'identifiant `<ID>` (`telephone` pour l'inscription et le profil, `user-telephone` pour UserModal) :
- Nouvel état `const [telephoneError, setTelephoneError] = useState("");`.
- Sous le bloc de l'input (après le `div.relative` quand il existe), dans cet ordre :
  ```tsx
  {telephoneError && (
    <p id="<ID>-erreur" role="alert" className="mt-1.5 text-xs text-emergency-500">{telephoneError}</p>
  )}
  <p id="<ID>-aide" className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{AIDE_TELEPHONE}</p>
  ```
- Sur l'input : `aria-invalid={telephoneError ? true : undefined}` et `aria-describedby={telephoneError ? "<ID>-erreur <ID>-aide" : "<ID>-aide"}`.
- Bordure : quand `telephoneError` est non vide, la partie `border-slate-200 dark:border-slate-700/50` de la classe de l'input est remplacée par `border-emergency-500/50` (le reste de la classe est inchangé). Pour l'inscription et le profil : passer la classe en gabarit `${telephoneError ? "border-emergency-500/50" : "border-slate-200 dark:border-slate-700/50"}` à la place exacte de ces classes. Pour UserModal : ajouter sous `cls` la constante `const clsErreur = cls.replace("border-slate-200 dark:border-slate-700/50", "border-emergency-500/50");` et utiliser `className={telephoneError ? clsErreur : cls}`.
- Dans le `catch` de l'envoi :
  ```ts
  const erreurTel = messageErreurTelephone(err);
  setTelephoneError(erreurTel ?? "");
  if (!(erreurTel && erreurSeulementTelephone(err))) {
    // logique actuelle du bandeau, inchangée
  }
  ```
- Au début de chaque envoi : `setTelephoneError("")` (à côté de l'effacement actuel de l'erreur générale).
- À la saisie dans le champ téléphone : `setTelephoneError("")`.

### Changement 2 : `src/app/auth/register/page.tsx`

- Importer `AIDE_TELEPHONE`, `messageErreurTelephone`, `erreurSeulementTelephone` depuis `@/lib/erreur_telephone`.
- Appliquer le motif commun avec `<ID>` = `telephone`. Dans `handleChange`, ajouter `if (e.target.name === "telephone" && telephoneError) setTelephoneError("");`. Dans `handleSubmit`, `setTelephoneError("")` juste après le `setError("")` du début. Le `catch` garde son code actuel (ApiError : `err.message`, sinon « Impossible de créer le compte. Vérifiez votre connexion. ») à l'intérieur du `if` du motif.
- Placeholder du champ : `620 00 00 00` (au lieu de `+224 622 123 456`). Le libellé « Téléphone (optionnel) » est inchangé.
- Rien d'autre ne change (validation des mots de passe, bandeau, redirection).

### Changement 3 : `src/app/dashboard/profil/page.tsx`

- Importer les mêmes trois éléments depuis `@/lib/erreur_telephone`.
- Appliquer le motif commun avec `<ID>` = `telephone`, avec une seule différence : le paragraphe d'aide n'est rendu que si `editing` est vrai (`{editing && <p id="telephone-aide" ...>}`), et `aria-describedby` vaut `"telephone-erreur telephone-aide"` si erreur, `"telephone-aide"` si `editing` sans erreur, `undefined` sinon.
- `handleFormChange` : ajouter `if (e.target.name === "telephone" && telephoneError) setTelephoneError("");`. `handleSaveProfile` : `setTelephoneError("")` à côté de `setSaveError("")` au début. Le `catch` (lignes 217 à 223) garde son code actuel à l'intérieur du `if` du motif, avec `setSaveError`. `cancelEdit` : ajouter `setTelephoneError("")`.
- Placeholder « Non renseigné » inchangé. Ne pas modifier l'envoi du téléphone (y compris la valeur vide, D18), ni la carte Sécurité.

### Changement 4 : `src/components/modals/UserModal.tsx`

- Supprimer les imports inutilisés `Stethoscope`, `Pill`, `ApiError as ApiAdminError`, `ApiError as ApiStructureError` (les lignes d'import gardent le reste : `createUser` ; `createMembre, createSuperAdmin, MembreRole`).
- Importer les trois éléments depuis `@/lib/erreur_telephone`.
- Champ téléphone : libellé `<label htmlFor="user-telephone" ...>Téléphone</label>`, input `id="user-telephone"`, placeholder `620 00 00 00` (au lieu de `+224 622...`), motif commun avec `<ID>` = `user-telephone`, `onChange` qui met à jour `form.telephone` et appelle `setTelephoneError("")`.
- `submit` : `setTelephoneError("")` à côté du `setError("")` existant (ligne 80) ; le `catch` garde `setError((err instanceof Error && err.message) || "Une erreur est survenue.")` à l'intérieur du `if` du motif.
- Rien d'autre ne change (rôles, spécialité, mot de passe, boutons, titres).

### Changement 5 : tests Vitest (4 nouveaux fichiers)

1. `src/lib/erreur_telephone.test.ts` : construire les erreurs avec `new ApiError(message, status, corps)` de `@/lib/api_auth`. Cas :
   - 409 `{ code: "TELEPHONE_DEJA_UTILISE" }` : message `MSG_TELEPHONE_DEJA_UTILISE`, seulement téléphone vrai.
   - 400 `{ code: "VALIDATION", champs: [{ champ: "telephone", contraintes: ["isPhoneNumber"] }] }` : `MSG_TELEPHONE_INVALIDE`, seulement téléphone vrai.
   - 400 VALIDATION avec champs `telephone` et `email` : `MSG_TELEPHONE_INVALIDE`, seulement téléphone faux.
   - 400 VALIDATION avec seulement `email` : null, faux.
   - 400 VALIDATION sans `champs` : null, faux.
   - 409 sans code (« Cette information existe déjà. ») : null, faux.
   - `new Error("x")` et `undefined` : null, faux.
2. `src/app/auth/register/page.test.tsx` : mocks `next/navigation` (`useRouter: () => ({ push })`), `@/hooks/useAuth` (`useAuth: () => ({ loginUser })`), `@/lib/api_auth` partiel (`vi.mock("@/lib/api_auth", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/api_auth")>()), register }))`, `register` créé par `vi.hoisted`). Remplir Nom, Prénom, Adresse email, Téléphone (`getByLabelText(/Téléphone/)`), Mot de passe et Confirmer le mot de passe (`Motdepasse1`) avec `fireEvent.change`, puis `fireEvent.submit(bouton « Créer mon compte ».closest("form"))`. Cas :
   - l'aide « Exemple : 620 00 00 00 » est affichée dès le rendu ;
   - `register` rejette 409 TELEPHONE_DEJA_UTILISE : le texte « Ce numéro est déjà utilisé par un autre compte. » apparaît une seule fois (`getAllByText` de longueur 1), dans l'élément `#telephone-erreur` ; l'input a `aria-invalid="true"` et `aria-describedby` contient `telephone-erreur` ; `push` n'est pas appelé ;
   - `register` rejette 400 VALIDATION avec champs `telephone` : « Ce numéro de téléphone n'est pas valide. » sous le champ, pas de texte du bandeau générique ;
   - `register` rejette 409 sans code avec le message « Un compte existe déjà avec cet email. » : ce message s'affiche (bandeau) et `#telephone-erreur` n'existe pas ;
   - après une erreur téléphone, une saisie dans le champ téléphone fait disparaître le message.
3. `src/app/dashboard/profil/page.test.tsx` : mocks `@/hooks/useAuth` (`useAuth: () => ({ user: { id: "u1", nom: "Diallo", prenom: "Mamadou", email: "m@exemple.com", role: "PATIENT" }, profile: { id: "u1", nom: "Diallo", prenom: "Mamadou", email: "m@exemple.com", role: "PATIENT", telephone: "620000001", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }, refreshProfile })`), `@/lib/api_auth` partiel (`updateProfile`, `changePassword`, `setMyAvatar`, `removeMyAvatar` en `vi.fn`), `@/components/FileUpload` et `@/components/ImageWithFallback` (`default: () => null`). Ajouter au profil mocké tout autre champ dont l'absence ferait planter le rendu. Cas :
   - clic sur « Modifier » : l'aide « Exemple : 620 00 00 00 » apparaît (absente avant le clic) ;
   - téléphone changé en `620000002`, `updateProfile` rejette 409 TELEPHONE_DEJA_UTILISE, `fireEvent.submit` du formulaire : le message apparaît une seule fois dans `#telephone-erreur`, le champ reste modifiable (non `disabled`) ;
   - `updateProfile` rejette 400 VALIDATION avec champs `email` uniquement et le message générique du back : le message générique s'affiche, `#telephone-erreur` n'existe pas.
4. `src/components/modals/UserModal.test.tsx` : mocks `@/lib/api_admin` (`{ createUser }`), `@/lib/api_structure` (`{ createMembre, createSuperAdmin }`), fonctions par `vi.hoisted`. Remplir par placeholder (« Mamadou », « Diallo », « exemple@email.com », « Min. 8 caractères » si le mode a un mot de passe) et `getByLabelText("Téléphone")`, puis `fireEvent.submit` du formulaire. Cas :
   - mode `create_admin_user`, `createUser` rejette 409 TELEPHONE_DEJA_UTILISE : message une seule fois dans `#user-telephone-erreur`, `onSuccess` et `onClose` non appelés ;
   - mode `create_membre` (`structureId="s1"`, `structureType="HOPITAL"`), `createMembre` rejette 400 VALIDATION avec champs `telephone` : « Ce numéro de téléphone n'est pas valide. » sous le champ ;
   - mode `create_super_admin`, `createSuperAdmin` rejette 409 sans code avec « Un compte existe déjà avec cet email. » : le bandeau montre ce message, `#user-telephone-erreur` n'existe pas.

Chaque fichier de test : `afterEach(cleanup)`, `beforeEach(vi.clearAllMocks)`, `console.warn` neutralisé comme dans l'exemple si besoin. Noms des `describe` et `it` en français.

## Contraintes

Faire uniquement ce qui est demandé : pas de refactors, helpers ou abstractions non demandés. Discipline de code dans l'ordre : réutiliser l'existant > ranger au bon endroit > n'abstraire qu'à la règle de trois. Règles d'audience, visuelles, typographiques et de langue : docs/ORCHESTRATOR.md. Ne pas modifier docs/plans/. Écrire les fichiers uniquement avec Write et Edit, jamais par redirection shell : le hook de garde ne voit pas les écritures faites par Bash.

Spécifiques :
- Ne modifier QUE ces 8 fichiers : `src/lib/erreur_telephone.ts`, `src/lib/erreur_telephone.test.ts`, `src/app/auth/register/page.tsx`, `src/app/auth/register/page.test.tsx`, `src/app/dashboard/profil/page.tsx`, `src/app/dashboard/profil/page.test.tsx`, `src/components/modals/UserModal.tsx`, `src/components/modals/UserModal.test.tsx`. Le back n'est pas touché.
- Textes visibles exactement ceux de la spec, en français, sans tiret cadratin ni demi-cadratin dans les lignes ajoutées ou modifiées. Aucun terme interdit visible (token, API, requête, serveur, session, ID, etc.).
- Aucune validation ni transformation du numéro côté web (D18).

## Done when

Depuis `D:\souleymane\perso-archive-20260923\perso\medconnecte` :
1. `docker compose exec -T frontend npx tsc --noEmit` : 0 erreur.
2. `docker compose exec -T frontend npx eslint src/lib/erreur_telephone.ts src/lib/erreur_telephone.test.ts src/app/auth/register/page.tsx src/app/auth/register/page.test.tsx src/app/dashboard/profil/page.tsx src/app/dashboard/profil/page.test.tsx src/components/modals/UserModal.tsx src/components/modals/UserModal.test.tsx` : 0 problème (ni erreur ni avertissement).
3. `docker compose exec -T frontend npx vitest run` : tous les tests passent, dont les 4 nouveaux fichiers avec tous les cas listés au changement 5.
4. `git -C front_medconnect status --short -- src` ne montre que les 8 fichiers listés ; en Git Bash, `git -C front_medconnect diff -U0 -- src | grep -E '^\+' | LC_ALL=C.UTF-8 grep -P '[\x{2013}\x{2014}]'` et `LC_ALL=C.UTF-8 grep -P '[\x{2013}\x{2014}]' front_medconnect/src/lib/erreur_telephone*.ts front_medconnect/src/app/auth/register/page.test.tsx front_medconnect/src/app/dashboard/profil/page.test.tsx front_medconnect/src/components/modals/UserModal.test.tsx` ne renvoient rien.
5. `grep -c "Exemple : 620 00 00 00" front_medconnect/src/lib/erreur_telephone.ts` vaut 1 et le texte n'est écrit en dur dans aucun des 3 composants (ils importent `AIDE_TELEPHONE`).

## Return

Chemin de l'artefact + preuve (commande lancée, résultat en une ligne). Ou un bloc BLOCKED. Pas de prose.

## Historique

<!-- une ligne par tentative : AAAA-MM-JJ | tier | résultat | raison si échec -->

## Validation

<!-- commande relancée par l'orchestrateur | résultat en une ligne | hash du commit -->
