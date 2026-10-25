import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, authFetch } from "./api_auth";
import {
  annulerVente,
  codeErreurVente,
  creerVente,
  getVente,
  lignesErreurVente,
  listerVentes,
} from "./api_ventes";

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

describe("listerVentes", () => {
  it("n'ajoute pas de paramètres sans option", async () => {
    mockedAuthFetch.mockResolvedValue({ data: {}, message: "ok", success: true });
    await listerVentes("ph/1");
    expect(mockedAuthFetch).toHaveBeenCalledWith("/pharmacie/ph%2F1/ventes");
  });

  it("ajoute la date puis la page", async () => {
    mockedAuthFetch.mockResolvedValue({ data: {}, message: "ok", success: true });
    await listerVentes("ph1", { page: 2, date: "2026-10-22" });
    expect(mockedAuthFetch).toHaveBeenCalledWith("/pharmacie/ph1/ventes?date=2026-10-22&page=2");
  });
});

describe("getVente", () => {
  it("lit la vente à la route encodée", async () => {
    mockedAuthFetch.mockResolvedValue({ data: {}, message: "ok", success: true });
    await getVente("ph/1", "v/1");
    expect(mockedAuthFetch).toHaveBeenCalledWith("/pharmacie/ph%2F1/ventes/v%2F1");
  });
});

describe("annulerVente", () => {
  it("envoie le motif en POST", async () => {
    mockedAuthFetch.mockResolvedValue({ data: {}, message: "ok", success: true });
    await annulerVente("ph1", "v1", "Erreur de quantité");
    expect(mockedAuthFetch).toHaveBeenCalledWith("/pharmacie/ph1/ventes/v1/annuler", {
      method: "POST",
      body: JSON.stringify({ motif: "Erreur de quantité" }),
    });
  });
});

describe("codeErreurVente", () => {
  it("reconnaît un code connu", () => {
    expect(codeErreurVente(new ApiError("x", 409, { code: "STOCK_INSUFFISANT" }))).toBe("STOCK_INSUFFISANT");
  });

  it.each(["STOCK_INTROUVABLE", "VENTE_DEJA_ANNULEE", "ANNULATION_HORS_DELAI"])("reconnaît %s", (code) => {
    expect(codeErreurVente(new ApiError("x", 409, { code }))).toBe(code);
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

  it("lit les lignes dans details à la racine du corps", () => {
    expect(lignesErreurVente(new ApiError("x", 409, { details: [ligne] }))).toEqual([ligne]);
  });

  it("recopie la quantité demandée", () => {
    const err = new ApiError("x", 409, { details: [{ stockId: "s1", disponible: 2, demande: 5 }] });
    expect(lignesErreurVente(err)).toEqual([{ stockId: "s1", disponible: 2, demande: 5 }]);
  });

  it("ignore les anciens emplacements", () => {
    expect(lignesErreurVente(new ApiError("x", 409, { donnees: { details: [ligne] } }))).toEqual([]);
    expect(lignesErreurVente(new ApiError("x", 409, { donnees: { lignes: [ligne] } }))).toEqual([]);
    expect(lignesErreurVente(new ApiError("x", 409, { lignes: [ligne] }))).toEqual([]);
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
