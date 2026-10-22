import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, authFetch } from "./api_auth";
import { codeErreurVente, creerVente, lignesErreurVente } from "./api_ventes";

vi.mock("./api_auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api_auth")>()),
  authFetch: vi.fn(),
}));

const mockedAuthFetch = vi.mocked(authFetch);

beforeEach(() => {
  mockedAuthFetch.mockReset();
});

describe("creerVente", () => {
  it("envoie la vente à la route de la pharmacie avec la clé d'idempotence", async () => {
    mockedAuthFetch.mockResolvedValue({ data: {}, message: "ok", success: true });
    const corps = { lignes: [{ stockId: "s1", quantite: 2 }], clientNom: "Diallo" };

    await creerVente("ph/1", corps, "cle-1");

    expect(mockedAuthFetch).toHaveBeenCalledWith("/pharmacie/ph%2F1/ventes", {
      method: "POST",
      body: JSON.stringify(corps),
      headers: { "Idempotency-Key": "cle-1" },
    });
  });
});

describe("codeErreurVente", () => {
  it("reconnaît un code connu", () => {
    expect(codeErreurVente(new ApiError("x", 409, { code: "STOCK_INSUFFISANT" }))).toBe("STOCK_INSUFFISANT");
  });

  it("ignore un code inconnu", () => {
    expect(codeErreurVente(new ApiError("x", 400, { code: "AUTRE" }))).toBeNull();
    expect(codeErreurVente(new ApiError("x", 500))).toBeNull();
  });

  it("ignore une erreur qui n'est pas une erreur de l'API", () => {
    expect(codeErreurVente(new Error("x"))).toBeNull();
    expect(codeErreurVente("STOCK_INSUFFISANT")).toBeNull();
  });
});

describe("lignesErreurVente", () => {
  const ligne = { stockId: "s1", nom: "Paracétamol", disponible: 2 };

  it.each([
    ["details.details", { details: [ligne] }],
    ["details.donnees.details", { donnees: { details: [ligne] } }],
    ["details.donnees.lignes", { donnees: { lignes: [ligne] } }],
    ["details.lignes", { lignes: [ligne] }],
  ])("lit les lignes dans %s", (_nom, details) => {
    expect(lignesErreurVente(new ApiError("x", 409, details))).toEqual([ligne]);
  });

  it("prend le premier emplacement dans l'ordre de priorité", () => {
    const err = new ApiError("x", 409, {
      lignes: [{ stockId: "s4" }],
      donnees: { lignes: [{ stockId: "s3" }], details: [{ stockId: "s2" }] },
      details: [{ stockId: "s1" }],
    });
    expect(lignesErreurVente(err)).toEqual([{ stockId: "s1" }]);
  });

  it("ignore les éléments invalides et les champs mal typés", () => {
    const err = new ApiError("x", 409, {
      details: [
        null,
        "texte",
        { stockId: "" },
        { stockId: 5 },
        { stockId: "s1", nom: 4, disponible: -1 },
        { stockId: "s2", disponible: 1.5 },
        { stockId: "s3", nom: "Aspirine", disponible: 0 },
      ],
    });
    expect(lignesErreurVente(err)).toEqual([{ stockId: "s1" }, { stockId: "s2" }, { stockId: "s3", nom: "Aspirine", disponible: 0 }]);
  });

  it("renvoie une liste vide sans détails ou pour une autre erreur", () => {
    expect(lignesErreurVente(new ApiError("x", 500))).toEqual([]);
    expect(lignesErreurVente(new Error("x"))).toEqual([]);
    expect(lignesErreurVente(new ApiError("x", 409, { code: "STOCK_INSUFFISANT" }))).toEqual([]);
  });
});
