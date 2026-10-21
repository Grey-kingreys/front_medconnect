import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EVENEMENT_DECONNEXION_FORCEE } from "@/lib/deconnexion_forcee";
import { AuthProvider, useAuth, useTerminerConnexion } from "./useAuth";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/",
}));

const enveloppe = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

const DONNEES = {
  access_token: "jeton-demo",
  user: { id: "u1", email: "medecin.demo@exemple.com", nom: "Diallo", prenom: "Mamadou", role: "MEDECIN" },
};

beforeEach(() => {
  push.mockReset();
  localStorage.clear();
  document.cookie = "mc_connecte=; path=/; max-age=0";
  vi.spyOn(console, "log").mockImplementation(() => {});
  // Chargement du profil en arrière-plan : laissé en attente, hors du périmètre du test
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useTerminerConnexion", () => {
  it("stocke le jeton et l'utilisateur, pose le cookie témoin et ouvre le tableau de bord", () => {
    const { result } = renderHook(() => ({ terminer: useTerminerConnexion(), auth: useAuth() }), {
      wrapper: enveloppe,
    });

    act(() => result.current.terminer(DONNEES));

    expect(localStorage.getItem("access_token")).toBe("jeton-demo");
    expect(JSON.parse(localStorage.getItem("user") ?? "null")).toEqual(DONNEES.user);
    expect(document.cookie).toContain("mc_connecte=1");
    expect(result.current.auth.user).toEqual(DONNEES.user);
    expect(push).toHaveBeenCalledWith("/dashboard");
  });
});

describe("AuthProvider", () => {
  it("déconnexion forcée : vide l'utilisateur et ouvre la page de connexion", () => {
    const { result } = renderHook(() => ({ terminer: useTerminerConnexion(), auth: useAuth() }), {
      wrapper: enveloppe,
    });
    act(() => result.current.terminer(DONNEES));
    push.mockReset();

    act(() => {
      window.dispatchEvent(new CustomEvent(EVENEMENT_DECONNEXION_FORCEE, { detail: { motif: "SESSION_REVOQUEE" } }));
    });

    expect(result.current.auth.user).toBeNull();
    expect(push).toHaveBeenCalledWith("/auth/login");
  });
});
