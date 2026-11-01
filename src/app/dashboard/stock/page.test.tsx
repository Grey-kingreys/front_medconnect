import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api_auth";
import { getMyStock, updateStockQuantite, type StockMedicament } from "@/lib/api_pharmacie";
import StockPage from "./page";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "p1", role: "PHARMACIEN", structureId: "s1", email: "p@exemple.com", nom: "Bah", prenom: "Ali" },
  }),
}));
vi.mock("@/lib/api_pharmacie", () => ({
  getMyStock: vi.fn(),
  removeStockItem: vi.fn(),
  updateStockQuantite: vi.fn(),
}));
vi.mock("@/components/modals/ImportStockModal", () => ({
  default: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>Fenêtre d&apos;import ouverte</div> : null),
}));
vi.mock("@/components/modals/StockModal", () => ({ default: () => null }));
vi.mock("@/components/modals/DeleteConfirmModal", () => ({ DeleteConfirmModal: () => null }));

const fiche = (id: string, nom: string, quantite: number, extra: Partial<StockMedicament> = {}): StockMedicament => ({
  id,
  medicamentId: `m-${id}`,
  structureId: "s1",
  quantite,
  disponible: quantite > 0,
  prixUnitaire: 1000,
  qualifie: true,
  medicament: { id: `m-${id}`, nom, categorie: "Antalgique", ordonnanceRequise: false, formes: [] },
  ...extra,
});

const doliprane = (quantite: number, extra: Partial<StockMedicament> = {}) =>
  fiche("d1", "Doliprane", quantite, { coefficientBoite: 20, uniteMinimale: "COMPRIME", prixUnitaire: 3500, ...extra });

const reponse = (
  stocks: StockMedicament[],
  alertes: { stockBas?: { id: string; nom: string; quantite: number }[]; rupture?: { id: string; nom: string }[] } = {},
) =>
  ({
    data: { stocks, alertes: { stockBas: alertes.stockBas ?? [], rupture: alertes.rupture ?? [] } },
    message: "ok",
    success: true,
  }) as never;

