# T10 - Point 11 : sirène SOS hébergée localement

Tier: spécifié (agent implementeur-specifie)
Audience: non-dev (son d'alerte ; aucun texte visible modifié)
Visuel: n/a
Background-safe: oui

## Spec

Constat (vérifié) : `src/components/EmergencyListener.tsx:92` charge la sirène depuis `https://cdn.pixabay.com/...mp3`. La CSP de `next.config.ts` n'autorise pas ce domaine (`default-src 'self'`, pas de `media-src`) : en production l'alarme reste muette.

Aucun téléchargement n'est possible : générer un son synthétique (décision D04).

À faire :
1. Créer `scripts/generer-sirene.mjs` (Node pur, sans dépendance) qui écrit `public/sounds/sirene.wav` : WAV PCM 16 bits mono, 22 050 Hz, environ 2 secondes, sirène à deux tons type « pin-pon » (alternance environ 0,5 s à ~960 Hz et ~770 Hz) ou balayage montant et descendant entre ~650 et ~1 300 Hz ; amplitude modérée (environ 0,6 de la pleine échelle) avec de courts fondus aux transitions pour éviter les clics, et une boucle sans à-coup (le fichier est joué avec `loop = true`). En-tête RIFF correct. Commentaires en français en tête du script : à quoi il sert et comment le relancer (`node scripts/generer-sirene.mjs`).
2. Lancer le script une fois pour produire `public/sounds/sirene.wav` (fichier binaire produit par le script : c'est l'exception voulue à la règle Write et Edit, le script lui-même s'écrit avec Write).
3. Dans `EmergencyListener.tsx`, remplacer l'URL externe par `"/sounds/sirene.wav"` et mettre à jour le commentaire. Rien d'autre.
4. Ne pas modifier `next.config.ts` : `default-src 'self'` couvre déjà un média du même domaine.

## Contraintes

Faire uniquement ce qui est demandé. Règles typographiques et de langue : docs/ORCHESTRATOR.md (commentaires en français, aucun tiret cadratin ni demi-cadratin). Ne pas modifier docs/plans/. Écrire les fichiers source uniquement avec Write et Edit, jamais par redirection shell. Ne pas commiter : l'orchestrateur commite.

## Done when

- `node -e` qui lit `public/sounds/sirene.wav` et affiche : en-tête `RIFF`/`WAVE`, format PCM 1, 1 canal, 22050 Hz, 16 bits, durée entre 1,5 et 3 s, taille inférieure à 200 Ko.
- Grep `pixabay` dans `src/` : 0 résultat ; grep `/sounds/sirene.wav` dans `EmergencyListener.tsx` : 1 résultat.
- `npx --no-install tsc --noEmit` : 0 erreur ; `npx --no-install eslint src/components/EmergencyListener.tsx scripts/generer-sirene.mjs` : 0 erreur, en appliquant la procédure D05 de `docs/plans/runs/2026-10-06-p1-beta/decisions.md` si le composant porte une dette préexistante.

## Return

Liste des fichiers créés ou modifiés + preuves (commandes lancées, résultat en une ligne chacune). Ou un bloc BLOCKED. Pas de prose.

## Historique

## Validation
