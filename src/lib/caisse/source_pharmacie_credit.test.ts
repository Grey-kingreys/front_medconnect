import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PontDesktop } from "./contrat_desktop";
import { creerSourcePharmacieDesktop } from "./source_pharmacie_desktop";

const ok = <T,>(data: T) => ({ ok: true as const, data, message: "ok" });

const api = vi.hoisted(() => ({
  creerClientCredit: vi.fn(),
  enregistrerRemboursement: vi.fn(),
  getFicheClientCredit: vi.fn(),
  listerCredits: vi.fn(),
  modifierClientCredit: vi.fn(),
  modifierDateLimitePrise: vi.fn(),
}));
vi.mock("../api_credit", async (original) => ({ ...(await original<typeof import("../api_credit")>()), ...api }));

describe("source de la pharmacie : cahier de crédit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sur le poste : domaine credit, identifiant généré pour un client ou un remboursement, refus en ApiError", async () => {
    const creerClient = vi.fn().mockResolvedValue(ok({ id: "c1" }));
    const enregistrerRemboursement = vi.fn().mockResolvedValue(ok({ resteAPayer: 0 }));
    const lister = vi.fn().mockResolvedValue(ok({ clients: [], total: 0 }));
    const modifierDateLimite = vi.fn().mockResolvedValue({ ok: false, status: 409, code: "PRISE_SOLDEE", message: "Cette prise est déjà soldée : sa date limite ne se modifie plus." });
    const pont = { credit: { creerClient, enregistrerRemboursement, lister, lire: vi.fn(), modifierClient: vi.fn(), modifierDateLimite } } as unknown as PontDesktop;
    const source = creerSourcePharmacieDesktop(pont);

    await source.creerClientCredit("s1", { nomComplet: "Awa Sow" });
    expect(creerClient.mock.calls[0][1]).toMatchObject({ nomComplet: "Awa Sow", id: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    await source.enregistrerRemboursementCredit("s1", "c1", { montant: 500 });
    expect(enregistrerRemboursement.mock.calls[0][2]).toMatchObject({ montant: 500, id: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    await source.enregistrerRemboursementCredit("s1", "c1", { id: "fixe", montant: 500 });
    expect(enregistrerRemboursement.mock.calls[1][2].id).toBe("fixe");
    await source.listerCredits("s1", { q: "awa", parPage: 10 });
    expect(lister).toHaveBeenCalledWith("s1", { q: "awa", parPage: 10 });
    await expect(source.modifierDateLimitePrise("s1", "v1", "2026-12-01")).rejects.toMatchObject({ status: 409 });
    expect(modifierDateLimite).toHaveBeenCalledWith("s1", "v1", { dateLimite: "2026-12-01" });
  });

  it("une application plus ancienne sans le domaine credit donne un message clair", async () => {
    const source = creerSourcePharmacieDesktop({} as unknown as PontDesktop);
    await expect(source.listerCredits("s1", {})).rejects.toThrow(/Mettez l'application à jour/);
  });

  it("en ligne : l'API est appelée telle quelle, sans l'identifiant du poste (le serveur le refuserait)", async () => {
    const { sourcePharmacieEnLigne } = await import("./source_pharmacie_en_ligne");
    api.creerClientCredit.mockResolvedValue({ data: {} });
    api.enregistrerRemboursement.mockResolvedValue({ data: {} });
    await sourcePharmacieEnLigne.creerClientCredit("s1", { id: "x", nomComplet: "Awa Sow" });
    expect(api.creerClientCredit).toHaveBeenCalledWith("s1", { nomComplet: "Awa Sow" });
    await sourcePharmacieEnLigne.enregistrerRemboursementCredit("s1", "c1", { id: "y", montant: 100, verseEnCaisse: true });
    expect(api.enregistrerRemboursement).toHaveBeenCalledWith("s1", "c1", { montant: 100, verseEnCaisse: true });
    await sourcePharmacieEnLigne.listerCredits("s1", { q: "a" });
    expect(api.listerCredits).toHaveBeenCalledWith("s1", { q: "a" });
  });
});
