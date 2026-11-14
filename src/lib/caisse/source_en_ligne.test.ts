import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api_auth";
import { assurerPosteWeb, getSessionCourante } from "../api_caisse";
import { getMyStock } from "../api_pharmacie";
import { sourceEnLigne } from "./source_en_ligne";

vi.mock("../api_caisse", () => ({
  getReferentiels: vi.fn(),
  assurerPosteWeb: vi.fn(),
  getSessionCourante: vi.fn(),
}));
vi.mock("../api_pharmacie", () => ({ getMyStock: vi.fn() }));
vi.mock("../api_ventes", () => ({ creerVente: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sourceEnLigne", () => {
  it("lit le poste web puis la session de ce poste", async () => {
    const poste = { id: "p1", code: "W1", libelle: "Poste web", type: "WEB" };
    vi.mocked(assurerPosteWeb).mockResolvedValue({ data: poste, message: "ok", success: true } as never);
    vi.mocked(getSessionCourante).mockResolvedValue({ data: null, message: "ok", success: true } as never);

    const etat = await sourceEnLigne.etatCaisse("s1", "u1");

    expect(assurerPosteWeb).toHaveBeenCalledWith("s1", "u1");
    expect(getSessionCourante).toHaveBeenCalledWith("s1", "p1");
    expect(etat).toEqual({ poste, session: null });
  });

  it("laisse remonter l'erreur réseau du stock telle quelle", async () => {
    const erreur = new ApiError("Hors connexion", 0);
    vi.mocked(getMyStock).mockRejectedValue(erreur);
    await expect(sourceEnLigne.chargerStock("s1")).rejects.toBe(erreur);
  });
});
