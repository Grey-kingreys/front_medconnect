import { describe, expect, it } from "vitest";
import { ApiError } from "./api_auth";
import { champsErreur, codeErreur, detailsErreur, estErreurReseau, estRefusDroit } from "./erreurs_api";

describe("erreurs_api", () => {
  it("code lu", () => {
    expect(codeErreur(new ApiError("m", 409, { code: "LOT_REQUIS" }))).toBe("LOT_REQUIS");
    expect(codeErreur(new ApiError("m", 409))).toBeNull();
    expect(codeErreur(new Error("m"))).toBeNull();
    expect(codeErreur(null)).toBeNull();
  });

  it("details", () => {
    const err = new ApiError("m", 409, { details: [{ stockId: "s1" }, 3, null] });
    expect(detailsErreur(err)).toEqual([{ stockId: "s1" }]);
    expect(detailsErreur(new ApiError("m", 409))).toEqual([]);
  });

  it("champs", () => {
    const err = new ApiError("m", 400, {
      champs: [{ champ: "lignes.0.dateExpiration", contraintes: ["dateValide"] }, { champ: 2 }],
    });
    expect(champsErreur(err)).toEqual([{ champ: "lignes.0.dateExpiration", contraintes: ["dateValide"] }]);
  });

  it("réseau", () => {
    for (const statut of [0, 502, 503, 504]) expect(estErreurReseau(new ApiError("m", statut))).toBe(true);
    for (const statut of [400, 409, 500]) expect(estErreurReseau(new ApiError("m", statut))).toBe(false);
    expect(estErreurReseau(new Error("m"))).toBe(false);
  });

  it("refus de droit", () => {
    expect(estRefusDroit(new ApiError("m", 403))).toBe(true);
    expect(estRefusDroit(new ApiError("m", 401))).toBe(false);
    expect(estRefusDroit(new ApiError("m", 404))).toBe(false);
  });

  it("jamais d'exception", () => {
    expect(() => codeErreur(undefined)).not.toThrow();
    expect(() => detailsErreur(undefined)).not.toThrow();
    expect(() => champsErreur(undefined)).not.toThrow();
    expect(() => estErreurReseau(undefined)).not.toThrow();
    expect(() => estRefusDroit(undefined)).not.toThrow();
  });
});
