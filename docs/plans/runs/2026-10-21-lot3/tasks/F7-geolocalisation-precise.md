# F7 - Géolocalisation précise : utilitaire partagé, précision du SOS, numéro d'urgence configuré, clé d'idempotence

Tier: spécifié (agent implementeur-specifie)
Audience: non-dev (bouton SOS du patient, messagerie, recherche de médicaments, choix d'un lieu sur la carte)
Visuel: préventif (aucun nouveau composant ni nouveau style : textes remplacés dans les éléments existants, clair et sombre inchangés)
Background-safe: non, car docker compose exec (typage, lint et tests dans le conteneur frontend)

## Spec

Dépôt : `D:\souleymane\perso-archive-20260923\perso\medconnecte\front_medconnect`, branche `orch/lot3-front` (arbre principal, ne pas changer de branche, ne pas committer). Le back (`back_medconnect`) ne doit PAS être modifié. Décisions du run : `docs/plans/runs/2026-10-21-lot3/decisions.md` (D01 à D09), déjà tranchées, ne pas les rediscuter.

But : la position envoyée par le SOS est parfois fausse de plusieurs kilomètres. Cause : `getCurrentPosition` est appelé sans `enableHighAccuracy`, la précision (`coords.accuracy`) et l'heure de mesure sont ignorées, le navigateur se contente d'une position réseau ou IP. On crée UN utilitaire partagé qui demande la haute précision et garde la meilleure mesure, on le branche sur les 4 appels, le SOS envoie précision, heure et source, affiche la précision au patient en langage simple, lit le numéro d'urgence dans la configuration publique et envoie une clé d'idempotence.

### Contexte (déjà vérifié par le chef d'équipe, ne pas re-chercher)

- `src/components/EmergencyButton.tsx` : `getLoc` (l.152-165) et `handleSendSOS` (l.167-181) appellent `navigator.geolocation.getCurrentPosition` sans options ; `sendRequest` (l.183-208) envoie `createUrgence({ latitude, longitude, message })`. État `location` `{lat,lng}` (l.43), `locLoading` (l.44, jamais lu : avertissement de lint). Compte à rebours de 5 s (effet l.69-80, avertissement `react-hooks/exhaustive-deps` sur `handleSendSOS`). `ouvrir` (l.119-133), `relancer` (l.136-144) utilisé par deux boutons : l.345-350 (« Réessayer l'envoi » si `envoiEchoue`, « Relancer l'alerte » si `aucunEtablissement`) et l.386-393 (« Relancer une alerte »). `reset` (l.230-238). Pastille de position l.308-313 (« Position GPS acquise » / « Recherche de votre position... »), titre « Envoi automatique... » l.303, ligne « Position partagée : lat, lng » l.335-337, bouton d'appel `href="tel:15"` « Appeler le 15 (SAMU) » l.400-403. En-tête de fichier : `eslint-disable` global de dette (any, immutability, set-state-in-effect, prefer-const, no-unescaped-entities) à laisser tel quel ; tout code AJOUTÉ est typé sans `any`.
- `src/app/dashboard/chat/page.tsx` `handleSendLocation` (l.130-156) : émet `sendMessage` avec `isLocation: true, lat, lng` ; deux messages d'erreur via `notifier(..., "erreur")`. Fichier propre au lint (disable global en tête).
- `src/app/dashboard/medicaments/page.tsx` effet l.53-71 : position au montage, sinon `setLocationError(...)` et `setSortBy("price")`. Lint actuel : 4 imports inutilisés (`Clock`, `ChevronRight`, `Filter`, `ExternalLink`, l.12-17) et une erreur `react-hooks/set-state-in-effect` l.68 (setState synchrone dans la branche « non supportée »).
- `src/components/GlobePicker.tsx` `handleAutoLocation` (l.244-261) : `if (!navigator.geolocation) return;` puis `getCurrentPosition` ; échec silencieux. Fichier propre au lint.
- `src/lib/api_carnet.ts` l.212-216 : `createUrgence(data: { latitude?; longitude?; message? })` via `authFetch` ; `authFetch`/`apiFetch` fusionnent `options.headers` (l'en-tête ajouté passe tel quel). Seul appelant : EmergencyButton.
- `src/lib/api_auth.ts` : `apiFetch<T>(endpoint, options, { tentativeUnique: true, sansJournal: true })` pour un appel public facultatif (modèle : `getComptesDemo`, l.410-418, qui ne lève jamais).
- Back (lecture seule) : `GET /app/config` public, réponse `{ success: true, data: { numerosUrgence: [{ code: "URGENCE_MEDICALE", libelle: "Urgences médicales", numero: "15" }], versionsDocuments: {...}, fonctions: {...} } }`. Aucun client web n'existe encore pour cette route.
- jsdom n'a pas `navigator.geolocation` : les tests le définissent avec `Object.defineProperty(navigator, "geolocation", { value: faux, configurable: true })`.

### Changement 1 : nouveau `src/lib/geolocalisation.ts` (D01, D03)

Module sans React. Contenu attendu (adapter seulement si `tsc` l'exige, sans changer le comportement) :

```ts
/**
 * Géolocalisation partagée : haute précision demandée, meilleure mesure gardée,
 * durée bornée. Ne lève jamais d'exception.
 */

/** Le navigateur ne dit pas si la position vient du GPS, du wifi ou de l'adresse IP. */
export type SourcePosition = "navigateur";

export interface PositionMesuree {
  latitude: number;
  longitude: number;
  /** Rayon d'incertitude en mètres (coords.accuracy). */
  precision: number;
  /** Instant de la mesure (pos.timestamp), au format ISO 8601. */
  horodatagePosition: string;
  source: SourcePosition;
}

export type CauseEchecPosition = "refusee" | "indisponible" | "non_prise_en_charge";

export type ResultatPosition =
  | { ok: true; position: PositionMesuree }
  | { ok: false; cause: CauseEchecPosition };

export interface ReglagesLocalisation {
  /** Arrêt dès qu'une mesure atteint cette précision (mètres). */
  precisionVisee: number;
  /** Durée maximale de la recherche (ms) : le résultat arrive toujours avant. */
  dureeMaxMs: number;
}

/** SOS : arrêt dès 50 m, jamais plus de 10 s. */
export const REGLAGES_SOS: ReglagesLocalisation = { precisionVisee: 50, dureeMaxMs: 10_000 };

/** Hors SOS : première mesure reçue, au plus 10 s si rien n'arrive. */
export const REGLAGES_RAPIDES: ReglagesLocalisation = { precisionVisee: Number.POSITIVE_INFINITY, dureeMaxMs: 10_000 };

/** Au delà, la position est dite approximative au patient. */
export const PRECISION_MAX_FIABLE_M = 500;

// GeolocationPositionError.PERMISSION_DENIED (constante absente de jsdom)
const ERREUR_PERMISSION_REFUSEE = 1;

const versPositionMesuree = (pos: GeolocationPosition): PositionMesuree => ({
  latitude: pos.coords.latitude,
  longitude: pos.coords.longitude,
  precision: pos.coords.accuracy,
  horodatagePosition: new Date(pos.timestamp).toISOString(),
  source: "navigateur",
});

export function localiserPrecisement(
  reglages: ReglagesLocalisation,
  onAmelioration?: (position: PositionMesuree) => void
): Promise<ResultatPosition> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve({ ok: false, cause: "non_prise_en_charge" });
  }
  const geo = navigator.geolocation;
  return new Promise((resolve) => {
    let meilleure: PositionMesuree | null = null;
    let termine = false;
    let idSuivi: number | null = null;

    const terminer = (resultat: ResultatPosition) => {
      if (termine) return;
      termine = true;
      clearTimeout(minuteur);
      if (idSuivi !== null) geo.clearWatch(idSuivi);
      resolve(resultat);
    };

    const minuteur = setTimeout(
      () => terminer(meilleure ? { ok: true, position: meilleure } : { ok: false, cause: "indisponible" }),
      reglages.dureeMaxMs
    );

    idSuivi = geo.watchPosition(
      (pos) => {
        if (termine) return;
        const mesure = versPositionMesuree(pos);
        if (!meilleure || mesure.precision < meilleure.precision) {
          meilleure = mesure;
          onAmelioration?.(mesure);
        }
        if (meilleure.precision <= reglages.precisionVisee) terminer({ ok: true, position: meilleure });
      },
      (erreur) => {
        // Refus : inutile d'attendre. Autres erreurs (indisponible, délai) : on attend la fin de la durée.
        if (erreur.code === ERREUR_PERMISSION_REFUSEE) terminer({ ok: false, cause: "refusee" });
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: reglages.dureeMaxMs }
    );
    // Rappel synchrone éventuel : le suivi n'était pas encore enregistré dans terminer
    if (termine) geo.clearWatch(idSuivi);
  });
}

/** Phrase montrée au patient sur la précision de la position envoyée avec le SOS. */
export function libellePrecisionSos(position: PositionMesuree | null, numeroUrgence: string): string {
  if (!position) return `Position non trouvée : si possible, appelez aussi le ${numeroUrgence}`;
  if (position.precision > PRECISION_MAX_FIABLE_M) {
    return `Position approximative : si possible, appelez aussi le ${numeroUrgence}`;
  }
  const metres = Math.max(10, Math.round(position.precision / 10) * 10);
  return `Position précise à environ ${metres} m`;
}
```

### Changement 2 : nouveau `src/lib/api_config.ts` (D07)

```ts
import { apiFetch } from "./api_auth";

/** Numéro servi si la configuration publique est illisible (même défaut que le back). */
export const NUMERO_URGENCE_PAR_DEFAUT = "15";

// Seuls chiffres, espaces et « + » : la valeur part dans un lien tel:
const NUMERO_VALIDE = /^\+?[0-9 ]{2,20}$/;

/**
 * Numéro d'urgence médicale lu dans GET /app/config (route publique).
 * Un seul essai, sans trace d'échec ; « 15 » en repli. Ne lève jamais d'exception.
 */
export async function getNumeroUrgenceMedicale(): Promise<string> {
  try {
    const res = await apiFetch<unknown>("/app/config", {}, { tentativeUnique: true, sansJournal: true });
    // lecture défensive de res.data.numerosUrgence (unknown, sans any) :
    // objet, tableau, entrée dont code === "URGENCE_MEDICALE" et numero de type string ;
    // numero.trim() renvoyé s'il respecte NUMERO_VALIDE.
  } catch {
    // repli ci-dessous
  }
  return NUMERO_URGENCE_PAR_DEFAUT;
}
```
Le coder la lecture défensive avec des gardes de type (`typeof x === "object" && x !== null`, `Array.isArray`), sans `any`, sans Zod.

### Changement 3 : `src/lib/api_carnet.ts` (D02, D05)

1. Importer `type PositionMesuree` depuis `./geolocalisation`. Ajouter juste avant `createUrgence` :
   ```ts
   /** Champs de position acceptés par POST /carnet-sante/sos (contrat B6, rétrocompatible). */
   export type PositionSos = PositionMesuree;
   ```
2. Remplacer `createUrgence` par :
   ```ts
   export const createUrgence = (data: Partial<PositionSos> & { message?: string }, cleIdempotence: string) =>
     authFetch<Urgence>("/carnet-sante/sos", {
       method: "POST",
       body: JSON.stringify(data),
       headers: { "Idempotency-Key": cleIdempotence },
     });
   ```
3. Ajouter, juste après :
   ```ts
   /**
    * Clé d'idempotence d'une alerte SOS (UUID v4). crypto.randomUUID n'existe qu'en HTTPS :
    * sinon UUID v4 construit avec crypto.getRandomValues.
    */
   export function nouvelleCleIdempotence(): string
   ```
   Repli : 16 octets aléatoires, `octets[6] = (octets[6] & 0x0f) | 0x40`, `octets[8] = (octets[8] & 0x3f) | 0x80`, puis hexadécimal au format `8-4-4-4-12`.

### Changement 4 : `src/components/EmergencyButton.tsx` (D03, D04, D05, D07, D08, D09)

1. Imports : ajouter `useRef` à l'import React ; `nouvelleCleIdempotence` à l'import de `@/lib/api_carnet` ; `localiserPrecisement, libellePrecisionSos, REGLAGES_SOS, PositionMesuree, ResultatPosition` depuis `@/lib/geolocalisation` ; `getNumeroUrgenceMedicale, NUMERO_URGENCE_PAR_DEFAUT` depuis `@/lib/api_config`.
2. États et références (remplacent `location` et `locLoading`, tous déclarés AVANT le `return null` des non patients) :
   - `const [position, setPosition] = useState<PositionMesuree | null>(null);`
   - `const [rechercheEnCours, setRechercheEnCours] = useState(false);`
   - `const [numeroUrgence, setNumeroUrgence] = useState(NUMERO_URGENCE_PAR_DEFAUT);`
   - `const rechercheRef = useRef<Promise<ResultatPosition> | null>(null);`
   - `const numeroRecherche = useRef(0);` (incrémenté à chaque nouvelle recherche et à la fermeture : les résultats d'une recherche périmée sont ignorés, un envoi en attente est abandonné)
   - `const cleRef = useRef("");`
3. Numéro d'urgence : nouvel effet, `useEffect(() => { if (user?.role !== "PATIENT") return; let actif = true; getNumeroUrgenceMedicale().then((n) => { if (actif) setNumeroUrgence(n); }); return () => { actif = false; }; }, [user?.role]);`
4. Remplacer `getLoc` par `demarrerRecherche` :
   ```ts
   const demarrerRecherche = () => {
     const n = ++numeroRecherche.current;
     setPosition(null);
     setRechercheEnCours(true);
     const recherche = localiserPrecisement(REGLAGES_SOS, (p) => {
       if (numeroRecherche.current === n) setPosition(p);
     });
     rechercheRef.current = recherche;
     recherche.then((r) => {
       if (numeroRecherche.current !== n) return;
       setRechercheEnCours(false);
       if (r.ok) setPosition(r.position);
     });
   };
   ```
5. `ouvrir` : `cleRef.current = nouvelleCleIdempotence();` puis `demarrerRecherche()` à la place de `getLoc()` ; le reste inchangé.
6. `relancer` reçoit un paramètre `nouvelleCle: boolean` : si vrai, `cleRef.current = nouvelleCleIdempotence();` ; `demarrerRecherche()` à la place de `getLoc()` ; le reste inchangé. Bouton l.345-350 : `onClick={() => relancer(!envoiEchoue)}` (« Réessayer l'envoi » garde la clé, « Relancer l'alerte » en crée une). Bouton l.386-393 : `onClick={() => relancer(true)}`.
7. Remplacer `handleSendSOS` :
   ```ts
   const handleSendSOS = async () => {
     const n = numeroRecherche.current;
     // La recherche se termine au plus tard 10 s après l'appui (REGLAGES_SOS) : attente bornée
     const resultat = rechercheRef.current ? await rechercheRef.current : null;
     // Fenêtre fermée ou alerte annulée pendant l'attente : rien n'est envoyé
     if (numeroRecherche.current !== n) return;
     await sendRequest(resultat?.ok ? resultat.position : null);
   };
   ```
8. `sendRequest(pos: PositionMesuree | null)` : appel `createUrgence({ ...(pos ? { latitude: pos.latitude, longitude: pos.longitude, precision: pos.precision, horodatagePosition: pos.horodatagePosition, source: pos.source } : {}), message: "Urgence vitale déclenchée depuis le dashboard." }, cleRef.current)` ; si `pos`, `setPosition(pos)`. Le reste de `sendRequest` inchangé.
9. `reset` : ajouter `numeroRecherche.current++;` en première ligne (abandonne la recherche et tout envoi en attente). « Annuler l'alerte » appelle déjà `reset`.
10. Effet du compte à rebours : ajouter juste au-dessus de la ligne `}, [timerActive, countdown]);` le commentaire et la directive suivants (D09) :
    ```ts
    // handleSendSOS est lu au rendu où le compte atteint 0 : volontairement hors dépendances
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ```
11. Affichage, vue `sos_confirm` :
    - titre l.303 : `{countdown === 0 ? "Envoi en cours..." : "Envoi automatique..."}` ;
    - pastille l.308-313 : icône `MapPin` verte si `position`, grise et pulsante sinon (même logique qu'aujourd'hui avec `position`) ; texte : `position ? libellePrecisionSos(position, numeroUrgence) : rechercheEnCours ? "Recherche de votre position..." : libellePrecisionSos(null, numeroUrgence)` ; classes du `<span>` remplacées par `text-xs font-bold text-slate-600 dark:text-slate-300` (casse normale, D08) ; `aria-live="polite"` sur le `<span>`.
12. Affichage, vue `sos_sent` l.335-337 : remplacer « Position partagée : ... » par `<p className="text-sm text-slate-500">{libellePrecisionSos(position, numeroUrgence)}</p>` (toujours sous la condition `!envoiEchoue`).
13. Bouton d'appel l.400-403 : `href={`tel:${numeroUrgence}`}` et texte `Appeler le {numeroUrgence}` (« (SAMU) » retiré).
14. Aucun autre changement de texte, de style ou de logique.

### Changement 5 : `src/app/dashboard/chat/page.tsx` (D06)

`handleSendLocation` : garder la garde `if (!activeConv || !socket) return;` et `setLocationLoading(true)`, puis `localiserPrecisement(REGLAGES_RAPIDES).then((r) => { setLocationLoading(false); if (r.ok) { socket.emit("sendMessage", { conversationId: activeConv.id, content: "📍 Position partagée", isLocation: true, lat: r.position.latitude, lng: r.position.longitude }); } else if (r.cause === "non_prise_en_charge") { notifier(<message actuel « Votre navigateur ne permet pas... »>, "erreur"); } else { notifier(<message actuel « Impossible de récupérer votre position... »>, "erreur"); } });`. Retirer le `console.error`. Charge utile du socket strictement inchangée.

### Changement 6 : `src/app/dashboard/medicaments/page.tsx` (D06, D09)

1. Retirer `Clock`, `ChevronRight`, `Filter`, `ExternalLink` de l'import `lucide-react`.
2. Remplacer le corps de l'effet de position par :
   ```ts
   let actif = true;
   localiserPrecisement(REGLAGES_RAPIDES).then((r) => {
     if (!actif) return;
     if (r.ok) {
       setUserLocation({ lat: r.position.latitude, lng: r.position.longitude });
       setLocationError(null);
       return;
     }
     setLocationError(
       r.cause === "refusee"
         ? "Accès à la position refusé. Tri par prix activé par défaut."
         : r.cause === "non_prise_en_charge"
           ? "Géolocalisation non supportée par votre navigateur."
           : "Position introuvable pour le moment. Tri par prix activé par défaut."
     );
     setSortBy("price");
   });
   return () => { actif = false; };
   ```
   (dépendances `[]` inchangées).

### Changement 7 : `src/components/GlobePicker.tsx` (D06)

`handleAutoLocation` : garder `e.stopPropagation();`, retirer `if (!navigator.geolocation) return;`, puis `localiserPrecisement(REGLAGES_RAPIDES).then((r) => { if (!r.ok || !map.current) return; const { latitude, longitude } = r.position; <corps actuel inchangé à partir de map.current?.flyTo> });`. Échec toujours silencieux.

### Changement 8 : tests Vitest

1. Nouveau `src/lib/geolocalisation.test.ts`, avec un faux `navigator.geolocation` (`watchPosition: vi.fn()` qui mémorise les deux rappels et renvoie 7, `clearWatch: vi.fn()`), `vi.useFakeTimers()` dans `beforeEach`, `vi.useRealTimers()` et suppression de la propriété dans `afterEach`. Fabrique `mesure(precision, lat = 9.5, lng = -13.7, ts = Date.UTC(2026, 9, 21, 10, 0, 0))` qui renvoie un objet `{ coords: { latitude, longitude, accuracy }, timestamp }` converti en `GeolocationPosition` (`as unknown as GeolocationPosition`). Tests obligatoires (titres libres, en français) :
   - options passées à `watchPosition` : `{ enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }` ;
   - meilleure précision retenue : mesures 800, 120, 300 m puis `await vi.advanceTimersByTimeAsync(10_000)` : résultat `ok` avec `precision` 120 ; `onAmelioration` appelé 2 fois (800 puis 120) ; `clearWatch` appelé avec 7 ;
   - arrêt dès 50 m : mesures 200 puis 40 sans avancer le temps : résultat `ok` avec 40, `clearWatch` appelé ;
   - délai respecté : aucune mesure ; après `advanceTimersByTimeAsync(9_999)` la promesse n'est pas résolue (drapeau posé dans `.then`) ; après 1 ms de plus : `{ ok: false, cause: "indisponible" }` ;
   - erreur non bloquante : mesure 900 puis erreur `{ code: 2 }` : pas de fin immédiate ; à 10 s, résultat `ok` avec 900 ;
   - refus de permission : erreur `{ code: 1 }` : `{ ok: false, cause: "refusee" }` sans avancer le temps, `clearWatch` appelé ;
   - navigateur sans géolocalisation : `{ ok: false, cause: "non_prise_en_charge" }` ;
   - `REGLAGES_RAPIDES` : première mesure de 3000 m renvoyée aussitôt ;
   - format : `horodatagePosition` égal à `"2026-10-21T10:00:00.000Z"`, `source` égal à `"navigateur"` ;
   - `libellePrecisionSos` : 27 m donne « Position précise à environ 30 m » ; 3 m donne « ... 10 m » ; 500 m donne « Position précise à environ 500 m » ; 501 m avec numéro « 117 » donne « Position approximative : si possible, appelez aussi le 117 » ; `null` avec « 117 » donne « Position non trouvée : si possible, appelez aussi le 117 ».
2. Nouveau `src/lib/api_config.test.ts`, sur le modèle de `src/lib/api_auth.demo.test.ts` (`fetch` simulé par `vi.stubGlobal`) : numéro « 117 » renvoyé ; 500 donne « 15 » avec un seul appel à `fetch` ; erreur réseau (`fetchSimule.mockRejectedValue`) donne « 15 » ; liste absente ou entrée d'un autre code donne « 15 » ; numéro « abc » donne « 15 ».
3. `src/lib/api_carnet.test.ts` : ajouter un `describe` : `createUrgence` appelle `authFetch` avec `/carnet-sante/sos`, méthode POST, corps JSON contenant `precision`, `horodatagePosition`, `source`, et `headers` contenant `"Idempotency-Key": "cle-1"` ; `nouvelleCleIdempotence` renvoie une chaîne conforme à `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/`, une fois avec `crypto.randomUUID` présent et une fois avec `randomUUID` retiré (`vi.stubGlobal("crypto", { getRandomValues: crypto.getRandomValues.bind(crypto) })`, puis `vi.unstubAllGlobals()`).

## Contraintes

Faire uniquement ce qui est demandé : pas de refactors, helpers ou abstractions non demandés. Ne pas modifier le back ni les fichiers non listés. Discipline de code dans l'ordre : réutiliser l'existant > ranger au bon endroit > n'abstraire qu'à la règle de trois. Aucun `any` dans le code ajouté. Règles d'audience, visuelles, typographiques et de langue : docs/ORCHESTRATOR.md (textes visibles et commentaires en français, aucun terme technique à l'écran, aucun tiret cadratin ni demi-cadratin dans les lignes ajoutées ou modifiées). Ne pas modifier docs/plans/. Écrire les fichiers uniquement avec Write et Edit, jamais par redirection shell : le hook de garde ne voit pas les écritures faites par Bash.

## Done when

Depuis `D:\souleymane\perso-archive-20260923\perso\medconnecte` :
1. `docker compose exec -T frontend npx tsc --noEmit` : aucune erreur.
2. `docker compose exec -T frontend npx eslint src/lib/geolocalisation.ts src/lib/geolocalisation.test.ts src/lib/api_config.ts src/lib/api_config.test.ts src/lib/api_carnet.ts src/lib/api_carnet.test.ts src/components/EmergencyButton.tsx src/app/dashboard/chat/page.tsx src/app/dashboard/medicaments/page.tsx src/components/GlobePicker.tsx` : 0 erreur, 0 avertissement.
3. `docker compose exec -T frontend npx vitest run` : tous les tests passent, dont ceux de `geolocalisation.test.ts`, `api_config.test.ts` et les nouveaux de `api_carnet.test.ts`.
4. `git -C front_medconnect status --porcelain` ne liste que les 10 fichiers de la commande 2 (hors `docs/plans/`).
5. `grep -rn "getCurrentPosition\|geolocation.watchPosition" front_medconnect/src --include=*.ts --include=*.tsx | grep -v "\.test\.ts"` : une seule ligne, dans `src/lib/geolocalisation.ts` (`geo.watchPosition`) ; aucun `getCurrentPosition`.
6. `grep -n "tel:15\|(SAMU)\|Position GPS acquise\|toFixed(4)" front_medconnect/src/components/EmergencyButton.tsx` : aucune sortie ; `grep -n "Idempotency-Key" front_medconnect/src/lib/api_carnet.ts` : une ligne.
7. `git -C front_medconnect diff -U0 | grep "^+" | LC_ALL=C.UTF-8 grep -P "[\x{2013}\x{2014}]"` et le même contrôle sur les 4 nouveaux fichiers (`LC_ALL=C.UTF-8 grep -P "[\x{2013}\x{2014}]" <fichier>`) : aucune sortie.

## Return

Chemin de l'artefact + preuve (commande lancée, résultat en une ligne). Ou un bloc BLOCKED. Pas de prose.

## Historique

<!-- une ligne par tentative : AAAA-MM-JJ | tier | résultat | raison si échec -->

## Validation

<!-- commande relancée par l'orchestrateur | résultat en une ligne | hash du commit -->
