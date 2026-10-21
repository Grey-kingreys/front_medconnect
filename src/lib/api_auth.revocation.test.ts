import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, changePassword, getMe, refreshAccessToken } from "./api_auth";
import { EVENEMENT_DECONNEXION_FORCEE, type DetailDeconnexionForcee } from "./deconnexion_forcee";

const reponse = (statut: number, corps: unknown) =>
  new Response(JSON.stringify(corps), { status: statut, headers: { "Content-Type": "application/json" } });

const fetchSimule = vi.fn();
let motifsRecus: string[] = [];
const ecouteur = (e: Event) => {
  motifsRecus.push((e as CustomEvent<DetailDeconnexionForcee>).detail.motif);
};

beforeEach(() => {
  fetchSimule.mockReset();
  vi.stubGlobal("fetch", fetchSimule);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  localStorage.clear();
  sessionStorage.clear();
  document.cookie = "mc_connecte=; path=/; max-age=0";
  localStorage.setItem("access_token", "jeton-test");
  motifsRecus = [];
  window.addEventListener(EVENEMENT_DECONNEXION_FORCEE, ecouteur);
});

afterEach(() => {
  window.removeEventListener(EVENEMENT_DECONNEXION_FORCEE, ecouteur);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("déconnexion forcée par le serveur", () => {
  it("401 avec SESSION_REVOQUEE : déconnecte sans tenter de rafraîchir", async () => {
    fetchSimule.mockResolvedValue(reponse(401, { statusCode: 401, message: "x", code: "SESSION_REVOQUEE" }));

    const erreur = await getMe().catch((e: unknown) => e);

    expect(erreur).toBeInstanceOf(ApiError);
    expect((erreur as ApiError).status).toBe(401);
    expect((erreur as ApiError).message).toBe("Vous avez été déconnecté de cet appareil.");
    expect(fetchSimule).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("access_token")).toBeNull();
    expect(motifsRecus).toEqual(["SESSION_REVOQUEE"]);
  });

  it("rafraîchissement refusé avec COMPTE_DESACTIVE : message du compte désactivé", async () => {
    fetchSimule
      .mockResolvedValueOnce(reponse(401, { statusCode: 401, message: "expiré" }))
      .mockResolvedValueOnce(reponse(401, { statusCode: 401, message: "x", code: "COMPTE_DESACTIVE" }));

    const erreur = await getMe().catch((e: unknown) => e);

    expect((erreur as ApiError).message).toBe("Votre compte a été désactivé. Contactez votre structure.");
    expect(fetchSimule).toHaveBeenCalledTimes(2);
    expect(String(fetchSimule.mock.calls[1][0])).toMatch(/\/auth\/refresh$/);
    expect(motifsRecus).toEqual(["COMPTE_DESACTIVE"]);
  });

  it("rafraîchissement refusé avec SESSION_EXPIREE : message habituel, sans déconnexion forcée", async () => {
    fetchSimule
      .mockResolvedValueOnce(reponse(401, { statusCode: 401, message: "expiré" }))
      .mockResolvedValueOnce(reponse(401, { statusCode: 401, message: "x", code: "SESSION_EXPIREE" }));

    const erreur = await getMe().catch((e: unknown) => e);

    expect((erreur as ApiError).message).toBe("Vous avez été déconnecté. Reconnectez-vous pour continuer.");
    expect(motifsRecus).toEqual([]);
    expect(sessionStorage.getItem("mc_motif_deconnexion")).toBeNull();
  });

  it("refreshAccessToken avec REFRESH_REUTILISE : rejet et déconnexion forcée", async () => {
    fetchSimule.mockResolvedValue(reponse(401, { statusCode: 401, message: "x", code: "REFRESH_REUTILISE" }));

    await expect(refreshAccessToken()).rejects.toBeInstanceOf(ApiError);
    expect(motifsRecus).toEqual(["SESSION_REVOQUEE"]);
  });
});

describe("changePassword", () => {
  it("envoie le choix de déconnecter les autres appareils", async () => {
    fetchSimule.mockResolvedValue(
      reponse(200, { data: { appareilsDeconnectes: 0 }, message: "Mot de passe modifié avec succès", success: true }),
    );

    await changePassword("Ancien123", "Nouveau123", false);

    const [url, options] = fetchSimule.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toMatch(/\/auth\/change-password$/);
    expect(options.method).toBe("POST");
    expect(JSON.parse(String(options.body))).toEqual({
      currentPassword: "Ancien123",
      newPassword: "Nouveau123",
      deconnecterAutresAppareils: false,
    });
    expect(new Headers(options.headers).get("Authorization")).toBe("Bearer jeton-test");
  });
});
