import { describe, expect, it } from "vitest";
import { boitesVersUm, formaterARegulariser, formaterQuantite, umVersBoites } from "./quantites";

// Vecteurs de back_medconnect/src/pharmacie/domaine/quantites.spec.ts (boitesVersUm, umVersBoites) et prix.spec.ts (CA2).
describe("quantités de la caisse", () => {
  it("CA2 : 20 boîtes de coefficient 1 font 20 unités", () => {
    expect(boitesVersUm(20, 1)).toBe(20);
  });

  it("245 comprimés en boîtes de 20 donnent 12 boîtes et 5", () => {
    expect(umVersBoites(245, 20)).toEqual({ boites: 12, unites: 5 });
  });

  it("formate boîtes et unités", () => {
    expect(formaterQuantite(26, 20, "COMPRIME")).toBe("1 boîte et 6 comprimés");
    expect(formaterQuantite(6, 20, "COMPRIME")).toBe("6 comprimés");
    expect(formaterQuantite(40, 20, "COMPRIME")).toBe("2 boîtes");
    expect(formaterQuantite(1, 1, "UNITE")).toBe("1 boîte");
    expect(formaterQuantite(0, 1, "UNITE")).toBe("0 boîte");
  });

  it("affiche 0 pour un stock négatif", () => {
    expect(formaterQuantite(-1, 1, "UNITE")).toBe("0 boîte");
    expect(formaterQuantite(-3, 20, "COMPRIME")).toBe("0 boîte");
  });

  it("garde : aucune sortie ne contient de signe moins, de -1000 à 1000", () => {
    for (const coefficient of [1, 2, 20, 30]) {
      for (let um = -1000; um <= 1000; um++) {
        expect(formaterQuantite(um, coefficient, "COMPRIME")).not.toContain("-");
      }
    }
  });

  it("formate la part à régulariser", () => {
    expect(formaterARegulariser(1, 1, "UNITE")).toBe("1 boîte à régulariser");
    expect(formaterARegulariser(2, 1, "UNITE")).toBe("2 boîtes à régulariser");
    expect(formaterARegulariser(43, 20, "COMPRIME")).toBe("2 boîtes et 3 comprimés à régulariser");
    expect(formaterARegulariser(3, 20, "COMPRIME")).toBe("3 comprimés à régulariser");
    expect(formaterARegulariser(0, 1, "UNITE")).toBeNull();
    expect(formaterARegulariser(undefined, 1, "UNITE")).toBeNull();
    expect(formaterARegulariser(null, 1, "UNITE")).toBeNull();
  });

  it("sépare les milliers à la française", () => {
    expect(formaterQuantite(1200, 1, "UNITE")).toMatch(/^1[  ]200 boîtes$/);
  });
});
