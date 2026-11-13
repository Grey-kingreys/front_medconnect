import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api_auth";
import type { PontDesktop } from "./caisse/contrat_desktop";
import { deconnecterPoste, panneReseauDesktop, pousserJeton } from "./connexion_desktop";

const definirJeton = vi.fn(async () => {});
const deconnexion = vi.fn(async () => {});

function avecPont() {
  window.medconnecteDesktop = { definirJeton, deconnexion } as unknown as PontDesktop;
}

afterEach(() => {
  delete window.medconnecteDesktop;
  definirJeton.mockReset();
  definirJeton.mockImplementation(async () => {});
  deconnexion.mockReset();
});

describe("sans pont (web)", () => {
  it("la panne réseau n'existe pas, quelle que soit l'erreur", () => {
    for (const status of [0, 502, 503, 504, 401]) {
      expect(panneReseauDesktop(new ApiError("x", status))).toBe(false);
    }
    expect(panneReseauDesktop(new TypeError("Failed to fetch"))).toBe(false);
  });

  it("pousserJeton et deconnecterPoste restent sans effet", () => {
    expect(() => pousserJeton("jeton")).not.toThrow();
    expect(() => deconnecterPoste()).not.toThrow();
    expect(definirJeton).not.toHaveBeenCalled();
    expect(deconnexion).not.toHaveBeenCalled();
  });
});

describe("avec le pont (desktop)", () => {
  it.each([0, 502, 503, 504])("le statut %i est une panne de réseau", (status) => {
    avecPont();
    expect(panneReseauDesktop(new ApiError("x", status))).toBe(true);
  });

  it.each([401, 403, 404])("le statut %i est un refus du serveur", (status) => {
    avecPont();
    expect(panneReseauDesktop(new ApiError("x", status))).toBe(false);
  });

  it("une erreur de fetch (TypeError) est une panne ; une autre erreur ne l'est pas", () => {
    avecPont();
    expect(panneReseauDesktop(new TypeError("Failed to fetch"))).toBe(true);
    expect(panneReseauDesktop(new Error("autre"))).toBe(false);
    expect(panneReseauDesktop(null)).toBe(false);
  });

  it("pousse le jeton et la déconnexion au pont, sans jamais lever d'exception", async () => {
    avecPont();
    pousserJeton("jeton");
    pousserJeton(null);
    expect(definirJeton).toHaveBeenNthCalledWith(1, "jeton");
    expect(definirJeton).toHaveBeenNthCalledWith(2, null);
    deconnecterPoste();
    expect(deconnexion).toHaveBeenCalledTimes(1);

    definirJeton.mockImplementation(() => {
      throw new Error("pont cassé");
    });
    deconnexion.mockRejectedValue(new Error("refus"));
    expect(() => pousserJeton("x")).not.toThrow();
    expect(() => deconnecterPoste()).not.toThrow();
    await Promise.resolve();
  });
});
