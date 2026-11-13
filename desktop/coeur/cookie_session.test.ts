import { describe, expect, it, vi } from "vitest";
import { retirerCookieRefresh, retirerEtControlerCookieRefresh, type CookiesSession } from "./cookie_session";

describe("cookie de refresh retiré à la déconnexion", () => {
  it("retire chaque cookie de refresh trouvé, sur son domaine, sans en lire la valeur", async () => {
    const remove = vi.fn(async () => {});
    const get = vi.fn(async () => [
      { name: "refresh_token", domain: "127.0.0.1", path: "/", secure: false },
      { name: "refresh_token", domain: ".api.exemple.gn", path: "/auth", secure: true },
    ]);
    const n = await retirerCookieRefresh({ get, remove } as CookiesSession);
    expect(n).toBe(2);
    expect(get).toHaveBeenCalledWith({ name: "refresh_token" });
    expect(remove).toHaveBeenNthCalledWith(1, "http://127.0.0.1/", "refresh_token");
    expect(remove).toHaveBeenNthCalledWith(2, "https://api.exemple.gn/auth", "refresh_token");
  });

  it("sans cookie, ou si la session échoue, ne lève jamais", async () => {
    expect(await retirerCookieRefresh({ get: async () => [], remove: vi.fn() })).toBe(0);
    expect(
      await retirerCookieRefresh({
        get: async () => {
          throw new Error("session fermée");
        },
        remove: vi.fn(),
      }),
    ).toBe(0);
    const remove = vi.fn(async () => {
      throw new Error("refus");
    });
    expect(await retirerCookieRefresh({ get: async () => [{ name: "refresh_token", domain: "127.0.0.1" }], remove })).toBe(0);
  });

  it("le cookie Secure de production se retire par son adresse https", async () => {
    const stock = [{ name: "refresh_token", domain: "api.exemple.gn", path: "/", secure: true }];
    const remove = vi.fn(async () => {
      stock.length = 0;
    });
    const journal = vi.fn();
    expect(await retirerEtControlerCookieRefresh({ get: async () => [...stock], remove }, journal)).toBe(true);
    expect(remove).toHaveBeenCalledWith("https://api.exemple.gn/", "refresh_token");
    expect(journal).not.toHaveBeenCalled();
  });

  it("un retrait sans effet ne reste pas silencieux, et le journal ne cite ni valeur ni domaine", async () => {
    const journal = vi.fn();
    const cookies = { get: async () => [{ name: "refresh_token", domain: "api.exemple.gn", path: "/", secure: true }], remove: async () => {} };
    expect(await retirerEtControlerCookieRefresh(cookies, journal)).toBe(false);
    expect(journal).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(journal.mock.calls)).not.toContain("exemple");
  });
});
