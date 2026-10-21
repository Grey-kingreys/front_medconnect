import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deconnecterAppareil, deconnecterAutresAppareils, getAppareilsConnectes } from "./api_appareils";

const reponse = (statut: number, corps: unknown) =>
  new Response(JSON.stringify(corps), { status: statut, headers: { "Content-Type": "application/json" } });

const fetchSimule = vi.fn();

beforeEach(() => {
  fetchSimule.mockReset();
  vi.stubGlobal("fetch", fetchSimule);
  localStorage.clear();
  localStorage.setItem("access_token", "jeton-test");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const appel = () => fetchSimule.mock.calls[0] as [string, RequestInit];

describe("getAppareilsConnectes", () => {
  it("lit la liste avec la connexion de l'utilisateur et la renvoie telle quelle", async () => {
    const liste = [{ id: "a1", type: "web", nom: "Chrome sur Windows", appareilCourant: true }];
    fetchSimule.mockResolvedValue(reponse(200, { data: liste, message: "ok", success: true }));

    const res = await getAppareilsConnectes();

    const [url, options] = appel();
    expect(String(url)).toMatch(/\/auth\/sessions$/);
    expect(options.method ?? "GET").toBe("GET");
    expect(new Headers(options.headers).get("Authorization")).toBe("Bearer jeton-test");
    expect(res.data).toEqual(liste);
  });
});

describe("deconnecterAppareil", () => {
  it("supprime l'appareil visé avec un identifiant encodé", async () => {
    fetchSimule.mockResolvedValue(reponse(200, { data: { id: "a b/1" }, message: "Appareil déconnecté.", success: true }));

    await deconnecterAppareil("a b/1");

    const [url, options] = appel();
    expect(String(url)).toMatch(/\/auth\/sessions\/a%20b%2F1$/);
    expect(options.method).toBe("DELETE");
  });
});

describe("deconnecterAutresAppareils", () => {
  it("déconnecte les autres appareils et renvoie leur nombre", async () => {
    fetchSimule.mockResolvedValue(reponse(200, { data: { nombre: 2 }, message: "ok", success: true }));

    const res = await deconnecterAutresAppareils();

    const [url, options] = appel();
    expect(String(url)).toMatch(/\/auth\/sessions\/revoquer-autres$/);
    expect(options.method).toBe("POST");
    expect(res.data.nombre).toBe(2);
  });
});
