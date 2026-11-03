import { beforeEach, describe, expect, it, vi } from "vitest";
import { authFetch } from "./api_auth";
import { listerAnomalies, traiterAnomalie } from "./api_pilotage";

vi.mock("./api_auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api_auth")>()),
  authFetch: vi.fn(),
}));

const mockedAuthFetch = vi.mocked(authFetch);

beforeEach(() => {
  mockedAuthFetch.mockReset();
  mockedAuthFetch.mockResolvedValue({ data: {}, message: "ok", success: true });
});

describe("api_pilotage", () => {
  it("envoie seulement les paramètres présents", async () => {
    await listerAnomalies("s1");
    expect(mockedAuthFetch).toHaveBeenLastCalledWith("/pharmacie/s1/anomalies");
    await listerAnomalies("s1", { statut: "TRAITEE", type: "ECART_CAISSE", page: 2 });
    expect(mockedAuthFetch).toHaveBeenLastCalledWith("/pharmacie/s1/anomalies?statut=TRAITEE&type=ECART_CAISSE&page=2");
  });

  it("traite une anomalie par PATCH avec le commentaire", async () => {
    await traiterAnomalie("s1", "a1", "Vérifié en rayon");
    expect(mockedAuthFetch).toHaveBeenCalledWith("/pharmacie/s1/anomalies/a1", {
      method: "PATCH",
      body: '{"commentaire":"Vérifié en rayon"}',
    });
  });
});
