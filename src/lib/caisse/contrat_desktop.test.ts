import { afterEach, describe, expect, it } from "vitest";
import { pontDesktop, type PontDesktop } from "./contrat_desktop";

describe("pontDesktop", () => {
  afterEach(() => {
    delete window.medconnecteDesktop;
  });

  it("vaut null sans pont", () => {
    expect(pontDesktop()).toBeNull();
  });

  it("renvoie le pont s'il existe", () => {
    window.medconnecteDesktop = { version: "0.1.0" } as unknown as PontDesktop;
    expect(pontDesktop()).toEqual({ version: "0.1.0" });
  });
});
