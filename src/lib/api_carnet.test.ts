import { beforeEach, describe, expect, it, vi } from "vitest";
import { authFetch } from "./api_auth";
import {
  createAnalyse,
  createConsultation,
  createOrdonnance,
  createRendezVous,
  createUrgence,
  createVaccination,
  nouvelleCleIdempotence,
  updateRendezVousStatus,
} from "./api_carnet";

vi.mock("./api_auth");

const mockedAuthFetch = vi.mocked(authFetch);

beforeEach(() => {
  mockedAuthFetch.mockReset();
});

describe("api_carnet : creations en POST", () => {
  const cas = [
    ["createConsultation", createConsultation, "/carnet-sante/consultations", { motif: "Fievre", patientId: "p1" }],
    // Corps conformes aux DTO du back (voir src/lib/schemas/carnet.ts), validés avant l'envoi.
    ["createOrdonnance", createOrdonnance, "/carnet-sante/ordonnances", { medicaments: [], patientId: "p1" }],
    ["createVaccination", createVaccination, "/carnet-sante/vaccinations", { vaccin: "BCG", dateVaccin: "2026-01-01" }],
    [
      "createAnalyse",
      createAnalyse,
      "/carnet-sante/analyses",
      { typeAnalyse: "NFS", resultats: "Normal", dateAnalyse: "2026-01-01", patientId: "p1" },
    ],
    ["createRendezVous", createRendezVous, "/carnet-sante/rendez-vous", { date: "2026-12-01", motif: "Suivi", patientId: "p1" }],
  ] as const;

  it.each(cas)("%s appelle authFetch avec le bon chemin et le corps JSON", (_nom, fn, chemin, data) => {
    // Chaque fonction a son propre type d'entrée : on les appelle de façon uniforme ici.
    (fn as (d: unknown) => Promise<unknown>)(data);
    expect(mockedAuthFetch).toHaveBeenCalledTimes(1);
    const [endpoint, options] = mockedAuthFetch.mock.calls[0];
    expect(endpoint).toBe(chemin);
    expect(options?.method).toBe("POST");
    expect(JSON.parse(options?.body as string)).toEqual(data);
  });
});

describe("createUrgence", () => {
  it("envoie la position mesurée et la clé d'idempotence", () => {
    createUrgence(
      {
        latitude: 9.5,
        longitude: -13.7,
        precision: 25,
        horodatagePosition: "2026-10-21T10:00:00.000Z",
        source: "inconnue",
        message: "SOS",
      },
      "cle-1"
    );
    const [endpoint, options] = mockedAuthFetch.mock.calls[0];
    expect(endpoint).toBe("/carnet-sante/sos");
    expect(options?.method).toBe("POST");
    const corps = JSON.parse(options?.body as string);
    expect(corps).toMatchObject({ precision: 25, horodatagePosition: "2026-10-21T10:00:00.000Z", source: "inconnue" });
    expect(options?.headers).toMatchObject({ "Idempotency-Key": "cle-1" });
  });
});

describe("nouvelleCleIdempotence", () => {
  const FORMAT_UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it("renvoie un UUID v4 avec crypto.randomUUID", () => {
    expect(nouvelleCleIdempotence()).toMatch(FORMAT_UUID_V4);
  });

  it("renvoie un UUID v4 sans crypto.randomUUID", () => {
    vi.stubGlobal("crypto", { getRandomValues: crypto.getRandomValues.bind(crypto) });
    try {
      expect(nouvelleCleIdempotence()).toMatch(FORMAT_UUID_V4);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("updateRendezVousStatus", () => {
  it("envoie { status } en POST sur le chemin du rendez-vous", () => {
    updateRendezVousStatus("rdv42", "CONFIRME");
    const [endpoint, options] = mockedAuthFetch.mock.calls[0];
    expect(endpoint).toBe("/carnet-sante/rendez-vous/rdv42/status");
    expect(options?.method).toBe("POST");
    expect(JSON.parse(options?.body as string)).toEqual({ status: "CONFIRME" });
  });
});
