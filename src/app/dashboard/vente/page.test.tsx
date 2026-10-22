import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api_auth";
import type { StockMedicament } from "@/lib/api_pharmacie";
import type { Vente } from "@/lib/api_ventes";
import { formaterGNF } from "@/lib/format_gnf";
import NouvelleVentePage from "./page";

const { getMyStock, creerVente } = vi.hoisted(() => ({
  getMyStock: vi.fn(),
  creerVente: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", structureId: "p1", email: "u1@exemple.com", nom: "Diallo", prenom: "Mariama", role: "PHARMACIEN" },
    loading: false,
  }),
}));
vi.mock("@/lib/api_pharmacie", () => ({ getMyStock }));
vi.mock("@/lib/api_ventes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api_ventes")>()),
  creerVente,
}));

const CLE_STOCKAGE = "medconnecte:panier-vente:p1:u1";

const stock = (id: string, nom: string, surcharge: Partial<StockMedicament> = {}, ordonnance = false): StockMedicament => ({
  id,
  medicamentId: `m-${id}`,
  medicament: { id: `m-${id}`, nom, categorie: "Divers", ordonnanceRequise: ordonnance, formes: [] },
  structureId: "p1",
  quantite: 3,
  prixUnitaire: 1500,
  disponible: true,
  ...surcharge,
});

const STOCKS = [
  stock("s1", "Paracétamol"),
  stock("s2", "Amoxicilline", { prixUnitaire: 2500, quantite: 2 }, true),
  stock("s3", "Vieux sirop", { dateExpiration: "2020-01-01T00:00:00.000Z" }),
  stock("s4", "Ibuprofène", { quantite: 0 }),
  stock("s5", "Vitamine C", { prixUnitaire: undefined }),
];

const reponseStock = (stocks: StockMedicament[]) => ({
  data: { stocks, alertes: { stockBas: [], rupture: [] } },
  message: "ok",
  success: true,
});

const VENTE: Vente = {
  id: "v1",
  structureId: "p1",
  numero: "V-2026-0001",
  vendeurId: "u1",
  clientNom: null,
  clientTelephone: null,
  ordonnanceVerifiee: false,
  total: 3000,
  statut: "VALIDEE",
  annuleeLe: null,
  annuleeParId: null,
  motifAnnulation: null,
  createdAt: "2026-10-22T10:00:00.000Z",
  lignes: [],
};

const TERMES_INTERDITS = /\b(ID|UUID|null|undefined|NaN|serveur|session|idempotence|localStorage|STOCK_INSUFFISANT|VALIDEE)\b/;

const verifierTermes = () => {
  const contenu = document.body.textContent ?? "";
  expect(contenu).not.toMatch(TERMES_INTERDITS);
  expect(contenu).not.toContain(String.fromCharCode(0x2013));
  expect(contenu).not.toContain(String.fromCharCode(0x2014));
  expect(contenu).not.toContain("requête");
};

const ajouter = (nom: string) => fireEvent.click(screen.getByRole("button", { name: `Ajouter ${nom} au panier` }));

const confirmerLaVente = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Valider la vente" }));
  const dialogue = await screen.findByRole("dialog");
  fireEvent.click(within(dialogue).getByRole("button", { name: "Confirmer la vente" }));
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  getMyStock.mockResolvedValue(reponseStock(STOCKS));
});

afterEach(() => {
  cleanup();
});

