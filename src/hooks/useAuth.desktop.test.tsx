import { act, cleanup, fireEvent, renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lireContexteAcces } from "@/lib/acces";
import { ApiError, authFetch, type UserProfile } from "@/lib/api_auth";
import type { PontDesktop } from "@/lib/caisse/contrat_desktop";
import { lireEtEffacerMotif } from "@/lib/deconnexion_forcee";
import { AuthProvider, useAuth, useTerminerConnexion } from "./useAuth";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/",
}));

const enveloppe = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

const UTILISATEUR = { id: "u1", email: "vendeur@exemple.com", nom: "Diallo", prenom: "Mariama", role: "PHARMACIEN" };
const PROFIL = {
  ...UTILISATEUR,
  isActive: true,
  structureType: "PHARMACIE",
  permissions: ["caisse:utiliser", "vente:write"],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} as unknown as UserProfile;

const reponse = (statut: number, corps: unknown) =>
  new Response(JSON.stringify(corps), { status: statut, headers: { "Content-Type": "application/json" } });
const refreshOk = () => reponse(200, { data: { access_token: "nouveau-jeton" }, message: "", success: true });

let profilLocal: UserProfile | null;
let demandeJeton: (() => void) | null;
let enLigne: boolean;
let identitePoste: string | null;
const pont = {
  version: "test",
  definirJeton: vi.fn(async () => {}),
  deconnexion: vi.fn(async () => {
    identitePoste = null;
    profilLocal = null;
  }),
  surDemandeJeton: vi.fn((rappel: () => void) => {
    demandeJeton = rappel;
    return () => {};
  }),
  profil: { lire: vi.fn(async () => profilLocal) },
  etat: vi.fn(async () => ({ enLigne })),
  surEtat: vi.fn(() => () => {}),
  caisse: {
    chargerStock: vi.fn(async () =>
      identitePoste === null
        ? { ok: false, status: 401, message: "Connexion nécessaire." }
        : { ok: true, data: [], message: "" },
    ),
    creerVente: vi.fn(async () =>
      identitePoste === null
        ? { ok: false, status: 401, message: "Connexion nécessaire." }
        : { ok: true, data: {}, message: "" },
    ),
  },
};

const fetchSimule = vi.fn();
const reseauCoupe = () => vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);

function sessionEnStockage() {
  localStorage.setItem("access_token", "jeton-expire");
  localStorage.setItem("user", JSON.stringify(UTILISATEUR));
  document.cookie = "mc_connecte=1; path=/";
}

beforeEach(() => {
  push.mockReset();
  localStorage.clear();
  sessionStorage.clear();
  document.cookie = "mc_connecte=; path=/; max-age=0";
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  fetchSimule.mockReset();
  vi.stubGlobal("fetch", fetchSimule);
  profilLocal = PROFIL;
  identitePoste = "u1";
  demandeJeton = null;
  enLigne = true;
  for (const f of [pont.definirJeton, pont.deconnexion, pont.surDemandeJeton, pont.profil.lire, pont.etat]) f.mockClear();
  pont.caisse.chargerStock.mockClear();
  pont.caisse.creerVente.mockClear();
  window.medconnecteDesktop = pont as unknown as PontDesktop;
});

