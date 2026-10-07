# T06 - Schémas Zod des 5 envois médicaux et typage de api_carnet.ts

Tier: dur (agent implementeur-dur)
Audience: non-dev (messages d'erreur de validation potentiellement affichés)
Visuel: n/a
Background-safe: oui

Worktree de travail : `D:/souleymane/perso-archive-20260923/perso/medconnecte/.worktrees/front-p3-fond` (branche `orch/p3-fond`, Vitest déjà installé par T05 : script `npm test`). Ne travaille que là. Ne commite pas : l'orchestrateur commite.

## Spec

Point 21 du backlog. Les 5 envois de données médicales de `src/lib/api_carnet.ts` sont typés `any` : `createConsultation`, `createOrdonnance`, `createVaccination`, `createAnalyse`, `createRendezVous`. Décision D02 : Zod, nouveau module `src/lib/schemas/carnet.ts`.

1. Ajouter `zod` aux dépendances (`npm install zod --no-audit --no-fund`, version 4 stable si compatible, sinon 3 ; le dire dans le Return).
2. Créer `src/lib/schemas/carnet.ts` : un schéma par envoi, **calqué exactement sur les DTO du back** (source de vérité : `D:/souleymane/perso-archive-20260923/perso/medconnecte/.worktrees/back-p3-fond/src/carnet-sante/dto/carnet-sante.dto.ts`, lecture seule) : mêmes champs, mêmes optionnels, mêmes contraintes (chaînes, dates ISO, nombres, énumérations, longueurs). **Jamais plus strict que le back** (sinon on bloque des envois légitimes). Exporter les types par `z.infer` (`ConsultationInput`, `OrdonnanceInput`, `VaccinationInput`, `AnalyseInput`, `RendezVousInput`). Commentaire d'en-tête : source DTO, règle « ne jamais être plus strict que le back », à garder synchronisé.
   - `medicaments` de l'ordonnance : le back attend aujourd'hui une chaîne JSON (vérifier dans le DTO). Le niveau P2 (F2) ajoute un identifiant de médicament du catalogue dans les lignes, sans migration : le schéma doit rester une chaîne (éventuellement « JSON valide » si et seulement si le back le valide), sans figer la forme des lignes.
   - Messages d'erreur des schémas en français, vocabulaire utilisateur (section 1 et 14 de docs/ORCHESTRATOR.md : pas de « ID », « JSON », « null »...). Exemple : « Indiquez le motif de la consultation. »
3. Dans `src/lib/api_carnet.ts`, remplacer **uniquement** les 5 `data: any` par les types inférés, et valider avant l'envoi : `schema.safeParse(data)` ; en cas d'échec, lever une `Error` dont le message est le premier message d'erreur humain du schéma (pas le détail technique Zod) ; en cas de succès, envoyer `JSON.stringify(data)` (les données d'origine, pour ne rien changer au contenu envoyé). Ne modifier aucune autre fonction ni aucun autre type du fichier. Ne pas toucher `api_auth.ts` (niveau P2).
4. **Compatibilité des appelants sans les modifier** : `src/components/DoctorAddRecordModal.tsx` et `src/app/dashboard/carnet/[patientId]/components/AddRecordForms.tsx` (modifiés par P2, D04) doivent continuer de compiler sans changement. Si un appelant passe un champ que le DTO du back n'accepte pas (le back est en `forbidNonWhitelisted`), ne pas modifier l'appelant : le signaler dans le Return (c'est un bug existant pour P2) et choisir un typage qui compile (par exemple champ optionnel documenté `// Envoyé par ..., refusé par le back : à corriger`).
5. Tests : `src/lib/schemas/carnet.test.ts` (Vitest) : pour chaque schéma, un cas valide minimal, un cas valide complet, au moins un cas invalide avec message en français ; un test qui vérifie que `createConsultation` invalide lève une erreur sans appeler `authFetch` (mock `./api_auth`, voir `src/lib/api_carnet.test.ts` créé par T05, à compléter si utile sans casser ses tests).

## Contraintes

Faire uniquement ce qui est demandé : pas de refactors, helpers ou abstractions non demandés. Commentaires en français. Aucun tiret cadratin ni demi-cadratin. Ne pas modifier docs/plans/. Écrire les fichiers uniquement avec Write et Edit, jamais par redirection shell (npm install autorisé pour package.json et le lock). Next.js 16 : non concerné (code TypeScript pur), mais ne rien importer de `next` dans le module de schémas.

## Done when

Dans le worktree :
- `grep -n "any" src/lib/api_carnet.ts` : plus aucun `data: any`.
- `npm test` : toutes les suites passent (celles de T05 comprises).
- `npx --no-install tsc --noEmit` : aucune erreur (donc DoctorAddRecordModal.tsx et AddRecordForms.tsx compilent sans modification).
- `npx --no-install eslint src/lib/api_carnet.ts src/lib/schemas/carnet.ts src/lib/schemas/carnet.test.ts` (et `src/lib/api_carnet.test.ts` si touché) : aucune erreur.
- `git status --porcelain` : seulement package.json, package-lock.json, src/lib/api_carnet.ts, src/lib/schemas/*, éventuellement src/lib/api_carnet.test.ts.
- Return : tableau champ par champ DTO back vs schéma (une ligne par envoi suffit si identique) et liste des incompatibilités d'appelants trouvées.

## Return

Chemins + preuves (commande lancée, résultat en une ligne) + incompatibilités. Ou un bloc BLOCKED. Pas de prose.

## Historique

2026-10-06 | dur | interrompu | travail laissé non commité (orchestrateur figé)
2026-10-07 | orchestrateur | réussi | repris et validé sans sous-agent ; zod ^4.6.5 (version 4)

DTO back vs schéma : identique champ par champ pour les 5 envois (mêmes obligatoires, mêmes @Length, mêmes dates ISO, même énumération de statut). Écarts volontaires plus souples : `.nullish()` (accepte null comme @IsOptional), `z.guid()` pour @IsUUID, `medicaments` liste au contenu non vérifié (le back n'a pas de @ValidateNested).

Incompatibilités d'appelants (non modifiés, D04, pour P2) : `prochainRappel: ""` envoyé par les deux formulaires de vaccination quand le champ est vide, refusé par le back comme par le schéma. Aucun champ hors DTO trouvé.

## Validation

grep any api_carnet.ts | aucune occurrence | 6461953
npm test | 4 fichiers, 32 tests OK | 6461953
npx --no-install tsc --noEmit | exit 0, appelants P2 compilent sans modification | 6461953
eslint api_carnet.ts, api_carnet.test.ts, schemas/carnet.ts, schemas/carnet.test.ts | exit 0 | 6461953
npm ci --dry-run | aucune désynchronisation du lock | 6461953
