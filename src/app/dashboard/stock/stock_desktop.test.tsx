import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PontDesktop } from "@/lib/caisse/contrat_desktop";
import type { StockMedicament } from "@/lib/api_pharmacie";
import { CorrectionQuantite } from "./CorrectionQuantite";
import { SortieStock } from "./SortieStock";
import StockPage from "./page";

vi.mock("@/hooks/useAuth", () => {
  const user = { id: "p1", role: "PHARMACIEN", structureId: "s1", email: "p@exemple.com", nom: "Bah", prenom: "Ali" };
  return {
    useAuth: () => ({
      user,
      profile: { ...user, isActive: true, structureType: "PHARMACIE", permissions: ["stock:read", "stock:write", "reception:write"] },
    }),
  };
});
vi.mock("@/components/modals/ImportStockModal", () => ({
  default: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>Fenêtre d&apos;import ouverte</div> : null),
}));
vi.mock("@/components/modals/StockModal", () => ({ default: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>Fiche ouverte</div> : null) }));
vi.mock("@/components/modals/DeleteConfirmModal", () => ({ DeleteConfirmModal: () => null }));

const fiche: StockMedicament = {
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
  lots: [{ id: "l1", numeroLot: "A1", dateExpiration: "2028-06-30", quantite: 40, lotTechnique: false, coefficientReception: 20 }],
  reliquat: [{ lotId: "l1", unitesRestantes: 0 }],
};

const ok = <T,>(data: T, message = "ok") => Promise.resolve({ ok: true as const, data, message });

function installerPont(horsLigne: boolean) {
  const sortir = vi.fn().mockImplementation(() => ok({ soldeLot: 20, quantiteARegulariser: 0 }, "Sortie de stock enregistrée sur ce poste."));
  const corriger = vi.fn().mockImplementation(() => ok(fiche, "Stock réduit sur ce poste (nouvelle quantité : 20)"));
  const chargerStock = vi.fn().mockImplementation(() => ok([fiche]));
  const chargerReferentiels = vi.fn().mockImplementation(() => ok({ parametres: { seuilStockBas: 5 } }));
  const etat = { horsLigne, enLigne: !horsLigne };
  window.medconnecteDesktop = {
    version: "0.1.0",
    etat: () => Promise.resolve(etat),
    surEtat: () => () => undefined,
    caisse: { chargerStock, chargerReferentiels },
    stock: { sortir, corriger },
  } as unknown as PontDesktop;
  return { sortir, corriger, chargerStock };
}

beforeEach(() => {
  window.history.replaceState(null, "", "/dashboard/stock");
});
afterEach(() => {
  cleanup();
  delete window.medconnecteDesktop;
  vi.clearAllMocks();
});

describe("Stock sur le poste desktop", () => {
  it("la sortie lit les lots du poste et passe par le pont avec un identifiant", async () => {
    const { sortir } = installerPont(true);
    const onSucces = vi.fn();
    render(<SortieStock isOpen stock={fiche} structureId="s1" onClose={vi.fn()} onSucces={onSucces} />);
    fireEvent.click(await screen.findByRole("radio", { name: "Cassé ou abîmé" }));
    fireEvent.change(screen.getByLabelText("Quantité"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la sortie" }));

    await waitFor(() =>
      expect(sortir).toHaveBeenCalledWith("s1", {
        id: expect.any(String),
        stockId: "d1",
        lotId: "l1",
        unite: "BOITE",
        quantite: 1,
        raison: "CASSE",
      }),
    );
    await waitFor(() => expect(onSucces).toHaveBeenCalled());
  });

  it("la correction passe par le pont avec un identifiant", async () => {
    const { corriger } = installerPont(true);
    const onSucces = vi.fn();
    render(<CorrectionQuantite isOpen stock={fiche} structureId="s1" onClose={vi.fn()} onSucces={onSucces} />);
    fireEvent.change(screen.getByLabelText("Quantité"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Motif de la correction"), { target: { value: "Boîte abîmée retrouvée" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la correction" }));

    await waitFor(() =>
      expect(corriger).toHaveBeenCalledWith("s1", "d1", { id: expect.any(String), variation: -20, motif: "Boîte abîmée retrouvée" }),
    );
    await waitFor(() => expect(onSucces).toHaveBeenCalledWith("Stock réduit sur ce poste (nouvelle quantité : 20)"));
  });

  it("hors ligne, la page se lit et les autres actions demandent une connexion", async () => {
    installerPont(true);
    render(<StockPage />);
    expect(await screen.findByText("Doliprane")).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("button", { name: "Sortir Doliprane du stock" })).toBeTruthy());

    for (const nom of ["Importer depuis Excel", "Ajouter un médicament", "Exporter le stock", "Modifier Doliprane"]) {
      fireEvent.click(screen.getByRole("button", { name: nom }));
      expect((await screen.findByRole("alert")).textContent).toBe("Cette action demande une connexion.");
    }
    expect(screen.queryByText("Fenêtre d'import ouverte")).toBeNull();
    expect(screen.queryByText("Fiche ouverte")).toBeNull();
  });

  it("en ligne sur le poste, l'import s'ouvre comme avant", async () => {
    installerPont(false);
    render(<StockPage />);
    await screen.findByText("Doliprane");
    fireEvent.click(screen.getByRole("button", { name: "Importer depuis Excel" }));
    expect(await screen.findByText("Fenêtre d'import ouverte")).toBeTruthy();
  });
});
