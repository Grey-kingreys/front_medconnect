import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, authFetch } from "./api_auth";
import { EVENEMENT_ACCES_REFUSE, estPermissionRefusee } from "./acces";

const reponse = (statut: number, corps: unknown) =>
  new Response(JSON.stringify(corps), { status: statut, headers: { "Content-Type": "application/json" } });

const fetchSimule = vi.fn();
const ecouteur = vi.fn();

beforeEach(() => {
  fetchSimule.mockReset();
  ecouteur.mockReset();
  vi.stubGlobal("fetch", fetchSimule);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  localStorage.setItem("access_token", "jeton-test");
  window.addEventListener(EVENEMENT_ACCES_REFUSE, ecouteur);
});

afterEach(() => {
  window.removeEventListener(EVENEMENT_ACCES_REFUSE, ecouteur);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("estPermissionRefusee", () => {
  it("est vrai pour un 403 portant le code PERMISSION_REFUSEE", () => {
    expect(estPermissionRefusee(new ApiError("x", 403, { code: "PERMISSION_REFUSEE" }))).toBe(true);
  });

  it("est faux pour un 403 sans code", () => {
    expect(estPermissionRefusee(new ApiError("x", 403))).toBe(false);
  });

  it("est faux pour un 403 portant un autre code", () => {
    expect(estPermissionRefusee(new ApiError("x", 403, { code: "SOS_ROLE_INTERDIT" }))).toBe(false);
  });

  it("est faux pour une erreur ordinaire", () => {
    expect(estPermissionRefusee(new Error("x"))).toBe(false);
  });
});

describe("authFetch face à un refus de droit", () => {
  const refus = () => reponse(403, { code: "PERMISSION_REFUSEE", message: "Accès refusé" });

  it("signale le refus une fois sur une lecture et relance l'erreur", async () => {
    fetchSimule.mockResolvedValue(refus());
    await expect(authFetch("/exemple")).rejects.toMatchObject({ status: 403 });
    expect(ecouteur).toHaveBeenCalledTimes(1);
  });

  it("ne signale rien sur une écriture", async () => {
    fetchSimule.mockResolvedValue(refus());
    await expect(authFetch("/exemple", { method: "POST", body: "{}" })).rejects.toMatchObject({ status: 403 });
    expect(ecouteur).not.toHaveBeenCalled();
  });

  it("ne signale rien sur un 403 sans code", async () => {
    fetchSimule.mockResolvedValue(reponse(403, { message: "Interdit" }));
    await expect(authFetch("/exemple")).rejects.toMatchObject({ status: 403 });
    expect(ecouteur).not.toHaveBeenCalled();
  });
});
