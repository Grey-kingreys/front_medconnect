# F3 - Plus aucun lien vide sur la page d'accueil, avec test de garde

Tier: mécanique (agent mecanique)
Audience: non-dev (landing publique), mais aucun texte visible modifié
Visuel: n/a (aucun rendu modifié)
Background-safe: non, car docker compose exec (typage, lint et tests dans le conteneur frontend)

## Spec

Dépôt : `D:\souleymane\perso-archive-20260923\perso\medconnecte\front_medconnect`, branche `orch/lot1-front` (arbre principal, ne pas changer de branche, ne pas committer).

### Contexte (déjà vérifié par le chef d'équipe, ne pas re-chercher)

- Les points 18 à 24 du CLAUDE.md racine sont déjà traités dans le code : flags `SHOW_STATS` et `SHOW_TESTIMONIALS` dans `src/app/page.tsx`, ancre « Témoignages » conditionnelle dans `Navbar.tsx`, logos vers `/`, liens légaux vers `/confidentialite`, `/cgu`, `/mentions-legales`, `/rgpd`, liens sans cible retirés du pied de page, réseaux sociaux vidés (`socialLinks = []`).
- Le seul `href="#"` restant dans `src/` est **dans un commentaire**, pas dans un lien : `src/components/Footer.tsx`, ligne 46, bloc JSDoc au-dessus de `footerLinks`. Aucun lien `#` vide n'existe dans le code rendu (grep fait sur `href="#"`, `href={"#"}`, `href: "#"`, guillemets simples et doubles).
- Les ancres internes utilisées (`#features`, `#how-it-works`, `#pricing`, `#cta`, `#testimonials`) ont toutes un `id` correspondant dans `src/components/` (FeaturesSection, HowItWorksSection, PricingSection, CTASection, TestimonialsSection).
- Décisions : D13 (le commentaire est reformulé pour que le contrôle par grep soit net), D14 (test de garde ajouté), D15 (contenu juridique et coordonnées non touchés).

### Changement 1 : `src/components/Footer.tsx`, commentaire ligne 46 uniquement

Remplacer exactement la ligne :

```
 * Seuls les liens ayant une destination réelle sont listés : un `href="#"` en
```

par :

```
 * Seuls les liens ayant une destination réelle sont listés : un lien vers « # » seul en
```

Rien d'autre ne change dans ce fichier (ni code, ni autres lignes du commentaire, ni le bloc `TODO(#24)`, ni les coordonnées de contact, ni les liens légaux).

### Changement 2 : nouveau fichier `src/components/liens_accueil.test.ts`

Contenu à reprendre tel quel :

```ts
/**
 * Garde contre les liens morts de la page d'accueil publique.
 * Un lien vers « # » seul remonte en haut de page sans rien faire : il dégrade la
 * confiance et le référencement. Chaque ancre interne doit viser une section existante.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE_SRC = resolve(process.cwd(), "src");
const DOSSIER_COMPOSANTS = join(RACINE_SRC, "components");

// Fichiers .ts et .tsx d'un dossier, sous-dossiers compris, hors fichiers de test.
function fichiersSource(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return fichiersSource(chemin);
    if (!/\.tsx?$/.test(nom) || /\.test\.tsx?$/.test(nom)) return [];
    return [chemin];
  });
}

// Lien vers « # » seul, en attribut JSX ou en propriété d'objet, quels que soient les guillemets.
const LIEN_VIDE = /href\s*(=|:)\s*\{?\s*(["'`])#\2/;
// Ancre interne vers une section, en attribut JSX ou en propriété d'objet.
const ANCRE = /href\s*(?:=|:)\s*\{?\s*["'`]#([a-z0-9-]+)["'`]/g;
const IDENTIFIANT = /id=["']([a-z0-9-]+)["']/g;

describe("liens de la page d'accueil", () => {
  it("aucun lien vers « # » seul dans src", () => {
    const fautifs = fichiersSource(RACINE_SRC).flatMap((fichier) =>
      readFileSync(fichier, "utf8")
        .split("\n")
        .flatMap((ligne, i) =>
          LIEN_VIDE.test(ligne) ? [`${relative(RACINE_SRC, fichier)}:${i + 1}`] : [],
        ),
    );
    expect(fautifs).toEqual([]);
  });

  it("chaque ancre interne des composants vise une section existante", () => {
    const sources = fichiersSource(DOSSIER_COMPOSANTS).map((f) => readFileSync(f, "utf8"));
    const ancres = new Set(sources.flatMap((s) => [...s.matchAll(ANCRE)].map((m) => m[1])));
    const identifiants = new Set(
      sources.flatMap((s) => [...s.matchAll(IDENTIFIANT)].map((m) => m[1])),
    );
    expect(ancres.size).toBeGreaterThan(0);
    const orphelines = [...ancres].filter((a) => !identifiants.has(a));
    expect(orphelines).toEqual([]);
  });
});
```

Si le typage ou le lint signale une erreur sur ce fichier, corriger le minimum dans CE fichier (par exemple un type explicite), sans changer ce que vérifient les deux tests. Ne pas modifier `vitest.config.mts`, `tsconfig.json` ni `eslint.config.mjs`.

### Interdits

- Ne toucher à aucun autre fichier que les deux ci-dessus.
- Ne pas modifier le contenu juridique (`src/app/cgu`, `confidentialite`, `mentions-legales`, `rgpd`) ni les coordonnées de contact ou réseaux sociaux du pied de page (en attente du porteur, point 24).
- Ne pas supprimer les tirets cadratins déjà présents dans `Footer.tsx` (ligne `TODO(#24)`) : contenu existant, hors périmètre.

## Contraintes

Faire uniquement ce qui est demandé : pas de refactors, helpers ou abstractions non demandés. Discipline de code dans l'ordre : réutiliser l'existant > ranger au bon endroit > n'abstraire qu'à la règle de trois. Règles d'audience, visuelles, typographiques et de langue : docs/ORCHESTRATOR.md. Ne pas modifier docs/plans/. Écrire les fichiers uniquement avec Write et Edit, jamais par redirection shell : le hook de garde ne voit pas les écritures faites par Bash.

## Done when

Toutes les commandes sont lancées depuis `D:\souleymane\perso-archive-20260923\perso\medconnecte` :

1. `grep -rnE "href\s*(=|:)\s*\{?\s*[\"'\`]#[\"'\`]" front_medconnect/src` ne renvoie rien (code de sortie 1).
2. `docker compose exec -T frontend npx tsc --noEmit` : 0 erreur.
3. `docker compose exec -T frontend npx eslint src/components/Footer.tsx src/components/liens_accueil.test.ts` : 0 erreur, 0 avertissement.
4. `docker compose exec -T frontend npx vitest run src/components/liens_accueil.test.ts` : 2 tests passent.
5. `docker compose exec -T frontend npx vitest run` : toute la suite passe.
6. `git -C front_medconnect status --short` ne liste que `src/components/Footer.tsx` (modifié) et `src/components/liens_accueil.test.ts` (nouveau), et `git -C front_medconnect diff src/components/Footer.tsx` ne montre qu'une seule ligne changée (la ligne 46 du commentaire).
7. Aucun tiret cadratin ni demi-cadratin dans les lignes ajoutées (hook de garde et pre-commit).

## Return

Chemin de l'artefact + preuve (commande lancée, résultat en une ligne). Ou un bloc BLOCKED. Pas de prose.

## Historique

<!-- une ligne par tentative : AAAA-MM-JJ | tier | résultat | raison si échec -->

## Validation

<!-- commande relancée par l'orchestrateur | résultat en une ligne | hash du commit -->
