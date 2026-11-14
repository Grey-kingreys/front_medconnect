import { afterEach, describe, expect, it, vi } from "vitest";
import type { PontDesktop } from "./contrat_desktop";
import { sourcePharmacie } from "./source_pharmacie_active";
import { sourcePharmacieEnLigne } from "./source_pharmacie_en_ligne";

afterEach(() => {
  delete window.medconnecteDesktop;
});

describe("sourcePharmacie", () => {
  it("rend la source en ligne sans pont", () => {
    expect(sourcePharmacie()).toBe(sourcePharmacieEnLigne);
  });

  it("rend la source desktop, mémorisée, qui lit le stock par le pont", async () => {
    const chargerStock = vi.fn().mockResolvedValue({ ok: true, data: [{ id: "s1" }], message: "Stock du poste." });
    window.medconnecteDesktop = { version: "0.1.0", caisse: { chargerStock } } as unknown as PontDesktop;
    const source = sourcePharmacie();
    expect(source).not.toBe(sourcePharmacieEnLigne);
    expect(source.enLigneSeulement).toBe(false);
    expect(sourcePharmacie()).toBe(source);
    expect(await source.chargerStock("ph1")).toEqual([{ id: "s1" }]);
    expect(chargerStock).toHaveBeenCalledWith("ph1");
  });

  it("un refus du pont devient une erreur lisible", async () => {
    const chargerStock = vi.fn().mockResolvedValue({ ok: false, status: 503, code: "CATALOGUE_ABSENT", message: "Catalogue absent." });
    window.medconnecteDesktop = { version: "0.1.0", caisse: { chargerStock } } as unknown as PontDesktop;
    await expect(sourcePharmacie().chargerStock("ph1")).rejects.toMatchObject({ message: "Catalogue absent." });
  });
});
