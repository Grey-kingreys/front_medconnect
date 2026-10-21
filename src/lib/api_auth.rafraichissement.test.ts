import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, authDownload, changePassword, getMe } from "./api_auth";
import { EVENEMENT_DECONNEXION_FORCEE, type DetailDeconnexionForcee } from "./deconnexion_forcee";

const reponse = (statut: number, corps: unknown) =>
  new Response(JSON.stringify(corps), { status: statut, headers: { "Content-Type": "application/json" } });

const fetchSimule = vi.fn();
let motifsRecus: string[] = [];
const ecouteur = (e: Event) => {
  motifsRecus.push((e as CustomEvent<DetailDeconnexionForcee>).detail.motif);
};

const rafraichissementReussi = () => reponse(200, { data: { access_token: "nouveau" }, message: "", success: true });
const profilOk = () => reponse(200, { data: { id: "u1" }, message: "", success: true });
const cheminAppele = (i: number) => String(fetchSimule.mock.calls[i][0]);

beforeEach(() => {
  fetchSimule.mockReset();
  vi.stubGlobal("fetch", fetchSimule);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  localStorage.clear();
  sessionStorage.clear();
  document.cookie = "mc_connecte=1; path=/";
  localStorage.setItem("access_token", "jeton-test");
  motifsRecus = [];
  window.addEventListener(EVENEMENT_DECONNEXION_FORCEE, ecouteur);
});

afterEach(() => {
  window.removeEventListener(EVENEMENT_DECONNEXION_FORCEE, ecouteur);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("rafraîchissement de la connexion sur un 401 de jeton", () => {
  it.each(["JETON_EXPIRE", "JETON_INVALIDE", "JETON_ABSENT"])(
    "401 %s : rafraîchit puis réussit avec le nouveau jeton",
    async (code) => {
      fetchSimule
        .mockResolvedValueOnce(reponse(401, { statusCode: 401, message: "x", code }))
        .mockResolvedValueOnce(rafraichissementReussi())
        .mockResolvedValueOnce(profilOk());

      const res = await getMe();

      expect(res.success).toBe(true);
      expect(fetchSimule).toHaveBeenCalledTimes(3);
      expect(cheminAppele(1)).toMatch(/\/auth\/refresh$/);
      const options = fetchSimule.mock.calls[2][1] as RequestInit;
      expect(new Headers(options.headers).get("Authorization")).toBe("Bearer nouveau");
      expect(localStorage.getItem("access_token")).toBe("nouveau");
    },
  );

  it("401 sans code (ancien serveur) : tente le rafraîchissement", async () => {
    fetchSimule
      .mockResolvedValueOnce(reponse(401, { statusCode: 401, message: "Unauthorized" }))
      .mockResolvedValueOnce(rafraichissementReussi())
      .mockResolvedValueOnce(profilOk());

    await getMe();

    expect(fetchSimule).toHaveBeenCalledTimes(3);
    expect(cheminAppele(1)).toMatch(/\/auth\/refresh$/);
  });

  it("authDownload : rafraîchit sur JETON_EXPIRE puis renvoie le fichier", async () => {
    fetchSimule
      .mockResolvedValueOnce(reponse(401, { statusCode: 401, message: "x", code: "JETON_EXPIRE" }))
      .mockResolvedValueOnce(rafraichissementReussi())
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="doc.pdf"' },
        }),
      );

    const { blob, filename } = await authDownload("/documents/1");

    expect(blob.size).toBe(3);
    expect(filename).toBe("doc.pdf");
    expect(fetchSimule).toHaveBeenCalledTimes(3);
  });
});

describe("erreurs qui ne demandent pas de rafraîchissement", () => {
  it("400 MOT_DE_PASSE_ACTUEL_INCORRECT : un seul appel, jeton conservé, aucune déconnexion", async () => {
    fetchSimule.mockResolvedValue(
      reponse(400, {
        statusCode: 400,
        message: "Le mot de passe actuel est incorrect.",
        code: "MOT_DE_PASSE_ACTUEL_INCORRECT",
      }),
    );

    const erreur = await changePassword("Faux1234", "Nouveau123", true).catch((e: unknown) => e);

    expect(erreur).toBeInstanceOf(ApiError);
    expect((erreur as ApiError).status).toBe(400);
    expect((erreur as ApiError).message).toBe("Le mot de passe actuel est incorrect.");
    expect((erreur as ApiError).details?.code).toBe("MOT_DE_PASSE_ACTUEL_INCORRECT");
    expect(fetchSimule).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("access_token")).toBe("jeton-test");
    expect(motifsRecus).toEqual([]);
  });

  it.each(["AUTRE_CODE", "SESSION_EXPIREE"])("401 %s sur une requête ordinaire : relancée telle quelle", async (code) => {
    fetchSimule.mockResolvedValue(reponse(401, { statusCode: 401, message: "Message du serveur", code }));

    const erreur = await getMe().catch((e: unknown) => e);

    expect(erreur).toBeInstanceOf(ApiError);
    expect((erreur as ApiError).message).toBe("Message du serveur");
    expect(fetchSimule).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("access_token")).toBe("jeton-test");
    expect(motifsRecus).toEqual([]);
  });
});

describe("nouvelle tentative après rafraîchissement", () => {
  it("ancien serveur, mot de passe faux : l'erreur du serveur remonte sans déconnexion", async () => {
    const corps = { statusCode: 401, message: "Le mot de passe actuel est incorrect" };
    fetchSimule
      .mockResolvedValueOnce(reponse(401, corps))
      .mockResolvedValueOnce(rafraichissementReussi())
      .mockResolvedValueOnce(reponse(401, corps));

    const erreur = await changePassword("Faux1234", "Nouveau123", true).catch((e: unknown) => e);

    expect(erreur).toBeInstanceOf(ApiError);
    expect((erreur as ApiError).status).toBe(401);
    expect((erreur as ApiError).message).toBe("Le mot de passe actuel est incorrect");
    expect((erreur as ApiError).message).not.toMatch(/déconnecté/);
    expect(fetchSimule).toHaveBeenCalledTimes(3);
    expect(localStorage.getItem("access_token")).toBe("nouveau");
    expect(document.cookie).toContain("mc_connecte=1");
    expect(motifsRecus).toEqual([]);
  });

  it("SESSION_REVOQUEE à la nouvelle tentative : déconnexion forcée", async () => {
    fetchSimule
      .mockResolvedValueOnce(reponse(401, { statusCode: 401, message: "x", code: "JETON_EXPIRE" }))
      .mockResolvedValueOnce(rafraichissementReussi())
      .mockResolvedValueOnce(reponse(401, { statusCode: 401, message: "x", code: "SESSION_REVOQUEE" }));

    const erreur = await getMe().catch((e: unknown) => e);

    expect(erreur).toBeInstanceOf(ApiError);
    expect((erreur as ApiError).message).toBe("Vous avez été déconnecté de cet appareil.");
    expect(motifsRecus).toEqual(["SESSION_REVOQUEE"]);
    expect(localStorage.getItem("access_token")).toBeNull();
  });
});
