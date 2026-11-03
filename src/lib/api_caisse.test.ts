import { beforeEach, describe, expect, it, vi } from "vitest";
import { authDownload, authFetch } from "./api_auth";
import {
  assurerPosteWeb,
  cloturerJournee,
  enregistrerMouvement,
  exporterCloture,
  fermerSession,
  getBilan,
  getPreparationCloture,
  getReferentiels,
  getSessionCourante,
  listerClotures,
  listerRemonteesApresCloture,
  ouvrirSession,
  saisirComptage,
} from "./api_caisse";

vi.mock("./api_auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api_auth")>()),
  authFetch: vi.fn(),
  authDownload: vi.fn(),
}));

const mockedAuthFetch = vi.mocked(authFetch);
const mockedAuthDownload = vi.mocked(authDownload);

beforeEach(() => {
  mockedAuthFetch.mockReset();
  mockedAuthFetch.mockResolvedValue({ data: {}, message: "ok", success: true });
});

describe("api_caisse", () => {
  it("lit les référentiels à la route encodée", async () => {
    await getReferentiels("s 1");
    expect(mockedAuthFetch).toHaveBeenCalledWith("/pharmacie/s%201/referentiels");
  });

  it("assure le poste web par défaut de l'utilisateur", async () => {
    await assurerPosteWeb("s1", "u1");
    expect(mockedAuthFetch).toHaveBeenCalledWith("/pharmacie/s1/postes", {
      method: "POST",
      body: '{"type":"WEB","appareilId":"web-defaut:u1"}',
    });
  });

  it("lit la session courante du poste", async () => {
    await getSessionCourante("s1", "p1");
    expect(mockedAuthFetch).toHaveBeenCalledWith("/pharmacie/s1/caisse/sessions/courante?posteId=p1");
  });

  it("ouvre la caisse puis enregistre un comptage", async () => {
    await ouvrirSession("s1", { id: "i1", posteId: "p1" });
    expect(mockedAuthFetch).toHaveBeenCalledWith("/pharmacie/s1/caisse/sessions", {
      method: "POST",
      body: '{"id":"i1","posteId":"p1"}',
    });
    await saisirComptage("s1", "c 1", { id: "i2", moment: "OUVERTURE", coupures: [{ valeurFaciale: 500, nombre: 2 }] });
    expect(mockedAuthFetch).toHaveBeenLastCalledWith("/pharmacie/s1/caisse/sessions/c%201/comptages", {
      method: "POST",
      body: '{"id":"i2","moment":"OUVERTURE","coupures":[{"valeurFaciale":500,"nombre":2}]}',
    });
  });

  it("enregistre un mouvement, lit le bilan et ferme la caisse aux routes encodées", async () => {
    await enregistrerMouvement("s1", "c 1", { id: "m1", type: "APPORT", montant: 5000, motif: "Monnaie" });
    expect(mockedAuthFetch).toHaveBeenLastCalledWith("/pharmacie/s1/caisse/sessions/c%201/mouvements", {
      method: "POST",
      body: '{"id":"m1","type":"APPORT","montant":5000,"motif":"Monnaie"}',
    });
    await getBilan("s1", "c 1");
    expect(mockedAuthFetch).toHaveBeenLastCalledWith("/pharmacie/s1/caisse/sessions/c%201/bilan");
    await fermerSession("s1", "c 1", { comptageFermeture: { id: "f1", coupures: [] } });
    expect(mockedAuthFetch).toHaveBeenLastCalledWith("/pharmacie/s1/caisse/sessions/c%201/fermer", {
      method: "POST",
      body: '{"comptageFermeture":{"id":"f1","coupures":[]}}',
    });
  });

  it("lit la préparation, clôture et liste les clôtures du mois aux routes encodées", async () => {
    await getPreparationCloture("s 1", "2026-10-30");
    expect(mockedAuthFetch).toHaveBeenLastCalledWith("/pharmacie/s%201/caisse/clotures/2026-10-30/preparation");
    await cloturerJournee("s1", { jour: "2026-10-30", forcer: true, motifForcage: "Panne" });
    expect(mockedAuthFetch).toHaveBeenLastCalledWith("/pharmacie/s1/caisse/clotures", {
      method: "POST",
      body: '{"jour":"2026-10-30","forcer":true,"motifForcage":"Panne"}',
    });
    await listerClotures("s1", "2026-10");
    expect(mockedAuthFetch).toHaveBeenLastCalledWith("/pharmacie/s1/caisse/clotures?mois=2026-10");
  });

  it("lit les sommes arrivées après une clôture dans data.anomalies", async () => {
    mockedAuthFetch.mockResolvedValue({ data: { anomalies: [{ id: "a1" }], total: 21 }, message: "ok", success: true });
    const liste = await listerRemonteesApresCloture("s1");
    expect(mockedAuthFetch).toHaveBeenCalledWith("/pharmacie/s1/anomalies?type=REMONTEE_APRES_CLOTURE&statut=OUVERTE");
    expect(liste).toEqual({ anomalies: [{ id: "a1" }], total: 21 });
  });

  it("exporte par authDownload, rend le même Blob et un nom de repli sans en-tête", async () => {
    const blob = new Blob(["﻿a;b"], { type: "text/csv" });
    mockedAuthDownload.mockResolvedValueOnce({ blob, filename: "cloture-2026-10-30.csv" });
    const recu = await exporterCloture("s1", "2026-10-30");
    expect(mockedAuthDownload).toHaveBeenLastCalledWith("/pharmacie/s1/caisse/clotures/2026-10-30/export");
    expect(recu.blob).toBe(blob);
    expect(recu.filename).toBe("cloture-2026-10-30.csv");
    mockedAuthDownload.mockResolvedValueOnce({ blob, filename: null });
    expect((await exporterCloture("s1", "2026-10-29")).filename).toBe("cloture-2026-10-29.csv");
  });
});
