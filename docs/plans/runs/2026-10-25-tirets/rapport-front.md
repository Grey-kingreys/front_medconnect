# Rapport front : retrait des tirets cadratins et demi-cadratins

Branche `task/sans-tirets-longs`.

## Résultat

- 72 lignes modifiées dans 38 fichiers (les occurrences d'une même ligne sont comptées une fois ; aucune autre ligne touchée).
- Vérification : `git grep -n -P "[\x{2013}\x{2014}]" -- . ':!package-lock.json' ':!.agents'` est vide.
- Fichiers : AGENTS.md, CLAUDE.md, Dockerfile, public/manifest.json, public/sw.js, pages `auth/layout`, `cgu`, `confidentialite`, `mentions-legales`, `layout`, `not-found`, `page`, pages du `dashboard` (carnet, catalogue, diagnostic, layout, medicaments, membres, profil, stock, structures, super-admin, utilisateurs, vaccinations), composants (FileUpload, Footer, ImageWithFallback, InstallAppButton, PricingSection, ServiceWorkerRegistration, StructuredData, StatCard, StructureModal), `lib/` (api_auth, api_carnet, api_storage).

## Exemples avant / après (texte visible)

- `MedConnecte (tiret cadratin) Plateforme de Santé Numérique en Guinée` devient `MedConnecte : Plateforme de Santé Numérique en Guinée` (layout, StructuredData ; idem manifest et Open Graph).
- `Diagnostic Médical IA (tiret cadratin) MedConnecte Guinée` devient `Diagnostic Médical IA : MedConnecte Guinée`.
- `3. Diagnostic IA (tiret cadratin) Disclaimer` devient `3. Diagnostic IA : avertissement`.
- `diagnostic IA (tiret cadratin) tout dans votre poche.` devient `diagnostic IA, tout dans votre poche.`
- `Optionnel (tiret cadratin) PDF, image, DICOM` devient `Optionnel : PDF, image, DICOM`.
- `{nom} (tiret cadratin) {type}` (profil) devient `{nom} ({type})`.
- `<strong>{m.nom}</strong> (tiret cadratin) {m.dosage}` devient `... : {m.dosage}`.
- Valeurs vides : `|| "(tiret cadratin)"` devient `"Non renseigné"` (catalogue, stock nom générique, n° de lot vaccin) ou `"-"` quand une unité suit ou que la place est étroite (poids/taille, km, prix, cartes de stats, cellules de tableaux, coordonnées, animation 404).

## Gate

- `tsc --noEmit` : OK, aucune erreur.
- `eslint` sur les fichiers .ts/.tsx touchés : 26 erreurs et 27 avertissements, tous préexistants (ex. `react-hooks/set-state-in-effect`), aucun lié aux changements (chaînes et commentaires uniquement).
- `vitest run` : 53 fichiers, 454 tests passés. Aucun test modifié.

## Cas laissés volontairement

- `.agents/` et `package-lock.json` non touchés (consigne). Aucun autre cas laissé.
- Les valeurs vides ont reçu un simple « - » quand « Non renseigné » ne rentrait pas (suivi d'une unité, cartes, cellules étroites).
