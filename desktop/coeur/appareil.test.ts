import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PosteIncoherent, fixerAppareil, lireAppareilId } from "../electron/appareil";
import { creerJournalFichier } from "../electron/journal_fichier";
import { base, fermerTout, outils, uuid } from "./aide_tests";
import { CoeurCaisse } from "./coeur";

let dossier = "";
beforeEach(() => {
  dossier = mkdtempSync(path.join(tmpdir(), "mc-appareil-"));
});
afterEach(() => {
  fermerTout();
  rmSync(dossier, { recursive: true, force: true });
});

describe("journal.log", () => {
  it("est créé dans le dossier de données et garde les lignes écrites", () => {
    const noter = creerJournalFichier(dossier);
    noter("premier message");
    noter("second message");
    const lignes = readFileSync(path.join(dossier, "journal.log"), "utf8").trim().split("\n");
    expect(lignes).toHaveLength(2);
    expect(lignes[0]).toMatch(/^\d{4}-\d{2}-\d{2}T.* premier message$/);
  });
});

describe("appareil.json", () => {
  it("écrit l'identifiant de la base quand le fichier manque", () => {
    const coeur = new CoeurCaisse(base(), outils());
    const id = fixerAppareil(coeur, dossier);
    expect(lireAppareilId(dossier)).toBe(id);
  });

  it("base et fichier en désaccord : arrêt, rien n'est écrit ni dans le fichier ni dans la base", () => {
    const coeur = new CoeurCaisse(base(), outils());
    const idBase = coeur.appareilId();
    const contenu = JSON.stringify({ appareilId: uuid(77) });
    writeFileSync(path.join(dossier, "appareil.json"), contenu);
    const journal = vi.fn();
    expect(() => fixerAppareil(coeur, dossier, journal)).toThrow(PosteIncoherent);
    expect(() => fixerAppareil(coeur, dossier, journal)).toThrow(/ne correspondent pas à son identifiant/);
    expect(journal).toHaveBeenCalled();
    expect(readFileSync(path.join(dossier, "appareil.json"), "utf8")).toBe(contenu);
    expect(coeur.appareilId()).toBe(idBase);
  });

  it("base qui porte déjà l'identifiant du fichier : accepté, sans alerte", () => {
    const coeur = new CoeurCaisse(base(), outils());
    const idBase = coeur.appareilId();
    writeFileSync(path.join(dossier, "appareil.json"), JSON.stringify({ appareilId: idBase }));
    const journal = vi.fn();
    expect(fixerAppareil(coeur, dossier, journal)).toBe(idBase);
    expect(journal).not.toHaveBeenCalled();
  });

  it("base vide et fichier valide : le fichier fait foi, sans alerte", () => {
    const coeur = new CoeurCaisse(base(), outils());
    writeFileSync(path.join(dossier, "appareil.json"), JSON.stringify({ appareilId: uuid(78) }));
    const journal = vi.fn();
    expect(fixerAppareil(coeur, dossier, journal)).toBe(uuid(78));
    expect(journal).not.toHaveBeenCalled();
  });
});
