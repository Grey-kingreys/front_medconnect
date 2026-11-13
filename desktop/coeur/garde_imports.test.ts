import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const DOSSIER = dirname(fileURLToPath(import.meta.url));

function fichiersSource(dossier: string): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const chemin = join(dossier, e.name);
    if (e.isDirectory()) return fichiersSource(chemin);
    return e.name.endsWith(".ts") && !e.name.endsWith(".test.ts") ? [chemin] : [];
  });
}

/** Modules importés (import, import(), require) d'un fichier. */
function modulesImportes(texte: string): string[] {
  const motif = /(?:from|import|require)\s*\(?\s*["']([^"']+)["']/g;
  return [...texte.matchAll(motif)].map((m) => m[1]);
}

describe("garde des imports du cœur", () => {
  const fichiers = fichiersSource(DOSSIER);

  it("le cœur compte des fichiers à contrôler", () => {
    expect(fichiers.length).toBeGreaterThan(3);
  });

  it("aucun fichier n'importe electron, next ou react", () => {
    const fautifs = fichiers.filter((f) =>
      modulesImportes(readFileSync(f, "utf8")).some((m) => /^(electron|next|react)([/-].*)?$/.test(m)),
    );
    expect(fautifs).toEqual([]);
  });

  it("preload.ts n'exporte pas ipcRenderer et ne l'expose jamais en bloc", () => {
    const texte = readFileSync(join(DOSSIER, "..", "electron", "preload.ts"), "utf8");
    expect(texte).not.toMatch(/^\s*export\s/m);
    const sansImport = texte.replace(/^import .*$/gm, "").replace(/\/\/.*$/gm, "");
    // Chaque usage est un appel de méthode précis : invoke, on ou removeListener.
    const usages = [...sansImport.matchAll(/ipcRenderer(?![A-Za-z])(.{0,16})/g)].map((m) => m[1]);
    expect(usages.length).toBeGreaterThan(0);
    for (const suite of usages) expect(suite).toMatch(/^\.(invoke|on|removeListener)\(/);
    // Le bloc exposé ne cite jamais ipcRenderer comme valeur.
    const expose = sansImport.slice(sansImport.indexOf("exposeInMainWorld"));
    expect(expose).not.toMatch(/:\s*ipcRenderer\b/);
  });

  it("le rendu ne peut pas déclarer d'identité : ni canal, ni méthode de pont", () => {
    const electron = join(DOSSIER, "..", "electron");
    const sansCommentaires = (f: string) => readFileSync(join(electron, f), "utf8").replace(/\/\/.*$/gm, "");
    expect(sansCommentaires("ipc.ts")).not.toMatch(/handle\(\s*["'`]utilisateur/);
    expect(sansCommentaires("preload.ts")).not.toMatch(/definirUtilisateur|"utilisateur"/);
  });

  it("seul stockage_sqlite.ts importe better-sqlite3", () => {
    const importeurs = fichiers
      .filter((f) => modulesImportes(readFileSync(f, "utf8")).includes("better-sqlite3"))
      .map((f) => f.slice(DOSSIER.length + 1).replace(/\\/g, "/"));
    expect(importeurs).toEqual(["stockage_sqlite.ts"]);
  });
});