afterEach(() => {
  cleanup();
  delete window.medconnecteDesktop;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const attendreFinChargement = (result: { current: { loading: boolean } }) =>
  waitFor(() => expect(result.current.loading).toBe(false));

describe("desktop : démarrage sans réseau", () => {
  it("garde l'utilisateur, lit le profil du pont, ne purge rien, permissions lisibles", async () => {
    sessionEnStockage();
    reseauCoupe();
    const { result } = renderHook(() => useAuth(), { wrapper: enveloppe });
    await attendreFinChargement(result);
    await waitFor(() => expect(result.current.profile).not.toBeNull());

    expect(result.current.user).toEqual(UTILISATEUR);
    expect(result.current.profile).toEqual(PROFIL);
    expect(localStorage.getItem("access_token")).toBe("jeton-expire");
    expect(localStorage.getItem("user")).not.toBeNull();
    expect(document.cookie).toContain("mc_connecte=1");
    const acces = lireContexteAcces(result.current.user!, result.current.profile);
    expect(acces.mode).toBe("permissions");
    expect(acces.mode === "permissions" && acces.permissions.has("caisse:utiliser")).toBe(true);
    expect(pont.deconnexion).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalledWith("/auth/login");
  });

  it("sans profil local : utilisateur gardé, profil nul, aucune purge", async () => {
    sessionEnStockage();
    profilLocal = null;
    reseauCoupe();
    const { result } = renderHook(() => useAuth(), { wrapper: enveloppe });
    await waitFor(() => expect(pont.profil.lire).toHaveBeenCalled());
    await attendreFinChargement(result);

    expect(result.current.user).toEqual(UTILISATEUR);
    expect(result.current.profile).toBeNull();
    expect(localStorage.getItem("access_token")).toBe("jeton-expire");
    expect(localStorage.getItem("user")).not.toBeNull();
    expect(pont.deconnexion).not.toHaveBeenCalled();
  });

  it("profil local d'un autre compte : pas de reprise, rien n'est purgé", async () => {
    sessionEnStockage();
    profilLocal = { ...PROFIL, id: "autre" } as UserProfile;
    reseauCoupe();
    const { result } = renderHook(() => useAuth(), { wrapper: enveloppe });
    await waitFor(() => expect(pont.profil.lire).toHaveBeenCalled());
    await attendreFinChargement(result);

    expect(result.current.user).toEqual(UTILISATEUR);
    expect(result.current.profile).toBeNull();
    expect(pont.deconnexion).not.toHaveBeenCalled();
  });

  it("serveur en 503 : même chose qu'une coupure, pas de purge", async () => {
    sessionEnStockage();
    fetchSimule.mockImplementation(() => Promise.resolve(reponse(503, {})));
    const { result } = renderHook(() => useAuth(), { wrapper: enveloppe });
    // La lecture du profil est réessayée (1 s puis 3 s) avant de céder
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 9000 });
    await waitFor(() => expect(result.current.profile).not.toBeNull(), { timeout: 9000 });

    expect(result.current.user).toEqual(UTILISATEUR);
    expect(localStorage.getItem("access_token")).toBe("jeton-expire");
    expect(pont.deconnexion).not.toHaveBeenCalled();
  }, 15000);
});

describe("desktop : stockage vide (origine ou port changé)", () => {
  it("rétablit la session d'affichage du profil du pont, sans jeton, et n'efface pas le poste", async () => {
    reseauCoupe();
    const { result } = renderHook(() => useAuth(), { wrapper: enveloppe });
    await waitFor(() => expect(result.current.user).not.toBeNull());

    expect(result.current.user).toMatchObject({ id: "u1", role: "PHARMACIEN" });
    expect(result.current.profile).toEqual(PROFIL);
    expect(localStorage.getItem("access_token")).toBeNull();
    expect(JSON.parse(localStorage.getItem("user") ?? "null")).toMatchObject({ id: "u1" });
    expect(document.cookie).toContain("mc_connecte=1");
    expect(pont.deconnexion).not.toHaveBeenCalled();
  });

  it("en ligne : un jeton est demandé aussitôt et poussé au processus principal", async () => {
    fetchSimule.mockImplementation(() => Promise.resolve(refreshOk()));
    renderHook(() => useAuth(), { wrapper: enveloppe });
    await waitFor(() => expect(pont.definirJeton).toHaveBeenCalledWith("nouveau-jeton"));
    expect(pont.deconnexion).not.toHaveBeenCalled();
  });

  it("en ligne, session refusée par le serveur : la reprise tombe, poste déconnecté", async () => {
    fetchSimule.mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ statusCode: 401, message: "Session expirée", code: "SESSION_EXPIREE" }), { status: 401 })),
    );
    const { result } = renderHook(() => useAuth(), { wrapper: enveloppe });
    await waitFor(() => expect(pont.deconnexion).toHaveBeenCalled());
    await waitFor(() => expect(result.current.user).toBeNull());
    expect(localStorage.getItem("user")).toBeNull();
    expect(document.cookie).not.toContain("mc_connecte=1");
  });

  it("déconnexion ou révocation passées (profil effacé) : aucune reprise, aucun refresh, même avec un utilisateur en stockage", async () => {
    profilLocal = null;
    localStorage.setItem("user", JSON.stringify(UTILISATEUR));
    fetchSimule.mockImplementation(() => Promise.resolve(refreshOk()));
    const { result } = renderHook(() => useAuth(), { wrapper: enveloppe });
    await waitFor(() => expect(pont.profil.lire).toHaveBeenCalled());
    await attendreFinChargement(result);
    expect(result.current.user).toBeNull();
    expect(pont.definirJeton).not.toHaveBeenCalled();
    expect(document.cookie).not.toContain("mc_connecte=1");
  });

  it("sans profil dans le pont : page de connexion, mais aucune déconnexion du poste", async () => {
    profilLocal = null;
    reseauCoupe();
    const { result } = renderHook(() => useAuth(), { wrapper: enveloppe });
    await waitFor(() => expect(pont.profil.lire).toHaveBeenCalled());
    await attendreFinChargement(result);

    expect(result.current.user).toBeNull();
    expect(pont.deconnexion).not.toHaveBeenCalled();
  });
});

