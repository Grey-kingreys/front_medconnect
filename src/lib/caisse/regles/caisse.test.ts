import { describe, expect, it } from "vitest";
import { calculerTheorique, ecartCaisse, totalComptage } from "./caisse";

// Scénarios de back_medconnect/src/pharmacie/domaine/caisse.spec.ts.
const modes = ["ESPECES", "ORANGE_MONEY", "MTN_MOMO"];

describe("règles de caisse", () => {
  it("totalComptage : coupures du franc guinéen", () => {
    expect(
      totalComptage([
        { valeurFaciale: 20000, nombre: 10 },
        { valeurFaciale: 10000, nombre: 5 },
        { valeurFaciale: 5000, nombre: 4 },
        { valeurFaciale: 2000, nombre: 0 },
        { valeurFaciale: 1000, nombre: 7 },
        { valeurFaciale: 500, nombre: 6 },
      ]),
    ).toBe(280000);
    expect(totalComptage([])).toBe(0);
  });

  it("totalComptage refuse un nombre négatif ou une coupure nulle", () => {
    expect(() => totalComptage([{ valeurFaciale: 500, nombre: -1 }])).toThrow(RangeError);
    expect(() => totalComptage([{ valeurFaciale: 0, nombre: 1 }])).toThrow(RangeError);
  });

  it("CA15 : fond 200 000, espèces 400 000, prélèvement 100 000 : théorique 500 000, compté 490 000, écart -10 000", () => {
    const r = calculerTheorique({
      modes,
      fondEspeces: 200000,
      paiements: [
        { mode: "ESPECES", montant: 150000 },
        { mode: "ESPECES", montant: 100000 },
        { mode: "ESPECES", montant: 150000 },
      ],
      mouvements: [{ type: "PRELEVEMENT", mode: "ESPECES", montant: 100000 }],
    });
    expect(r).toEqual([
      { mode: "ESPECES", theorique: 500000 },
      { mode: "ORANGE_MONEY", theorique: 0 },
      { mode: "MTN_MOMO", theorique: 0 },
    ]);
    const compte = totalComptage([
      { valeurFaciale: 20000, nombre: 24 },
      { valeurFaciale: 10000, nombre: 1 },
    ]);
    expect(compte).toBe(490000);
    expect(ecartCaisse(compte, 500000)).toBe(-10000);
  });

  it("apport, remboursement et paiement négatif (annulation) par mode", () => {
    const r = calculerTheorique({
      modes,
      fondEspeces: 50000,
      paiements: [
        { mode: "ESPECES", montant: 10000 },
        { mode: "ORANGE_MONEY", montant: 10000 },
        { mode: "ESPECES", montant: -10000 },
      ],
      mouvements: [
        { type: "APPORT", mode: "ESPECES", montant: 5000 },
        { type: "REMBOURSEMENT", mode: "ORANGE_MONEY", montant: 2000 },
      ],
    });
    expect(r).toEqual([
      { mode: "ESPECES", theorique: 55000 },
      { mode: "ORANGE_MONEY", theorique: 8000 },
      { mode: "MTN_MOMO", theorique: 0 },
    ]);
  });

  it("refuse un mode inconnu, un doublon, un fond sans espèces", () => {
    expect(() =>
      calculerTheorique({ modes, fondEspeces: 0, paiements: [{ mode: "CARTE", montant: 1 }], mouvements: [] }),
    ).toThrow(RangeError);
    expect(() => calculerTheorique({ modes: ["ESPECES", "ESPECES"], fondEspeces: 0, paiements: [], mouvements: [] })).toThrow(
      RangeError,
    );
    expect(() => calculerTheorique({ modes: ["ORANGE_MONEY"], fondEspeces: 100, paiements: [], mouvements: [] })).toThrow(
      RangeError,
    );
  });

  it("ecartCaisse : null sans comptage, jamais -0", () => {
    expect(ecartCaisse(null, 1000)).toBeNull();
    expect(Object.is(ecartCaisse(1000, 1000), 0)).toBe(true);
    expect(ecartCaisse(1500, 1000)).toBe(500);
  });
});
