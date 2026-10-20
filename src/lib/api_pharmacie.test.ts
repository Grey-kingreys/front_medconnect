import { beforeEach, describe, expect, it, vi } from "vitest";
import { authDownload, authFetch } from "./api_auth";
import { apercuImportCatalogue, importerCatalogue, telechargerModeleImportCatalogue } from "./api_pharmacie";

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
});
