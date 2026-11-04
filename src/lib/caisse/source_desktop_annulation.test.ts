import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api_auth";
import { codeErreurVente } from "../api_ventes";
import type { EtatPosteDesktop, PontDesktop } from "./contrat_desktop";
import { creerSourceDesktop } from "./source_desktop";

const { annulerVente, listerVentes, getVente } = vi.hoisted(() => ({
  annulerVente: vi.fn(),
  listerVentes: vi.fn(),
  getVente: vi.fn(),
}));
vi.mock("../api_ventes", async (importer) => ({ ...(await importer<typeof import("../api_ventes")>()), annulerVente, listerVentes, getVente }));

const ETAT: EtatPosteDesktop = {
  enLigne: true,
  horsLigne: false,
  connexionARefaire: false,
  nonEnregistre: false,
  catalogueDisponible: true,
  fileEnAttente: 0,
  rejetes: 0,
  plageEpuisee: false,
  heureFausse: false,
  posteDesactive: false,
  autrePharmacie: false,
  dernierContactLe: null,
  photographieLe: null,
  messageEnvoi: null,
};

function pont(etat: Partial<EtatPosteDesktop>, caisse: Record<string, unknown> = {}): PontDesktop {
  return {
    version: "t",
    etat: vi.fn().mockResolvedValue({ ...ETAT, ...etat }),
    caisse: {
      etatCaisse: vi.fn().mockResolvedValue({ ok: true, data: { poste: { id: "poste-d1" }, session: null }, message: "" }),
      enregistrerAnnulationServeur: vi.fn().mockResolvedValue({ ok: true, data: null, message: "" }),
      ...caisse,
    },
  } as unknown as PontDesktop;
}

beforeEach(() => {
  annulerVente.mockReset();
  listerVentes.mockReset();
  getVente.mockReset();
});

describe("annulation depuis le poste (D745)", () => {
  it("refuse sans appel tant que des ventes attendent d'être envoyées", async () => {
    const source = creerSourceDesktop(pont({ fileEnAttente: 2 }));
    const erreur = await source.annulerVente("p1", "v1", "erreur", "u1").catch((e: unknown) => e);
    expect((erreur as ApiError).status).toBe(409);
    expect((erreur as ApiError).message).toBe("Envoi des ventes en cours : réessayez dans un instant.");
    expect(annulerVente).not.toHaveBeenCalled();
  });

  it("demande une connexion hors ligne", async () => {
    const source = creerSourceDesktop(pont({ enLigne: false, horsLigne: true }));
    await expect(source.annulerVente("p1", "v1", "erreur", "u1")).rejects.toThrow("L'annulation demande une connexion.");
    expect(annulerVente).not.toHaveBeenCalled();
  });

  it("envoie le poste desktop puis enregistre la réponse sur le poste", async () => {
    const reponse = { data: { id: "v1" }, message: "Annulée", success: true };
    annulerVente.mockResolvedValue(reponse);
    const p = pont({});
    const source = creerSourceDesktop(p);
    await expect(source.annulerVente("p1", "v1", "erreur", "u1")).resolves.toBe(reponse);
    expect(annulerVente).toHaveBeenCalledWith("p1", "v1", "erreur", "poste-d1");
    expect(p.caisse.enregistrerAnnulationServeur).toHaveBeenCalledWith({ id: "v1" });
  });

  it("dit que l'annulation est faite quand le poste refuse, sans proposer de réessayer", async () => {
    annulerVente.mockResolvedValue({ data: { id: "v1" }, message: "Annulée", success: true });
    const source = creerSourceDesktop(
      pont(
        {},
        {
          enregistrerAnnulationServeur: vi.fn().mockResolvedValue({
            ok: false,
            status: 409,
            code: "ANNULATION_AUTRE_CAISSE",
            message: "Rien n'a été modifié ici.",
          }),
        },
      ),
    );
    const erreur = await source.annulerVente("p1", "v1", "erreur", "u1").catch((e: unknown) => e);
    expect((erreur as ApiError).message).toBe("L'annulation est faite, ne la refaites pas. Rien n'a été modifié ici.");
    expect(codeErreurVente(erreur)).toBe("ANNULATION_AUTRE_CAISSE");
  });
});

describe("ventes et reçu du poste", () => {
  it("hors ligne, lit les ventes locales sans appeler le serveur", async () => {
    const locale = { ok: true, data: { ventes: [], totalJour: 0, nombre: 0, totalPages: 1 }, message: "" };
    const source = creerSourceDesktop(pont({ enLigne: false, horsLigne: true }, { listerVentes: vi.fn().mockResolvedValue(locale) }));
    await source.listerVentes("p1", {});
    expect(listerVentes).not.toHaveBeenCalled();
  });

  it("en ligne, met en tête les ventes du poste que le serveur ne connaît pas", async () => {
    listerVentes.mockResolvedValue({
      data: { date: "2026-11-04", totalJour: 1000, nombre: 1, page: 1, parPage: 50, totalPages: 1, ventes: [{ id: "a", total: 1000, typePiece: "VENTE" }] },
      message: "",
      success: true,
    });
    const locales = {
      ok: true,
      data: { ventes: [{ id: "a", total: 1000, typePiece: "VENTE" }, { id: "b", total: 500, typePiece: "VENTE" }] },
      message: "",
    };
    const source = creerSourceDesktop(pont({ fileEnAttente: 1 }, { listerVentes: vi.fn().mockResolvedValue(locales) }));
    const res = await source.listerVentes("p1", { date: "2026-11-04" });
    expect(res.data.ventes.map((v) => v.id)).toEqual(["b", "a"]);
    expect(res.data.ventes[0].enCoursEnvoi).toBe(true);
    expect(res.data.totalJour).toBe(1500);
  });

  it("lit le reçu sur le poste d'abord, sinon demande une connexion hors ligne", async () => {
    const source = creerSourceDesktop(
      pont({ enLigne: false, horsLigne: true }, { getVente: vi.fn().mockResolvedValue({ ok: true, data: null, message: "" }) }),
    );
    await expect(source.getVente("p1", "v9")).rejects.toThrow("Cette action demande une connexion.");
    expect(getVente).not.toHaveBeenCalled();
  });
});