describe("Page du stock", () => {
  beforeEach(() => {
    vi.mocked(getMyStock).mockResolvedValue(reponse([]));
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.history.replaceState(null, "", "/");
  });

  it("ouvre la fenêtre d'import quand l'adresse le demande, puis nettoie l'adresse", async () => {
    window.history.replaceState(null, "", "/dashboard/stock?importer=1");
    render(<StockPage />);
    expect(await screen.findByText("Fenêtre d'import ouverte")).toBeTruthy();
    expect(window.location.search).toBe("");
  });

  it("n'ouvre pas la fenêtre d'import sans cette demande", async () => {
    window.history.replaceState(null, "", "/dashboard/stock");
    render(<StockPage />);
    await waitFor(() => expect(getMyStock).toHaveBeenCalled());
    expect(await screen.findByText("Importer depuis Excel")).toBeTruthy();
    expect(screen.queryByText("Fenêtre d'import ouverte")).toBeNull();
  });

  it("affiche la quantité en boîtes et unités", async () => {
    vi.mocked(getMyStock).mockResolvedValue(reponse([doliprane(26)]));
    render(<StockPage />);
    expect(await screen.findByText("1 boîte et 6 comprimés")).toBeTruthy();
  });

  it("lit les statuts des alertes du serveur", async () => {
    vi.mocked(getMyStock).mockResolvedValue(
      reponse([fiche("a", "Amlor", 500), fiche("v", "Ventoline", -1), fiche("o", "Oméprazole", 500)], {
        stockBas: [{ id: "a", nom: "Amlor", quantite: 500 }],
        rupture: [{ id: "v", nom: "Ventoline" }],
      }),
    );
    render(<StockPage />);
    await screen.findByText("Amlor");
    const ligne = (nom: string) => screen.getByText(nom).closest("tr") as HTMLElement;
    expect(ligne("Amlor").textContent).toContain("Stock bas");
    expect(ligne("Ventoline").textContent).toContain("Rupture");
    expect(ligne("Oméprazole").textContent).toContain("OK");
  });

  it("filtre les médicaments à qualifier", async () => {
    vi.mocked(getMyStock).mockResolvedValue(
      reponse([fiche("s", "Spasfon", 60, { qualifie: false }), fiche("p", "Paracétamol", 10)]),
    );
    render(<StockPage />);
    await screen.findByText("Paracétamol");
    fireEvent.click(screen.getByRole("button", { name: "À qualifier (1)" }));
    expect(screen.getByText("Spasfon")).toBeTruthy();
    expect(screen.queryByText("Paracétamol")).toBeNull();
    expect(screen.getByText(/Confirmez le nombre d'unités par boîte/)).toBeTruthy();
  });

  it("calcule la valeur du stock au prix de la boîte divisé par le nombre d'unités", async () => {
    vi.mocked(getMyStock).mockResolvedValue(reponse([doliprane(40)]));
    render(<StockPage />);
    expect(await screen.findByText(/^7\s000\sGNF$/)).toBeTruthy();
  });

  it("enregistre une correction avec motif puis recharge le stock", async () => {
    vi.mocked(getMyStock).mockResolvedValue(reponse([doliprane(40)]));
    vi.mocked(updateStockQuantite).mockResolvedValue({ data: {}, message: "Quantité corrigée.", success: true } as never);
    render(<StockPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Corriger la quantité de Doliprane" }));

    expect(screen.getByRole("radio", { name: "Retirer du stock" })).toBeChecked();
    fireEvent.change(screen.getByLabelText("Quantité"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Motif de la correction"), { target: { value: "Boîte abîmée retrouvée" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la correction" }));

    await waitFor(() =>
      expect(updateStockQuantite).toHaveBeenCalledWith("s1", "d1", { variation: -20, motif: "Boîte abîmée retrouvée" }),
    );
    await waitFor(() => expect(getMyStock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Quantité corrigée.")).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("exige le lot concerné quand la fiche compte plusieurs lots", async () => {
    const lots = [
      { id: "l1", numeroLot: "A1", dateExpiration: "2027-06-01T00:00:00.000Z", quantite: 20, lotTechnique: false },
      { id: "l2", numeroLot: "B2", dateExpiration: "2027-09-01T00:00:00.000Z", quantite: 20, lotTechnique: false },
    ];
    vi.mocked(getMyStock).mockResolvedValue(reponse([doliprane(40, { lots })]));
    vi.mocked(updateStockQuantite).mockResolvedValue({ data: {}, message: "Quantité corrigée.", success: true } as never);
    render(<StockPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Corriger la quantité de Doliprane" }));

    fireEvent.change(screen.getByLabelText("Quantité"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Motif de la correction"), { target: { value: "Erreur de comptage" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la correction" }));

    expect(
      await screen.findByText("Indiquez une quantité, le lot concerné et un motif de 3 caractères au moins."),
    ).toBeTruthy();
    expect(updateStockQuantite).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("radio", { name: /Lot B2/ }));
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la correction" }));

    await waitFor(() =>
      expect(updateStockQuantite).toHaveBeenCalledWith("s1", "d1", {
        variation: -20,
        lotId: "l2",
        motif: "Erreur de comptage",
      }),
    );
  });

  it("propose de réessayer quand le chargement échoue", async () => {
    vi.mocked(getMyStock)
      .mockRejectedValueOnce(new ApiError("", 0))
      .mockResolvedValueOnce(reponse([doliprane(40)]));
    render(<StockPage />);

    expect(
      await screen.findByText("Le stock n'a pas pu être chargé. Vérifiez votre connexion puis réessayez."),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));

    expect(await screen.findByText("Doliprane")).toBeTruthy();
    expect(getMyStock).toHaveBeenCalledTimes(2);
  });
});
