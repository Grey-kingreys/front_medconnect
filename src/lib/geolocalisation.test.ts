import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  libelleDistancePrecision,
  libellePrecisionSos,
  localiserPrecisement,
  REGLAGES_PRECIS,
  REGLAGES_RAPIDES,
  REGLAGES_SOS,
  type PositionMesuree,
  type ResultatPosition,
} from "./geolocalisation";

type RappelSucces = (pos: GeolocationPosition) => void;
type RappelErreur = (erreur: { code: number }) => void;

let succes: RappelSucces;
let echec: RappelErreur;
const watchPosition = vi.fn();
const clearWatch = vi.fn();

const mesure = (precision: number, latitude = 9.5, longitude = -13.7, timestamp = Date.UTC(2026, 9, 21, 10, 0, 0)) =>
  ({ coords: { latitude, longitude, accuracy: precision }, timestamp }) as unknown as GeolocationPosition;

beforeEach(() => {
  vi.useFakeTimers();
  watchPosition.mockReset();
  clearWatch.mockReset();
  watchPosition.mockImplementation((ok: RappelSucces, ko: RappelErreur) => {
    succes = ok;
    echec = ko;
    return 7;
  });
  Object.defineProperty(navigator, "geolocation", {
    value: { watchPosition, clearWatch },
    configurable: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
  delete (navigator as unknown as Record<string, unknown>).geolocation;
});

describe("localiserPrecisement", () => {
  it("demande la haute précision sans position en cache", () => {
    void localiserPrecisement(REGLAGES_SOS);
    expect(watchPosition.mock.calls[0][2]).toEqual({ enableHighAccuracy: true, maximumAge: 0, timeout: 10000 });
  });

  it("retient la meilleure précision et prévient à chaque amélioration", async () => {
    const onAmelioration = vi.fn();
    const promesse = localiserPrecisement(REGLAGES_SOS, onAmelioration);
    succes(mesure(800));
    succes(mesure(120));
    succes(mesure(300));
    await vi.advanceTimersByTimeAsync(10_000);
    const r = await promesse;
    expect(r.ok && r.position.precision).toBe(120);
    expect(onAmelioration).toHaveBeenCalledTimes(2);
    expect(onAmelioration.mock.calls[0][0].precision).toBe(800);
    expect(onAmelioration.mock.calls[1][0].precision).toBe(120);
    expect(clearWatch).toHaveBeenCalledWith(7);
  });

  it("s'arrête dès 50 m", async () => {
    const promesse = localiserPrecisement(REGLAGES_SOS);
    succes(mesure(200));
    succes(mesure(40));
    const r = await promesse;
    expect(r.ok && r.position.precision).toBe(40);
    expect(clearWatch).toHaveBeenCalledWith(7);
  });

  it("respecte la durée maximale", async () => {
    let resolu = false;
    const promesse = localiserPrecisement(REGLAGES_SOS).then((r) => {
      resolu = true;
      return r;
    });
    await vi.advanceTimersByTimeAsync(9_999);
    expect(resolu).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await promesse).toEqual({ ok: false, cause: "indisponible" });
  });

  it("n'arrête pas la recherche sur une erreur non bloquante", async () => {
    let resolu = false;
    const promesse = localiserPrecisement(REGLAGES_SOS).then((r) => {
      resolu = true;
      return r;
    });
    succes(mesure(900));
    echec({ code: 2 });
    await vi.advanceTimersByTimeAsync(0);
    expect(resolu).toBe(false);
    await vi.advanceTimersByTimeAsync(10_000);
    const r = await promesse;
    expect(r.ok && r.position.precision).toBe(900);
  });

  it("s'arrête aussitôt sur un refus de permission", async () => {
    const promesse = localiserPrecisement(REGLAGES_SOS);
    echec({ code: 1 });
    expect(await promesse).toEqual({ ok: false, cause: "refusee" });
    expect(clearWatch).toHaveBeenCalledWith(7);
  });

  it("signale un navigateur sans géolocalisation", async () => {
    delete (navigator as unknown as Record<string, unknown>).geolocation;
    expect(await localiserPrecisement(REGLAGES_SOS)).toEqual({ ok: false, cause: "non_prise_en_charge" });
  });

  it("rend la première mesure avec les réglages rapides", async () => {
    const promesse = localiserPrecisement(REGLAGES_RAPIDES);
    succes(mesure(3000));
    const r = await promesse;
    expect(r.ok && r.position.precision).toBe(3000);
  });

  it("renvoie l'heure de mesure en ISO et la source", async () => {
    const promesse = localiserPrecisement(REGLAGES_SOS);
    succes(mesure(10));
    const r: ResultatPosition = await promesse;
    expect(r.ok && r.position.horodatagePosition).toBe("2026-10-21T10:00:00.000Z");
    expect(r.ok && r.position.source).toBe("inconnue");
  });
});

describe("libelleDistancePrecision", () => {
  it("parle en mètres sous 1 km, en kilomètres au delà", () => {
    expect(libelleDistancePrecision(27)).toBe("environ 30 m");
    expect(libelleDistancePrecision(4)).toBe("environ 10 m");
    expect(libelleDistancePrecision(2480)).toBe("environ 2,5 km");
  });
});

describe("REGLAGES_PRECIS", () => {
  it("ignore une première mesure grossière et attend une mesure à 30 m", async () => {
    let resolu = false;
    const promesse = localiserPrecisement(REGLAGES_PRECIS).then((r) => {
      resolu = true;
      return r;
    });
    succes(mesure(3000));
    await vi.advanceTimersByTimeAsync(0);
    expect(resolu).toBe(false);
    succes(mesure(25));
    const r = await promesse;
    expect(r.ok && r.position.precision).toBe(25);
  });
});

describe("libellePrecisionSos", () => {
  const position = (precision: number): PositionMesuree => ({
    latitude: 9.5,
    longitude: -13.7,
    precision,
    horodatagePosition: "2026-10-21T10:00:00.000Z",
    source: "inconnue",
  });

  it("arrondit la précision à la dizaine, 10 m au minimum", () => {
    expect(libellePrecisionSos(position(27), "15")).toBe("Position précise à environ 30 m");
    expect(libellePrecisionSos(position(3), "15")).toBe("Position précise à environ 10 m");
    expect(libellePrecisionSos(position(500), "15")).toBe("Position précise à environ 500 m");
  });

  it("dit la position approximative au delà de 500 m", () => {
    expect(libellePrecisionSos(position(501), "117")).toBe(
      "Position approximative : si possible, appelez aussi le 117"
    );
  });

  it("dit la position non trouvée sans mesure", () => {
    expect(libellePrecisionSos(null, "117")).toBe("Position non trouvée : si possible, appelez aussi le 117");
  });
});