describe("desktop : refus du serveur, comme le web", () => {
  it("401 SESSION_REVOQUEE : purge, motif gardé et poste déconnecté", async () => {
    sessionEnStockage();
    fetchSimule.mockImplementation(() =>
      Promise.resolve(reponse(401, { statusCode: 401, message: "x", code: "SESSION_REVOQUEE" })),
    );
    const { result } = renderHook(() => useAuth(), { wrapper: enveloppe });
    await attendreFinChargement(result);
    await waitFor(() => expect(result.current.user).toBeNull());

    expect(localStorage.getItem("access_token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
    expect(lireEtEffacerMotif()).toBe("SESSION_REVOQUEE");
    expect(pont.deconnexion).toHaveBeenCalled();
  });

  it("401 simple puis refresh en 401 : purge et poste déconnecté", async () => {
    sessionEnStockage();
    fetchSimule.mockImplementation(() => Promise.resolve(reponse(401, { statusCode: 401, message: "x" })));
    const { result } = renderHook(() => useAuth(), { wrapper: enveloppe });
    await attendreFinChargement(result);
    await waitFor(() => expect(result.current.user).toBeNull());

    expect(localStorage.getItem("access_token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
    expect(document.cookie).not.toContain("mc_connecte=1");
    expect(pont.deconnexion).toHaveBeenCalled();
  });
});

describe("desktop : authFetch", () => {
  it("401 puis refresh en panne réseau : erreur réseau, jeton gardé, poste non déconnecté", async () => {
    localStorage.setItem("access_token", "jeton-expire");
    fetchSimule
      .mockResolvedValueOnce(reponse(401, { statusCode: 401, message: "x", code: "JETON_EXPIRE" }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const erreur = await authFetch("/pharmacie/x").catch((e: unknown) => e);

    expect(erreur).toBeInstanceOf(ApiError);
    expect((erreur as ApiError).status).toBe(0);
    expect(localStorage.getItem("access_token")).toBe("jeton-expire");
    expect(pont.deconnexion).not.toHaveBeenCalled();
  });

  it("401 puis refresh refusé par le serveur : session purgée et poste déconnecté", async () => {
    localStorage.setItem("access_token", "jeton-expire");
    localStorage.setItem("user", JSON.stringify(UTILISATEUR));
    fetchSimule
      .mockResolvedValueOnce(reponse(401, { statusCode: 401, message: "x", code: "JETON_EXPIRE" }))
      .mockResolvedValueOnce(reponse(401, { statusCode: 401, message: "x" }));

    await expect(authFetch("/pharmacie/x")).rejects.toMatchObject({ status: 401 });

    expect(localStorage.getItem("access_token")).toBeNull();
    expect(pont.deconnexion).toHaveBeenCalledTimes(1);
  });

  it("chaque renouvellement de jeton est poussé au processus principal", async () => {
    localStorage.setItem("access_token", "jeton-expire");
    fetchSimule
      .mockResolvedValueOnce(reponse(401, { statusCode: 401, message: "x", code: "JETON_EXPIRE" }))
      .mockResolvedValueOnce(refreshOk())
      .mockResolvedValueOnce(reponse(200, { data: {}, message: "", success: true }));

    await authFetch("/pharmacie/x");

    expect(pont.definirJeton).toHaveBeenCalledWith("nouveau-jeton");
  });
});

describe("desktop : jeton et déconnexion volontaire", () => {
  it("la connexion pousse le jeton ; la déconnexion en ligne appelle deconnexion()", async () => {
    fetchSimule.mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => ({ terminer: useTerminerConnexion(), auth: useAuth() }), { wrapper: enveloppe });
    act(() => result.current.terminer({ access_token: "jeton-connexion", user: UTILISATEUR } as never));
    expect(pont.definirJeton).toHaveBeenCalledWith("jeton-connexion");
    // Au montage sans session, le rendu a déjà confirmé que le poste n'a plus d'utilisateur
    pont.deconnexion.mockClear();

    fetchSimule.mockReset();
    fetchSimule.mockImplementation(() => Promise.resolve(reponse(200, { data: null, message: "", success: true })));
    await act(async () => {
      await result.current.auth.logout();
    });

    expect(pont.deconnexion).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("access_token")).toBeNull();
    expect(push).toHaveBeenCalledWith("/auth/login");
  });

  it("surDemandeJeton après déconnexion (stockage et profil vides) : aucun refresh", async () => {
    profilLocal = null;
    renderHook(() => useAuth(), { wrapper: enveloppe });
    fetchSimule.mockReset();
    fetchSimule.mockImplementation(() => Promise.resolve(refreshOk()));

    await act(async () => {
      demandeJeton!();
    });

    expect(fetchSimule).not.toHaveBeenCalled();
    expect(pont.definirJeton).not.toHaveBeenCalledWith("nouveau-jeton");
    expect(localStorage.getItem("access_token")).toBeNull();
  });

  it("surDemandeJeton : refresh puis jeton poussé", async () => {
    sessionEnStockage();
    renderHook(() => useAuth(), { wrapper: enveloppe });
    expect(demandeJeton).not.toBeNull();
    fetchSimule.mockImplementation(() => Promise.resolve(refreshOk()));

    await act(async () => {
      demandeJeton!();
    });

    await waitFor(() => expect(pont.definirJeton).toHaveBeenCalledWith("nouveau-jeton"));
    expect(localStorage.getItem("access_token")).toBe("nouveau-jeton");
  });

  it("surDemandeJeton en panne réseau : rien n'est fait, aucune déconnexion", async () => {
    sessionEnStockage();
    renderHook(() => useAuth(), { wrapper: enveloppe });
    fetchSimule.mockReset();
    fetchSimule.mockRejectedValue(new TypeError("Failed to fetch"));

    await act(async () => {
      demandeJeton!();
    });

    await waitFor(() => expect(fetchSimule).toHaveBeenCalled());
    expect(pont.deconnexion).not.toHaveBeenCalled();
    expect(localStorage.getItem("user")).not.toBeNull();
  });
});

describe("desktop : vendeur suivant, hors ligne", () => {
  it("A se déconnecte sans réseau, l'application redémarre : connexion demandée, aucune vente au nom de A", async () => {
    sessionEnStockage();
    enLigne = false;
    reseauCoupe();
    const premier = renderHook(() => useAuth(), { wrapper: enveloppe });
    await attendreFinChargement(premier.result);
    await waitFor(() => expect(premier.result.current.profile).not.toBeNull());

    // Hors ligne : la déconnexion demande d'abord confirmation
    await act(async () => {
      await premier.result.current.logout();
    });
    expect(pont.deconnexion).not.toHaveBeenCalled();
    expect(screen.getByText(/ne pourrez pas vous reconnecter/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Rester connecté" }));
    expect(pont.deconnexion).not.toHaveBeenCalled();
    expect(localStorage.getItem("user")).not.toBeNull();

    await act(async () => {
      await premier.result.current.logout();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Se déconnecter" }));
    });
    await waitFor(() => expect(pont.deconnexion).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(premier.result.current.user).toBeNull());
    expect(localStorage.getItem("user")).toBeNull();

    // Redémarrage de l'application, toujours sans réseau
    premier.unmount();
    push.mockReset();
    const apres = renderHook(() => useAuth(), { wrapper: enveloppe });
    await attendreFinChargement(apres.result);
    expect(apres.result.current.user).toBeNull();
    expect(apres.result.current.profile).toBeNull();
    // Le montage sans session n'efface plus rien : seule la déconnexion volontaire a appelé le pont
    expect(pont.deconnexion).toHaveBeenCalledTimes(1);

    const stock = await window.medconnecteDesktop!.caisse.chargerStock("ph1");
    const vente = await window.medconnecteDesktop!.caisse.creerVente("ph1", { lignes: [] } as never, "cle");
    expect(stock).toMatchObject({ ok: false, status: 401 });
    expect(vente).toMatchObject({ ok: false, status: 401 });
  });
});

describe("web sans pont : comportement d'aujourd'hui inchangé (D743)", () => {
  it("une panne réseau à la vérification purge encore la session, sans aucun appel au pont", async () => {
    delete window.medconnecteDesktop;
    sessionEnStockage();
    reseauCoupe();
    const { result } = renderHook(() => useAuth(), { wrapper: enveloppe });
    // Le chargement démarre à faux quand un jeton est gardé : on attend la fin de la vérification
    await waitFor(() => expect(result.current.user).toBeNull());

    expect(result.current.profile).toBeNull();
    expect(localStorage.getItem("access_token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
    expect(document.cookie).not.toContain("mc_connecte=1");
    expect(pont.definirJeton).not.toHaveBeenCalled();
    expect(pont.deconnexion).not.toHaveBeenCalled();
    expect(pont.profil.lire).not.toHaveBeenCalled();
  });

  it("la déconnexion web n'ouvre aucune confirmation, même hors ligne", async () => {
    delete window.medconnecteDesktop;
    sessionEnStockage();
    reseauCoupe();
    const { result } = renderHook(() => useAuth(), { wrapper: enveloppe });
    await waitFor(() => expect(result.current.user).toBeNull());
    sessionEnStockage();
    await act(async () => {
      await result.current.logout().catch(() => {});
    });
    expect(screen.queryByText(/ne pourrez pas vous reconnecter/)).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
  });
});
