import { describe, expect, it } from "vitest";
import type { Coupure } from "@/lib/api_caisse";
import { lignesAEnvoyer, lignesDepuisReferentiel, totalComptage } from "./comptage";

const coupure = (valeurFaciale: number, ordre: number): Coupure => ({ devise: "GNF", valeurFaciale, type: "BILLET", ordre });

describe("comptage", () => {
  it("additionne la valeur de chaque coupure", () => {
    const lignes = [
      { valeurFaciale: 20000, nombre: 2 },
      { valeurFaciale: 5000, nombre: 3 },
      { valeurFaciale: 500, nombre: 1 },
    ];
    expect(totalComptage(lignes)).toBe(55500);
  });

  it("range les coupures par ordre, à zéro", () => {
    const lignes = lignesDepuisReferentiel([coupure(500, 6), coupure(20000, 1), coupure(10000, 2)]);
    expect(lignes).toEqual([
      { valeurFaciale: 20000, nombre: 0 },
      { valeurFaciale: 10000, nombre: 0 },
      { valeurFaciale: 500, nombre: 0 },
    ]);
  });

  it("retire les lignes à zéro avant l'envoi", () => {
    const lignes = [
      { valeurFaciale: 20000, nombre: 0 },
      { valeurFaciale: 10000, nombre: 4 },
    ];
    expect(lignesAEnvoyer(lignes)).toEqual([{ valeurFaciale: 10000, nombre: 4 }]);
    expect(lignesAEnvoyer([{ valeurFaciale: 500, nombre: 0 }])).toEqual([]);
  });
});
