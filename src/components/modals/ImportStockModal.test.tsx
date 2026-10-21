import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ToastProvider from "@/components/Toast";
import ImportStockModal, { ImportCatalogueModal } from "./ImportStockModal";
import {
  apercuImportCatalogue,
  apercuImportStock,
  importerCatalogue,
  importerStock,
  type RapportImportCatalogue,
  type RapportImportStock,
} from "@/lib/api_pharmacie";

vi.mock("@/lib/api_pharmacie", async (original) => ({
  ...(await original<typeof import("@/lib/api_pharmacie")>()),
  apercuImportCatalogue: vi.fn(),
  importerCatalogue: vi.fn(),
  telechargerModeleImportCatalogue: vi.fn(),
  apercuImportStock: vi.fn(),
  importerStock: vi.fn(),
  telechargerModeleImportStock: vi.fn(),
}));

const mockedApercu = vi.mocked(apercuImportCatalogue);
const mockedImporter = vi.mocked(importerCatalogue);
const mockedApercuStock = vi.mocked(apercuImportStock);
const mockedImporterStock = vi.mocked(importerStock);

const RAPPORT_STOCK: RapportImportStock = {
  totalLignes: 3,
  acceptees: 2,
  rejetees: 1,
  lignes: [
    {
      ligne: 2,
      nom: "Doliprane 500",
      statut: "acceptee",
      medicamentNom: "Doliprane 500 mg",
      quantite: 10,
      quantiteAvant: 5,
      quantiteApres: 15,
    },
    {
      ligne: 3,
      nom: "Amoxicilline",
      statut: "acceptee",
      medicamentNom: "Amoxicilline 500 mg",
      quantite: 4,
      quantiteAvant: 0,
      quantiteApres: 4,
    },
    { ligne: 4, nom: "Inconnu", statut: "rejetee", raison: "Médicament introuvable dans le catalogue." },
  ],
};

// Réponse d'un ancien serveur : ni quantiteAvant ni quantiteApres
const RAPPORT_STOCK_ANCIEN: RapportImportStock = {
  ...RAPPORT_STOCK,
  lignes: RAPPORT_STOCK.lignes.map((l) => ({ ...l, quantiteAvant: undefined, quantiteApres: undefined })),
};

const INVENTAIRE = "Inventaire : remplacer les quantités";
const LIVRAISON = "Livraison : ajouter aux quantités";

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

// Renvoie le fichier choisi, pour vérifier qu'il est bien transmis au serveur
function choisirFichier() {
  const champ = screen.getByLabelText(/Votre fichier Excel/);
  const f = fichierXlsx();
  fireEvent.change(champ, { target: { files: [f] } });
  return f;
}

