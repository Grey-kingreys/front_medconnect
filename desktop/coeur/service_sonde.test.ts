/** Contact léger sans jeton : « hors connexion » seulement après un échec réel (PD04c). */
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { creerServiceSynchro, delaiContactMs } from "../electron/synchro";
import { coeurPret, fermerTout, uuid } from "./aide_tests";

afterEach(fermerTout);

function service(urlApi: string) {
  const { c } = coeurPret();
  const notifier = vi.fn();
  const s = creerServiceSynchro({
    coeur: c,
    urlApi,
    versionApp: "0.1.0",
    libellePoste: "poste",
    genererId: () => uuid(1),
    notifier,
    demanderJeton: vi.fn(),
    identite: { confirmer: vi.fn(), effacer: vi.fn(), idCourant: () => null },
    journal: vi.fn(),
  });
  return { s, notifier };
}

async function attendre(condition: () => boolean) {
  for (let i = 0; i < 100 && !condition(); i += 1) await new Promise((r) => setTimeout(r, 20));
}

describe("rythme du contact léger (D758)", () => {
  it("une fois par minute hors coupure, toutes les 10 s en coupure", () => {
    expect(delaiContactMs("EN_LIGNE")).toBe(60_000);
    expect(delaiContactMs("DEMARRAGE")).toBe(60_000);
    expect(delaiContactMs("CONNEXION_A_REFAIRE")).toBe(60_000);
    expect(delaiContactMs("HORS_LIGNE")).toBe(10_000);
  });

  it("un serveur qui répond 502 compte comme une coupure", async () => {
    const srv = http.createServer((_req, res) => {
      res.statusCode = 502;
      res.end("{}");
    });
    await new Promise<void>((ok) => srv.listen(0, "127.0.0.1", ok));
    try {
      const { s } = service(`http://127.0.0.1:${(srv.address() as AddressInfo).port}`);
      await attendre(() => s.etat().etat === "HORS_LIGNE");
      expect(s.etat().etat).toBe("HORS_LIGNE");
      s.arreter();
    } finally {
      await new Promise<void>((ok) => srv.close(() => ok()));
    }
  });
});

describe("contact léger au démarrage, sans jeton", () => {
  it("serveur injoignable : HORS_LIGNE", async () => {
    const { s, notifier } = service("http://127.0.0.1:1");
    expect(s.etat().etat).toBe("DEMARRAGE");
    await attendre(() => s.etat().etat === "HORS_LIGNE");
    expect(s.etat().etat).toBe("HORS_LIGNE");
    expect(notifier).toHaveBeenCalled();
    s.arreter();
  });

  it("serveur qui répond : reste en DEMARRAGE, jamais HORS_LIGNE", async () => {
    const srv = http.createServer((_req, res) => res.end("{}"));
    await new Promise<void>((ok) => srv.listen(0, "127.0.0.1", ok));
    try {
      const { s, notifier } = service(`http://127.0.0.1:${(srv.address() as AddressInfo).port}`);
      await attendre(() => notifier.mock.calls.length > 0);
      expect(s.etat().etat).toBe("DEMARRAGE");
      s.arreter();
    } finally {
      await new Promise<void>((ok) => srv.close(() => ok()));
    }
  });
});
