import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attendreImpression, avecDelai, creerDedoublonneur, lectureAutoriseeDepuisImpression } from "./impression_file";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("délai autour de print", () => {
  it("rend la main après le délai quand le pilote n'appelle jamais le rappel (file libérée)", async () => {
    const fausseImpression = vi.fn(); // n'appelle jamais le rappel
    const attente = attendreImpression(fausseImpression, 60_000);
    await vi.advanceTimersByTimeAsync(59_999);
    let fini = false;
    void attente.then(() => (fini = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(fini).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await attente).toEqual({ succes: false, raison: "délai dépassé", delaiDepasse: true });
  });

  it("rend le résultat du rappel sans attendre le délai, et ignore un rappel tardif", async () => {
    let rappel: (s: boolean, r: string) => void = () => undefined;
    const attente = attendreImpression((r) => (rappel = r), 60_000);
    rappel(true, "");
    expect(await attente).toEqual({ succes: true, raison: "", delaiDepasse: false });
    rappel(false, "tard");
    await vi.advanceTimersByTimeAsync(60_000);
  });

  it("une impression qui lève est un échec, pas une exception", async () => {
    const attente = attendreImpression(() => {
      throw new Error("Invalid deviceName provided");
    });
    expect(await attente).toMatchObject({ succes: false, raison: "Invalid deviceName provided", delaiDepasse: false });
  });
});

describe("délai autour de la mesure du reçu", () => {
  it("rend null quand la page ne répond jamais (file libérée)", async () => {
    const attente = avecDelai(new Promise<number>(() => undefined), 5_000);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(await attente).toBeNull();
  });

  it("rend la valeur sans attendre, et propage un rejet", async () => {
    expect(await avecDelai(Promise.resolve(120), 5_000)).toBe(120);
    await expect(avecDelai(Promise.reject(new Error("page détruite")), 5_000)).rejects.toThrow("page détruite");
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("déduplication par vente", () => {
  it("un second appel pendant l'impression reçoit le même résultat, sans relancer", async () => {
    const d = creerDedoublonneur();
    let lancer: (v: string) => void = () => undefined;
    const travail = vi.fn(() => new Promise<string>((r) => (lancer = r)));
    const a = d.lancer("v1", travail);
    const b = d.lancer("v1", travail);
    expect(d.estEnCours("v1")).toBe(true);
    lancer("ok");
    expect(await a).toBe("ok");
    expect(await b).toBe("ok");
    expect(travail).toHaveBeenCalledTimes(1);
  });

  it("une autre vente part, et la même vente peut être réimprimée ensuite", async () => {
    const d = creerDedoublonneur();
    const travail = vi.fn(async () => "ok");
    await Promise.all([d.lancer("v1", travail), d.lancer("v2", travail)]);
    expect(travail).toHaveBeenCalledTimes(2);
    await d.lancer("v1", travail);
    expect(travail).toHaveBeenCalledTimes(3);
    expect(d.estEnCours("v1")).toBe(false);
  });

  it("un échec libère la clé", async () => {
    const d = creerDedoublonneur();
    await expect(d.lancer("v1", () => Promise.reject(new Error("x")))).rejects.toThrow("x");
    expect(d.estEnCours("v1")).toBe(false);
  });
});

describe("liste blanche de la fenêtre d'impression", () => {
  it("autorise la lecture d'une vente, l'état, le profil local et le signal", () => {
    for (const canal of ["caisse:getVente", "etat", "profil:lire", "impression:signalerPret"]) {
      expect(lectureAutoriseeDepuisImpression(canal)).toBe(true);
    }
  });

  it("refuse les écritures de caisse, le jeton, la déconnexion et les réglages", () => {
    for (const canal of [
      "caisse:creerVente",
      "caisse:ouvrirSession",
      "caisse:fermerSession",
      "caisse:enregistrerAnnulationServeur",
      "caisse:chargerStock",
      "caisse:listerVentes",
      "jeton",
      "deconnexion",
      "impression:enregistrerReglages",
      "impression:imprimerVente",
    ]) {
      expect(lectureAutoriseeDepuisImpression(canal)).toBe(false);
    }
  });
});
