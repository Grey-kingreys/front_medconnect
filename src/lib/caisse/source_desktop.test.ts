import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../api_auth";
import { codeErreur } from "../erreurs_api";
import { codeErreurVente, lignesErreurVente } from "../api_ventes";
import type { PontDesktop } from "./contrat_desktop";
import { creerSourceDesktop } from "./source_desktop";

function pontAvec(caisse: Partial<PontDesktop["caisse"]>): PontDesktop {
  return { version: "0.1.0", caisse } as unknown as PontDesktop;
}

describe("creerSourceDesktop", () => {
  it("rend la donnée d'un succès", async () => {
    const source = creerSourceDesktop(
      pontAvec({ chargerStock: vi.fn().mockResolvedValue({ ok: true, data: [{ id: "s1" }], message: "ok" }) }),
    );
    await expect(source.chargerStock("p1")).resolves.toEqual([{ id: "s1" }]);
    expect(source.enLigneSeulement).toBe(false);
  });

  it("rend la réponse enveloppée pour la caisse (les pages lisent message)", async () => {
    const source = creerSourceDesktop(
      pontAvec({ getBilan: vi.fn().mockResolvedValue({ ok: true, data: { total: 1 }, message: "Bilan" }) }),
    );
    await expect(source.getBilan("p1", "x")).resolves.toEqual({ data: { total: 1 }, message: "Bilan", success: true });
  });

  it("lit le refus SORTIE_MANUELLE_REQUISE comme celui de l'API", async () => {
    const lignes = [{ stockId: "s1", nom: "Doliprane", lots: [{ lotId: "l1", numeroLot: "A", dateExpiration: "2026-01-01", quantite: 2 }] }];
    const source = creerSourceDesktop(
      pontAvec({
        creerVente: vi.fn().mockResolvedValue({
          ok: false,
          status: 409,
          code: "SORTIE_MANUELLE_REQUISE",
          message: "Choisissez un lot.",
          details: lignes,
        }),
      }),
    );
    const erreur = await source.creerVente("p1", { lignes: [] }, "cle").catch((e: unknown) => e);
    expect(erreur).toBeInstanceOf(ApiError);
    expect((erreur as ApiError).status).toBe(409);
    expect((erreur as ApiError).message).toBe("Choisissez un lot.");
    expect(codeErreurVente(erreur)).toBe("SORTIE_MANUELLE_REQUISE");
    expect(lignesErreurVente(erreur)[0]?.stockId).toBe("s1");
  });

  it("lit un 409 de caisse par codeErreur", async () => {
    const source = creerSourceDesktop(
      pontAvec({
        ouvrirSession: vi.fn().mockResolvedValue({ ok: false, status: 409, code: "SESSION_AUTRE_UTILISATEUR", message: "Occupée." }),
      }),
    );
    const erreur = await source.ouvrirSession("p1", { id: "x" }).catch((e: unknown) => e);
    expect(codeErreur(erreur)).toBe("SESSION_AUTRE_UTILISATEUR");
  });
});
