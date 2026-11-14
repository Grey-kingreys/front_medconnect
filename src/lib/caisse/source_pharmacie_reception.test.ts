import { describe, expect, it, vi } from "vitest";
import type { PontDesktop } from "./contrat_desktop";
import { creerSourcePharmacieDesktop } from "./source_pharmacie_desktop";

const ok = <T,>(data: T) => ({ ok: true as const, data, message: "ok" });

describe("source de la pharmacie par le pont : réception et fournisseurs", () => {
  it("passe par les domaines reception et fournisseur, génère l'identifiant d'une réception, et lève un refus en ApiError", async () => {
    const enregistrer = vi.fn().mockResolvedValue(ok({ id: "x" }));
    const lister = vi.fn().mockResolvedValue(ok({ receptions: [], page: 2, parPage: 20, total: 0 }));
    const lire = vi.fn().mockResolvedValue({ ok: false, status: 404, code: "RECEPTION_INTROUVABLE", message: "Cette réception est introuvable." });
    const creer = vi.fn().mockResolvedValue(ok({ id: "f1", nom: "Sopharma", telephone: null, createdAt: "", cree: true }));
    const pont = {
      reception: { enregistrer, lister, lire },
      fournisseur: { lister: vi.fn().mockResolvedValue(ok([])), creer },
    } as unknown as PontDesktop;
    const source = creerSourcePharmacieDesktop(pont);

    await source.enregistrerReception("s1", { lignes: [{ stockId: "a", nombreBoites: 1, sansPeremption: true }] });
    expect(enregistrer.mock.calls[0][1].id).toMatch(/^[0-9a-f-]{36}$/);
    await source.listerReceptions("s1", 2);
    expect(lister).toHaveBeenCalledWith("s1", { page: 2 });
    await source.creerFournisseur("s1", { nom: "Sopharma" });
    expect(creer).toHaveBeenCalledWith("s1", { nom: "Sopharma" });
    await expect(source.lireReception("s1", "r1")).rejects.toMatchObject({ status: 404 });
  });

  it("une application plus ancienne sans ces domaines donne un message clair", async () => {
    const source = creerSourcePharmacieDesktop({} as unknown as PontDesktop);
    await expect(source.listerFournisseurs("s1")).rejects.toThrow(/Mettez l'application à jour/);
  });
});
