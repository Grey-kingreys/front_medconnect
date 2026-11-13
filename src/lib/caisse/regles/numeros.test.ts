import { describe, expect, it } from "vitest";
import { formaterNumeroTicket, numeroSecours } from "./numeros";

describe("numéros de pièces", () => {
  it("formaterNumeroTicket : T1-0000123", () => {
    expect(formaterNumeroTicket(1, 123)).toBe("T1-0000123");
    expect(formaterNumeroTicket(2, 12345678)).toBe("T2-12345678");
  });

  it("formaterNumeroTicket refuse un ordre ou un numéro invalide", () => {
    expect(() => formaterNumeroTicket(0, 1)).toThrow(RangeError);
    expect(() => formaterNumeroTicket(1, 0)).toThrow(RangeError);
    expect(() => formaterNumeroTicket(1, 1.5)).toThrow(RangeError);
  });

  it("numeroSecours : S1-D1-4", () => {
    expect(numeroSecours(1, "D1", 4)).toBe("S1-D1-4");
  });
});
