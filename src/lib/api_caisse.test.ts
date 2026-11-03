import { beforeEach, describe, expect, it, vi } from "vitest";
import { authFetch } from "./api_auth";
import { assurerPosteWeb, getReferentiels, getSessionCourante, ouvrirSession, saisirComptage } from "./api_caisse";

vi.mock("./api_auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api_auth")>()),
  authFetch: vi.fn(),
}));

const mockedAuthFetch = vi.mocked(authFetch);

beforeEach(() => {
  mockedAuthFetch.mockReset();
  mockedAuthFetch.mockResolvedValue({ data: {}, message: "ok", success: true });
});

describe("api_caisse", () => {
  it("lit les référentiels à la route encodée", async () => {
    await getReferentiels("s 1");
    expect(mockedAuthFetch).toHaveBeenCalledWith("/pharmacie/s%201/referentiels");
  });

  it("assure le poste web par défaut de l'utilisateur", async () => {
    await assurerPosteWeb("s1", "u1");
    expect(mockedAuthFetch).toHaveBeenCalledWith("/pharmacie/s1/postes", {
      method: "POST",
      body: '{"type":"WEB","appareilId":"web-defaut:u1"}',
    });
  });

  it("lit la session courante du poste", async () => {
    await getSessionCourante("s1", "p1");
    expect(mockedAuthFetch).toHaveBeenCalledWith("/pharmacie/s1/caisse/sessions/courante?posteId=p1");
  });

  it("ouvre la caisse puis enregistre un comptage", async () => {
    await ouvrirSession("s1", { id: "i1", posteId: "p1" });
    expect(mockedAuthFetch).toHaveBeenCalledWith("/pharmacie/s1/caisse/sessions", {
      method: "POST",
      body: '{"id":"i1","posteId":"p1"}',
    });
    await saisirComptage("s1", "c 1", { id: "i2", moment: "OUVERTURE", coupures: [{ valeurFaciale: 500, nombre: 2 }] });
    expect(mockedAuthFetch).toHaveBeenLastCalledWith("/pharmacie/s1/caisse/sessions/c%201/comptages", {
      method: "POST",
      body: '{"id":"i2","moment":"OUVERTURE","coupures":[{"valeurFaciale":500,"nombre":2}]}',
    });
  });
});
