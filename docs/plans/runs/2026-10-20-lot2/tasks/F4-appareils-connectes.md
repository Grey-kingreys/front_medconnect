# F4 - Mes appareils connectés, déconnexion à distance et déconnexion forcée

Tier: spécifié (agent implementeur-specifie)
Audience: non-dev (dashboard de tous les rôles, page de connexion)
Visuel: préventif (reprendre les cartes, lignes et boutons existants du profil, tokens existants, clair et sombre ; aucun nouveau design)
Background-safe: non, car docker compose exec (typage, lint et tests dans le conteneur frontend)

## Spec

Dépôt : `D:\souleymane\perso-archive-20260923\perso\medconnecte\front_medconnect`, branche `orch/lot2-front` (arbre principal, ne pas changer de branche, ne pas committer). Le back (`back_medconnect`) ne doit PAS être modifié. Décisions du run : `docs/plans/runs/2026-10-20-lot2/decisions.md` (D01 à D11), déjà tranchées, ne pas les rediscuter.

But (plan mobile, ligne 1020) : la page web « Mes appareils connectés » est le seul recours si le téléphone est perdu. L'utilisateur voit où son compte est ouvert, déconnecte un appareil ou tous les autres, et l'appareil déconnecté (ou un compte désactivé) est renvoyé proprement vers la page de connexion avec un message humain.

### Contexte (déjà vérifié par le chef d'équipe, ne pas re-chercher)

Contrat du back (branche `orch/lot1-back`, livré) :
- `GET /auth/sessions` (jeton requis) : `{ data: AppareilBack[], message, success }`, l'appareil courant en tête. Chaque élément : `{ id: string; type: "web" | "mobile"; nom: string; plateforme: string; versionApp: string | null; creeLe: string; derniereActivite: string; expireLe: string; appareilCourant: boolean }`. `nom` est déjà lisible (« Chrome sur Windows », « Téléphone Android », « iPhone », « Navigateur web »). `plateforme` vaut `"web"`, `"ios"`, `"android"` ou `"inconnue"`. Liste vide si la fonction est désactivée côté serveur.
- `DELETE /auth/sessions/:id` : `{ data: { id }, message: "Appareil déconnecté.", success: true }` ; 404 avec message « Cet appareil est introuvable ou déjà déconnecté. » si inconnu, déjà déconnecté ou d'un autre utilisateur.
- `POST /auth/sessions/revoquer-autres` : `{ data: { nombre: number }, message: "Vos autres appareils ont été déconnectés." | "Aucun autre appareil n'était connecté.", success: true }`.
- `POST /auth/change-password` : corps `{ currentPassword, newPassword, deconnecterAutresAppareils?: boolean }` (vrai par défaut côté back) ; réponse `{ data: { appareilsDeconnectes: number }, message: "Mot de passe modifié. Vos autres appareils ont été déconnectés." | "Mot de passe modifié avec succès", success: true }`.
- Toute requête authentifiée d'une session révoquée reçoit un 401 dont le corps porte `code` : `"SESSION_REVOQUEE"` ou `"COMPTE_DESACTIVE"` (corps `{ statusCode, message, error, code }`). `POST /auth/refresh` peut renvoyer 401 avec `code` `"SESSION_EXPIREE"`, `"SESSION_REVOQUEE"`, `"REFRESH_REUTILISE"` ou `"COMPTE_DESACTIVE"`.
- Événement en direct `sessionRevoquee` `{ code, message }` (code `SESSION_REVOQUEE` ou `COMPTE_DESACTIVE`, parfois `SESSION_EXPIREE`), émis sur la connexion en direct de la session visée juste avant sa coupure.

Côté front :
- `src/lib/api_auth.ts` : `apiFetch` lève `ApiError(message, status, details)` où `details` est le corps d'erreur (donc `details.code`). `avecRafraichissement` (lignes 215 à 260) tente `/auth/refresh` sur tout 401, puis nettoie le stockage local et lève « Vous avez été déconnecté. Reconnectez-vous pour continuer. ». `refreshAccessToken` (lignes 525 à 541) est utilisé par `useAuth` (vérification initiale et renouvellement toutes les 12 min). `changePassword` (lignes 508 à 513) n'envoie pas l'option. Fichier propre au lint.
- `src/hooks/useAuth.tsx` : `AuthProvider` (monté dans `src/app/layout.tsx`), `supprimerCookieConnecte()` local, `router.push`. Fichier propre au lint (directive globale existante).
- Connexions en direct existantes : `src/components/EmergencyListener.tsx` (effet lignes 82 à 100, `newSocket`) et `src/app/dashboard/chat/page.tsx` (effet lignes 33 à 47, `newSocket`).
- `src/components/modals/DeleteConfirmModal.tsx` : modale de confirmation accessible (`useDialogA11y`), icône `Trash2` et libellé « Suppression... » en dur. Utilisée par catalogue, stock et utilisateurs.
- `src/hooks/useToast.tsx` : `useToast().notifier(message, "succes" | "erreur" | "info")`, `messageErreurPour(err, texteParDefaut)` ; hors fournisseur, repli sur `console.warn`.
- `src/app/dashboard/profil/page.tsx` : carte « Sécurité » (lignes 618 à 799) avec ligne « Mot de passe » et formulaire de changement. Bug actuel : en cas de succès le formulaire se referme et le message de succès (rendu dans le formulaire) n'est jamais vu. Lint actuel du fichier : 2 erreurs (ligne 133 `react-hooks/set-state-in-effect`, ligne 183 `no-explicit-any`) et 1 avertissement (ligne 11 `UserProfile` inutilisé). La ligne 385 contient un tiret cadratin préexistant : ne pas y toucher.
- `src/app/auth/login/page.tsx` : bloc d'erreur lignes 58 à 63 (classes à réutiliser).
- Lint actuel : `EmergencyListener.tsx` 3 avertissements (directive des lignes 1 et 2 en double de celle des lignes 4 et 5, `useCallback` et `Phone` inutilisés) ; `chat/page.tsx` 5 avertissements (`useCallback`, `startConversation`, `Phone`, `AlertCircle`, `Menu` inutilisés). Tous les autres fichiers touchés sont propres.
- Les tests de `src/app/dashboard/page.test.tsx` montrent que `next/link` se rend sans mock dans Vitest.

