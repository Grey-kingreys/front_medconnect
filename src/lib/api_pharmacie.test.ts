import { beforeEach, describe, expect, it, vi } from "vitest";
import { authDownload, authFetch } from "./api_auth";
import {
  apercuImportCatalogue,
  apercuImportStock,
  importerCatalogue,
  importerStock,
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
    apercuImportStock("s1", f, "ajouter");

    const [endpoint, options] = mockedAuthFetch.mock.calls[0];
    expect(endpoint).toBe("/pharmacie/stock/s1/import/apercu");
    expect(options?.method).toBe("POST");
    expect(options?.body).toBeInstanceOf(FormData);
    expect((options?.body as FormData).get("fichier")).toBe(f);
    expect((options?.body as FormData).get("mode")).toBe("ajouter");
  });

  it("apercuImportStock prend le mode « remplacer » par défaut", () => {
    apercuImportStock("s1", fichier());

    const [, options] = mockedAuthFetch.mock.calls[0];
    expect((options?.body as FormData).get("mode")).toBe("remplacer");
  });

  it("importerStock envoie le fichier et le mode en POST sur la route d'import", () => {
    const f = fichier();
    importerStock("s1", f, "ajouter");

    const [endpoint, options] = mockedAuthFetch.mock.calls[0];
    expect(endpoint).toBe("/pharmacie/stock/s1/import");
    expect(options?.method).toBe("POST");
    expect((options?.body as FormData).get("mode")).toBe("ajouter");
    expect((options?.body as FormData).get("fichier")).toBe(f);
  });
});
