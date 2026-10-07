# T06 - SOS : délai annoncé par la structure et compte à rebours du patient (F5, côté front)

Tier: spécifié (agent implementeur-specifie)
Audience: non-dev (patient en situation d'urgence, soignant de garde)
Visuel: préventif
Background-safe: oui

## Spec

Contrat serveur (fait en parallèle par une autre tâche, figé, à coder tel quel) :
- `POST /carnet-sante/sos/:id/take-charge` exige désormais le corps `{ delaiArriveeMinutes: number }` (entier de 1 à 240). Réponse `data` = l'urgence avec `structurePriseEnChargeId`, `priseEnChargeAt`, `delaiArriveeMinutes`.
- `POST /carnet-sante/sos` peut renvoyer une erreur 409 avec un `message` humain déjà rédigé (alerte prise en charge dont le délai court encore, ou alerte envoyée il y a moins de 5 minutes). Le `message` est lu par `ApiError` (`src/lib/api_auth.ts`) comme d'habitude.
- Nouveau `GET /carnet-sante/sos/en-cours` (patient connecté) : `data` = `null` ou la dernière alerte active `{ id, status: 'LANCE' | 'PRIS_EN_CHARGE', createdAt, priseEnChargeAt, delaiArriveeMinutes, structurePriseEnCharge: { id, nom } | null, finDelaiAt: string | null, peutRelancerA: string | null, ... }`.
- L'événement en direct `emergencyHandled` n'est plus envoyé à tous : seulement au patient concerné et aux soignants concernés ; payload `{ urgenceId, structureName, handledAt, delaiArriveeMinutes, finDelaiAt }`.
Décisions D01, D02, D03 (back) et D14 dans `docs/plans/runs/2026-10-06-p2-fonctionnalites/decisions.md` : délai expiré, le patient peut relancer lui-même ; pas de rediffusion automatique.

1. `src/lib/api_carnet.ts` : `takeChargeSOS(id, delaiArriveeMinutes)` envoie le corps ; nouvelle fonction `getMonAlerteEnCours()` ; étendre le type `Urgence` existant (ne pas en créer un second) avec les nouveaux champs.
2. **Soignant**, `src/components/EmergencyListener.tsx` (modale d'alerte reçue, bouton de prise en charge vers la ligne 209) : avant de confirmer la prise en charge, demander « Dans combien de minutes vos équipes peuvent-elles arriver ? » avec des choix rapides (10, 15, 20, 30, 45, 60 min) et un champ nombre libre (1 à 240), validation à l'écran avec message humain ; bouton de confirmation désactivé tant que la valeur est invalide. Erreur d'envoi : message humain + possibilité de réessayer. Mettre à jour la réception de `emergencyHandled` si besoin (payload enrichi, rétrocompatible).
3. **Patient**, `src/components/EmergencyButton.tsx` (vue `sos_sent` et ouverture du bouton) :
   - à l'ouverture et après l'envoi d'une alerte, lire `getMonAlerteEnCours()` ; tant que l'alerte est « Alerte envoyée » (`LANCE`), relire toutes les 20 s (arrêt au démontage, à la fermeture et dès la prise en charge) ; s'il existe déjà une connexion en direct accessible côté patient pour `emergencyHandled`, l'écouter aussi (sinon ne pas en ouvrir une nouvelle : D14) ;
   - prise en charge : afficher clairement « {Structure} a pris en charge votre alerte » et un compte à rebours mm:ss mis à jour chaque seconde jusqu'à `finDelaiAt` (« Les secours arrivent dans environ 12:30 »), avec un rappel de rester joignable ;
   - délai expiré : « Le délai annoncé est dépassé. Si personne n'est arrivé, vous pouvez relancer une alerte. » + bouton « Relancer une alerte » (rejoue le flux d'envoi existant) ;
   - erreur 409 à l'envoi : afficher le `message` du serveur tel quel, relire `getMonAlerteEnCours()` et afficher l'état correspondant (compte à rebours ou « Vous pourrez relancer dans environ X minutes » calculé depuis `peutRelancerA`, mis à jour chaque seconde ou chaque minute) ; le bouton d'envoi reste désactivé jusqu'à `peutRelancerA`.
   - aucun libellé de statut brut (`LANCE`, `PRIS_EN_CHARGE`...) à l'écran : libellés humains (« Alerte envoyée », « Prise en charge »).
4. Ne pas changer le flux existant d'envoi (géolocalisation, compte à rebours de 5 s avant envoi, premiers secours) en dehors de ce qui est décrit.
5. Accessibilité : compte à rebours dans une zone `aria-live="polite"` (annonce au plus chaque minute, pas chaque seconde : texte lisible par les lecteurs d'écran séparé de l'affichage mm:ss si nécessaire).
6. Visuel : réutiliser les couleurs et composants déjà présents dans ces deux fichiers (rouge d'urgence, etc.), contraste AA clair et sombre.

## Contraintes

Faire uniquement ce qui est demandé : pas de refactors, helpers ou abstractions non demandés. Ne pas modifier `src/lib/api_auth.ts` (autre tâche). Règles d'audience, visuelles, typographiques et de langue : docs/ORCHESTRATOR.md (sections 1 à 5, 14 ; vocabulaire : « alerte SOS », « établissement de santé »). Ne pas modifier docs/plans/. Écrire les fichiers uniquement avec Write et Edit, jamais par redirection shell. Nettoyer timers et écouteurs au démontage. Aucun tiret cadratin ou demi-cadratin dans les lignes ajoutées. Aucun commit.

## Done when

- `npx --no-install tsc --noEmit` sans erreur ; eslint des fichiers touchés : aucune erreur nouvelle (lister à part les préexistantes).
- Termes interdits : 0 occurrence dans les chaînes visibles ajoutées (grep montré).
- `takeChargeSOS` envoie `delaiArriveeMinutes` (ligne citée) ; tous les `setInterval`/`setTimeout` ajoutés ont leur nettoyage (lignes citées).

## Return

Fichiers modifiés + preuves (commande lancée, résultat en une ligne). Ou un bloc BLOCKED. Pas de prose.

## Historique

- 2026-10-07 : exécutée directement par l'orchestrateur de reprise (D16). Aucune connexion en direct côté patient (D14) : seule la relecture périodique est utilisée. À l'ouverture, si l'alerte en cours bloque encore la relance, le compte à rebours d'envoi de 5 s est arrêté et l'état de l'alerte est affiché ; sinon le flux d'envoi existant continue.

## Validation

- `npx --no-install tsc --noEmit` : 0 erreur.
- `npx --no-install eslint` (3 fichiers) : 0 erreur, 4 avertissements préexistants (dette préexistante en en-tête, D15).
- `takeChargeSOS` : `body: JSON.stringify({ delaiArriveeMinutes })`.
- Minuteurs ajoutés et nettoyage : relecture `setInterval(chargerAlerte, 20 000)` / `clearInterval(id)` ; horloge `setInterval(..., 1000)` / `clearInterval(id)`, tous deux dans un `useEffect` avec retour de nettoyage, actifs seulement modale ouverte.
- Termes interdits et tirets : 0 occurrence dans les chaînes visibles ajoutées (grep des lignes ajoutées).
- Parcours navigateur non joué : aucun serveur ne tourne pendant ce run.