### Changement 1 : nouveau fichier `src/lib/deconnexion_forcee.ts`

Module sans React, SANS import de `./api_auth` (éviter l'import circulaire). Contenu attendu (commentaires en français) :

```ts
/**
 * Déconnexion forcée : appareil déconnecté à distance ou compte désactivé.
 * Déclencheurs : 401 avec code (api_auth), événement en direct « sessionRevoquee ».
 * Effet : nettoyage local, motif gardé pour la page de connexion, AuthProvider prévenu.
 */

export type MotifDeconnexion = "SESSION_REVOQUEE" | "COMPTE_DESACTIVE";

export const MESSAGES_DECONNEXION: Record<MotifDeconnexion, string> = {
  SESSION_REVOQUEE: "Vous avez été déconnecté de cet appareil.",
  COMPTE_DESACTIVE: "Votre compte a été désactivé. Contactez votre structure.",
};

/** Nom de l'événement window écouté par AuthProvider. */
export const EVENEMENT_DECONNEXION_FORCEE = "mc:deconnexion-forcee";

export interface DetailDeconnexionForcee {
  motif: MotifDeconnexion;
}

const CLE_MOTIF = "mc_motif_deconnexion";

/** Code reçu du serveur vers un motif ; null si le code ne force pas la déconnexion. */
export function motifDepuisCode(code: unknown): MotifDeconnexion | null {
  if (code === "COMPTE_DESACTIVE") return "COMPTE_DESACTIVE";
  if (code === "SESSION_REVOQUEE" || code === "REFRESH_REUTILISE") return "SESSION_REVOQUEE";
  return null;
}

/** Motif d'une réponse en erreur : seulement pour un 401 portant un code connu. */
export function motifDepuisReponse(status: number, details?: Record<string, unknown>): MotifDeconnexion | null {
  return status === 401 ? motifDepuisCode(details?.code) : null;
}

function nettoyerConnexionLocale(): void {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user");
  // Cookie témoin lu par src/proxy.ts (voir useAuth.tsx)
  document.cookie = "mc_connecte=; path=/; max-age=0; SameSite=Lax";
}

export function deconnexionForcee(motif: MotifDeconnexion): void {
  if (typeof window === "undefined") return;
  nettoyerConnexionLocale();
  try {
    sessionStorage.setItem(CLE_MOTIF, motif);
  } catch {
    // Stockage indisponible : la redirection se fait quand même, sans message
  }
  window.dispatchEvent(
    new CustomEvent<DetailDeconnexionForcee>(EVENEMENT_DECONNEXION_FORCEE, { detail: { motif } }),
  );
}

/** Lit puis efface le motif gardé pour la page de connexion. */
export function lireEtEffacerMotif(): MotifDeconnexion | null {
  if (typeof window === "undefined") return null;
  try {
    const valeur = sessionStorage.getItem(CLE_MOTIF);
    sessionStorage.removeItem(CLE_MOTIF);
    return valeur === "SESSION_REVOQUEE" || valeur === "COMPTE_DESACTIVE" ? valeur : null;
  } catch {
    return null;
  }
}

/** Gestionnaire de l'événement en direct « sessionRevoquee » ({ code, message }). */
export function gererSessionRevoquee(donnees: unknown): void {
  const code = donnees && typeof donnees === "object" ? (donnees as { code?: unknown }).code : undefined;
  deconnexionForcee(motifDepuisCode(code) ?? "SESSION_REVOQUEE");
}
```

### Changement 2 : `src/lib/api_auth.ts`

1. Ajouter en tête des imports : `import { deconnexionForcee, motifDepuisReponse, MESSAGES_DECONNEXION, type MotifDeconnexion } from "./deconnexion_forcee";`
2. Ajouter, juste avant `avecRafraichissement` :
   ```ts
   /** Déconnexion forcée (appareil déconnecté ou compte désactivé) : prévient l'application et renvoie l'erreur à lever. */
   function arreterConnexion(motif: MotifDeconnexion, details?: Record<string, unknown>): ApiError {
     deconnexionForcee(motif);
     return new ApiError(MESSAGES_DECONNEXION[motif], 401, details);
   }
   ```
3. `avecRafraichissement` : dans `if (err instanceof ApiError && err.status === 401) {`, AVANT le `try` du rafraîchissement :
   ```ts
   // Appareil déconnecté ou compte désactivé : inutile de rafraîchir la connexion
   const motifImmediat = motifDepuisReponse(err.status, err.details);
   if (motifImmediat) throw arreterConnexion(motifImmediat, err.details);
   ```
   Le `catch {` du rafraîchissement devient `catch (errRafraichissement) {` ; juste après `refreshPromise = null;` ajouter :
   ```ts
   if (errRafraichissement instanceof ApiError) {
     const motif = motifDepuisReponse(errRafraichissement.status, errRafraichissement.details);
     if (motif) throw arreterConnexion(motif, errRafraichissement.details);
   }
   ```
   Le reste du bloc (nettoyage existant et `throw new ApiError("Vous avez été déconnecté. Reconnectez-vous pour continuer.", 401)`) est inchangé.
4. `refreshAccessToken` : dans son `catch (err)`, après `refreshPromise = null;` et avant `throw err;`, ajouter le même bloc (`if (err instanceof ApiError) { const motif = motifDepuisReponse(err.status, err.details); if (motif) throw arreterConnexion(motif, err.details); }`).
5. `changePassword` devient :
   ```ts
   /**
    * Changer le mot de passe de l'utilisateur connecté ; `deconnecterAutresAppareils`
    * déconnecte aussi les autres appareils du compte (vrai par défaut côté serveur).
    */
   export async function changePassword(currentPassword: string, newPassword: string, deconnecterAutresAppareils: boolean) {
     return authFetch<{ appareilsDeconnectes: number }>("/auth/change-password", {
       method: "POST",
       body: JSON.stringify({ currentPassword, newPassword, deconnecterAutresAppareils }),
     });
   }
   ```
   Rien d'autre ne change dans ce fichier.

### Changement 3 : nouveau fichier `src/lib/api_appareils.ts`

```ts
/**
 * Appareils connectés au compte (un appareil = une connexion ouverte).
 */
import { authFetch } from "./api_auth";

export interface AppareilConnecte {
  id: string;
  type: "web" | "mobile";
  /** Nom lisible fourni par le serveur (« Chrome sur Windows », « iPhone ») */
  nom: string;
  /** "web", "ios", "android" ou "inconnue" */
  plateforme: string;
  versionApp: string | null;
  creeLe: string;
  derniereActivite: string;
  expireLe: string;
  /** Vrai pour l'appareil qui fait la demande */
  appareilCourant: boolean;
}

export async function getAppareilsConnectes() {
  return authFetch<AppareilConnecte[]>("/auth/sessions");
}

export async function deconnecterAppareil(id: string) {
  return authFetch<{ id: string }>(`/auth/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function deconnecterAutresAppareils() {
  return authFetch<{ nombre: number }>("/auth/sessions/revoquer-autres", { method: "POST" });
}
```

### Changement 4 : `src/hooks/useAuth.tsx`

1. Import : `import { EVENEMENT_DECONNEXION_FORCEE } from "@/lib/deconnexion_forcee";`
2. Dans `AuthProvider`, juste après la définition de `handleLogout` :
   ```tsx
   // ── Déconnexion forcée (appareil déconnecté à distance, compte désactivé) ──
   // Le stockage est déjà vidé par deconnexionForcee : on vide l'état et on ouvre la connexion
   useEffect(() => {
     const surDeconnexionForcee = () => {
       supprimerCookieConnecte();
       setUser(null);
       setProfile(null);
       router.push("/auth/login");
     };
     window.addEventListener(EVENEMENT_DECONNEXION_FORCEE, surDeconnexionForcee);
     return () => window.removeEventListener(EVENEMENT_DECONNEXION_FORCEE, surDeconnexionForcee);
   }, [router]);
   ```
   Rien d'autre ne change.

### Changement 5 : connexions en direct existantes

- `src/components/EmergencyListener.tsx` : importer `import { gererSessionRevoquee } from "@/lib/deconnexion_forcee";`. Dans l'effet d'initialisation, juste après la création de `newSocket` (avant `setSocket(newSocket)`) : `newSocket.on("sessionRevoquee", gererSessionRevoquee);` ; dans son nettoyage, avant `newSocket.disconnect();` : `newSocket.off("sessionRevoquee", gererSessionRevoquee);`. Lint : supprimer les lignes 1 et 2 (commentaire et directive en double) en gardant les lignes 4 et 5 ; retirer `useCallback` de l'import react et `Phone` de l'import lucide-react. Si eslint signale encore « Unused eslint-disable directive » pour certaines règles de la directive restante, retirer exactement ces règles de la liste (et la ligne entière si toutes le sont).
- `src/app/dashboard/chat/page.tsx` : même import, même `newSocket.on("sessionRevoquee", gererSessionRevoquee);` avant `setSocket(newSocket)` et même `newSocket.off(...)` avant `newSocket.disconnect();`. Lint : retirer `useCallback` (import react), `startConversation` (import api_chat), `Phone`, `AlertCircle`, `Menu` (import lucide-react). Rien d'autre.

### Changement 6 : `src/components/modals/DeleteConfirmModal.tsx`

Ajouter deux props optionnelles, valeurs par défaut = comportement actuel (les 3 usages existants ne changent pas) :
- `icone?: LucideIcon` (import `type LucideIcon` depuis lucide-react), défaut `Trash2`. Dans le composant : `const Icone = icone ?? Trash2;` (ou paramètre déstructuré `icone: Icone = Trash2`), utilisé à la place des deux `<Trash2 ... />` (même `className`).
- `libelleEnCours?: string`, défaut `"Suppression..."`, utilisé à la place du texte `"Suppression..."` du bouton.

### Changement 7 : nouveau fichier `src/app/dashboard/appareils/affichage.ts`

Fonctions pures, sans React :

```ts
import type { AppareilConnecte } from "@/lib/api_appareils";

/** Libellé de la plateforme (D10). */
export function libellePlateforme(appareil: Pick<AppareilConnecte, "type" | "plateforme">): string
// type "web" → "Navigateur web" ; plateforme "ios" → "Application iPhone" ;
// "android" → "Application Android" ; sinon → "Application mobile"

/** Dernière activité en langage simple (D09), sans majuscule initiale (affiché après « Dernière activité : »). */
export function formaterDerniereActivite(iso: string, maintenant: Date = new Date()): string
```

Règles de `formaterDerniereActivite`, dans cet ordre (`date = new Date(iso)`, `ecartMs = maintenant.getTime() - date.getTime()`) :
1. date invalide (`Number.isNaN(date.getTime())`) : `"inconnue"` ;
2. `ecartMs < 60_000` (y compris négatif) : `"à l'instant"` ;
3. `ecartMs < 3_600_000` : `n = Math.floor(ecartMs / 60_000)`, `"il y a 1 minute"` si n vaut 1, sinon `` `il y a ${n} minutes` `` ;
4. écart en jours calendaires locaux `jours = Math.round((debutDuJour(maintenant) - debutDuJour(date)) / 86_400_000)` où `debutDuJour(d) = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()` ; heure `hh = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })` :
   - `jours === 0` : `` `aujourd'hui à ${hh}` `` ;
   - `jours === 1` : `` `hier à ${hh}` `` ;
   - `jours < 7` : `` `il y a ${jours} jours` `` ;
   - sinon : `` `le ${date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}` ``.

