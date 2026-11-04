import { describe, expect, it } from "vitest";
import { aCoutTransmis, formaterTaux, tauxMarge } from "./marge_affichage";

describe("marge_affichage", () => {
  it("calcule le taux sur le chiffre d'affaires au coût connu", () => {
    const taux = tauxMarge({ marge: 235, chiffreAffairesValorise: 1000 });
    expect(taux).toBe(23.5);
    expect(formaterTaux(taux)).toBe("23,5 %");
  });

  it("affiche inconnu quand aucun chiffre d'affaires n'a de coût connu", () => {
    expect(tauxMarge({ marge: 0, chiffreAffairesValorise: 0 })).toBeNull();
    expect(formaterTaux(tauxMarge({ marge: 0, chiffreAffairesValorise: 0 }))).toBe("inconnu");
  });

  it("teste la présence de la clé de coût, pas sa valeur", () => {
    expect(aCoutTransmis({ valeurCout: null }, "valeurCout")).toBe(true);
    expect(aCoutTransmis({}, "valeurCout")).toBe(false);
  });

  it("ne transforme jamais une valeur nulle en 0", () => {
    expect(formaterTaux(null)).not.toContain("0");
    expect(formaterTaux(null)).toBe("inconnu");
  });
});
