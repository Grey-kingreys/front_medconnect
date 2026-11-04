import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ToastProvider from "@/components/Toast";
import { ApiError } from "@/lib/api_auth";
import ImportStockModal, { ImportCatalogueModal } from "./ImportStockModal";
import {
  apercuImportCatalogue,
  apercuImportStock,
  importerCatalogue,
  importerStock,
  telechargerModeleImportStock,
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
const mockedModeleStock = vi.mocked(telechargerModeleImportStock);

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

const INVENTAIRE = "Inventaire : remplacer par les quantités comptées";
const LIVRAISON = "Livraison : ajouter les boîtes reçues";
const EXPLICATION_LIVRAISON =
  "Chaque ligne du fichier crée un lot. Quantités en boîtes ; date de péremption obligatoire (ou « sans péremption ») ; numéro de lot et coût d'achat facultatifs.";
const EXPLICATION_INVENTAIRE =
  "Une ligne par lot compté, quantités en boîtes (et unités en plus d'une boîte entamée). Les quantités du fichier remplacent celles enregistrées.";

const RAPPORT_INVENTAIRE: RapportImportStock = {
  totalLignes: 2,
  acceptees: 2,
  rejetees: 0,
  lignes: [
    {
      ligne: 2,
      nom: "Doliprane 500",
      statut: "acceptee",
      medicamentNom: "Doliprane 500 mg",
      numeroLot: "L1",
      quantite: 1,
      quantiteComptee: 20,
      quantiteTheorique: 25,
      ecart: -5,
      sousTolerance: false,
    },
    {
      ligne: 3,
      nom: "Amoxicilline",
      statut: "acceptee",
      medicamentNom: "Amoxicilline 500 mg",
      dateExpiration: "2028-06-30",
      quantite: 2,
      quantiteComptee: 40,
      // Un ancien serveur peut encore donner une valeur attendue négative : elle se lit 0
      quantiteTheorique: -3,
      quantiteARegulariser: 3,
      ecart: 43,
      sousTolerance: false,
      nouveauLot: true,
    },
  ],
};

const afficher = (modesPermis?: ("livraison" | "inventaire")[]) =>
  render(<ImportStockModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} structureId="s1" modesPermis={modesPermis} />);

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

  it("montre les colonnes lues, la ligne des titres et les colonnes non importées", async () => {
    mockedApercu.mockResolvedValue({
      data: {
        ...RAPPORT,
        colonnes: {
          ligneTitres: 3,
          reconnues: [
            { titre: "Désignation", colonne: "Nom" },
            { titre: "CATÉGORIE", colonne: "Catégorie" },
          ],
          ignorees: ["Laboratoire", "Prix"],
        },
      },
      message: "",
      success: true,
    });
    render(<ImportCatalogueModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);

    choisirFichier();
    fireEvent.click(screen.getByRole("button", { name: /Vérifier le fichier/ }));

    const lues = await screen.findByText(/Colonnes lues/);
    expect(lues.parentElement).toHaveTextContent(
      "Colonnes lues : « Désignation » comme Nom, Catégorie (titres trouvés en ligne 3)."
    );
    expect(screen.getByText(/Colonnes non importées : « Laboratoire », « Prix »/)).toBeInTheDocument();
  });

  it("n'affiche rien sur les colonnes avec un ancien serveur", async () => {
    mockedApercu.mockResolvedValue({ data: RAPPORT, message: "", success: true });
    render(<ImportCatalogueModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);

    choisirFichier();
    fireEvent.click(screen.getByRole("button", { name: /Vérifier le fichier/ }));

    await screen.findByText("1 médicament prêt à être ajouté au catalogue, 1 ligne écartée");
    expect(screen.queryByText(/Colonnes lues/)).not.toBeInTheDocument();
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
    expect(screen.getByText("Remplissez une ligne par produit et par lot : les quantités sont en boîtes.")).toBeInTheDocument();
    expect(screen.getByText(/rien n'est enregistré avant votre confirmation/)).toBeInTheDocument();
  });

  const afficherStock = () => afficher();
  const verifier = () => fireEvent.click(screen.getByRole("button", { name: /Vérifier le fichier/ }));

  it("propose le choix du mode à l'étape 1, Livraison cochée par défaut, avec une explication accessible", () => {
    afficherStock();

    expect(screen.getByRole("group", { name: "Que contient votre fichier ?" })).toBeInTheDocument();
    const inventaire = screen.getByRole("radio", { name: INVENTAIRE });
    const livraison = screen.getByRole("radio", { name: LIVRAISON });
    expect(livraison).toBeChecked();
    expect(inventaire).not.toBeChecked();
    expect(livraison).toHaveAccessibleDescription(EXPLICATION_LIVRAISON);
    expect(inventaire).toHaveAccessibleDescription(EXPLICATION_INVENTAIRE);
  });

  it("avec le droit d'inventaire seul, n'affiche aucun choix et vérifie en mode « inventaire »", async () => {
    mockedApercuStock.mockResolvedValue({ data: RAPPORT_INVENTAIRE, message: "", success: true });
    afficher(["inventaire"]);

    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.getByText(/Cet import sert à/)).toHaveTextContent(`« ${INVENTAIRE} »`);
    const f = choisirFichier();
    verifier();

    await screen.findByRole("columnheader", { name: "Compté (en unités)" });
    expect(mockedApercuStock).toHaveBeenCalledWith("s1", f, "inventaire");
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });

  it("télécharge le modèle du mode sélectionné", async () => {
    mockedModeleStock.mockResolvedValue({ blob: new Blob(["x"]), filename: "m.xlsx" });
    URL.createObjectURL = vi.fn(() => "blob:test");
    URL.revokeObjectURL = vi.fn();
    afficherStock();

    fireEvent.click(screen.getByRole("button", { name: /Télécharger le modèle Excel/ }));
    await waitFor(() => expect(mockedModeleStock).toHaveBeenLastCalledWith("s1", "livraison"));
    fireEvent.click(screen.getByRole("radio", { name: INVENTAIRE }));
    fireEvent.click(screen.getByRole("button", { name: /Télécharger le modèle Excel/ }));
    await waitFor(() => expect(mockedModeleStock).toHaveBeenLastCalledWith("s1", "inventaire"));
  });

  it("vérifie en mode « livraison » par défaut, rappelle le mode et montre la colonne Stock avant → après", async () => {
    mockedApercuStock.mockResolvedValue({ data: RAPPORT_STOCK, message: "", success: true });
    afficherStock();

    const f = choisirFichier();
    verifier();

    expect(await screen.findByText(/Mode choisi/)).toHaveTextContent(`Mode choisi : « ${LIVRAISON} ». ${EXPLICATION_LIVRAISON}`);
    expect(mockedApercuStock).toHaveBeenCalledWith("s1", f, "livraison");
    expect(screen.getByRole("columnheader", { name: "Stock avant → après" })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Doliprane 500/ })).toHaveTextContent("5 → devient 15");
  });

  it("aperçu de livraison : pas de colonne de coût sans la clé, « Inconnu » pour un coût nul", async () => {
    mockedApercuStock.mockResolvedValueOnce({ data: RAPPORT_STOCK, message: "", success: true });
    afficherStock();
    choisirFichier();
    verifier();
    await screen.findByRole("columnheader", { name: "Unités reçues" });
    expect(screen.queryByRole("columnheader", { name: "Coût d'une boîte" })).not.toBeInTheDocument();
    cleanup();

    mockedApercuStock.mockResolvedValueOnce({
      data: {
        ...RAPPORT_STOCK,
        lignes: [
          { ...RAPPORT_STOCK.lignes[0], coutAchatBoite: null, unitesRecues: 200, numeroLot: "L9", dateExpiration: "2028-06-30" },
          { ...RAPPORT_STOCK.lignes[1], coutAchatBoite: 12500, sansPeremption: true },
        ],
      },
      message: "",
      success: true,
    });
    afficherStock();
    choisirFichier();
    verifier();
    await screen.findByRole("columnheader", { name: "Coût d'une boîte" });
    const premiere = screen.getByRole("row", { name: /Doliprane 500/ });
    expect(premiere).toHaveTextContent("Inconnu");
    expect(premiere).toHaveTextContent("30/06/2028");
    expect(premiere).toHaveTextContent("L9");
    expect(screen.getByRole("row", { name: /Amoxicilline/ })).toHaveTextContent("12 500 GNF");
    expect(screen.getByRole("row", { name: /Amoxicilline/ })).toHaveTextContent("Sans péremption");
  });

  it("inventaire à l'aveugle : ni attendu ni écart à l'aperçu, présents au résultat après enregistrement", async () => {
    mockedApercuStock.mockResolvedValue({ data: RAPPORT_INVENTAIRE, message: "", success: true });
    mockedImporterStock.mockResolvedValue({
      data: { ...RAPPORT_INVENTAIRE, importees: 2, mode: "inventaire", receptionId: null, inventaireId: "i1" },
      message: "2 lots comptés.",
      success: true,
    });
    afficher(["inventaire"]);
    choisirFichier();
    verifier();

    // Aperçu : seulement ce que dit le fichier
    const premiere = await screen.findByRole("row", { name: /Doliprane 500/ });
    expect(screen.getByRole("columnheader", { name: "Compté (en unités)" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Attendu (en unités)" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Écart (en unités)" })).not.toBeInTheDocument();
    expect(premiere).toHaveTextContent("20");
    expect(premiere).not.toHaveTextContent("25");
    expect(premiere).not.toHaveTextContent("-5");
    expect(screen.getByRole("table")).not.toHaveTextContent("à régulariser");
    expect(screen.getByRole("table")).not.toHaveTextContent("tolérance");

    fireEvent.click(screen.getByRole("button", { name: "Importer 2 médicaments" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer l'import" }));

    // Résultat : attendu écrêté à 0 avec la part à régulariser, écart signé
    await screen.findByRole("columnheader", { name: "Attendu (en unités)" });
    expect(screen.getByRole("columnheader", { name: "Écart (en unités)" })).toBeInTheDocument();
    const avant = screen.getByRole("row", { name: /Doliprane 500/ });
    expect(avant).toHaveTextContent("25");
    expect(avant).toHaveTextContent("-5");
    const seconde = screen.getByRole("row", { name: /Amoxicilline/ });
    expect(seconde).toHaveTextContent("+43");
    expect(seconde).toHaveTextContent("3 à régulariser");
    expect(seconde).toHaveTextContent("nouveau lot");
    expect(seconde).not.toHaveTextContent("-3");
  });

  it("résultat d'une livraison : message du serveur et lien vers la réception", async () => {
    mockedApercuStock.mockResolvedValue({ data: RAPPORT_STOCK, message: "", success: true });
    mockedImporterStock.mockResolvedValue({
      data: { ...RAPPORT_STOCK, importees: 2, mode: "livraison", receptionId: "r1", inventaireId: null },
      message: "2 lots ajoutés au stock.",
      success: true,
    });
    afficherStock();
    choisirFichier();
    verifier();
    fireEvent.click(await screen.findByRole("button", { name: "Importer 2 médicaments" }));
    expect(screen.getByText("Ajouter 2 lots au stock ?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmer l'import" }));

    expect(await screen.findByText("2 lots ajoutés au stock.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voir la réception" })).toHaveAttribute("href", "/dashboard/receptions/r1");
  });

  it("refus 403 de l'aperçu : affiche le message du serveur", async () => {
    mockedApercuStock.mockRejectedValue(new ApiError("Vous n'avez pas le droit d'ajouter une livraison.", 403));
    afficherStock();
    choisirFichier();
    verifier();

    expect(await screen.findByRole("alert")).toHaveTextContent("Vous n'avez pas le droit d'ajouter une livraison.");
  });

  it("montre « 0 → 4 » avec la part à régulariser rattachée, sans signe moins ni jargon", async () => {
    mockedApercuStock.mockResolvedValue({
      data: {
        ...RAPPORT_STOCK,
        lignes: [
          { ...RAPPORT_STOCK.lignes[1], quantiteAvant: 0, quantiteApres: 4, quantiteARegulariserAvant: 1 },
          // Un ancien serveur peut encore donner un avant négatif : il se lit 0.
          { ...RAPPORT_STOCK.lignes[0], quantiteAvant: -2, quantiteApres: 8 },
        ],
      },
      message: "",
      success: true,
    });
    afficherStock();

    choisirFichier();
    verifier();

    const ligne = await screen.findByRole("row", { name: /Amoxicilline/ });
    expect(ligne).toHaveTextContent("0 → devient 4");
    expect(ligne).toHaveTextContent("1 à régulariser avant cette livraison");
    expect(ligne).not.toHaveTextContent("boîte à régulariser");
    const autre = screen.getByRole("row", { name: /Doliprane 500/ });
    expect(autre).toHaveTextContent("0 → devient 8");
    expect(autre).not.toHaveTextContent("régulariser");
    expect(within(screen.getByRole("table")).queryByText(/-\d/)).not.toBeInTheDocument();
  });

  it("vérifie en mode « inventaire » quand l'inventaire est choisi à l'étape 1", async () => {
    mockedApercuStock.mockResolvedValue({ data: RAPPORT_INVENTAIRE, message: "", success: true });
    afficherStock();

    const f = choisirFichier();
    fireEvent.click(screen.getByRole("radio", { name: INVENTAIRE }));
    verifier();

    expect(await screen.findByText(/Mode choisi/)).toHaveTextContent(`Mode choisi : « ${INVENTAIRE} ». ${EXPLICATION_INVENTAIRE}`);
    expect(mockedApercuStock).toHaveBeenCalledWith("s1", f, "inventaire");
  });

  it("importe en mode « livraison » après confirmation adaptée à la livraison", async () => {
    mockedApercuStock.mockResolvedValue({ data: RAPPORT_STOCK, message: "", success: true });
    mockedImporterStock.mockResolvedValue({ data: { ...RAPPORT_STOCK, importees: 2 }, message: "", success: true });
    afficherStock();

    const f = choisirFichier();
    verifier();
    fireEvent.click(await screen.findByRole("button", { name: "Importer 2 médicaments" }));
    expect(screen.getByText("Ajouter 2 lots au stock ?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmer l'import" }));

    await waitFor(() => expect(mockedImporterStock).toHaveBeenCalledTimes(1));
    expect(mockedImporterStock).toHaveBeenCalledWith("s1", f, "livraison");
  });

  it("importe en mode « inventaire » après confirmation adaptée à l'inventaire", async () => {
    mockedApercuStock.mockResolvedValue({ data: RAPPORT_STOCK, message: "", success: true });
    mockedImporterStock.mockResolvedValue({
      data: { ...RAPPORT_INVENTAIRE, importees: 2, mode: "inventaire", receptionId: null, inventaireId: "i1" },
      message: "",
      success: true,
    });
    afficherStock();

    const f = choisirFichier();
    fireEvent.click(screen.getByRole("radio", { name: INVENTAIRE }));
    verifier();
    fireEvent.click(await screen.findByRole("button", { name: "Importer 2 médicaments" }));
    expect(screen.getByText("Remplacer le stock de 2 lots par les quantités comptées ?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmer l'import" }));

    await waitFor(() => expect(mockedImporterStock).toHaveBeenCalledTimes(1));
    expect(mockedImporterStock).toHaveBeenCalledWith("s1", f, "inventaire");
    expect(await screen.findByText("Les écarts au-delà de la tolérance sont signalés au titulaire.")).toBeInTheDocument();
  });

  it("relance l'aperçu quand on change de mode à l'étape 2, puis importe avec ce mode", async () => {
    mockedApercuStock.mockResolvedValue({ data: RAPPORT_STOCK, message: "", success: true });
    mockedImporterStock.mockResolvedValue({ data: { ...RAPPORT_STOCK, importees: 2 }, message: "", success: true });
    afficherStock();

    const f = choisirFichier();
    verifier();
    await screen.findByText(/Mode choisi/);
    fireEvent.click(screen.getByRole("radio", { name: INVENTAIRE }));

    await waitFor(() => expect(mockedApercuStock).toHaveBeenCalledTimes(2));
    expect(mockedApercuStock).toHaveBeenLastCalledWith("s1", f, "inventaire");
    await waitFor(() => expect(screen.getByText(/Mode choisi/)).toHaveTextContent(INVENTAIRE));

    fireEvent.click(await screen.findByRole("button", { name: "Importer 2 médicaments" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer l'import" }));
    await waitFor(() => expect(mockedImporterStock).toHaveBeenCalledWith("s1", f, "inventaire"));
  });

  it("revient au mode précédent et garde l'aperçu si la nouvelle vérification échoue", async () => {
    mockedApercuStock.mockResolvedValueOnce({ data: RAPPORT_STOCK, message: "", success: true });
    mockedApercuStock.mockRejectedValueOnce(new Error("x"));
    mockedImporterStock.mockResolvedValue({ data: { ...RAPPORT_STOCK, importees: 2 }, message: "", success: true });
    afficherStock();

    const f = choisirFichier();
    verifier();
    await screen.findByText(/Mode choisi/);
    fireEvent.click(screen.getByRole("radio", { name: INVENTAIRE }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: LIVRAISON })).toBeChecked();
    expect(screen.getByText(/Mode choisi/)).toHaveTextContent(LIVRAISON);
    expect(screen.getByText("Doliprane 500 mg")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Importer 2 médicaments" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer l'import" }));
    await waitFor(() => expect(mockedImporterStock).toHaveBeenCalledWith("s1", f, "livraison"));
  });

  it("n'affiche ni flèche ni erreur quand un ancien serveur ne donne pas les quantités avant et après", async () => {
    mockedApercuStock.mockResolvedValue({ data: RAPPORT_STOCK_ANCIEN, message: "", success: true });
    afficherStock();

    choisirFichier();
    verifier();

    expect(await screen.findByRole("columnheader", { name: "Stock avant → après" })).toBeInTheDocument();
    for (const ligne of screen.getAllByRole("row").slice(1)) expect(ligne).not.toHaveTextContent("→");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Importer 2 médicaments" })).toBeEnabled();
  });

  it("remet le mode sur Livraison à la fermeture", () => {
    const onClose = vi.fn();
    render(<ImportStockModal isOpen onClose={onClose} onSuccess={vi.fn()} structureId="s1" />);

    fireEvent.click(screen.getByRole("radio", { name: INVENTAIRE }));
    expect(screen.getByRole("radio", { name: INVENTAIRE })).toBeChecked();
    fireEvent.click(screen.getAllByRole("button", { name: "Fermer" })[0]);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("radio", { name: LIVRAISON })).toBeChecked();
  });

  it("n'affiche aucun choix de mode pour l'import du catalogue", () => {
    render(<ImportCatalogueModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);

    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });
});