### Changement 8 : nouveau fichier `src/app/dashboard/appareils/page.tsx`

Page client (`"use client"`, export par défaut `MesAppareilsPage`). Aucun `any`. Même mise en page que `src/app/dashboard/profil/page.tsx` (reprendre ses classes telles quelles) :
- Conteneur : `<div className="max-w-4xl mx-auto space-y-8 animate-fade-in">`.
- En-tête : lien `<Link href="/dashboard/profil">` avec icône `ArrowLeft` (w-4 h-4) et texte « Retour à mon profil », classes `inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors` ; puis le `<h1>` aux classes et au style du titre du profil, texte « Mes appareils connectés » ; puis `<p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Retrouvez les téléphones et ordinateurs où votre compte est ouvert. Si vous avez perdu un téléphone, déconnectez-le ici.</p>`.
- Une carte (classes de la carte « Sécurité » : `bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-3xl p-6 sm:p-8`), titre `<h2>` aux classes du `<h3>` « Sécurité » : « Appareils connectés ».

État (chargement indépendant, setState seulement dans les callbacks de promesse, comme `src/app/dashboard/page.tsx`) :

```tsx
type EtatListe =
  | { statut: "chargement" }
  | { statut: "erreur"; message: string }
  | { statut: "pret"; appareils: AppareilConnecte[] };

const [etat, setEtat] = useState<EtatListe>({ statut: "chargement" });
const [essai, setEssai] = useState(0);
const [aDeconnecter, setADeconnecter] = useState<AppareilConnecte | null>(null);
const [confirmerTous, setConfirmerTous] = useState(false);
const { notifier } = useToast();

useEffect(() => {
  let actif = true;
  getAppareilsConnectes()
    .then((res) => { if (actif) setEtat({ statut: "pret", appareils: res.data }); })
    .catch((err: unknown) => {
      if (actif) setEtat({ statut: "erreur", message: messageErreurPour(err, "Impossible d'afficher vos appareils. Vérifiez votre connexion puis réessayez.") });
    });
  return () => { actif = false; };
}, [essai]);

const reessayer = () => { setEtat({ statut: "chargement" }); setEssai((n) => n + 1); };
```

