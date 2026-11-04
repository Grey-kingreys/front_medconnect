import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api_auth";
import { updateStockQuantite, type StockMedicament } from "@/lib/api_pharmacie";
import { CorrectionQuantite } from "./CorrectionQuantite";

vi.mock("@/lib/api_pharmacie", () => ({
  updateStockQuantite: vi.fn(),
}));

const stock: StockMedicament = {
  id: "d1",
  medicamentId: "m1",
  structureId: "s1",
  quantite: 40,
  disponible: true,
  prixUnitaire: 3500,
  coefficientBoite: 20,
  uniteMinimale: "COMPRIME",
  qualifie: true,
  medicament: { id: "m1", nom: "Doliprane", categorie: "Antalgique", ordonnanceRequise: false, formes: [] },
};

function ouvrir() {
  const onClose = vi.fn();
  const onSucces = vi.fn();
  render(<CorrectionQuantite isOpen stock={stock} structureId="s1" onClose={onClose} onSucces={onSucces} />);
  return { onClose, onSucces };
}

function remplir(motif: string) {
  fireEvent.change(screen.getByLabelText("Quantité"), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText("Motif de la correction"), { target: { value: motif } });
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer la correction" }));
}

describe("CorrectionQuantite", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("dit la part à régulariser et la phrase d'explication, sans signe moins", () => {
    render(
      <CorrectionQuantite
        isOpen
        stock={{ ...stock, quantite: 0, quantiteARegulariser: 21 }}
        structureId="s1"
        onClose={vi.fn()}
        onSucces={vi.fn()}
      />,
    );
    expect(screen.getByText("Stock actuel : 0 boîte")).toBeTruthy();
    expect(screen.getByText("1 boîte et 1 comprimé à régulariser")).toBeTruthy();
    expect(screen.getByText("Ces ventes se régularisent à la prochaine réception ou au prochain inventaire.")).toBeTruthy();
    expect(screen.getByRole("dialog").textContent).not.toMatch(/-\d/);
  });

  it("n'affiche aucune mention sans part à régulariser", () => {
    ouvrir();
    expect(screen.queryByText(/à régulariser/)).toBeNull();
  });

  it("affiche le message du serveur pour un lot négatif et garde le dialogue ouvert", async () => {
    vi.mocked(updateStockQuantite).mockRejectedValue(
      new ApiError("Ce lot ne contient pas assez de comprimés.", 409, { code: "STOCK_LOT_NEGATIF" }),
    );
    const { onClose, onSucces } = ouvrir();
    remplir("Erreur de comptage");

    expect(await screen.findByText("Ce lot ne contient pas assez de comprimés.")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect(onSucces).not.toHaveBeenCalled();
  });

  it("verrouille la saisie après un échec réseau, sans bouton Réessayer", async () => {
    vi.mocked(updateStockQuantite).mockRejectedValue(new ApiError("Vous semblez hors connexion.", 0));
    const { onClose } = ouvrir();
    remplir("Erreur de comptage");

    expect(
      await screen.findByText(
        "La correction n'a peut-être pas été enregistrée. Fermez cette fenêtre et vérifiez la quantité affichée avant de recommencer.",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Réessayer/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Enregistrer la correction" })).toBeNull();
    expect(screen.getByLabelText("Quantité")).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    expect(onClose).toHaveBeenCalledWith(true);
  });

  it("refuse localement un motif de 2 caractères", async () => {
    ouvrir();
    remplir("ab");

    expect(
      await screen.findByText("Indiquez une quantité, le lot concerné et un motif de 3 caractères au moins."),
    ).toBeTruthy();
    await waitFor(() => expect(updateStockQuantite).not.toHaveBeenCalled());
  });
});
