import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  comparerFefo,
  estPerime,
  ordonnerLotsPourVente,
  selectionnerLots,
  type DemandeSelection,
  type LotCandidat,
} from "./selection_lots";

// Vecteurs partagés avec le back : copie à l'identique de back_medconnect/test/vecteurs/selection-lots.json.
interface CasVecteur {
  nom: string;
  entree: DemandeSelection;
  attendu: {
    allocations: { lotId: string; quantite: number }[];
    resteProvisoire: number;
    lotsPerimesDisponibles: string[];
  };
}
interface FichierVecteurs {
  version: number;
  cas: CasVecteur[];
}

// Vitest tourne depuis la racine du front (jsdom : import.meta.url n'est pas un chemin de fichier).
const CHEMIN_COPIE = join(process.cwd(), "src/lib/caisse/regles/vecteurs/selection-lots.json");
const CHEMIN_ORIGINAL = join(process.cwd(), "..", "back_medconnect/test/vecteurs/selection-lots.json");
const fichier = JSON.parse(readFileSync(CHEMIN_COPIE, "utf8")) as FichierVecteurs;

function lot(id: string, champs: Partial<LotCandidat> = {}): LotCandidat {
  return {
    id,
    numeroLot: id,
    dateExpiration: "2027-01-31",
    dateReception: "2026-10-01T08:00:00.000Z",
    solde: 10,
    coefficientReception: 1,
    coutUnitaire: 0,
    lotTechnique: false,
    ...champs,
  };
}

describe("selectionnerLots : vecteurs partagés avec le back", () => {
  it("le fichier est en version 1 et compte 24 cas", () => {
    expect(fichier.version).toBe(1);
    expect(fichier.cas).toHaveLength(24);
  });

  it.each(fichier.cas)("$nom", (c) => {
    const r = selectionnerLots(c.entree);
    expect({
      allocations: r.allocations.map((a) => ({ lotId: a.lotId, quantite: a.quantite })),
      resteProvisoire: r.resteProvisoire,
      lotsPerimesDisponibles: r.lotsPerimesDisponibles.map((l) => l.lotId),
    }).toEqual(c.attendu);
    const somme = r.allocations.reduce((s, a) => s + a.quantite, 0);
    expect(somme + r.resteProvisoire).toBe(c.entree.quantiteUm);
  });

  // Le dépôt front se clone seul : sans le dépôt du back à côté, la comparaison est sautée.
  it.skipIf(!existsSync(CHEMIN_ORIGINAL))("la copie est identique à l'original du back", () => {
    expect(readFileSync(CHEMIN_COPIE, "utf8")).toBe(readFileSync(CHEMIN_ORIGINAL, "utf8"));
  });
});

describe("selectionnerLots : règles", () => {
  it("un lot périmé n'est jamais pris, le reste est provisoire", () => {
    const r = selectionnerLots({
      jour: "2026-11-01",
      unite: "BOITE",
      quantiteUm: 5,
      lots: [lot("P", { dateExpiration: "2026-10-31", solde: 10 })],
    });
    expect(r.allocations).toEqual([]);
    expect(r.resteProvisoire).toBe(5);
    expect(r.lotsPerimesDisponibles.map((l) => l.lotId)).toEqual(["P"]);
  });

  it("refuse un lot en double et une quantité nulle", () => {
    expect(() =>
      selectionnerLots({ jour: "2026-11-01", unite: "BOITE", quantiteUm: 1, lots: [lot("A"), lot("A")] }),
    ).toThrow(RangeError);
    expect(() => selectionnerLots({ jour: "2026-11-01", unite: "BOITE", quantiteUm: 0, lots: [lot("A")] })).toThrow(
      RangeError,
    );
  });

  it("estPerime : le jour même reste vendable, sans date jamais périmé", () => {
    expect(estPerime("2026-11-01", "2026-11-01")).toBe(false);
    expect(estPerime("2026-10-31", "2026-11-01")).toBe(true);
    expect(estPerime(null, "2026-11-01")).toBe(false);
  });

  it("comparerFefo : date nulle d'abord, puis date, réception, identifiant", () => {
    const tries = [
      lot("C", { dateExpiration: "2027-02-01" }),
      lot("B", { dateExpiration: null }),
      lot("A", { dateExpiration: "2027-02-01", dateReception: "2026-09-01T08:00:00.000Z" }),
    ].sort(comparerFefo);
    expect(tries.map((l) => l.id)).toEqual(["B", "A", "C"]);
  });

  it("ordonnerLotsPourVente : les lots à reliquat passent avant les autres", () => {
    const ordre = ordonnerLotsPourVente(
      [
        lot("A", { solde: 20, coefficientReception: 20, dateExpiration: "2027-03-31" }),
        lot("B", { solde: 24, coefficientReception: 20, dateExpiration: "2027-09-30" }),
      ],
      "2026-11-01",
    );
    expect(ordre.map((l) => l.id)).toEqual(["B", "A"]);
  });
});