Rendu dans la carte selon `etat.statut` :
- `chargement` : `<div role="status" className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400"><Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />Chargement de vos appareils...</div>`.
- `erreur` : bloc d'erreur du profil (`flex items-center gap-3 p-4 rounded-2xl bg-emergency-500/10 border border-emergency-500/20 text-emergency-500 text-sm`, `role="alert"`, icône `AlertCircle`) avec `etat.message`, puis un bouton « Réessayer » (classes du bouton « Modifier » du profil : `flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-primary-400 bg-primary-500/10 border border-primary-500/20 hover:bg-primary-500/20 transition-all duration-200`, `mt-4`) qui appelle `reessayer`.
- `pret` et liste vide : `<p className="text-sm text-slate-500 dark:text-slate-400">Aucun appareil à afficher pour le moment.</p>` puis le bouton « Actualiser » (mêmes classes que « Réessayer », appelle `reessayer`).
- `pret` et liste non vide : `<ul aria-label="Appareils connectés" className="space-y-4">`, un `<li>` par appareil, dans l'ordre reçu, aux classes de la ligne « Mot de passe » du profil (`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/50`) :
  - à gauche : pastille d'icône du profil (`p-2 rounded-xl bg-slate-800/50 text-slate-500 dark:text-slate-400`) avec `Monitor` si `type === "web"`, sinon `Smartphone` (w-5 h-5, `aria-hidden="true"`) ; puis
    - `<p className="text-sm font-medium text-slate-900 dark:text-white">{appareil.nom}</p>` suivi, si `appareil.appareilCourant`, d'un badge `<span className="ml-2 inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full bg-primary-600 text-white">Cet appareil</span>` (dans le même `<p>` ou un conteneur `flex items-center` ; le texte « Cet appareil » doit être un élément à part) ;
    - si `libellePlateforme(appareil) !== appareil.nom` : `<p className="text-xs text-slate-500">{libellePlateforme(appareil)}</p>` ;
    - `<p className="text-xs text-slate-500">Dernière activité : {formaterDerniereActivite(appareil.derniereActivite)}</p>`.
  - à droite, seulement si `!appareil.appareilCourant` : bouton `type="button"`, `aria-label={`Déconnecter ${appareil.nom}`}`, icône `LogOut` (w-4 h-4) et texte « Déconnecter », classes `self-start sm:self-auto flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-emergency-500 bg-emergency-500/10 border border-emergency-500/20 hover:bg-emergency-500/20 transition-all duration-200`, `onClick={() => setADeconnecter(appareil)}`.
  - Sous la liste : s'il existe au moins un appareil avec `appareilCourant === false`, un bouton « Déconnecter tous mes autres appareils » (icône `LogOut`, mêmes classes que le bouton « Déconnecter » plus `mt-6`), `onClick={() => setConfirmerTous(true)}` ; sinon `<p className="mt-6 text-sm text-slate-500 dark:text-slate-400">Vous n&apos;êtes connecté sur aucun autre appareil.</p>`.

