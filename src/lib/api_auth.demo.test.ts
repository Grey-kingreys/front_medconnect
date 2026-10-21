import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connexionDemo, getComptesDemo, login } from "./api_auth";

const COMPTE = {
  id: "u1",
  email: "patient.demo@exemple.com",
  nom: "Camara",
  prenom: "Aïssatou",
  role: "PATIENT",
  roleLibelle: "Patient",
  structureNom: null,
  description: "Suivi de grossesse et carnet de vaccination.",
};

const reponse = (statut: number, corps: unknown) =>
  new Response(JSON.stringify(corps), { status: statut, headers: { "Content-Type": "application/json" } });

const fetchSimule = vi.fn();

beforeEach(() => {
  fetchSimule.mockReset();
  vi.stubGlobal("fetch", fetchSimule);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getComptesDemo", () => {
  it("renvoie [] sur 404 (mode démo désactivé), en un seul essai et sans trace", async () => {
    const trace = vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchSimule.mockResolvedValue(reponse(404, { message: "Not Found", statusCode: 404 }));
    await expect(getComptesDemo()).resolves.toEqual([]);
    expect(fetchSimule).toHaveBeenCalledTimes(1);
    expect(String(fetchSimule.mock.calls[0][0])).toMatch(/\/auth\/demo\/comptes$/);
    expect(trace).not.toHaveBeenCalled();
    trace.mockRestore();
  });

  it("renvoie [] sur erreur réseau, sans nouvelle tentative", async () => {
    fetchSimule.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(getComptesDemo()).resolves.toEqual([]);
    expect(fetchSimule).toHaveBeenCalledTimes(1);
  });

  it("renvoie [] sur 503 sans nouvelle tentative", async () => {
    fetchSimule.mockResolvedValue(reponse(503, {}));
    await expect(getComptesDemo()).resolves.toEqual([]);
    expect(fetchSimule).toHaveBeenCalledTimes(1);
  });

  it("renvoie la liste sur 200", async () => {
    fetchSimule.mockResolvedValue(reponse(200, { success: true, data: [COMPTE], message: "" }));
    await expect(getComptesDemo()).resolves.toEqual([COMPTE]);
  });

  it("ignore une réponse dont la forme est inattendue", async () => {
    fetchSimule.mockResolvedValue(reponse(200, { success: true, data: [{ id: 1 }, COMPTE], message: "" }));
    await expect(getComptesDemo()).resolves.toEqual([COMPTE]);
  });
});

describe("connexionDemo", () => {
  const SUCCES = {
    success: true,
    message: "Connexion réussie",
    data: { access_token: "jeton", user: { id: "u1", email: COMPTE.email, nom: "Camara", prenom: "Aïssatou", role: "PATIENT" } },
  };

  it("envoie { userId } en POST sur /auth/demo/connexion, avec le cookie", async () => {
    fetchSimule.mockResolvedValue(reponse(200, SUCCES));
    await connexionDemo("u1");
    const [url, options] = fetchSimule.mock.calls[0];
    expect(String(url)).toMatch(/\/auth\/demo\/connexion$/);
    expect(options.method).toBe("POST");
    expect(options.credentials).toBe("include");
    expect(JSON.parse(options.body)).toEqual({ userId: "u1" });
  });

  it("partage l'envoi et la réponse de login (factorisation)", async () => {
    fetchSimule.mockImplementation(() => Promise.resolve(reponse(200, SUCCES)));
    const parDemo = await connexionDemo("u1");
    const parFormulaire = await login(COMPTE.email, "motdepasse");
    expect(parDemo).toEqual(parFormulaire);

    const [, optionsDemo] = fetchSimule.mock.calls[0];
    const [, optionsLogin] = fetchSimule.mock.calls[1];
    expect(optionsDemo.method).toBe(optionsLogin.method);
    expect(optionsDemo.credentials).toBe(optionsLogin.credentials);
    expect(optionsDemo.headers).toEqual(optionsLogin.headers);
  });

  it("lève une erreur lisible sur 403", async () => {
    fetchSimule.mockResolvedValue(reponse(403, { message: "Compte non autorisé", statusCode: 403 }));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(connexionDemo("u2")).rejects.toMatchObject({ status: 403 });
  });
});
