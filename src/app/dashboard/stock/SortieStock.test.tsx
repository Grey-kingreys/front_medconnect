import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api_auth";
import { listerLotsFiche, sortirDuStock, type LotEnStock, type StockMedicament } from "@/lib/api_pharmacie";
import { SortieStock } from "./SortieStock";

vi.mock("@/lib/api_pharmacie", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api_pharmacie")>()),
  listerLotsFiche: vi.fn(),
  sortirDuStock: vi.fn(),
}));

const stock: StockMedicament = {
  id: "d1",
  medicamentId: "m1",
  structureId: "s1",
  quantite: 100,
  disponible: true,
  prixUnitaire: 3500,
  coefficientBoite: 20,
  uniteMinimale: "COMPRIME",
  qualifie: true,
  medicament: { id: "m1", nom: "Doliprane", categorie: "Antalgique", ordonnanceRequise: false, formes: [] },
};

const lot = (id: string, numeroLot: string, extra: Partial<LotEnStock> = {}): LotEnStock => ({
  id,
  numeroLot,
  dateExpiration: "2028-06-30",
  dateReception: "2026-10-01T10:00:00.000Z",
  quantite: 60,
  reliquat: 0,
  coefficientReception: 20,
  lotTechnique: false,
  perime: false,
  ...extra,
});

const LOT_PERIME = lot("l1", "AG23C777", { dateExpiration: "2026-01-01", perime: true, quantite: 40 });
const LOT_VALIDE = lot("l2", "CT23H990");

const lots = (liste: LotEnStock[]) => vi.mocked(listerLotsFiche).mockResolvedValue({ data: liste, message: "ok", success: true } as never);

function ouvrir() {
  const onClose = vi.fn();
  const onSucces = vi.fn();
  render(<SortieStock isOpen stock={stock} structureId="s1" onClose={onClose} onSucces={onSucces} />);
  return { onClose, onSucces };
}

const enregistrer = () => fireEvent.click(screen.getByRole("button", { name: "Enregistrer la sortie" }));

