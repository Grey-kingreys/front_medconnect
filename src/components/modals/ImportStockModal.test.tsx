import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ToastProvider from "@/components/Toast";
import ImportStockModal, { ImportCatalogueModal } from "./ImportStockModal";
import {
  apercuImportCatalogue,
  importerCatalogue,
  type RapportImportCatalogue,
} from "@/lib/api_pharmacie";

vi.mock("@/lib/api_pharmacie", async (original) => ({
  ...(await original<typeof import("@/lib/api_pharmacie")>()),
  apercuImportCatalogue: vi.fn(),
  importerCatalogue: vi.fn(),
  telechargerModeleImportCatalogue: vi.fn(),
}));

const mockedApercu = vi.mocked(apercuImportCatalogue);
const mockedImporter = vi.mocked(importerCatalogue);

const RAPPORT: RapportImportCatalogue = {
  totalLignes: 2,
  acceptees: 1,
  rejetees: 1,
  lignes: [
    {
      ligne: 2,
      nom: "Ibuprofène 400 mg",
      statut: "acceptee",
      categorie: "Anti-inflammatoire",
      nomGenerique: "Ibuprofène",
      ordonnanceRequise: false,
      formes: ["comprimé", "sirop"],
    },
    {
      ligne: 3,
      nom: "Paracétamol 500 mg",
      statut: "rejetee",
      raison: "Déjà au catalogue : cette ligne est ignorée, le médicament existant n'est pas modifié.",
    },
  ],
};

const fichierXlsx = () => new File(["x"], "catalogue.xlsx");

function choisirFichier() {
  const champ = screen.getByLabelText(/Votre fichier Excel/);
  fireEvent.change(champ, { target: { files: [fichierXlsx()] } });
}

beforeEach(() => {
  mockedApercu.mockReset();
  mockedImporter.mockReset();
});

afterEach(cleanup);

describe("ImportStockModal en mode catalogue", () => {
  it("présente les consignes du catalogue à l'étape 1", () => {
    render(<ImportCatalogueModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Importer le catalogue depuis Excel" })).toBeInTheDocument();
    expect(screen.getByText(/avec au moins son nom et sa catégorie/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Télécharger le modèle Excel/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Vérifier le fichier/ })).toBeDisabled();
  });

  it("affiche l'aperçu avec les lignes acceptées, les lignes écartées et leur raison", async () => {
    mockedApercu.mockResolvedValue({ data: RAPPORT, message: "", success: true });
    render(<ImportCatalogueModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);

    choisirFichier();
    fireEvent.click(screen.getByRole("button", { name: /Vérifier le fichier/ }));

    expect(await screen.findByText("1 médicament prêt à être ajouté au catalogue, 1 ligne écartée")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Catégorie" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Formes" })).toBeInTheDocument();
    expect(screen.getByText("Anti-inflammatoire")).toBeInTheDocument();
    expect(screen.getByText("comprimé, sirop")).toBeInTheDocument();
    expect(screen.getByText(/Déjà au catalogue/)).toBeInTheDocument();
    expect(screen.queryByText("Quantité")).not.toBeInTheDocument();
    expect(mockedImporter).not.toHaveBeenCalled();
  });

  it("demande confirmation, importe, notifie le succès puis rafraîchit la liste à la fermeture", async () => {
    mockedApercu.mockResolvedValue({ data: RAPPORT, message: "", success: true });
    mockedImporter.mockResolvedValue({
      data: { ...RAPPORT, importees: 1 },
      message: "1 médicament ajouté au catalogue, 1 ligne écartée.",
      success: true,
    });
    const onSuccess = vi.fn();
    render(
      <ToastProvider>
        <ImportCatalogueModal isOpen onClose={vi.fn()} onSuccess={onSuccess} />
      </ToastProvider>,
    );

    choisirFichier();
    fireEvent.click(screen.getByRole("button", { name: /Vérifier le fichier/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Ajouter 1 médicament au catalogue" }));
    expect(screen.getByText(/1 médicament sera ajouté au catalogue/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmer l'ajout" }));

    expect(await screen.findByText("1 médicament ajouté au catalogue")).toBeInTheDocument();
    expect(mockedImporter).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("1 médicament ajouté au catalogue, 1 ligne écartée.")).toBeInTheDocument();

    // Bouton « Fermer » de l'étape 3 (le dernier ; le premier est la croix de l'en-tête)
    const boutonsFermer = screen.getAllByRole("button", { name: "Fermer" });
    fireEvent.click(boutonsFermer[boutonsFermer.length - 1]);
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  it("refuse un fichier qui n'est pas un classeur .xlsx en citant la feuille du catalogue pour la taille", () => {
    render(<ImportCatalogueModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);
    const champ = screen.getByLabelText(/Votre fichier Excel/);

    fireEvent.change(champ, { target: { files: [new File(["x"], "catalogue.csv")] } });
    expect(screen.getByRole("alert")).toHaveTextContent("Le fichier doit être un classeur Excel (.xlsx).");

    const gros = new File(["x"], "catalogue.xlsx");
    Object.defineProperty(gros, "size", { value: 3 * 1024 * 1024 });
    fireEvent.change(champ, { target: { files: [gros] } });
    expect(screen.getByRole("alert")).toHaveTextContent("feuille « Catalogue »");
  });
});

describe("ImportStockModal en mode stock", () => {
  it("garde le titre et les consignes du stock", () => {
    render(<ImportStockModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} structureId="s1" />);

    expect(screen.getByRole("heading", { name: "Importer depuis Excel" })).toBeInTheDocument();
    expect(screen.getByText("La quantité indiquée remplace celle actuellement en stock.")).toBeInTheDocument();
  });
});