Confirmations (`DeleteConfirmModal`, import nommé depuis `@/components/modals/DeleteConfirmModal`, `icone={LogOut}`, `libelleEnCours="Déconnexion..."`) :
- Un appareil : `isOpen={aDeconnecter !== null}`, `onClose={() => setADeconnecter(null)}`, `title="Déconnecter cet appareil ?"`, `confirmLabel="Déconnecter"`, `description={<>« <strong>{aDeconnecter?.nom}</strong> » sera déconnecté de votre compte. Pour l&apos;utiliser à nouveau, il faudra se reconnecter avec votre mot de passe.</>}` ; `onConfirm` :
  ```tsx
  async () => {
    if (!aDeconnecter) return;
    const cible = aDeconnecter.id;
    const res = await deconnecterAppareil(cible);
    setEtat((prec) => (prec.statut === "pret" ? { statut: "pret", appareils: prec.appareils.filter((a) => a.id !== cible) } : prec));
    notifier(res.message || "Appareil déconnecté.", "succes");
  }
  ```
  (une erreur remonte : la modale affiche son message, déjà rédigé pour l'utilisateur).
- Tous les autres : `isOpen={confirmerTous}`, `onClose={() => setConfirmerTous(false)}`, `title="Déconnecter tous vos autres appareils ?"`, `confirmLabel="Tout déconnecter"`, `description="Tous vos appareils, sauf celui-ci, seront déconnectés. Il faudra se reconnecter avec votre mot de passe sur chacun d'eux."` ; `onConfirm` : `const res = await deconnecterAutresAppareils();` puis `setEtat` qui ne garde que les appareils `appareilCourant` (si `pret`), puis `notifier(res.message || "Vos autres appareils ont été déconnectés.", "succes")`.

Aucun texte visible ne contient : session, jeton, token, serveur, requête, API, ID, code d'erreur.

### Changement 9 : `src/app/dashboard/profil/page.tsx`

1. Lint (D11) : retirer `type UserProfile,` de l'import api_auth ; juste au-dessus de `setForm({` dans l'effet de la ligne 131, ajouter `// Dette préexistante : formulaire recopié depuis le profil chargé` puis `// eslint-disable-next-line react-hooks/set-state-in-effect` ; ligne 183, remplacer `const updateData: Record<string, any> = {};` par `const updateData: Parameters<typeof updateProfile>[0] = {};`.
2. Imports : ajouter `import Link from "next/link";` et les icônes `Smartphone`, `ChevronRight` à l'import lucide-react.
3. État, à côté des autres états du mot de passe (avant le `return null` anticipé) : `const [deconnecterAutres, setDeconnecterAutres] = useState(true);`.
4. `handleSavePassword` : `const res = await changePassword(passwordForm.currentPassword, passwordForm.newPassword, deconnecterAutres);` puis `setPasswordSuccess(res.message || "Mot de passe modifié avec succès !");` ; après la remise à zéro du formulaire, `setDeconnecterAutres(true);`. Le bouton « Annuler » du formulaire remet aussi `setDeconnecterAutres(true)`.
5. Case à cocher dans le formulaire, entre « Confirmer le nouveau mot de passe » et les boutons :
   ```tsx
   <div className="flex items-start gap-3">
     <input
       id="deconnecterAutresAppareils"
       type="checkbox"
       checked={deconnecterAutres}
       onChange={(e) => setDeconnecterAutres(e.target.checked)}
       className="mt-0.5 w-5 h-5 rounded border-slate-300 text-primary-500 focus:ring-primary-500"
     />
     <label htmlFor="deconnecterAutresAppareils" className="text-sm text-slate-600 dark:text-slate-300">
       Déconnecter mes autres appareils
       <span className="block text-xs text-slate-500">Conseillé si vous pensez que quelqu&apos;un d&apos;autre connaît votre mot de passe.</span>
     </label>
   </div>
   ```
6. Carte « Sécurité » : le contenu sous l'en-tête devient `<div className="space-y-4">` contenant :
   - si `!showPasswordForm` : le bloc de succès existant (mêmes classes que celui du formulaire, avec `role="status"`) si `passwordSuccess`, puis la ligne « Mot de passe » existante ; le bouton « Changer » fait `setShowPasswordForm(true); setPasswordSuccess("");` ;
   - sinon : le formulaire existant (inchangé hors points 4 et 5) ;
   - dans les deux cas, en dernier, une ligne « Appareils connectés » aux classes de la ligne « Mot de passe » : pastille d'icône `Smartphone`, `<p className="text-sm font-medium text-slate-900 dark:text-white">Appareils connectés</p>`, `<p className="text-xs text-slate-500">Voyez où votre compte est ouvert et déconnectez un téléphone perdu.</p>`, et à droite `<Link href="/dashboard/appareils" className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-primary-400 bg-primary-500/10 border border-primary-500/20 hover:bg-primary-500/20 transition-all duration-200">Gérer<ChevronRight className="w-4 h-4" aria-hidden="true" /></Link>`.
   Rien d'autre ne change dans ce fichier.

### Changement 10 : `src/app/auth/login/page.tsx`

- Imports : `useEffect` depuis react ; `import { lireEtEffacerMotif, MESSAGES_DECONNEXION, type MotifDeconnexion } from "@/lib/deconnexion_forcee";`.
- État et lecture unique (le `if` garde le message lors du double effet du mode strict) :
  ```tsx
  const [motifDeconnexion, setMotifDeconnexion] = useState<MotifDeconnexion | null>(null);

  // Motif d'une déconnexion forcée, lu après le montage (stockage absent au rendu serveur)
  useEffect(() => {
    const motif = lireEtEffacerMotif();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (motif) setMotifDeconnexion(motif);
  }, []);
  ```
  (si eslint signale la ligne `if`, placer la directive juste au-dessus de la ligne signalée.)
- Juste avant le bloc `{/* Error */}` : `{motifDeconnexion && (<div role="status" className="mb-6 flex items-start gap-3 p-4 rounded-2xl bg-emergency-500/10 border border-emergency-500/20 text-emergency-500 text-sm"><AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden="true" /><span>{MESSAGES_DECONNEXION[motifDeconnexion]}</span></div>)}`.
- Rien d'autre ne change.

### Changement 11 : tests Vitest (textes `describe`/`it` en français, pas de `any`, `afterEach(cleanup)` pour les rendus)

Forme des stubs `fetch` : celle de `src/lib/api_auth.demo.test.ts` (`vi.stubGlobal("fetch", fetchSimule)`, `new Response(JSON.stringify(corps), { status, headers: { "Content-Type": "application/json" } })`), `console.warn` neutralisé par `vi.spyOn`. Réinitialiser `localStorage`, `sessionStorage` et le cookie dans `beforeEach`.

A. Nouveau `src/lib/deconnexion_forcee.test.ts` (un `it` par point) :
1. `motifDepuisCode` : `SESSION_REVOQUEE` et `REFRESH_REUTILISE` donnent `SESSION_REVOQUEE` ; `COMPTE_DESACTIVE` donne `COMPTE_DESACTIVE` ; `SESSION_EXPIREE`, `undefined`, `42` donnent `null`.
2. `motifDepuisReponse` : 401 + `{ code: "COMPTE_DESACTIVE" }` donne `COMPTE_DESACTIVE` ; 403 + même code donne `null` ; 401 sans `details` donne `null`.
3. `deconnexionForcee("SESSION_REVOQUEE")` : `access_token`, `refresh_token` et `user` retirés de localStorage ; `document.cookie` ne contient plus `mc_connecte=1` ; un écouteur de `EVENEMENT_DECONNEXION_FORCEE` reçoit `detail.motif === "SESSION_REVOQUEE"` ; puis `lireEtEffacerMotif()` renvoie `"SESSION_REVOQUEE"` et un second appel renvoie `null`.
4. `lireEtEffacerMotif()` renvoie `null` pour une valeur inconnue rangée sous `mc_motif_deconnexion`.
5. `gererSessionRevoquee({ code: "COMPTE_DESACTIVE", message: "..." })` émet le motif `COMPTE_DESACTIVE` ; `gererSessionRevoquee(undefined)` émet `SESSION_REVOQUEE`.

B. Nouveau `src/lib/api_auth.revocation.test.ts` (`localStorage.setItem("access_token", "jeton-test")` en `beforeEach`, écouteur d'événement enregistré par test et retiré après) :
1. `getMe()` reçoit 401 `{ statusCode: 401, message: "x", code: "SESSION_REVOQUEE" }` : rejet `ApiError` de statut 401 et de message « Vous avez été déconnecté de cet appareil. » ; `fetch` appelé une seule fois (aucun appel à `/auth/refresh`) ; `access_token` retiré ; événement reçu avec `SESSION_REVOQUEE`.
2. `getMe()` reçoit 401 sans `code`, puis `/auth/refresh` reçoit 401 `{ code: "COMPTE_DESACTIVE" }` : message « Votre compte a été désactivé. Contactez votre structure. », `fetch` appelé 2 fois (le 2e sur une URL finissant par `/auth/refresh`), événement `COMPTE_DESACTIVE`.
3. `getMe()` reçoit 401 sans `code`, puis `/auth/refresh` reçoit 401 `{ code: "SESSION_EXPIREE" }` : message inchangé « Vous avez été déconnecté. Reconnectez-vous pour continuer. », aucun événement, `sessionStorage.getItem("mc_motif_deconnexion")` vaut `null`.
4. `refreshAccessToken()` reçoit 401 `{ code: "REFRESH_REUTILISE" }` : rejet, événement `SESSION_REVOQUEE`.
5. `changePassword("Ancien123", "Nouveau123", false)` (réponse 200 `{ data: { appareilsDeconnectes: 0 }, message: "Mot de passe modifié avec succès", success: true }`) : URL finissant par `/auth/change-password`, méthode `POST`, corps JSON égal à `{ currentPassword: "Ancien123", newPassword: "Nouveau123", deconnecterAutresAppareils: false }`, en-tête `Authorization` égal à `Bearer jeton-test`.

C. Nouveau `src/lib/api_appareils.test.ts` (jeton `jeton-test` en localStorage) :
1. `getAppareilsConnectes()` : GET sur une URL finissant par `/auth/sessions`, `Authorization: Bearer jeton-test`, renvoie `data` tel quel.
2. `deconnecterAppareil("a b/1")` : URL finissant par `/auth/sessions/a%20b%2F1`, méthode `DELETE`.
3. `deconnecterAutresAppareils()` : URL finissant par `/auth/sessions/revoquer-autres`, méthode `POST`, `data.nombre` renvoyé.

D. Nouveau `src/app/dashboard/appareils/affichage.test.ts`, `maintenant = new Date(2026, 9, 21, 15, 0, 0)` :
1. `libellePlateforme` : web donne « Navigateur web », mobile ios « Application iPhone », mobile android « Application Android », mobile inconnue « Application mobile ».
2. `formaterDerniereActivite` : il y a 30 s et dans 5 min donnent « à l'instant » ; il y a 1 min « il y a 1 minute » ; il y a 45 min « il y a 45 minutes » ; `new Date(2026, 9, 21, 9, 5)` « aujourd'hui à 09:05 » ; `new Date(2026, 9, 20, 22, 30)` « hier à 22:30 » ; `new Date(2026, 9, 18, 10, 0)` « il y a 3 jours » ; `new Date(2026, 9, 14, 15, 0)` « le 14 octobre 2026 » ; `"pas une date"` « inconnue ». Dates passées en `.toISOString()`.

E. Nouveau `src/app/dashboard/appareils/page.test.tsx` : mock `@/lib/api_appareils` (`getAppareilsConnectes`, `deconnecterAppareil`, `deconnecterAutresAppareils` en `vi.fn()`) ; `console.warn` neutralisé (repli de `useToast`). Jeu : appareil courant `{ id: "a1", type: "web", nom: "Chrome sur Windows", plateforme: "web", appareilCourant: true, derniereActivite: new Date().toISOString(), ... }` et autre appareil `{ id: "a2", type: "mobile", nom: "Téléphone Android", plateforme: "android", appareilCourant: false, ... }`. Cas :
1. Liste : « Chrome sur Windows » et « Téléphone Android » affichés, « Cet appareil » présent une seule fois et dans la ligne de « Chrome sur Windows » (`within(closest("li"))`), « Application Android » affiché, « Dernière activité : à l'instant » présent ; un seul bouton nommé « Déconnecter Téléphone Android » et aucun nommé « Déconnecter Chrome sur Windows » ; bouton « Déconnecter tous mes autres appareils » présent.
2. Un appareil : clic sur « Déconnecter Téléphone Android » ouvre la modale « Déconnecter cet appareil ? » ; clic sur le bouton « Déconnecter » de la modale (`within(screen.getByRole("dialog"))`) appelle `deconnecterAppareil` avec `"a2"` ; ensuite « Téléphone Android » n'est plus affiché et « Vous n'êtes connecté sur aucun autre appareil. » apparaît.
3. Échec de la déconnexion : `deconnecterAppareil` rejette `new ApiError("Cet appareil est introuvable ou déjà déconnecté.", 404)` : ce message s'affiche dans la modale, la ligne « Téléphone Android » reste.
4. Tous les autres : clic sur « Déconnecter tous mes autres appareils », confirmation « Tout déconnecter » : `deconnecterAutresAppareils` appelé une fois, seule « Chrome sur Windows » reste.
5. Erreur de chargement puis réessai : premier `getAppareilsConnectes` rejette `new ApiError("Vous semblez hors connexion. Vérifiez votre connexion internet puis réessayez.", 0)`, le second résout la liste : message affiché, clic sur « Réessayer », la liste apparaît.
6. Seul l'appareil courant : pas de bouton « Déconnecter tous mes autres appareils », texte « Vous n'êtes connecté sur aucun autre appareil. » présent.
7. Liste vide : « Aucun appareil à afficher pour le moment. » et bouton « Actualiser ».

F. Nouveau `src/app/auth/login/page.test.tsx` : mocks `@/hooks/useAuth` (`useTerminerConnexion: () => vi.fn()`), `@/components/ComptesDemo` (`default: () => null`). Cas : `sessionStorage` `mc_motif_deconnexion` = `SESSION_REVOQUEE` : « Vous avez été déconnecté de cet appareil. » affiché et la clé effacée ; `COMPTE_DESACTIVE` : « Votre compte a été désactivé. Contactez votre structure. » affiché ; sans clé : aucun des deux messages.

G. Nouveau `src/app/dashboard/profil/page.test.tsx` : mocks `@/hooks/useAuth` (`useAuth: () => ({ user, profile, refreshProfile: vi.fn() })` avec un profil PATIENT complet : `id`, `email`, `nom`, `prenom`, `role`, `isActive`, `createdAt`, `updatedAt`), `@/components/FileUpload` et `@/components/ImageWithFallback` (`default: () => null`), `@/lib/api_auth` partiel (`vi.mock("@/lib/api_auth", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/api_auth")>()), changePassword: vi.fn() }))`). Cas :
1. Le lien « Gérer » pointe vers `/dashboard/appareils` (`closest("a")` a l'attribut `href` `/dashboard/appareils`).
2. Clic sur « Changer » : la case « Déconnecter mes autres appareils » est cochée ; saisie des 3 champs (`Ancien123`, `Nouveau123`, `Nouveau123`) et envoi : `changePassword` appelé avec `("Ancien123", "Nouveau123", true)` ; le message renvoyé (« Mot de passe modifié. Vos autres appareils ont été déconnectés. ») est visible après fermeture du formulaire.
3. Case décochée avant l'envoi : `changePassword` appelé avec `false` en 3e argument.

H. `src/hooks/useAuth.test.tsx` : ajouter un `it` « déconnexion forcée : vide l'utilisateur et ouvre la page de connexion » : après `terminer(DONNEES)` (comme le test existant), `push.mockReset()`, puis `act(() => { window.dispatchEvent(new CustomEvent(EVENEMENT_DECONNEXION_FORCEE, { detail: { motif: "SESSION_REVOQUEE" } })); })` : `result.current.auth.user` vaut `null` et `push` a été appelé avec `"/auth/login"`.

I. `src/components/EmergencyListener.test.tsx` : ajouter un `it` : pour un utilisateur ayant la permission `sos:respond` (même mise en place que les tests existants), `socketFactice.on` a été appelé avec `"sessionRevoquee"` et `gererSessionRevoquee` (importé de `@/lib/deconnexion_forcee`, non mocké).

## Contraintes

Faire uniquement ce qui est demandé : pas de refactors, helpers ou abstractions non demandés. Discipline de code dans l'ordre : réutiliser l'existant > ranger au bon endroit > n'abstraire qu'à la règle de trois. Règles d'audience, visuelles, typographiques et de langue : docs/ORCHESTRATOR.md. Ne pas modifier docs/plans/. Écrire les fichiers uniquement avec Write et Edit, jamais par redirection shell : le hook de garde ne voit pas les écritures faites par Bash.

Spécifique : ne toucher QUE les 20 fichiers listés dans « Done when » point 4 ; aucun fichier du back ; aucun `any` dans le code ajouté ; aucun tiret cadratin ni demi-cadratin dans les lignes ajoutées ; textes visibles en français, sans les termes interdits de l'audience non-dev ; commentaires et libellés de test en français ; Next.js 16 : lire `node_modules/next/dist/docs/` si un doute porte sur une API Next ; pas de commit.

## Done when

Toutes les commandes lancées depuis `D:\souleymane\perso-archive-20260923\perso\medconnecte` :
1. `docker compose exec -T frontend npx tsc --noEmit` : sortie vide, code 0.
2. `docker compose exec -T frontend npx eslint src/lib/deconnexion_forcee.ts src/lib/deconnexion_forcee.test.ts src/lib/api_auth.ts src/lib/api_auth.revocation.test.ts src/lib/api_appareils.ts src/lib/api_appareils.test.ts src/hooks/useAuth.tsx src/hooks/useAuth.test.tsx src/components/EmergencyListener.tsx src/components/EmergencyListener.test.tsx src/components/modals/DeleteConfirmModal.tsx src/app/dashboard/chat/page.tsx src/app/dashboard/appareils/affichage.ts src/app/dashboard/appareils/affichage.test.ts src/app/dashboard/appareils/page.tsx src/app/dashboard/appareils/page.test.tsx src/app/dashboard/profil/page.tsx src/app/dashboard/profil/page.test.tsx src/app/auth/login/page.tsx src/app/auth/login/page.test.tsx` : 0 erreur, 0 avertissement.
3. `docker compose exec -T frontend npx vitest run` : tous les tests verts, dont ceux des 6 nouveaux fichiers de test (A à G) et les 2 nouveaux `it` (H, I).
4. `git -C front_medconnect status --porcelain -- src` : exactement les 20 fichiers du point 2 (11 nouveaux `??` : deconnexion_forcee.ts et .test.ts, api_auth.revocation.test.ts, api_appareils.ts et .test.ts, le dossier `src/app/dashboard/appareils/` (4 fichiers), `src/app/dashboard/profil/page.test.tsx`, `src/app/auth/login/page.test.tsx` ; 9 modifiés ` M`) ; `git -C back_medconnect status --porcelain` inchangé par rapport à avant la tâche.
5. (Git Bash, préfixe `LC_ALL=C.UTF-8` obligatoire pour `grep -P`) `git -C front_medconnect diff -U0 -- src | LC_ALL=C.UTF-8 grep -P "^\+.*[\x{2013}\x{2014}]"` et `LC_ALL=C.UTF-8 grep -rnP "[\x{2013}\x{2014}]" front_medconnect/src/lib/deconnexion_forcee.ts front_medconnect/src/lib/api_appareils.ts front_medconnect/src/app/dashboard/appareils` : aucun résultat.
6. `grep -niE "session|jeton|token|serveur|requête" front_medconnect/src/app/dashboard/appareils/page.tsx front_medconnect/src/app/dashboard/appareils/affichage.ts` : aucun résultat ; `grep -nE "\bAPI\b|\bID\b" front_medconnect/src/app/dashboard/appareils/page.tsx front_medconnect/src/app/dashboard/appareils/affichage.ts` (sensible à la casse) : aucun résultat ; `grep -n "any" front_medconnect/src/lib/api_appareils.ts front_medconnect/src/lib/deconnexion_forcee.ts front_medconnect/src/app/dashboard/appareils/page.tsx` : aucun résultat.

## Return

Chemin des 20 fichiers + preuve des 6 commandes du « Done when » (commande lancée, résultat en une ligne chacune). Ou un bloc BLOCKED. Pas de prose.

## Historique

<!-- une ligne par tentative : AAAA-MM-JJ | tier | résultat | raison si échec -->

## Validation

<!-- commande relancée par l'orchestrateur | résultat en une ligne | hash du commit -->
