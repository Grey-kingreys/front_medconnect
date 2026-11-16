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
  const exporter = vi.fn().mockImplementation(() => ok({ enregistre: true, nomFichier: "stock-pharmacie-2026-11-14.xlsx" }, "Stock exporté."));
  const listerImportsDifferes = vi.fn().mockImplementation(() =>
    ok([
      { id: "i1", mode: "livraison", nomFichier: "livraison.xlsx", statut: "TRAITE", message: null, resultat: { mode: "livraison", nomFichier: "livraison.xlsx", totalLignes: 3, importees: 2, rejetees: 1, receptionId: null, inventaireId: null, lignesRejetees: [{ ligne: 4, nom: "Inconnu", raison: "Médicament absent du catalogue." }] } },
      { id: "i2", mode: "inventaire", nomFichier: "comptage.xlsx", statut: "EN_ATTENTE", message: null, resultat: null },
    ]),
  );
  const chargerStock = vi.fn().mockImplementation(() => ok([fiche]));
  const chargerReferentiels = vi.fn().mockImplementation(() => ok({ parametres: { seuilStockBas: 5 } }));
  const etat = { horsLigne, enLigne: !horsLigne };
  window.medconnecteDesktop = {
    version: "0.1.0",
    etat: () => Promise.resolve(etat),
    surEtat: () => () => undefined,
    caisse: { chargerStock, chargerReferentiels },
    stock: { sortir, corriger, exporter, listerImportsDifferes },
  } as unknown as PontDesktop;
  return { sortir, corriger, chargerStock, exporter };
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

  it("hors ligne, la page se lit, l'import Excel s'ouvre (fichier mis de côté) et la fiche s'ouvre pour les champs sûrs", async () => {
    installerPont(true);
    render(<StockPage />);
    expect(await screen.findByText("Doliprane")).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("button", { name: "Sortir Doliprane du stock" })).toBeTruthy());

    expect(screen.queryByText("Fiche ouverte")).toBeNull();
    // Hors ligne, l'import ne demande plus la connexion : la fenêtre s'ouvre
    fireEvent.click(screen.getByRole("button", { name: "Importer depuis Excel" }));
    expect(await screen.findByText("Fenêtre d'import ouverte")).toBeTruthy();
    expect(screen.queryByText("Cette action demande une connexion.")).toBeNull();
    // Ajouter et modifier une fiche se font sur le poste : la fenêtre s'ouvre.
    fireEvent.click(screen.getByRole("button", { name: "Modifier Doliprane" }));
    expect(await screen.findByText("Fiche ouverte")).toBeTruthy();
  });

  it("hors ligne, les fichiers mis de côté et leur résultat sont listés sur la page du stock", async () => {
    installerPont(true);
    render(<StockPage />);
    expect(await screen.findByText("Fichiers Excel mis de côté")).toBeTruthy();
    expect(screen.getByText("2 lignes importées sur 3, 1 ligne refusée")).toBeTruthy();
    expect(screen.getByText("En attente du retour du réseau")).toBeTruthy();
    expect(screen.getByText("Ligne 4 (Inconnu) : Médicament absent du catalogue.")).toBeTruthy();
  });

  it("hors ligne, l'export se fait sur le poste, sans connexion, et dit que les prix d'achat n'y sont pas", async () => {
    const { exporter } = installerPont(true);
    render(<StockPage />);
    await screen.findByText("Doliprane");
    fireEvent.click(screen.getByRole("button", { name: "Exporter le stock" }));
    await waitFor(() => expect(exporter).toHaveBeenCalledWith("s1", {}));
    expect((await screen.findByRole("status")).textContent).toContain("Les prix d'achat ne sont pas dans le fichier");
    expect(screen.queryByText("Cette action demande une connexion.")).toBeNull();
  });

  it("hors ligne, un export annulé dans la boîte « Enregistrer sous » n'affiche aucun succès", async () => {
    const { exporter } = installerPont(true);
    exporter.mockImplementation(() => ok({ enregistre: false, nomFichier: "x.xlsx" }, "Export annulé."));
    render(<StockPage />);
    await screen.findByText("Doliprane");
    fireEvent.click(screen.getByRole("button", { name: "Exporter le stock" }));
    await waitFor(() => expect(exporter).toHaveBeenCalled());
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("en ligne sur le poste, l'import s'ouvre comme avant", async () => {
    installerPont(false);
    render(<StockPage />);
    await screen.findByText("Doliprane");
    fireEvent.click(screen.getByRole("button", { name: "Importer depuis Excel" }));
    expect(await screen.findByText("Fenêtre d'import ouverte")).toBeTruthy();
  });
});
