import { describe, expect, it } from "vitest";
import { formaterGNF } from "./format_gnf";

describe("formaterGNF", () => {
  it("écrit zéro", () => {
    expect(formaterGNF(0)).toBe("0 GNF");
  });

  it("n'ajoute pas de séparateur sous mille", () => {
    expect(formaterGNF(500)).toBe("500 GNF");
  });

  it("sépare les milliers par une espace insécable", () => {
    expect(formaterGNF(12500)).toBe("12 500 GNF");
  });

  it("arrondit à l'entier", () => {
    expect(formaterGNF(1234567.6)).toBe("1 234 568 GNF");
  });

  it("garde le signe moins devant les chiffres", () => {
    expect(formaterGNF(-12500)).toBe("-12 500 GNF");
  });
});
