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
      uniteAffichee: "BOITE",
      nombreAffiche: 2,
      coefficientApplique: 1,
      allocations: [
        {
          lotId: "lot-secret-1",
          numeroLot: "LOT-A12",
          dateExpiration: "2027-03-31",
          quantite: 2,
          statut: "DEFINITIVE",
          sortieManuelle: false,
          motif: null,
          lotTechnique: false,
        },
      ],
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
  typePiece: "VENTE",
  numeroTicket: 1,
  jourMetier: "2026-10-22",
  provisoire: false,
  poste: { id: "po1", code: "W1" },
  session: { id: "se1", ouverteAutomatiquement: false },
  paiements: [],
  annulation: null,
  venteOrigine: null,
  motif: null,
};

const PAIEMENT_ESPECES = {
  id: "pa1",
  mode: "ESPECES",
  libelle: "Espèces",
  montant: 3000,
  reference: null,
  montantRecu: 5000,
  rendu: 2000,
};

/** Ligne de reçu au texte exact : formaterGNF contient des espaces insécables que la recherche par texte normalise. */
const ligneExacte = (texte: string) => (_contenu: string, el: Element | null) =>
  el?.tagName === "P" && el.textContent === texte;

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
    expect(dans.getByText("2 boîtes de Paracétamol 500 mg")).toBeInTheDocument();
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
      reponse({
        ...VENTE,
        statut: "ANNULEE",
        annuleeLe: "2026-10-22T11:00:00.000Z",
        motifAnnulation: "Erreur de quantité",
        annulation: {
          id: "a1",
          numero: "A-V-2026-0001",
          motif: "Erreur de quantité",
          le: "2026-10-22T11:00:00.000Z",
          par: { id: "u2", nom: "Djénabou Baldé" },
        },
      }),
    );
    render(<RecuVentePage />);
    expect(await screen.findByText("ANNULÉE")).toBeInTheDocument();
    expect(screen.getByText("Annulée le 22/10/2026 à 11:00 par Djénabou Baldé (pièce A-V-2026-0001)")).toBeInTheDocument();
    expect(screen.getByText("Motif : Erreur de quantité")).toBeInTheDocument();
    verifierTermes();
  });

  it("titre une pièce d'annulation avec sa vente d'origine et son motif", async () => {
    getVente.mockResolvedValue(
      reponse({
        ...VENTE,
        id: "a1",
        numero: "A-T1-0000012",
        total: -3000,
        typePiece: "ANNULATION",
        numeroTicket: null,
        venteOrigine: { id: "v12", numero: "T1-0000012" },
        motif: "Erreur de quantité",
        lignes: [{ ...VENTE.lignes[0], nombreAffiche: -2, quantite: -2, sousTotal: -3000 }],
        paiements: [{ ...PAIEMENT_ESPECES, montant: -3000, montantRecu: null, rendu: null }],
      }),
    );
    render(<RecuVentePage />);
    const recu = within(await screen.findByRole("article"));

    expect(recu.getByText("Pièce d'annulation n° A-T1-0000012")).toBeInTheDocument();
    expect(recu.getByText("Annule la vente n° T1-0000012")).toBeInTheDocument();
    expect(recu.getByText("Motif : Erreur de quantité")).toBeInTheDocument();
    expect(recu.queryByText(/Reçu n°/)).toBeNull();
    expect(recu.getByText("2 boîtes de Paracétamol 500 mg")).toBeInTheDocument();
    // Le calcul de la ligne reste juste : le nombre porte le signe du sous-total.
    expect(recu.getByText(ligneExacte(`-2 × ${formaterGNF(1500)} = ${formaterGNF(-3000)}`))).toBeInTheDocument();
    expect(recu.getByText("Total").parentElement?.textContent).toBe(`Total${formaterGNF(-3000)}`);
    expect(recu.getByText(ligneExacte(`Espèces : ${formaterGNF(-3000)}`))).toBeInTheDocument();
    verifierTermes();
  });

  it("titre une régularisation et indique le jour où elle est comptée", async () => {
    getVente.mockResolvedValue(
      reponse({ ...VENTE, numero: "T2-0000009", typePiece: "REGULARISATION", jourMetier: "2026-10-23" }),
    );
    render(<RecuVentePage />);
    const recu = within(await screen.findByRole("article"));

    expect(recu.getByText("Régularisation n° T2-0000009")).toBeInTheDocument();
    expect(recu.getByText("Comptée pour le vendredi 23 octobre 2026")).toBeInTheDocument();
  });

  it("n'indique pas de jour de comptage quand il est celui de la vente", async () => {
    render(<RecuVentePage />);
    const recu = within(await screen.findByRole("article"));
    expect(recu.queryByText(/Comptée pour le/)).toBeNull();
  });

  it("liste les paiements avec la monnaie rendue en espèces", async () => {
    getVente.mockResolvedValue(
      reponse({
        ...VENTE,
        total: 8000,
        paiements: [
          PAIEMENT_ESPECES,
          {
            id: "pa2",
            mode: "ORANGE_MONEY",
            libelle: "Orange Money",
            montant: 5000,
            reference: "OM123456",
            montantRecu: null,
            rendu: null,
          },
        ],
      }),
    );
    render(<RecuVentePage />);
    const recu = within(await screen.findByRole("article"));

    expect(recu.getByText(ligneExacte(`Espèces : ${formaterGNF(3000)}`))).toBeInTheDocument();
    expect(recu.getByText(ligneExacte(`Reçu : ${formaterGNF(5000)}`))).toBeInTheDocument();
    expect(recu.getByText(ligneExacte(`Rendu : ${formaterGNF(2000)}`))).toBeInTheDocument();
    expect(recu.getByText(ligneExacte(`Orange Money : ${formaterGNF(5000)}`))).toBeInTheDocument();
    expect(recu.getByText("Référence : OM123456")).toBeInTheDocument();
  });

  it("n'affiche aucune ligne de paiement quand il n'y en a pas", async () => {
    render(<RecuVentePage />);
    const recu = within(await screen.findByRole("article"));
    expect(recu.queryByText(/Espèces|Orange Money|Rendu/)).toBeNull();
  });

  it("n'affiche aucun numéro de lot ni coût", async () => {
    render(<RecuVentePage />);
    await screen.findByRole("article");
    const contenu = document.body.textContent ?? "";
    expect(contenu).not.toContain("LOT-A12");
    expect(contenu).not.toContain("2027");
    expect(contenu).not.toMatch(/lot|coût|marge/i);
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
