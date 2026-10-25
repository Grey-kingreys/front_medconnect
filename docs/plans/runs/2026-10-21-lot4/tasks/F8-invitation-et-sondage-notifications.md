# F8 - Structure créée sans invitation (avertissement, renvoi, 503 lisible) et un seul sondage des notifications

Tier: spécifié (agent implementeur-specifie)
Audience: non-dev (super administrateur : création de structure et liste des structures ; cloche de notifications de tous les profils)
Visuel: préventif (un seul nouveau bloc d'avertissement dans la fenêtre de création, construit avec les couleurs existantes ; le reste réutilise les éléments déjà en place ; clair et sombre vérifiés)
Background-safe: non, car docker compose exec (typage, lint et tests dans le conteneur frontend)

## Spec

Dépôt : `D:\souleymane\perso-archive-20260923\perso\medconnecte\front_medconnect`, branche `orch/lot4-front` (arbre principal, ne pas changer de branche, ne pas committer). Le back (`back_medconnect`, branche orch/lot4-back en cours) ne doit PAS être modifié. Décisions du run : `docs/plans/runs/2026-10-21-lot4/decisions.md` (D01 à D08), déjà tranchées, ne pas les rediscuter.

Deux défauts vus sur le déploiement de dev, corrigés dans la même tâche :
- A. Le super administrateur crée une structure ; si l'email d'invitation ne part pas, le back répondra `201` avec `invitationEnvoyee: false`, et « Renvoyer l'invitation » répondra `503` avec `code: "EMAIL_INDISPONIBLE"` et un `message` rédigé pour l'utilisateur. L'interface doit montrer la structure comme créée, avec un avertissement et le bouton de renvoi ; en cas de 503, afficher le message du serveur.
- B. `GET /notifications` part deux fois toutes les 30 s depuis le même onglet. Cause (D05) : `src/app/dashboard/layout.tsx` monte DEUX `NotificationBell` (barre latérale bureau l.330 dans un bloc `hidden lg:flex`, en-tête mobile l.525 dans un `header lg:hidden`) ; le CSS en cache une mais les deux sont montées, et chacune lance son propre `setInterval(fetchNotifs, 30000)` (l.107-111). On garde UN seul sondage partagé, suspendu quand l'onglet est caché.

### Contexte (déjà vérifié par le chef d'équipe, ne pas re-chercher)

- `src/lib/api_auth.ts` :
  - `STATUTS_INDISPONIBLES = [502, 503, 504]` (l.89), `MSG_INDISPONIBLE` (l.93).
  - `envoyer` (l.121-177) : boucle de tentatives ; l.154-155 `if (!STATUTS_INDISPONIBLES.includes(res.status)) return res; derniereErreur = new ApiError(MSG_INDISPONIBLE, res.status);`. Conséquence actuelle : TOUT 503, même avec un corps rédigé par le serveur, devient « Le service est momentanément indisponible... » sans `details`. Le message `EMAIL_INDISPONIBLE` serait donc perdu : à corriger (changement 1).
  - `apiFetch` (l.179-206) : lit le corps, et si `!res.ok` lève `new ApiError(messageErreur(body), res.status, body)` (le corps devient `details`, donc `details.code` est lisible).
  - `ApiError` (l.332-342) : `message`, `status`, `details?`.
  - `ApiResponse<T>` (l.14-18) : `{ data: T; message: string; success: boolean }`.
- `src/hooks/useToast.tsx` exporte `messageErreurPour(err, texteParDefaut)` : message de l'`ApiError` sinon le texte fourni. À réutiliser, ne pas recréer.
- `src/lib/api_admin.ts` : `createStructure` (l.110-115) renvoie `authFetch<Structure>` ; `resendStructureInvitation(id)` (l.124-129) `authFetch<null>`, POST. Le back actuel (lecture seule, `super-admin.service.ts`) renvoie pour la création `{ data: { id, nom, type, email, isConfigured, createdAt }, message, success }`. Lint actuel : 3 avertissements d'imports inutilisés l.10 (`ApiError`, `ApiResponse`, `apiFetch`), 0 erreur.
- `src/components/modals/StructureModal.tsx` : seule fenêtre de création utilisée (`CreateStructureModal.tsx` n'a aucun appelant, ne pas le toucher, D08). `submit` (l.67-107) : en mode `create`, `await createStructure({...})` puis `onSuccess?.(); onClose();`, erreur affichée par `setError(err instanceof ApiError ? err.message : "Une erreur est survenue")` dans le bloc l.133-138. Sous-titre l.124-126 « Un email d'invitation sera envoyé automatiquement ». Bandeau d'information l.289-294 (icône `Mail`). Pied l.296-315 : en création, boutons « Annuler » et « Créer et inviter ». Lint actuel : 3 avertissements d'imports inutilisés (`MyStructure`, `UpdateStructurePayload` l.4, `MapPin` l.8), 0 erreur. Le fichier n'a pas de `"use client"` (importé seulement par des pages client) : ne pas en ajouter.
- `src/app/dashboard/structures/page.tsx` (liste des structures du super administrateur) : `showToast(msg, ok)` local (l.73-76) avec son propre affichage l.148-160 (le garder, ne pas migrer vers useToast) ; `fetchData` (l.78-89) ; `handleResend` (l.108-118) : succès `Invitation renvoyée à ${s.email}`, échec `showToast("Erreur lors de l'envoi", false)` (message générique, à remplacer) ; bouton de renvoi visible si `!s.isConfigured` (l.410-425) ; création : `<StructureModal mode="create" onClose=... onSuccess={fetchData} />` (l.518-524). La fenêtre reste montée pendant le rechargement de la liste (pas de retour anticipé sur `loading`). Lint actuel : 1 ERREUR `react-hooks/set-state-in-effect` l.92 (`fetchData()` dans l'effet de montage) et 5 avertissements d'imports ou variables inutilisés (`X` l.19, `ChevronDown` l.20, `createStructure` l.29, `ApiError` l.34, `user` l.59).
- `src/components/NotificationBell.tsx` : état local `notifications`, `nonLues`, `loading`, `actionLoading`, `open` (l.85-89) ; `fetchNotifs` (l.92-104, `setLoading(true)` synchrone puis `getNotifications()`, échec silencieux) ; effet de sondage l.106-111 ; effet « au clic d'ouverture » l.113-116 ; `handleMarkAllRead`, `handleMarkRead`, `handleDelete`, `handleClearRead` (l.129-172) mettent à jour l'état local après l'appel ; `if (!user) return null;` l.174 ; badge l.198-203 (`{nonLues > 9 ? "9+" : nonLues}`) ; spinner de liste `loading && notifications.length === 0` (l.271). Lint actuel : 2 ERREURS `react-hooks/set-state-in-effect` l.108 et l.115.
- `src/lib/api_notifications.ts` : `getNotifications()` renvoie `ApiResponse<{ notifications: Notification[]; nonLues: number }>`, plus `markAllAsRead`, `markNotificationAsRead(id)`, `deleteNotification(id)`, `clearReadNotifications()`. Ne pas modifier ce fichier.
- `src/app/dashboard/layout.tsx` : `DashboardLayout` (l.457-540) ne rend le contenu que si `user` existe ; il enveloppe tout dans `<ToastProvider>` (l.489 et l.538). Lint actuel : 0 erreur (disable global `set-state-in-effect` en tête), 3 avertissements d'imports inutilisés (`User` l.26, `Loader2` l.32, `QrCode` l.36).
- Modèle de fournisseur + hook dans un même fichier `src/hooks/*.tsx` : `src/hooks/useAuth.tsx` (`AuthProvider` + `useAuth`, qui lève une erreur hors fournisseur).
- Modèles de tests : `src/lib/api_auth.demo.test.ts` (`vi.stubGlobal("fetch", ...)`, fabrique `reponse(statut, corps)`), `src/components/modals/UserModal.test.tsx` (mocks `vi.hoisted` + `vi.mock("@/lib/api_admin", ...)`), `src/components/EmergencyListener.test.tsx` (mock de `@/hooks/useAuth`). Environnement jsdom, `@testing-library/react` et `jest-dom` disponibles.

### Changement 1 : `src/lib/api_auth.ts`, une erreur 502/503/504 du serveur applicatif garde son message (D02)

Dans `envoyer`, remplacer la ligne `if (!STATUTS_INDISPONIBLES.includes(res.status)) return res;` par :

```ts
      if (!STATUTS_INDISPONIBLES.includes(res.status)) return res;
      // Réponse rédigée par le serveur (corps JSON avec un code) : rendue telle quelle,
      // sans nouvel essai, pour que son message parvienne à l'utilisateur (D02)
      if (await estReponseApplicative(res)) return res;
```

et ajouter, juste avant `envoyer` (après l'interface `ReglagesAppel`) :

```ts
/** Vrai si le corps d'une réponse 502/503/504 vient du serveur applicatif (objet JSON avec un `code` texte). */
async function estReponseApplicative(res: Response): Promise<boolean> {
  try {
    const corps: unknown = await res.clone().json();
    return typeof corps === "object" && corps !== null && typeof (corps as CorpsReponse).code === "string";
  } catch {
    return false;
  }
}
```

Rien d'autre ne change dans `envoyer` ni `apiFetch` : un 503 sans `code` (proxy, passerelle) garde le comportement actuel (nouvel essai sur les lectures, `MSG_INDISPONIBLE`) ; un 503 avec `code` est levé par `apiFetch` en `ApiError(body.message, 503, body)`. `getComptesDemo` (503 avec corps `{}`) reste inchangé.

### Changement 2 : `src/lib/api_admin.ts`, réponse de création typée (D01)

Ajouter après `CreateStructurePayload` :

```ts
/** Structure renvoyée à la création ; `invitationEnvoyee` absent = ancienne réponse, invitation envoyée. */
export type StructureCreee = Pick<Structure, "id" | "nom" | "type" | "email" | "isConfigured" | "createdAt"> & {
  invitationEnvoyee?: boolean;
};
```

`createStructure` devient `authFetch<StructureCreee>(...)` (même appel). Ajouter après `createStructure` :

```ts
/**
 * Vrai seulement si le serveur dit explicitement que l'email d'invitation n'est pas parti
 * (`invitationEnvoyee: false` dans `data` ou à la racine). Champ absent = invitation envoyée.
 */
export function invitationNonEnvoyee(res: ApiResponse<StructureCreee>): boolean {
  const racine = res as ApiResponse<StructureCreee> & { invitationEnvoyee?: boolean };
  return res.data?.invitationEnvoyee === false || racine.invitationEnvoyee === false;
}
```

(`ApiResponse` est déjà importé l.10, l'avertissement « inutilisé » sur `ApiResponse` disparaît ; ne pas toucher aux deux autres imports.)

### Changement 3 : `src/components/modals/StructureModal.tsx`, écran « structure créée, invitation non envoyée » (D03, D04)

1. Imports : ajouter `invitationNonEnvoyee`, `resendStructureInvitation` et le type `StructureCreee` à l'import de `@/lib/api_admin` ; `AlertTriangle` et `CheckCircle2` à l'import `lucide-react` ; `messageErreurPour` depuis `@/hooks/useToast`. Retirer les 3 imports inutilisés (`MyStructure`, `UpdateStructurePayload`, `MapPin`) pour que le fichier soit propre.
2. Nouvel état : `const [structureSansInvitation, setStructureSansInvitation] = useState<StructureCreee | null>(null);`, `const [renvoiEnCours, setRenvoiEnCours] = useState(false);`, `const [renvoiErreur, setRenvoiErreur] = useState("");`, `const [renvoiReussi, setRenvoiReussi] = useState(false);`.
3. Dans `submit`, branche `create` : `const res = await createStructure({...})` (mêmes champs). Puis :
   - si `invitationNonEnvoyee(res)` : `onSuccess?.()` (la liste se rafraîchit), `setStructureSansInvitation(res.data)`, et `return` SANS appeler `onClose()` (le `finally` remet `saving` à false) ;
   - sinon : `onSuccess?.(); onClose();` comme aujourd'hui.
   La branche `edit` ne change pas.
4. Fonction `renvoyerInvitation` :
   ```ts
   const renvoyerInvitation = async () => {
     if (!structureSansInvitation) return;
     setRenvoiEnCours(true);
     setRenvoiErreur("");
     try {
       await resendStructureInvitation(structureSansInvitation.id);
       setRenvoiReussi(true);
     } catch (err) {
       setRenvoiErreur(messageErreurPour(err, "L'invitation n'a pas pu être envoyée. Réessayez dans quelques instants."));
     } finally {
       setRenvoiEnCours(false);
     }
   };
   ```
5. Rendu : quand `structureSansInvitation` n'est pas null, l'en-tête reste (titre `h2` remplacé par « Structure créée », sous-titre « Un email d'invitation sera envoyé automatiquement » masqué), et le `<form>` est remplacé par un bloc de résultat dans le même conteneur défilant (classes `p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4 bg-white dark:bg-slate-900`), dans cet ordre :
   - si `!renvoiReussi`, l'avertissement, `role="alert"` :
     ```tsx
     <div role="alert" className="flex items-start gap-3 p-4 rounded-xl border border-amber-600/40 dark:border-amber-400/40 text-sm text-amber-900 dark:text-amber-200">
       <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
       <div className="space-y-1">
         <p className="font-semibold">Structure créée, mais l&apos;email d&apos;invitation n&apos;a pas pu être envoyé.</p>
         <p>
           La structure <strong>{structureSansInvitation.nom}</strong> est bien enregistrée. Renvoyez l&apos;invitation à{" "}
           <strong>{structureSansInvitation.email}</strong> maintenant, ou plus tard depuis la liste des structures.
         </p>
       </div>
     </div>
     ```
     (une seule délimitation : bordure, sans fond ni ombre.)
   - si `renvoiReussi`, à la place de l'avertissement, `role="status"` : même structure de bloc avec `border-secondary-600/40 dark:border-secondary-400/40 text-secondary-800 dark:text-secondary-200`, icône `CheckCircle2`, texte « Invitation envoyée à {structureSansInvitation.email}. »
   - si `renvoiErreur`, le bloc d'erreur existant (mêmes classes que l.134-137, icône `AlertCircle`) avec `role="alert"` et le texte `{renvoiErreur}`.
   - pied, mêmes classes que le pied actuel (l.296) : si `!renvoiReussi`, bouton secondaire « Fermer » (classes du bouton « Annuler » actuel, `onClick={onClose}`) et bouton principal « Renvoyer l'invitation » (mêmes classes et dégradé que « Créer et inviter », icône `Send`, `Loader2` animé et texte « Envoi en cours... » pendant `renvoiEnCours`, `disabled={renvoiEnCours}`, `type="button"`, `onClick={renvoyerInvitation}`) ; si `renvoiReussi`, un seul bouton « Fermer » pleine largeur (classes du bouton « Fermer » du mode `view`, l.298).
   Échap et le clic sur le fond ferment la fenêtre comme aujourd'hui (comportement de `useDialogA11y` et `onClose` inchangé, `closeOnEscape` devient `!saving && !showMap && !renvoiEnCours`).
6. Le reste du formulaire (création réussie, mode `edit`, mode `view`) est inchangé.

### Changement 4 : `src/app/dashboard/structures/page.tsx`, message du serveur sur échec du renvoi (D04)

- `handleResend` : `catch (err) { showToast(messageErreurPour(err, "L'invitation n'a pas pu être envoyée. Réessayez dans quelques instants."), false); }` (import de `messageErreurPour` depuis `@/hooks/useToast`). Le succès reste `Invitation renvoyée à ${s.email}`.
- Lint propre au minimum (règle des fichiers touchés) : retirer les imports et la variable inutilisés (`X`, `ChevronDown`, `createStructure`, `ApiError`, et `const { user } = useAuth();` l.59 ainsi que l'import `useAuth` l.5, qui n'a pas d'autre usage) ; sur l'effet de montage l.91-93, ajouter juste au-dessus de l'appel `// eslint-disable-next-line react-hooks/set-state-in-effect -- chargement initial de la liste, dette préexistante` (même forme que `src/app/dashboard/page.tsx:411`). Aucun autre changement dans ce fichier.

### Changement 5 : nouveau `src/hooks/useNotifications.tsx`, un seul sondage partagé (D06, D07)

Fichier `"use client"`. Contenu attendu (adapter seulement si `tsc` ou `eslint` l'exige, sans changer le comportement) :

```tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  clearReadNotifications,
  deleteNotification,
  getNotifications,
  markAllAsRead,
  markNotificationAsRead,
  type Notification,
} from "@/lib/api_notifications";

/** Intervalle du sondage des notifications, onglet visible seulement. */
export const INTERVALLE_SONDAGE_NOTIFICATIONS_MS = 30_000;

export interface ContexteNotifications {
  notifications: Notification[];
  nonLues: number;
  /** Vrai tant que la première réponse (ou le premier échec) n'est pas arrivée. */
  premierChargement: boolean;
  rafraichir: () => Promise<void>;
  marquerToutLu: () => Promise<void>;
  marquerLu: (id: string) => Promise<void>;
  supprimer: (id: string, etaitNonLue: boolean) => Promise<void>;
  supprimerLues: () => Promise<void>;
}

const NotificationsContext = createContext<ContexteNotifications | null>(null);

/**
 * Source unique des notifications du tableau de bord : un seul sondage par onglet,
 * suspendu quand l'onglet est caché, partagé par toutes les cloches (D06, D07).
 * Monté une fois dans app/dashboard/layout.tsx, avec `key={user.id}`.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [nonLues, setNonLues] = useState(0);
  const [premierChargement, setPremierChargement] = useState(true);
  const enCours = useRef(false);

  const rafraichir = useCallback(async () => {
    // Pas de requête en parallèle (ouverture du panneau pendant un sondage)
    if (enCours.current) return;
    enCours.current = true;
    try {
      const res = await getNotifications();
      setNotifications(res.data.notifications);
      setNonLues(res.data.nonLues);
    } catch {
      // Échec silencieux : la liste précédente reste affichée, nouvel essai au prochain passage
    } finally {
      enCours.current = false;
      setPremierChargement(false);
    }
  }, []);

  useEffect(() => {
    let minuteur: ReturnType<typeof setInterval> | null = null;
    const arreter = () => {
      if (minuteur !== null) {
        clearInterval(minuteur);
        minuteur = null;
      }
    };
    const demarrer = () => {
      if (minuteur !== null) return;
      void rafraichir();
      minuteur = setInterval(() => void rafraichir(), INTERVALLE_SONDAGE_NOTIFICATIONS_MS);
    };
    const surChangementVisibilite = () => (document.visibilityState === "hidden" ? arreter() : demarrer());

    surChangementVisibilite();
    document.addEventListener("visibilitychange", surChangementVisibilite);
    return () => {
      arreter();
      document.removeEventListener("visibilitychange", surChangementVisibilite);
    };
  }, [rafraichir]);

  const marquerToutLu = useCallback(async () => {
    await markAllAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, lu: true })));
    setNonLues(0);
  }, []);

  const marquerLu = useCallback(async (id: string) => {
    await markNotificationAsRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, lu: true } : n)));
    setNonLues((prev) => Math.max(0, prev - 1));
  }, []);

  const supprimer = useCallback(async (id: string, etaitNonLue: boolean) => {
    await deleteNotification(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (etaitNonLue) setNonLues((prev) => Math.max(0, prev - 1));
  }, []);

  const supprimerLues = useCallback(async () => {
    await clearReadNotifications();
    setNotifications((prev) => prev.filter((n) => !n.lu));
  }, []);

  const valeur = useMemo(
    () => ({ notifications, nonLues, premierChargement, rafraichir, marquerToutLu, marquerLu, supprimer, supprimerLues }),
    [notifications, nonLues, premierChargement, rafraichir, marquerToutLu, marquerLu, supprimer, supprimerLues]
  );

  return <NotificationsContext.Provider value={valeur}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): ContexteNotifications {
  const contexte = useContext(NotificationsContext);
  if (!contexte) {
    throw new Error("useNotifications doit être utilisé dans un NotificationsProvider");
  }
  return contexte;
}
```

Si `eslint` signale `react-hooks/set-state-in-effect` sur `surChangementVisibilite();` dans l'effet (appel synchrone qui mène à un setState après `await`), ajouter juste au-dessus `// eslint-disable-next-line react-hooks/set-state-in-effect -- premier chargement, les mises à jour arrivent après la réponse` ; aucune autre désactivation.

### Changement 6 : `src/components/NotificationBell.tsx`, la cloche lit l'état partagé

- Retirer `getNotifications`, `markAllAsRead`, `markNotificationAsRead`, `deleteNotification`, `clearReadNotifications` de l'import (garder le type `Notification`, utilisé par `NotifIcon`) ; importer `useNotifications` depuis `@/hooks/useNotifications`. Retirer `useEffect`/`useCallback` de l'import React seulement s'ils ne servent plus (l'effet « clic à l'extérieur » l.118-127 reste et utilise `useEffect`).
- Supprimer les états locaux `notifications`, `nonLues`, `loading`, la fonction `fetchNotifs` et les deux effets l.106-116. Les remplacer par `const { notifications, nonLues, premierChargement, rafraichir, marquerToutLu, marquerLu, supprimer, supprimerLues } = useNotifications();`. Garder locaux `open`, `actionLoading`, `panelRef`.
- Les quatre gestionnaires gardent leur forme (`setActionLoading(...)`, `try { await ... } finally { setActionLoading(null); }`) mais appellent `marquerToutLu()`, `marquerLu(id)`, `supprimer(id, wasUnread)`, `supprimerLues()` à la place des appels et mises à jour locales.
- Bouton cloche : `onClick={() => { if (!open) void rafraichir(); setOpen((v) => !v); }}` (rafraîchissement à l'ouverture, hors effet).
- Spinner de liste : la condition `loading && notifications.length === 0` devient `premierChargement && notifications.length === 0`. Aucun autre changement visuel ni textuel.
- `if (!user) return null;` reste.

### Changement 7 : `src/app/dashboard/layout.tsx`, un seul fournisseur

Importer `NotificationsProvider` depuis `@/hooks/useNotifications`. Dans `DashboardLayout`, juste à l'intérieur de `<ToastProvider>`, envelopper le `<div className="min-h-screen ...">` dans `<NotificationsProvider key={user.id}>` ... `</NotificationsProvider>`. Les deux `<NotificationBell />` restent où ils sont. Retirer les 3 imports inutilisés (`User`, `Loader2`, `QrCode`). Rien d'autre.

### Changement 8 : tests Vitest

a) Nouveau `src/lib/api_auth.indisponible.test.ts` (modèle `api_auth.demo.test.ts` : `vi.stubGlobal("fetch", fetchSimule)`, fabrique `reponse`, `console.warn` neutralisé). `localStorage.setItem("access_token", "jeton-test")` dans `beforeEach`. Appels via `resendStructureInvitation("s1")` (import réel de `@/lib/api_admin`) et `apiFetch` :
  1. POST 503 `{ statusCode: 503, code: "EMAIL_INDISPONIBLE", message: "Le service d'envoi des emails est momentanément indisponible. Réessayez dans quelques minutes." }` sur `resendStructureInvitation("s1")` : rejet `ApiError` avec ce `message`, `status` 503, `details.code === "EMAIL_INDISPONIBLE"`, `fetch` appelé 1 fois.
  2. POST 503 corps `{}` : rejet avec le message « Le service est momentanément indisponible, réessayez dans quelques instants. », `fetch` appelé 1 fois.
  3. GET 503 avec `code` (`apiFetch("/exemple")`) : rejet avec le message du serveur et `fetch` appelé 1 fois (pas de nouvel essai, pas de minuteur à avancer).
b) Nouveau `src/components/modals/StructureModal.test.tsx` (modèle `UserModal.test.tsx`). Mocks : `vi.mock("@/lib/api_admin", () => ({ createStructure, resendStructureInvitation, invitationNonEnvoyee: vraieFonction }))` en important la vraie `invitationNonEnvoyee` via `vi.importActual` (ou mock partiel `async (importOriginal) => ({ ...(await importOriginal()), createStructure, resendStructureInvitation })`) ; `vi.mock("@/lib/api_structure", () => ({ updateMyStructure: vi.fn() }))` ; `vi.mock("./MapModal", () => ({ MapModal: () => null }))`. Remplir le nom (placeholder « Ex: Hôpital Donka ») et l'email (placeholder « admin@structure.com »), soumettre le formulaire. Cas :
  1. Réponse `{ success: true, message: "", data: { id: "s1", nom: "Clinique Test", type: "CLINIQUE", email: "c@exemple.com", isConfigured: false, createdAt: "2026-10-21T00:00:00.000Z", invitationEnvoyee: false } }` : `onSuccess` appelé 1 fois, `onClose` non appelé, texte « Structure créée, mais l'email d'invitation n'a pas pu être envoyé. » visible, bouton « Renvoyer l'invitation » présent.
  2. Même réponse puis `resendStructureInvitation` rejeté par `new ApiError("Le service d'envoi des emails est momentanément indisponible. Réessayez dans quelques minutes.", 503, { code: "EMAIL_INDISPONIBLE" })` : après clic sur « Renvoyer l'invitation », ce message exact est visible, le bouton est toujours là, aucun texte « Une erreur est survenue ».
  3. Même réponse puis renvoi résolu : « Invitation envoyée à c@exemple.com. » visible, bouton « Renvoyer l'invitation » absent.
  4. Ancienne réponse sans `invitationEnvoyee` : `onSuccess` et `onClose` appelés 1 fois chacun, aucun avertissement.
  5. `invitationNonEnvoyee` (fonction réelle) : `false` pour `data` sans champ, `false` pour `invitationEnvoyee: true`, `true` pour `data.invitationEnvoyee === false`, `true` pour `invitationEnvoyee: false` à la racine.
c) Nouveau `src/hooks/useNotifications.test.tsx`. Mocks : `vi.mock("@/lib/api_notifications", () => ({ getNotifications, markAllAsRead, markNotificationAsRead, deleteNotification, clearReadNotifications }))` avec `getNotifications.mockResolvedValue({ success: true, message: "", data: { notifications: [une notification non lue], nonLues: 3 } })` ; `vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }))`. `vi.useFakeTimers()` en `beforeEach`, `vi.useRealTimers()` et `cleanup()` en `afterEach`. Visibilité simulée par `Object.defineProperty(document, "visibilityState", { configurable: true, get: () => etatVisibilite })` puis `document.dispatchEvent(new Event("visibilitychange"))`. Faire avancer le temps avec `await act(async () => { await vi.advanceTimersByTimeAsync(ms); })`. Cas :
  1. Deux `<NotificationBell />` sous un seul `<NotificationsProvider>` : après montage (`advanceTimersByTimeAsync(0)`), `getNotifications` appelé 1 fois ; après 30 000 ms, 2 fois ; après 60 000 ms de plus, 4 fois (une seule requête par intervalle, pas deux).
  2. État partagé : les deux cloches affichent le badge « 3 » (`getAllByText("3")` de longueur 2).
  3. Onglet caché : passer `hidden` et déclencher l'évènement, avancer 90 000 ms : aucun nouvel appel ; repasser `visible` : 1 appel immédiat, puis 1 de plus après 30 000 ms.
  4. Démontage (`unmount`) : avancer 60 000 ms, aucun nouvel appel.
  5. Ouverture du panneau (clic sur le bouton « Notifications » d'une cloche) : 1 appel de plus.
  6. `useNotifications` hors fournisseur lève l'erreur « useNotifications doit être utilisé dans un NotificationsProvider » (`renderHook` dans un `expect(...).toThrow`, `console.error` neutralisé).

### Hors périmètre

Ne pas modifier : le back, `CreateStructureModal.tsx`, `src/lib/api_notifications.ts`, `src/app/dashboard/super-admin/page.tsx`, la mise en page des cloches, les autres usages de `showToast`.

## Contraintes

Faire uniquement ce qui est demandé : pas de refactors, helpers ou abstractions non demandés. Discipline de code dans l'ordre : réutiliser l'existant > ranger au bon endroit > n'abstraire qu'à la règle de trois. Règles d'audience, visuelles, typographiques et de langue : docs/ORCHESTRATOR.md. Ne pas modifier docs/plans/. Écrire les fichiers uniquement avec Write et Edit, jamais par redirection shell : le hook de garde ne voit pas les écritures faites par Bash.

Textes visibles en français, sans tiret cadratin ni demi-cadratin, sans terme interdit (« email » est autorisé ; « serveur », « API », « 503 », « code » ne doivent jamais apparaître à l'écran). Tout code ajouté est typé, sans `any`. Commentaires de code en français.

## Done when

Toutes les commandes lancées depuis `D:\souleymane\perso-archive-20260923\perso\medconnecte` :

1. `docker compose exec -T frontend npx tsc --noEmit` : aucune sortie, code 0.
2. `docker compose exec -T frontend npx eslint src/lib/api_auth.ts src/lib/api_admin.ts src/components/modals/StructureModal.tsx src/app/dashboard/structures/page.tsx src/hooks/useNotifications.tsx src/components/NotificationBell.tsx src/app/dashboard/layout.tsx src/lib/api_auth.indisponible.test.ts src/components/modals/StructureModal.test.tsx src/hooks/useNotifications.test.tsx` : 0 erreur (code 0) ; `StructureModal.tsx`, `structures/page.tsx`, `useNotifications.tsx`, `NotificationBell.tsx`, `layout.tsx` et les 3 tests sans aucun avertissement. Seuls avertissements tolérés : les 2 imports inutilisés préexistants de `api_admin.ts` (`ApiError`, `apiFetch`).
3. `docker compose exec -T frontend npx vitest run` : tous les tests passent, dont les 3 nouveaux fichiers (14 cas au minimum), et les tests existants inchangés (`api_auth.demo.test.ts` « renvoie [] sur 503 sans nouvelle tentative » toujours vert).
4. `grep -n "NotificationBell" front_medconnect/src/app/dashboard/layout.tsx` montre toujours 2 cloches, et `grep -rn "setInterval" front_medconnect/src/components/NotificationBell.tsx` ne renvoie rien ; `grep -rn "getNotifications" front_medconnect/src --include=*.tsx | grep -v test` ne renvoie que `src/hooks/useNotifications.tsx`.
5. Aucun tiret cadratin ni demi-cadratin ajouté : aucun blocage du hook de garde (route-guard ou orchestrator-guard) sur les écritures de la tâche ; le validateur le revérifie au pre-commit.

## Return

Liste des fichiers touchés + preuve (les 3 commandes du Done when lancées, résultat en une ligne chacune, nombre de tests passés). Ou un bloc BLOCKED. Pas de prose.

## Historique

<!-- une ligne par tentative : AAAA-MM-JJ | tier | résultat | raison si échec -->

## Validation

<!-- commande relancée par l'orchestrateur | résultat en une ligne | hash du commit -->
