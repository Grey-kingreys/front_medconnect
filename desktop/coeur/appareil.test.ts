import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fixerAppareil, lireAppareilId } from "../electron/appareil";
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

describe("appareil.json", () => {
  it("écrit l'identifiant de la base quand le fichier manque", () => {
    const coeur = new CoeurCaisse(base(), outils());
    const id = fixerAppareil(coeur, dossier);
    expect(lireAppareilId(dossier)).toBe(id);
  });

  it("base et fichier en désaccord : alerte, la base fait foi, le fichier est corrigé", () => {
    const coeur = new CoeurCaisse(base(), outils());
    const idBase = coeur.appareilId();
    writeFileSync(path.join(dossier, "appareil.json"), JSON.stringify({ appareilId: uuid(77) }));
    const journal = vi.fn();
    expect(fixerAppareil(coeur, dossier, journal)).toBe(idBase);
    expect(journal).toHaveBeenCalledTimes(1);
    expect(String(journal.mock.calls[0][0])).toContain("alerte");
    expect(lireAppareilId(dossier)).toBe(idBase);
    expect(readFileSync(path.join(dossier, "appareil.json"), "utf8")).toContain(idBase);
  });

  it("base vide et fichier valide : le fichier fait foi, sans alerte", () => {
    const coeur = new CoeurCaisse(base(), outils());
    writeFileSync(path.join(dossier, "appareil.json"), JSON.stringify({ appareilId: uuid(78) }));
    const journal = vi.fn();
    expect(fixerAppareil(coeur, dossier, journal)).toBe(uuid(78));
    expect(journal).not.toHaveBeenCalled();
  });
});