beforeEach(() => {
  mockedApercu.mockReset();
  mockedImporter.mockReset();
  mockedApercuStock.mockReset();
  mockedImporterStock.mockReset();
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
    expect(
      screen.getByText("Choisissez ensuite si les quantités du fichier remplacent votre stock (inventaire) ou s'y ajoutent (livraison)."),
    ).toBeInTheDocument();
  });

  const afficherStock = () => render(<ImportStockModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} structureId="s1" />);
  const verifier = () => fireEvent.click(screen.getByRole("button", { name: /Vérifier le fichier/ }));

  it("propose le choix du mode à l'étape 1, Inventaire coché par défaut, avec une explication accessible", () => {
    afficherStock();

    expect(screen.getByRole("group", { name: "Que contient votre fichier ?" })).toBeInTheDocument();
    const inventaire = screen.getByRole("radio", { name: INVENTAIRE });
    const livraison = screen.getByRole("radio", { name: LIVRAISON });
    expect(inventaire).toBeChecked();
    expect(livraison).not.toBeChecked();
    expect(inventaire).toHaveAccessibleDescription("Les quantités du fichier deviennent votre stock.");
    expect(livraison).toHaveAccessibleDescription("Les quantités du fichier s'ajoutent à votre stock actuel.");
  });

  it("vérifie en mode « remplacer » par défaut, rappelle le mode et montre la colonne Stock", async () => {
    mockedApercuStock.mockResolvedValue({ data: RAPPORT_STOCK, message: "", success: true });
    afficherStock();

    const f = choisirFichier();
    verifier();

    expect(await screen.findByText(/Mode choisi/)).toHaveTextContent(`Mode choisi : « ${INVENTAIRE} ». Les quantités du fichier deviennent votre stock.`);
    expect(mockedApercuStock).toHaveBeenCalledWith("s1", f, "remplacer");
    expect(screen.getByRole("columnheader", { name: "Stock" })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Doliprane 500/ })).toHaveTextContent("5 → devient 15");
  });

  it("vérifie en mode « ajouter » quand la livraison est choisie à l'étape 1", async () => {
    mockedApercuStock.mockResolvedValue({ data: RAPPORT_STOCK, message: "", success: true });
    afficherStock();

    const f = choisirFichier();
    fireEvent.click(screen.getByRole("radio", { name: LIVRAISON }));
    verifier();

    expect(await screen.findByText(/Mode choisi/)).toHaveTextContent(
      `Mode choisi : « ${LIVRAISON} ». Les quantités du fichier s'ajoutent à votre stock actuel.`,
    );
    expect(mockedApercuStock).toHaveBeenCalledWith("s1", f, "ajouter");
  });

  it("importe en mode « ajouter » après confirmation adaptée à la livraison", async () => {
    mockedApercuStock.mockResolvedValue({ data: RAPPORT_STOCK, message: "", success: true });
    mockedImporterStock.mockResolvedValue({ data: { ...RAPPORT_STOCK, importees: 2 }, message: "", success: true });
    afficherStock();

    const f = choisirFichier();
    fireEvent.click(screen.getByRole("radio", { name: LIVRAISON }));
    verifier();
    fireEvent.click(await screen.findByRole("button", { name: "Importer 2 médicaments" }));
    expect(screen.getByText(/la quantité du fichier sera ajoutée à celle en stock/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmer l'import" }));

    await waitFor(() => expect(mockedImporterStock).toHaveBeenCalledTimes(1));
    expect(mockedImporterStock).toHaveBeenCalledWith("s1", f, "ajouter");
  });

  it("importe en mode « remplacer » après confirmation adaptée à l'inventaire", async () => {
    mockedApercuStock.mockResolvedValue({ data: RAPPORT_STOCK, message: "", success: true });
    mockedImporterStock.mockResolvedValue({ data: { ...RAPPORT_STOCK, importees: 2 }, message: "", success: true });
    afficherStock();

    const f = choisirFichier();
    verifier();
    fireEvent.click(await screen.findByRole("button", { name: "Importer 2 médicaments" }));
    expect(screen.getByText(/la quantité en stock sera remplacée par celle du fichier/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmer l'import" }));

    await waitFor(() => expect(mockedImporterStock).toHaveBeenCalledTimes(1));
    expect(mockedImporterStock).toHaveBeenCalledWith("s1", f, "remplacer");
  });

  it("relance l'aperçu quand on change de mode à l'étape 2, puis importe avec ce mode", async () => {
    mockedApercuStock.mockResolvedValue({ data: RAPPORT_STOCK, message: "", success: true });
    mockedImporterStock.mockResolvedValue({ data: { ...RAPPORT_STOCK, importees: 2 }, message: "", success: true });
    afficherStock();

    const f = choisirFichier();
    verifier();
    await screen.findByText(/Mode choisi/);
    fireEvent.click(screen.getByRole("radio", { name: LIVRAISON }));

    await waitFor(() => expect(mockedApercuStock).toHaveBeenCalledTimes(2));
    expect(mockedApercuStock).toHaveBeenLastCalledWith("s1", f, "ajouter");
    await waitFor(() => expect(screen.getByText(/Mode choisi/)).toHaveTextContent(LIVRAISON));

    fireEvent.click(await screen.findByRole("button", { name: "Importer 2 médicaments" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer l'import" }));
    await waitFor(() => expect(mockedImporterStock).toHaveBeenCalledWith("s1", f, "ajouter"));
  });

  it("revient au mode précédent et garde l'aperçu si la nouvelle vérification échoue", async () => {
    mockedApercuStock.mockResolvedValueOnce({ data: RAPPORT_STOCK, message: "", success: true });
    mockedApercuStock.mockRejectedValueOnce(new Error("x"));
    mockedImporterStock.mockResolvedValue({ data: { ...RAPPORT_STOCK, importees: 2 }, message: "", success: true });
    afficherStock();

    const f = choisirFichier();
    verifier();
    await screen.findByText(/Mode choisi/);
    fireEvent.click(screen.getByRole("radio", { name: LIVRAISON }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: INVENTAIRE })).toBeChecked();
    expect(screen.getByText(/Mode choisi/)).toHaveTextContent(INVENTAIRE);
    expect(screen.getByText("Doliprane 500 mg")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Importer 2 médicaments" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer l'import" }));
    await waitFor(() => expect(mockedImporterStock).toHaveBeenCalledWith("s1", f, "remplacer"));
  });

  it("n'affiche ni flèche ni erreur quand un ancien serveur ne donne pas les quantités avant et après", async () => {
    mockedApercuStock.mockResolvedValue({ data: RAPPORT_STOCK_ANCIEN, message: "", success: true });
    afficherStock();

    choisirFichier();
    verifier();

    expect(await screen.findByRole("columnheader", { name: "Stock" })).toBeInTheDocument();
    expect(within(screen.getByRole("table")).queryByText(/→/)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Importer 2 médicaments" })).toBeEnabled();
  });

  it("remet le mode sur Inventaire à la fermeture", () => {
    const onClose = vi.fn();
    render(<ImportStockModal isOpen onClose={onClose} onSuccess={vi.fn()} structureId="s1" />);

    fireEvent.click(screen.getByRole("radio", { name: LIVRAISON }));
    expect(screen.getByRole("radio", { name: LIVRAISON })).toBeChecked();
    fireEvent.click(screen.getAllByRole("button", { name: "Fermer" })[0]);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("radio", { name: INVENTAIRE })).toBeChecked();
  });

  it("n'affiche aucun choix de mode pour l'import du catalogue", () => {
    render(<ImportCatalogueModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);

    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });
});
