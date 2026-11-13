import { describe, expect, it } from "vitest";
import { calculerStockLocal, type LotPhoto, type SortieLocale } from "./stock_local";

const JOUR = "2026-11-01";

function lot(id: string, solde: number, champs: Partial<LotPhoto> = {}): LotPhoto {
  return {
    id,
    numeroLot: id,
    dateExpiration: "2027-06-30",
    dateReception: "2026-10-01T08:00:00.000Z",
    coefficientReception: 1,
    solde,
    lotTechnique: false,
    ...champs,
  };
}

const lotSortie = (lotId: string, quantiteUm: number): SortieLocale => ({ lotId, quantiteUm });
const provisoire = (quantiteUm: number): SortieLocale => ({ lotId: null, quantiteUm });

describe("calculerStockLocal (D738)", () => {
  it("40 en L1, aucune sortie : 40, 0, 40", () => {
    const r = calculerStockLocal({ quantite: 40, quantiteARegulariser: 0, lots: [lot("L1", 40)] }, [], JOUR);
    expect([r.quantite, r.quantiteARegulariser, r.quantiteVendable]).toEqual([40, 0, 40]);
  });

  it("5 en L1, sort L1=5 et provisoire=2 : 0, 2, 0", () => {
    const r = calculerStockLocal(
      { quantite: 5, quantiteARegulariser: 0, lots: [lot("L1", 5)] },
      [lotSortie("L1", 5), provisoire(2)],
      JOUR,
    );
    expect([r.quantite, r.quantiteARegulariser, r.quantiteVendable]).toEqual([0, 2, 0]);
    expect(r.lots).toEqual([]);
  });

  it("3 avec 2 à régulariser, L1=5, sort L1=4 : 0, 2, 0", () => {
    const r = calculerStockLocal({ quantite: 3, quantiteARegulariser: 2, lots: [lot("L1", 5)] }, [lotSortie("L1", 4)], JOUR);
    expect([r.quantite, r.quantiteARegulariser, r.quantiteVendable]).toEqual([0, 2, 0]);
    expect(r.lots.map((l) => [l.id, l.solde])).toEqual([["L1", 1]]);
  });

  it("agrégat -1 sans lot, provisoire=2 : 0, 3, 0", () => {
    const r = calculerStockLocal({ quantite: 0, quantiteARegulariser: 1, lots: [] }, [provisoire(2)], JOUR);
    expect([r.quantite, r.quantiteARegulariser, r.quantiteVendable]).toEqual([0, 3, 0]);
  });

  it("aucun lot, provisoire=1 : 0, 1, 0", () => {
    const r = calculerStockLocal({ quantite: 0, quantiteARegulariser: 0, lots: [] }, [provisoire(1)], JOUR);
    expect([r.quantite, r.quantiteARegulariser, r.quantiteVendable]).toEqual([0, 1, 0]);
  });

  it("lot périmé : 10, 0, 0, date du lot périmé", () => {
    const r = calculerStockLocal(
      { quantite: 10, quantiteARegulariser: 0, lots: [lot("L1", 10, { dateExpiration: "2026-10-01" })] },
      [],
      JOUR,
    );
    expect([r.quantite, r.quantiteARegulariser, r.quantiteVendable]).toEqual([10, 0, 0]);
    expect(r.dateExpiration).toBe("2026-10-01");
  });

  it("deux lots de coefficient 20, sort L1=6 : 44, 0, 44, reliquat L1=4, rien sur L2", () => {
    const r = calculerStockLocal(
      {
        quantite: 50,
        quantiteARegulariser: 0,
        lots: [
          lot("L1", 30, { coefficientReception: 20, dateExpiration: "2027-03-31" }),
          lot("L2", 20, { coefficientReception: 20, dateExpiration: "2027-09-30" }),
        ],
      },
      [lotSortie("L1", 6)],
      JOUR,
    );
    expect([r.quantite, r.quantiteARegulariser, r.quantiteVendable]).toEqual([44, 0, 44]);
    expect(r.lots.find((l) => l.id === "L1")?.solde).toBe(24);
    expect(r.reliquat).toEqual([{ lotId: "L1", unitesRestantes: 4 }]);
    expect(r.dateExpiration).toBe("2027-03-31");
  });

  it("plaquettes (coefficient 10), L1=26, sort 7 : 19, 0, 19, reliquat 9", () => {
    const r = calculerStockLocal(
      { quantite: 26, quantiteARegulariser: 0, lots: [lot("L1", 26, { coefficientReception: 10 })] },
      [lotSortie("L1", 7)],
      JOUR,
    );
    expect([r.quantite, r.quantiteARegulariser, r.quantiteVendable]).toEqual([19, 0, 19]);
    expect(r.reliquat).toEqual([{ lotId: "L1", unitesRestantes: 9 }]);
  });

  it("jamais de valeur négative, même avec des sorties supérieures au stock", () => {
    const r = calculerStockLocal(
      { quantite: 2, quantiteARegulariser: 0, lots: [lot("L1", 2)] },
      [lotSortie("L1", 9), provisoire(4)],
      JOUR,
    );
    expect(r.quantite).toBeGreaterThanOrEqual(0);
    expect(r.quantiteARegulariser).toBeGreaterThanOrEqual(0);
    expect(r.quantiteVendable).toBeGreaterThanOrEqual(0);
    expect(r.lots.every((l) => l.solde > 0)).toBe(true);
  });

  it("sans date de péremption : la date renvoyée est nulle", () => {
    const r = calculerStockLocal(
      { quantite: 3, quantiteARegulariser: 0, lots: [lot("L1", 3, { dateExpiration: null })] },
      [],
      JOUR,
    );
    expect(r.dateExpiration).toBeNull();
  });
});
