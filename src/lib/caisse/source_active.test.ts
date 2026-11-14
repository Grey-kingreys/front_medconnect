import { afterEach, describe, expect, it } from "vitest";
import type { PontDesktop } from "./contrat_desktop";
import { sourceCaisse } from "./source_active";
import { sourceEnLigne } from "./source_en_ligne";

afterEach(() => {
  delete window.medconnecteDesktop;
});

describe("sourceCaisse", () => {
  it("rend la source en ligne sans pont", () => {
    expect(sourceCaisse()).toBe(sourceEnLigne);
  });

  it("rend la source desktop, mémorisée, avec un pont", () => {
    window.medconnecteDesktop = { version: "0.1.0", caisse: {} } as unknown as PontDesktop;
    const source = sourceCaisse();
    expect(source).not.toBe(sourceEnLigne);
    expect(source.enLigneSeulement).toBe(false);
    expect(sourceCaisse()).toBe(source);
  });
});
