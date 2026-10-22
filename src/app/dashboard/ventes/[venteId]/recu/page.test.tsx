import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api_auth";
import type { Vente } from "@/lib/api_ventes";
import { formaterGNF } from "@/lib/format_gnf";
import RecuVentePage from "./page";

const { getVente } = vi.hoisted(() => ({ getVente: vi.fn() }));

vi.mock("next/navigation", () => ({ useParams: () => ({ venteId: "v1" }) }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", structureId: "p1", email: "u1@exemple.com", nom: "Diallo", prenom: "Mariama", role: "PHARMACIEN" },
    loading: false,
    profile: {
      id: "u1",
      email: "u1@exemple.com",
      nom: "Diallo",
      prenom: "Mariama",
      role: "PHARMACIEN",
      isActive: true,
      permissions: ["vente:read"],
      structureType: "PHARMACIE",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  }),
}));
vi.mock("@/lib/api_ventes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api_ventes")>()),
  getVente,
}));

const VENTE: Vente = {
  id: "v1",
  numero: "V-2026-0001",
  statut: "VALIDEE",
  createdAt: "2026-10-22T10:05:00.000Z",
  total: 3000,
  ordonnanceVerifiee: false,
  clientNom: "Barry",
  clientTelephone: "620 00 00 00",
  vendeur: { id: "u1", nom: "Mariama Diallo" },
  annuleeLe: null,
  annuleeParId: null,
  motifAnnulation: null,
  lignes: [
    {
      id: "l1",
      stockId: "s1",
      medicamentId: "m1",
      nomMedicament: "Paracétamol 500 mg",
      prixUnitaire: 1500,
      quantite: 2,
      sousTotal: 3000,
    },
  ],
  pharmacie: {
    id: "p1",
    nom: "Pharmacie du Centre",
    adresse: "Avenue de la République",
    ville: "Conakry",
    telephone: "622 11 22 33",
    logoUrl: null,
  },
};

const reponse = (vente: Vente) => ({ data: vente, message: "ok", success: true });

const TERMES_INTERDITS =
  /\b(ID|UUID|null|undefined|NaN|serveur|session|idempotence|localStorage|STOCK_INSUFFISANT|STOCK_INTROUVABLE|VALIDEE|ANNULEE)\b/;

const verifierTermes = () => {
  const contenu = document.body.textContent ?? "";
  expect(contenu).not.toMatch(TERMES_INTERDITS);
  expect(contenu).not.toContain(String.fromCharCode(0x2013));
  expect(contenu).not.toContain(String.fromCharCode(0x2014));
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  window.print = vi.fn();
  getVente.mockResolvedValue(reponse(VENTE));
});

afterEach(() => {
  cleanup();
});

describe("Reçu de vente", () => {
  it("affiche le contenu du reçu", async () => {
    render(<RecuVentePage />);
    const recu = await screen.findByRole("article", { name: "Reçu V-2026-0001" });
    const dans = within(recu);

    expect(getVente).toHaveBeenCalledWith("p1", "v1");
    expect(dans.getByText("Pharmacie du Centre")).toBeInTheDocument();
    expect(dans.getByText("Avenue de la République")).toBeInTheDocument();
    expect(dans.getByText("Conakry")).toBeInTheDocument();
    expect(dans.getByText("Tél. : 622 11 22 33")).toBeInTheDocument();
    expect(dans.getByText("Reçu n° V-2026-0001")).toBeInTheDocument();
    expect(dans.getByText("Le 22/10/2026 à 10:05")).toBeInTheDocument();
    expect(dans.getByText("Vendeur : Mariama Diallo")).toBeInTheDocument();
    expect(dans.getByText("Client : Barry")).toBeInTheDocument();
    expect(dans.getByText("Téléphone du client : 620 00 00 00")).toBeInTheDocument();
    expect(dans.getByText("Paracétamol 500 mg")).toBeInTheDocument();
    const detail = `2 × ${formaterGNF(1500)} = ${formaterGNF(3000)}`;
    expect(dans.getByText((_, el) => el?.tagName === "P" && el.textContent === detail)).toBeInTheDocument();
    expect(dans.getByText("Total").parentElement?.textContent).toBe(`Total${formaterGNF(3000)}`);
    expect(dans.getByText("Merci de votre confiance")).toBeInTheDocument();
    expect(dans.getByText("Reçu : ne vaut pas facture")).toBeInTheDocument();
    verifierTermes();
  });

  it("montre le logo seulement quand la pharmacie en a un", async () => {
    getVente.mockResolvedValue(reponse({ ...VENTE, pharmacie: { ...VENTE.pharmacie, logoUrl: "https://cdn.exemple.com/logo.png" } }));
    render(<RecuVentePage />);
    expect(await screen.findByRole("img", { name: "Logo de Pharmacie du Centre" })).toBeInTheDocument();
    cleanup();

    getVente.mockResolvedValue(reponse(VENTE));
    render(<RecuVentePage />);
    await screen.findByRole("article");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("marque ANNULÉE seulement une vente annulée", async () => {
    render(<RecuVentePage />);
    await screen.findByRole("article");
    expect(screen.queryByText("ANNULÉE")).toBeNull();
    cleanup();

    getVente.mockResolvedValue(
      reponse({ ...VENTE, statut: "ANNULEE", annuleeLe: "2026-10-22T11:00:00.000Z", motifAnnulation: "Erreur de quantité" }),
    );
    render(<RecuVentePage />);
    expect(await screen.findByText("ANNULÉE")).toBeInTheDocument();
    expect(screen.getByText("Annulée le 22/10/2026 à 11:00")).toBeInTheDocument();
    expect(screen.queryByText(/Erreur de quantité/)).toBeNull();
    verifierTermes();
  });

  it("propose le ticket 58 mm par défaut et mémorise le choix", async () => {
    render(<RecuVentePage />);
    await screen.findByRole("article");
    expect(screen.getByRole("radio", { name: "Ticket 58 mm" })).toBeChecked();

    fireEvent.click(screen.getByRole("radio", { name: "Feuille A4" }));
    expect(screen.getByRole("radio", { name: "Feuille A4" })).toBeChecked();
    expect(localStorage.getItem("medconnecte:format-recu")).toBe("A4");
    cleanup();

    render(<RecuVentePage />);
    await screen.findByRole("article");
    expect(screen.getByRole("radio", { name: "Feuille A4" })).toBeChecked();
  });

  it("lance l'impression", async () => {
    render(<RecuVentePage />);
    await screen.findByRole("article");
    fireEvent.click(screen.getByRole("button", { name: "Imprimer" }));
    expect(window.print).toHaveBeenCalledTimes(1);
  });

  it("explique qu'une vente est introuvable", async () => {
    getVente.mockRejectedValue(new ApiError("Vente introuvable.", 404));
    render(<RecuVentePage />);
    expect(await screen.findByText(/Cette vente est introuvable/)).toBeInTheDocument();
    expect(screen.queryByRole("article")).toBeNull();
    verifierTermes();
  });

  it("propose de réessayer après un échec de connexion", async () => {
    getVente.mockRejectedValueOnce(new ApiError("Connexion perdue.", 0));
    render(<RecuVentePage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Connexion perdue.");
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));

    expect(await screen.findByRole("article")).toBeInTheDocument();
    await waitFor(() => expect(getVente).toHaveBeenCalledTimes(2));
  });
});
