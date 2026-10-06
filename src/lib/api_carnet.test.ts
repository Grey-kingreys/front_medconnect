import { beforeEach, describe, expect, it, vi } from "vitest";
import { authFetch } from "./api_auth";
import {
  createAnalyse,
  createConsultation,
  createOrdonnance,
  createRendezVous,
  createVaccination,
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
    ["createOrdonnance", createOrdonnance, "/carnet-sante/ordonnances", { medicaments: "[]", patientId: "p1" }],
    ["createVaccination", createVaccination, "/carnet-sante/vaccinations", { vaccin: "BCG", dateVaccin: "2026-01-01" }],
    ["createAnalyse", createAnalyse, "/carnet-sante/analyses", { type: "NFS", patientId: "p1" }],
    ["createRendezVous", createRendezVous, "/carnet-sante/rendez-vous", { date: "2026-12-01", motif: "Suivi" }],
  ] as const;

  it.each(cas)("%s appelle authFetch avec le bon chemin et le corps JSON", (_nom, fn, chemin, data) => {
    fn(data);
    expect(mockedAuthFetch).toHaveBeenCalledTimes(1);
    const [endpoint, options] = mockedAuthFetch.mock.calls[0];
    expect(endpoint).toBe(chemin);
    expect(options?.method).toBe("POST");
    expect(JSON.parse(options?.body as string)).toEqual(data);
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
