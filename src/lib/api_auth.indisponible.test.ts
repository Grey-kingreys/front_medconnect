import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch } from "./api_auth";
import { resendStructureInvitation } from "./api_admin";

const MESSAGE_SERVEUR = "Le service d'envoi des emails est momentanément indisponible. Réessayez dans quelques minutes.";
const MESSAGE_GENERIQUE = "Le service est momentanément indisponible, réessayez dans quelques instants.";

const reponse = (statut: number, corps: unknown) =>
  new Response(JSON.stringify(corps), { status: statut, headers: { "Content-Type": "application/json" } });

const fetchSimule = vi.fn();

beforeEach(() => {
  fetchSimule.mockReset();
  vi.stubGlobal("fetch", fetchSimule);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  localStorage.setItem("access_token", "jeton-test");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("réponse 503 du serveur applicatif", () => {
  it("garde le message rédigé par le serveur et son code, en un seul essai", async () => {
    fetchSimule.mockResolvedValue(
      reponse(503, { statusCode: 503, code: "EMAIL_INDISPONIBLE", message: MESSAGE_SERVEUR }),
    );
    const erreur = await resendStructureInvitation("s1").catch((e: unknown) => e);
    expect(erreur).toBeInstanceOf(ApiError);
    expect(erreur).toMatchObject({ message: MESSAGE_SERVEUR, status: 503 });
    expect((erreur as ApiError).details).toMatchObject({ code: "EMAIL_INDISPONIBLE" });
    expect(fetchSimule).toHaveBeenCalledTimes(1);
  });

  it("garde le message générique sur un 503 sans code", async () => {
    fetchSimule.mockResolvedValue(reponse(503, {}));
    await expect(resendStructureInvitation("s1")).rejects.toMatchObject({ message: MESSAGE_GENERIQUE });
    expect(fetchSimule).toHaveBeenCalledTimes(1);
  });

  it("ne retente pas une lecture dont le 503 porte un code", async () => {
    fetchSimule.mockResolvedValue(
      reponse(503, { statusCode: 503, code: "EMAIL_INDISPONIBLE", message: MESSAGE_SERVEUR }),
    );
    await expect(apiFetch("/exemple")).rejects.toMatchObject({ message: MESSAGE_SERVEUR, status: 503 });
    expect(fetchSimule).toHaveBeenCalledTimes(1);
  });
});
