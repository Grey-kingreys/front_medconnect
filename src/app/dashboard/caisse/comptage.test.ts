import { describe, expect, it } from "vitest";
import { afficherSaisie, chiffresDepuisSaisie, MONTANT_ESPECES_MAX, montantDepuisChiffres } from "./comptage";

describe("saisie des espèces", () => {
  it("retire les lettres et accepte les séparateurs de milliers", () => {
    expect(chiffresDepuisSaisie("350 000")).toBe("350000");
    expect(chiffresDepuisSaisie("350 000")).toBe("350000");
    expect(chiffresDepuisSaisie("1,250.000")).toBe("1250000");
    expect(chiffresDepuisSaisie("abc12x3")).toBe("123");
    expect(chiffresDepuisSaisie("-5")).toBe("5");
    expect(chiffresDepuisSaisie("")).toBe("");
  });

  it("retire les zéros de tête et plafonne au maximum du serveur", () => {
    expect(chiffresDepuisSaisie("00045")).toBe("45");
    expect(chiffresDepuisSaisie("0")).toBe("0");
    expect(chiffresDepuisSaisie("99999999999")).toBe(String(MONTANT_ESPECES_MAX));
  });

  it("donne null pour un champ vide, sinon le montant entier", () => {
    expect(montantDepuisChiffres("")).toBeNull();
    expect(montantDepuisChiffres("0")).toBe(0);
    expect(montantDepuisChiffres("490000")).toBe(490000);
  });

  it("affiche les milliers séparés", () => {
    expect(afficherSaisie("1250000")).toBe("1 250 000");
    expect(afficherSaisie("500")).toBe("500");
  });
});
