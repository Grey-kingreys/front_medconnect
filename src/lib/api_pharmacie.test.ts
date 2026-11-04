import { beforeEach, describe, expect, it, vi } from "vitest";
import { authDownload, authFetch } from "./api_auth";
import {
  apercuImportCatalogue,
  apercuImportStock,
  importerCatalogue,
  corrigerDateLot,
  creerFournisseur,
  enregistrerReception,
  importerStock,
  listerLotsFiche,
  sortirDuStock,
  telechargerModeleImportCatalogue,
} from "./api_pharmacie";

vi.mock("./api_auth");

const mockedAuthFetch = vi.mocked(authFetch);
const mockedAuthDownload = vi.mocked(authDownload);

const fichier = () =>
  new File(["contenu"], "catalogue.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

beforeEach(() => {
  mockedAuthFetch.mockReset();
  mockedAuthDownload.mockReset();
});

describe("api_pharmacie, import Excel du catalogue", () => {
  it("telechargerModeleImportCatalogue télécharge le modèle et garde le nom donné par le serveur", async () => {
    const blob = new Blob(["x"]);
    mockedAuthDownload.mockResolvedValue({ blob, filename: "modele-import-catalogue.xlsx" });

    const resultat = await telechargerModeleImportCatalogue();

    expect(mockedAuthDownload).toHaveBeenCalledWith("/pharmacie/catalogue/import/modele");
    expect(resultat).toEqual({ blob, filename: "modele-import-catalogue.xlsx" });
  });

  it("telechargerModeleImportCatalogue donne un nom par défaut si le serveur n'en fournit pas", async () => {
    mockedAuthDownload.mockResolvedValue({ blob: new Blob(["x"]), filename: null });

    const { filename } = await telechargerModeleImportCatalogue();

    expect(filename).toBe("modele-import-catalogue.xlsx");
  });

  it("apercuImportCatalogue envoie le fichier en POST dans le champ « fichier »", () => {
    const f = fichier();
    apercuImportCatalogue(f);

    const [endpoint, options] = mockedAuthFetch.mock.calls[0];
    expect(endpoint).toBe("/pharmacie/catalogue/import/apercu");
    expect(options?.method).toBe("POST");
    expect(options?.body).toBeInstanceOf(FormData);
    expect((options?.body as FormData).get("fichier")).toBe(f);
  });

  it("importerCatalogue envoie le même fichier en POST sur la route d'import", () => {
    const f = fichier();
    importerCatalogue(f);

    const [endpoint, options] = mockedAuthFetch.mock.calls[0];
    expect(endpoint).toBe("/pharmacie/catalogue/import");
    expect(options?.method).toBe("POST");
    expect((options?.body as FormData).get("fichier")).toBe(f);
  });

  it("apercuImportCatalogue n'envoie pas de champ « mode »", () => {
    apercuImportCatalogue(fichier());

    const [, options] = mockedAuthFetch.mock.calls[0];
    expect((options?.body as FormData).get("mode")).toBeNull();
  });
});

describe("api_pharmacie, import Excel du stock", () => {
  it("apercuImportStock envoie le fichier et le mode choisi", () => {
    const f = fichier();
    apercuImportStock("s1", f, "livraison");

    const [endpoint, options] = mockedAuthFetch.mock.calls[0];
    expect(endpoint).toBe("/pharmacie/stock/s1/import/apercu");
    expect(options?.method).toBe("POST");
    expect(options?.body).toBeInstanceOf(FormData);
    expect((options?.body as FormData).get("fichier")).toBe(f);
    expect((options?.body as FormData).get("mode")).toBe("livraison");
  });

  it("apercuImportStock envoie le mode « inventaire » quand il est choisi", () => {
    apercuImportStock("s1", fichier(), "inventaire");

    const [, options] = mockedAuthFetch.mock.calls[0];
    expect((options?.body as FormData).get("mode")).toBe("inventaire");
  });

  it("importerStock envoie le fichier et le mode en POST sur la route d'import", () => {
    const f = fichier();
    importerStock("s1", f, "livraison");

    const [endpoint, options] = mockedAuthFetch.mock.calls[0];
    expect(endpoint).toBe("/pharmacie/stock/s1/import");
    expect(options?.method).toBe("POST");
    expect((options?.body as FormData).get("mode")).toBe("livraison");
    expect((options?.body as FormData).get("fichier")).toBe(f);
  });
});

describe("api_pharmacie, réceptions et fournisseurs", () => {
  it("enregistrerReception envoie le corps tel quel en POST", () => {
    const corps = {
      id: "11111111-1111-4111-8111-111111111111",
      reference: "BL-1",
      lignes: [{ stockId: "m1", nombreBoites: 10, dateExpiration: "2028-06-30" }],
    };
    enregistrerReception("s1", corps);

    const [endpoint, options] = mockedAuthFetch.mock.calls[0];
    expect(endpoint).toBe("/pharmacie/s1/receptions");
    expect(options?.method).toBe("POST");
    expect(JSON.parse(options?.body as string)).toEqual(corps);
  });

  it("corrigerDateLot envoie la date et le motif en PATCH sur le lot", () => {
    corrigerDateLot("s1", "l1", { dateExpiration: "2027-10-31", motif: "Date relue" });

    const [endpoint, options] = mockedAuthFetch.mock.calls[0];
    expect(endpoint).toBe("/pharmacie/s1/lots/l1");
    expect(options?.method).toBe("PATCH");
    expect(JSON.parse(options?.body as string)).toEqual({ dateExpiration: "2027-10-31", motif: "Date relue" });
  });

  it("listerLotsFiche et sortirDuStock visent les routes de la fiche et des sorties", () => {
    listerLotsFiche("s1", "d1");
    expect(mockedAuthFetch.mock.calls[0][0]).toBe("/pharmacie/s1/stock/d1/lots");

    const corps = { stockId: "d1", lotId: "l1", unite: "BOITE" as const, quantite: 1, raison: "CASSE" as const };
    sortirDuStock("s1", corps);
    const [endpoint, options] = mockedAuthFetch.mock.calls[1];
    expect(endpoint).toBe("/pharmacie/s1/stock/sorties");
    expect(options?.method).toBe("POST");
    expect(JSON.parse(options?.body as string)).toEqual(corps);
  });

  it("creerFournisseur envoie le nom et le téléphone", () => {
    creerFournisseur("s1", { nom: "UbiPharm", telephone: "622 00 00 00" });

    const [endpoint, options] = mockedAuthFetch.mock.calls[0];
    expect(endpoint).toBe("/pharmacie/s1/fournisseurs");
    expect(options?.method).toBe("POST");
    expect(JSON.parse(options?.body as string)).toEqual({ nom: "UbiPharm", telephone: "622 00 00 00" });
  });
});
