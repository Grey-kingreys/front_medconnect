import { describe, expect, it } from "vitest";
import { idLotDeterministe, idLotOuDerive, uuidV5 } from "./ids_stables";

describe("identifiants stables de lot", () => {
  it("UUID v5 conforme au vecteur connu de la RFC (espace DNS, www.example.com)", () => {
    expect(uuidV5("www.example.com", "6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe("2ed6657d-e927-568b-95e1-2665a8aea6a2");
  });

  it("est déterministe, de forme UUID v5, distinct selon la pièce et le rang", () => {
    const a = idLotDeterministe("reception-1", 0);
    expect(idLotDeterministe("reception-1", 0)).toBe(a);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(idLotDeterministe("reception-1", 1)).not.toBe(a);
    expect(idLotDeterministe("reception-2", 0)).not.toBe(a);
  });

  it("refuse une pièce vide ou un rang invalide", () => {
    expect(() => idLotDeterministe("", 0)).toThrow();
    expect(() => idLotDeterministe("p", -1)).toThrow();
    expect(() => idLotDeterministe("p", 1.5)).toThrow();
  });

  it("garde l'identifiant fourni s'il est un UUID, sinon le dérive", () => {
    const fourni = "0F0F0F0F-1111-5222-8333-444444444444";
    expect(idLotOuDerive(fourni, "p", 0)).toBe(fourni.toLowerCase());
    expect(idLotOuDerive("pas-un-uuid", "p", 0)).toBe(idLotDeterministe("p", 0));
    expect(idLotOuDerive(undefined, "p", 2)).toBe(idLotDeterministe("p", 2));
  });
});
