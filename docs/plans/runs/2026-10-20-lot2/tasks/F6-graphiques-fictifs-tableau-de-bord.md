# F6 - Retrait des graphiques fictifs et du badge « En direct » du tableau de bord

Tier: spécifié (agent implementeur-specifie)
Audience: non-dev (tableau de bord des rôles patient, médecin, pharmacien, administrateur de structure)
Visuel: préventif (on retire une section ; aucun nouveau style, aucune carte vide, clair et sombre inchangés pour le reste de la page)
Background-safe: non, car docker compose exec (typage, lint et tests dans le conteneur frontend)

## Spec

Dépôt : `D:\souleymane\perso-archive-20260923\perso\medconnecte\front_medconnect`, branche `orch/lot2-front` (arbre principal, ne pas changer de branche, ne pas committer). Le back (`back_medconnect`) ne doit PAS être modifié. Décisions du run : `docs/plans/runs/2026-10-20-lot2/decisions.md` (D20 à D23), déjà tranchées, ne pas les rediscuter.

But : le tableau de bord ne montre jamais de chiffres inventés. La section « Analyses et Tendances » (composant `DashboardCharts`) affiche des graphiques à données codées en dur, avec un badge « En direct » mensonger. On retire la section du rendu (le composant reste dans le code, même motif que `SHOW_STATS` de la page d'accueil) et on supprime le badge.

### Contexte (déjà vérifié par le chef d'équipe, ne pas re-chercher)

- `src/components/DashboardCharts.tsx` : toutes les séries (`PATIENT_DATA`, `DOCTOR_DATA`, `PIE_DATA`, `PHARMACY_DATA`, `STRUCTURE_DATA`) sont des constantes inventées. Aucune route du back ne fournit directement une série (seules `GET /users/stats` et `GET /super-admin/stats` existent, elles renvoient des totaux, pas des séries ; cf. D20). **Ne pas modifier ce fichier** (il porte une erreur de lint préexistante `react-hooks/set-state-in-effect` ligne 59 qui bloquerait le pre-commit s'il était indexé ; cf. D22).
- `src/app/dashboard/page.tsx` :
  - ligne 21 : import `TrendingUp` de `lucide-react`, utilisé uniquement par le badge (ligne 581) ;
  - ligne 31 : `import DashboardCharts from "@/components/DashboardCharts";` (à garder) ;
  - lignes 478-479 : commentaire puis `const showCharts = ["PATIENT", "MEDECIN", "PHARMACIEN", "STRUCTURE_ADMIN"].includes(user.role);` ;
  - lignes 572-587 : section `{showCharts && (<section ...> ... titre « Analyses et Tendances » ... badge « En direct » ... <DashboardCharts role={user.role} /> </section>)}`.
  - Fichier propre au lint aujourd'hui. Il contient un tiret cadratin préexistant (bloc « Structure info », entre `{profile.structure.nom}` et le type de structure) : ne pas y toucher.
- Modèle de drapeau existant : `src/app/page.tsx` lignes 11-13 et 23 (`const SHOW_STATS = false; // ...` puis `{SHOW_STATS && <StatsSection />}`).
- `src/app/dashboard/page.test.tsx` : utilisateur simulé de rôle `MEDECIN` (ligne 9), `DashboardCharts` simulé par `vi.mock("@/components/DashboardCharts", () => ({ default: () => null }))` (ligne 13), `vi.resetAllMocks()` dans `beforeEach`. Fichier propre au lint.

### Changement 1 : `src/app/dashboard/page.tsx`

1. Juste après les imports (avant le bloc `// ─── Types`), ajouter :
   ```ts
   // Graphiques « Analyses et Tendances » : données fictives codées en dur dans DashboardCharts.
   // Masqués tant qu'aucune route du back ne fournit de vraies séries (ne jamais montrer de chiffres inventés).
   const SHOW_CHARTS = false;
   ```
2. Remplacer les lignes 478-479 par :
   ```ts
   // Les graphiques n'existent que pour certains rôles (DashboardCharts renvoie null sinon) et restent masqués par SHOW_CHARTS.
   const showCharts = SHOW_CHARTS && ["PATIENT", "MEDECIN", "PHARMACIEN", "STRUCTURE_ADMIN"].includes(user.role);
   ```
3. Dans la section des graphiques, supprimer entièrement le badge (le `<div className="flex items-center gap-2 px-3 py-1 bg-primary-500/10 rounded-full">` et son contenu `TrendingUp` + « En direct »). Le reste de la section (titre, `<DashboardCharts role={user.role} />`) reste tel quel ; le conteneur `flex items-center justify-between mb-4` autour du titre peut rester.
4. Retirer `TrendingUp,` de l'import `lucide-react` (sinon avertissement de variable inutilisée).
5. Rien d'autre : l'import de `DashboardCharts` est gardé (toujours référencé dans le JSX), aucune autre section ne change, aucun texte de remplacement n'est ajouté (la page passe directement de « Aperçu » à « Accès rapide », aucune carte vide).

Si `tsc` signalait une comparaison toujours fausse à cause du littéral `false` (peu probable, le même motif passe dans `src/app/page.tsx`), écrire `const SHOW_CHARTS: boolean = false;` et rien de plus.

### Changement 2 : `src/app/dashboard/page.test.tsx`

1. Remplacer le mock ligne 13 par une fonction espionnable :
   ```ts
   const { graphiquesRendus } = vi.hoisted(() => ({ graphiquesRendus: vi.fn() }));
   vi.mock("@/components/DashboardCharts", () => ({ default: graphiquesRendus }));
   ```
   (après `vi.resetAllMocks()`, `graphiquesRendus` renvoie `undefined`, ce que React 19 accepte comme rendu vide).
2. Ajouter dans le `describe` existant un test :
   ```ts
   it("n'affiche ni graphiques fictifs ni badge « En direct »", async () => {
     vi.mocked(getMyPatients).mockResolvedValue(reponse(Array.from({ length: 7 }, () => ({}))));
     vi.mocked(getConsultations).mockResolvedValue(consultationsDuJour());
     vi.mocked(getRendezVous).mockResolvedValue(rendezVousAVenir());
     render(<DashboardPage />);
     expect(await within(carteDe("Patients de la structure")).findByText("7")).toBeTruthy();
     expect(screen.queryByText("Analyses et Tendances")).toBeNull();
     expect(screen.queryByText("En direct")).toBeNull();
     expect(graphiquesRendus).not.toHaveBeenCalled();
     expect(screen.getByText("Accès rapide")).toBeTruthy();
   });
   ```
3. Les 4 tests existants restent inchangés et doivent passer.

## Contraintes

Faire uniquement ce qui est demandé : pas de refactors, helpers ou abstractions non demandés. Ne pas modifier `src/components/DashboardCharts.tsx` ni le back. Discipline de code dans l'ordre : réutiliser l'existant > ranger au bon endroit > n'abstraire qu'à la règle de trois. Règles d'audience, visuelles, typographiques et de langue : docs/ORCHESTRATOR.md (commentaires en français, aucun tiret cadratin ni demi-cadratin dans les lignes ajoutées ou modifiées). Ne pas modifier docs/plans/. Écrire les fichiers uniquement avec Write et Edit, jamais par redirection shell : le hook de garde ne voit pas les écritures faites par Bash.

## Done when

Depuis `D:\souleymane\perso-archive-20260923\perso\medconnecte` :
1. `docker compose exec -T frontend npx tsc --noEmit` : aucune erreur.
2. `docker compose exec -T frontend npx eslint src/app/dashboard/page.tsx src/app/dashboard/page.test.tsx` : 0 erreur, 0 avertissement.
3. `docker compose exec -T frontend npx vitest run` : tous les tests passent, dont « n'affiche ni graphiques fictifs ni badge « En direct » ».
4. `git -C front_medconnect diff --name-only` ne liste que `src/app/dashboard/page.tsx` et `src/app/dashboard/page.test.tsx` (`src/components/DashboardCharts.tsx` intact).
5. `grep -n "En direct\|TrendingUp" front_medconnect/src/app/dashboard/page.tsx` : aucune sortie ; `grep -n "const SHOW_CHARTS = false" front_medconnect/src/app/dashboard/page.tsx` (ou la variante `: boolean`) : une ligne.
6. `git -C front_medconnect diff -U0 | grep "^+" | LC_ALL=C.UTF-8 grep -P "[\x{2013}\x{2014}]"` : aucune sortie.

## Return

Chemin de l'artefact + preuve (commande lancée, résultat en une ligne). Ou un bloc BLOCKED. Pas de prose.

## Historique

<!-- une ligne par tentative : AAAA-MM-JJ | tier | résultat | raison si échec -->

## Validation

<!-- commande relancée par l'orchestrateur | résultat en une ligne | hash du commit -->
