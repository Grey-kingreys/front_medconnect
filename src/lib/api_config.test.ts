import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getNumeroUrgenceMedicale } from "./api_config";

const reponse = (statut: number, corps: unknown) =>
  new Response(JSON.stringify(corps), { status: statut, headers: { "Content-Type": "application/json" } });

const config = (numerosUrgence: unknown) => ({ success: true, data: { numerosUrgence }, message: "" });

const fetchSimule = vi.fn();

beforeEach(() => {
  fetchSimule.mockReset();
  vi.stubGlobal("fetch", fetchSimule);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getNumeroUrgenceMedicale", () => {
  it("renvoie le numéro configuré", async () => {
    fetchSimule.mockResolvedValue(
      reponse(200, config([{ code: "URGENCE_MEDICALE", libelle: "Urgences médicales", numero: "117" }]))
    );
    await expect(getNumeroUrgenceMedicale()).resolves.toBe("117");
    expect(String(fetchSimule.mock.calls[0][0])).toMatch(/\/app\/config$/);
  });

  it("renvoie 15 sur erreur 500, en un seul essai", async () => {
    fetchSimule.mockResolvedValue(reponse(500, {}));
    await expect(getNumeroUrgenceMedicale()).resolves.toBe("15");
    expect(fetchSimule).toHaveBeenCalledTimes(1);
  });

  it("renvoie 15 sur erreur réseau", async () => {
    fetchSimule.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(getNumeroUrgenceMedicale()).resolves.toBe("15");
  });

  it("renvoie 15 si la liste est absente", async () => {
    fetchSimule.mockResolvedValue(reponse(200, { success: true, data: {}, message: "" }));
    await expect(getNumeroUrgenceMedicale()).resolves.toBe("15");
  });

  it("renvoie 15 si aucune entrée ne porte le bon code", async () => {
    fetchSimule.mockResolvedValue(reponse(200, config([{ code: "POLICE", libelle: "Police", numero: "117" }])));
    await expect(getNumeroUrgenceMedicale()).resolves.toBe("15");
  });

  it("renvoie 15 si le numéro est invalide", async () => {
    fetchSimule.mockResolvedValue(reponse(200, config([{ code: "URGENCE_MEDICALE", libelle: "x", numero: "abc" }])));
    await expect(getNumeroUrgenceMedicale()).resolves.toBe("15");
  });
});