describe("Nouvelle vente", () => {
  it("affiche les médicaments non vendables avec leur raison et sans bouton Ajouter", async () => {
    render(<NouvelleVentePage />);
    await screen.findByText("Vieux sirop");

    for (const [nom, raison] of [
      ["Vieux sirop", "Date de péremption dépassée"],
      ["Ibuprofène", "Rupture de stock"],
      ["Vitamine C", "Prix non renseigné"],
    ]) {
      const ligne = screen.getByText(nom).closest("li") as HTMLElement;
      expect(within(ligne).getByText(raison)).toBeInTheDocument();
      expect(within(ligne).queryByRole("button")).toBeNull();
      expect(screen.queryByRole("button", { name: `Ajouter ${nom} au panier` })).toBeNull();
    }
    expect(screen.getByRole("button", { name: "Ajouter Paracétamol au panier" })).toBeInTheDocument();
    verifierTermes();
  });

  it("borne les quantités au stock et calcule le total en direct", async () => {
    render(<NouvelleVentePage />);
    await screen.findByText("Paracétamol");
    ajouter("Paracétamol");

    const moins = screen.getByRole("button", { name: "Diminuer la quantité de Paracétamol" });
    const plus = screen.getByRole("button", { name: "Augmenter la quantité de Paracétamol" });
    expect(moins).toBeDisabled();
    fireEvent.click(plus);
    fireEvent.click(plus);
    expect(plus).toBeDisabled();
    expect(moins).not.toBeDisabled();
    expect(screen.getByText("Tout le stock est dans le panier")).toBeInTheDocument();
    expect(screen.getByText("Total").parentElement?.textContent).toBe(`Total${formaterGNF(4500)}`);
    expect(formaterGNF(4500)).toBe("4 500 GNF");
  });

  it("exige l'ordonnance vue pour un médicament sur ordonnance", async () => {
    render(<NouvelleVentePage />);
    await screen.findByText("Amoxicilline");
    ajouter("Amoxicilline");

    fireEvent.click(screen.getByRole("button", { name: "Valider la vente" }));
    expect(screen.getByText("Cochez « J'ai vu l'ordonnance » pour vendre ces médicaments.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByLabelText("J'ai vu l'ordonnance")).toHaveFocus();

    fireEvent.click(screen.getByLabelText("J'ai vu l'ordonnance"));
    fireEvent.click(screen.getByRole("button", { name: "Valider la vente" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Ordonnance vue")).toBeInTheDocument();
  });

  it("refuse un téléphone invalide sans ouvrir la confirmation", async () => {
    render(<NouvelleVentePage />);
    await screen.findByText("Paracétamol");
    ajouter("Paracétamol");
    fireEvent.change(screen.getByLabelText("Téléphone du client"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Valider la vente" }));

    expect(screen.getByText("Ce numéro de téléphone n'est pas valide.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("enregistre la vente après confirmation et affiche le reçu", async () => {
    creerVente.mockResolvedValue({ data: VENTE, message: "ok", success: true });
    render(<NouvelleVentePage />);
    await screen.findByText("Paracétamol");
    ajouter("Paracétamol");
    fireEvent.click(screen.getByRole("button", { name: "Augmenter la quantité de Paracétamol" }));
    expect(localStorage.getItem(CLE_STOCKAGE)).not.toBeNull();

    await confirmerLaVente();

    expect(await screen.findByRole("heading", { name: "Vente enregistrée" })).toHaveFocus();
    expect(creerVente).toHaveBeenCalledWith("p1", { lignes: [{ stockId: "s1", quantite: 2 }] }, expect.any(String));
    expect(screen.getByText("Numéro : V-2026-0001")).toBeInTheDocument();
    expect(document.body.textContent).toContain(`Total : ${formaterGNF(3000)}`);
    expect(screen.getByRole("link", { name: "Voir et imprimer le reçu" })).toHaveAttribute("href", "/dashboard/ventes/v1/recu");
    expect(localStorage.getItem(CLE_STOCKAGE)).toBeNull();
    verifierTermes();
  });

  it("après un échec de connexion, « Réessayer » renvoie la même demande", async () => {
    creerVente
      .mockRejectedValueOnce(new ApiError("Connexion perdue.", 0))
      .mockResolvedValueOnce({ data: VENTE, message: "ok", success: true });
    render(<NouvelleVentePage />);
    await screen.findByText("Paracétamol");
    ajouter("Paracétamol");

    await confirmerLaVente();

    const alerte = await screen.findByRole("alert");
    expect(alerte).toHaveTextContent("La vente n'a peut-être pas été enregistrée.");
    verifierTermes();
    fireEvent.click(within(alerte).getByRole("button", { name: "Réessayer" }));

    expect(await screen.findByRole("heading", { name: "Vente enregistrée" })).toBeInTheDocument();
    expect(creerVente).toHaveBeenCalledTimes(2);
    const premiereCle = creerVente.mock.calls[0][2];
    expect(typeof premiereCle).toBe("string");
    expect(creerVente.mock.calls[1][2]).toBe(premiereCle);
  });

  it("corrige le panier quand le stock a changé pendant la vente", async () => {
    creerVente.mockRejectedValue(
      new ApiError("Stock insuffisant.", 409, {
        code: "STOCK_INSUFFISANT",
        details: [{ stockId: "s1", nom: "Paracétamol", disponible: 1 }],
      }),
    );
    render(<NouvelleVentePage />);
    await screen.findByText("Paracétamol");
    ajouter("Paracétamol");
    fireEvent.click(screen.getByRole("button", { name: "Augmenter la quantité de Paracétamol" }));
    fireEvent.click(screen.getByRole("button", { name: "Augmenter la quantité de Paracétamol" }));

    await confirmerLaVente();

    const alerte = await screen.findByRole("alert");
    expect(alerte).toHaveTextContent("Le stock a changé pendant la vente.");
    expect(alerte).toHaveTextContent("Paracétamol (1 au lieu de 3)");
    await waitFor(() => expect(getMyStock).toHaveBeenCalledTimes(2));
    const ligne = screen.getByRole("button", { name: "Retirer Paracétamol du panier" }).closest("li") as HTMLElement;
    expect(ligne.textContent).toContain(`${formaterGNF(1500)} × 1`);
    verifierTermes();
  });

  it("relit le panier enregistré et le corrige si le stock a baissé", async () => {
    localStorage.setItem(
      CLE_STOCKAGE,
      JSON.stringify({
        version: 1,
        cleIdempotence: "cle-1",
        lignes: [{ stockId: "s1", quantite: 5 }],
        clientNom: "Barry",
        clientTelephone: "",
        ordonnanceVue: false,
      }),
    );
    render(<NouvelleVentePage />);

    expect(await screen.findByText("Le panier a été corrigé : Paracétamol (3 au lieu de 5).")).toBeInTheDocument();
    const ligne = screen.getByRole("button", { name: "Retirer Paracétamol du panier" }).closest("li") as HTMLElement;
    expect(ligne.textContent).toContain(`${formaterGNF(1500)} × 3`);
    expect(screen.getByLabelText("Nom du client")).toHaveValue("Barry");
  });

  it("propose de réessayer quand le stock ne se charge pas", async () => {
    getMyStock.mockRejectedValueOnce(new ApiError("Impossible de joindre le service.", 0));
    render(<NouvelleVentePage />);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(await screen.findByText("Paracétamol")).toBeInTheDocument();
  });

  it("guide vers le stock quand il est vide", async () => {
    getMyStock.mockResolvedValue(reponseStock([]));
    render(<NouvelleVentePage />);

    expect(await screen.findByText(/Votre stock est vide/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Aller au stock" })).toHaveAttribute("href", "/dashboard/stock");
  });
});
