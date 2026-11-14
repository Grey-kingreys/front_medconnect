import { describe, expect, it } from "vitest";
import {
  LIBELLES_UNITE_MINIMALE,
  aArticle,
  boitesVersUm,
  deOuD,
  formaterARegulariser,
  formaterQuantite,
  umVersBoites,
} from "./quantites";

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

  it("formate les plaquettes, au singulier pour une seule", () => {
    expect(formaterQuantite(26, 10, "PLAQUETTE")).toBe("2 boîtes et 6 plaquettes");
    expect(formaterQuantite(21, 10, "PLAQUETTE")).toBe("2 boîtes et 1 plaquette");
    expect(formaterQuantite(1, 10, "PLAQUETTE")).toBe("1 plaquette");
  });

  it("accorde l'article de chaque unité (D725)", () => {
    expect(LIBELLES_UNITE_MINIMALE.PLAQUETTE.article).toBe("la plaquette");
    expect(LIBELLES_UNITE_MINIMALE.COMPRIME.article).toBe("le comprimé");
    expect(LIBELLES_UNITE_MINIMALE.AMPOULE.article).toBe("l'ampoule");
    expect(LIBELLES_UNITE_MINIMALE.UNITE.article).toBe("l'unité");
    expect(LIBELLES_UNITE_MINIMALE.GELULE.article).toBe("la gélule");
    expect(LIBELLES_UNITE_MINIMALE.ML.article).toBe("le ml");
    expect(LIBELLES_UNITE_MINIMALE.SACHET.article).toBe("le sachet");
    expect(LIBELLES_UNITE_MINIMALE.GRAMME.article).toBe("le gramme");
  });

  it("deOuD met « d' » devant une voyelle ou un h muet, « de » sinon", () => {
    expect(deOuD("plaquettes")).toBe("de plaquettes");
    expect(deOuD("ampoules")).toBe("d'ampoules");
    expect(deOuD("unités")).toBe("d'unités");
    expect(deOuD("ml")).toBe("de ml");
  });

  it("aArticle donne « à la plaquette », « à l'unité » et « au comprimé »", () => {
    expect(aArticle("la plaquette")).toBe("à la plaquette");
    expect(aArticle("l'unité")).toBe("à l'unité");
    expect(aArticle("le comprimé")).toBe("au comprimé");
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