describe("SortieStock", () => {
  beforeEach(() => {
    lots([LOT_VALIDE]);
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("présélectionne « Périmé » quand le lot choisi est périmé", async () => {
    lots([LOT_PERIME, LOT_VALIDE]);
    ouvrir();
    const perime = await screen.findByRole("radio", { name: /Lot AG23C777/ });
    expect(screen.getByRole("radio", { name: "Périmé" })).not.toBeChecked();

    fireEvent.click(perime);
    expect(screen.getByRole("radio", { name: "Périmé" })).toBeChecked();
  });

  it("refuse « Autre raison » sans précision, sans rien envoyer", async () => {
    ouvrir();
    fireEvent.click(await screen.findByRole("radio", { name: "Autre raison" }));
    fireEvent.change(screen.getByLabelText("Quantité"), { target: { value: "1" } });
    enregistrer();

    expect(
      await screen.findByText("Choisissez le lot, la raison et la quantité (et précisez pour « Autre raison »)."),
    ).toBeTruthy();
    expect(sortirDuStock).not.toHaveBeenCalled();
  });

  it("envoie la sortie en boîtes avec l'identifiant du dialogue", async () => {
    vi.mocked(sortirDuStock).mockResolvedValue({
      data: { soldeLot: 20 },
      message: "Sortie de stock enregistrée.",
      success: true,
    } as never);
    const { onClose, onSucces } = ouvrir();
    fireEvent.click(await screen.findByRole("radio", { name: "Cassé ou abîmé" }));
    fireEvent.change(screen.getByLabelText("Quantité"), { target: { value: "2" } });
    enregistrer();

    await waitFor(() =>
      expect(sortirDuStock).toHaveBeenCalledWith("s1", {
        id: expect.any(String),
        stockId: "d1",
        lotId: "l2",
        unite: "BOITE",
        quantite: 2,
        raison: "CASSE",
      }),
    );
    await waitFor(() => expect(onSucces).toHaveBeenCalledWith("Sortie de stock enregistrée. Reste dans ce lot : 1 boîte."));
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it("compte les boîtes d'un lot avec le coefficient du lot, pas celui de la fiche (D709)", async () => {
    // Fiche à 20 comprimés par boîte, lot reçu à 10 par boîte : 40 comprimés font 4 boîtes de ce lot.
    lots([lot("l3", "LOT10", { quantite: 40, coefficientReception: 10 })]);
    vi.mocked(sortirDuStock).mockRejectedValueOnce(new ApiError("Vous semblez hors connexion.", 0));
    vi.mocked(sortirDuStock).mockResolvedValueOnce({ data: { soldeLot: 20 }, message: "ok", success: true } as never);
    const { onSucces } = ouvrir();

    expect(await screen.findByRole("radio", { name: /Lot LOT10, .*, 4 boîtes$/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Cassé ou abîmé" }));
    fireEvent.change(screen.getByLabelText("Quantité"), { target: { value: "2" } });
    enregistrer();

    // « 2 boîtes » du lot : le serveur les multiplie par le coefficient du lot, soit 20 comprimés.
    await waitFor(() =>
      expect(sortirDuStock).toHaveBeenCalledWith("s1", {
        id: expect.any(String),
        stockId: "d1",
        lotId: "l3",
        unite: "BOITE",
        quantite: 2,
        raison: "CASSE",
      }),
    );
    // Résumé en lecture seule après l'échec réseau : même lecture du lot.
    expect(await screen.findByText(/Lot LOT10, 4 boîtes/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Réessayer l'envoi" }));
    await waitFor(() => expect(onSucces).toHaveBeenCalledWith("ok Reste dans ce lot : 2 boîtes."));
  });

  it("« Tout le lot » sort les unités du lot", async () => {
    vi.mocked(sortirDuStock).mockResolvedValue({ data: { soldeLot: 0 }, message: "ok", success: true } as never);
    ouvrir();
    fireEvent.click(await screen.findByRole("radio", { name: "Perdu ou volé" }));
    fireEvent.click(screen.getByRole("button", { name: "Tout le lot" }));
    expect(screen.getByLabelText("Quantité")).toHaveValue("60");
    enregistrer();

    await waitFor(() =>
      expect(sortirDuStock).toHaveBeenCalledWith("s1", {
        id: expect.any(String),
        stockId: "d1",
        lotId: "l2",
        unite: "UNITE",
        quantite: 60,
        raison: "PERDU",
      }),
    );
  });

  it("affiche le message du serveur pour un lot insuffisant et garde le même identifiant", async () => {
    vi.mocked(sortirDuStock).mockRejectedValue(
      new ApiError("Ce lot n'a que 60 unité(s) en stock : la sortie ne peut pas dépasser ce stock.", 409, {
        code: "STOCK_LOT_NEGATIF",
      }),
    );
    const { onClose } = ouvrir();
    fireEvent.click(await screen.findByRole("radio", { name: "Cassé ou abîmé" }));
    fireEvent.change(screen.getByLabelText("Quantité"), { target: { value: "9" } });
    enregistrer();

    expect(
      await screen.findByText("Ce lot n'a que 60 unité(s) en stock : la sortie ne peut pas dépasser ce stock."),
    ).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Quantité")).not.toHaveAttribute("readonly");

    fireEvent.change(screen.getByLabelText("Quantité"), { target: { value: "1" } });
    enregistrer();
    await waitFor(() => expect(sortirDuStock).toHaveBeenCalledTimes(2));
    const [, premier] = vi.mocked(sortirDuStock).mock.calls[0];
    const [, second] = vi.mocked(sortirDuStock).mock.calls[1];
    expect(second.id).toBe(premier.id);
  });

  it("verrouille la saisie après un échec réseau et rejoue la sortie avec le même identifiant", async () => {
    vi.mocked(sortirDuStock).mockRejectedValueOnce(new ApiError("Vous semblez hors connexion.", 0));
    vi.mocked(sortirDuStock).mockResolvedValueOnce({ data: { soldeLot: 40 }, message: "ok", success: true } as never);
    const { onSucces } = ouvrir();
    fireEvent.click(await screen.findByRole("radio", { name: "Cassé ou abîmé" }));
    fireEvent.change(screen.getByLabelText("Quantité"), { target: { value: "1" } });
    enregistrer();

    expect(
      await screen.findByText(
        "La sortie n'a peut-être pas été enregistrée. Appuyez sur « Réessayer l'envoi » : elle ne sera pas comptée deux fois.",
      ),
    ).toBeTruthy();
    expect(screen.getByLabelText("Quantité")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Précisez")).toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: "Enregistrer la sortie" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Réessayer l'envoi" }));
    await waitFor(() => expect(onSucces).toHaveBeenCalled());
    const [, premier] = vi.mocked(sortirDuStock).mock.calls[0];
    const [, second] = vi.mocked(sortirDuStock).mock.calls[1];
    expect(second.id).toBe(premier.id);
    expect(second).toEqual(premier);
  });
});
