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
