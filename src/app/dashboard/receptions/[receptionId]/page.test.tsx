import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api_auth";
import type { LotRecu, Reception } from "@/lib/api_pharmacie";
import DetailReceptionPage from "./page";

const { getReception, getMyStock, corrigerDateLot } = vi.hoisted(() => ({
  getReception: vi.fn(),
  getMyStock: vi.fn(),
  corrigerDateLot: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useParams: () => ({ receptionId: "r1" }) }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", structureId: "s1", email: "u1@exemple.com", nom: "Baldé", prenom: "Djénabou", role: "STRUCTURE_ADMIN" },
    loading: false,
    profile: null,
  }),
}));
vi.mock("@/lib/api_pharmacie", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api_pharmacie")>()),
  getReception,
  getMyStock,
  corrigerDateLot,
}));

const lot = (id: string, nom: string, extra: Partial<LotRecu> = {}): LotRecu => ({
  id,
  stockId: `st-${id}`,
  nom,
  numeroLot: "AG23C777",
  dateExpiration: "2028-06-30",
  quantiteRecue: 40,
  coefficientReception: 20,
  solde: 26,
  ...extra,
});

const reception = (lots: LotRecu[], extra: Partial<Reception> = {}) => ({
  data: {
    id: "r1",
    reference: "BL-MAT-0412",
    recueLe: "2026-10-29T10:05:00.000Z",
    createdAt: "2026-10-29T10:06:00.000Z",
    auteurId: "u1",
    fournisseur: { id: "f1", nom: "UbiPharm" },
    lots,
    resolutions: [],
    ...extra,
  } as Reception,
  message: "ok",
  success: true,
});

beforeEach(() => {
  vi.clearAllMocks();
  getMyStock.mockResolvedValue({
    data: {
      stocks: [{ id: "st-l1", uniteMinimale: "COMPRIME" }],
      alertes: { stockBas: [], rupture: [] },
    },
    message: "ok",
    success: true,
  });
});

afterEach(cleanup);

describe("Réceptions, détail", () => {
  it("affiche les lots avec leur péremption et « Sans numéro »", async () => {
    getReception.mockResolvedValue(
      reception([lot("l1", "Augmentin"), lot("l2", "Ibuprofène", { numeroLot: null, dateExpiration: null })]),
    );
    render(<DetailReceptionPage />);

    expect(await screen.findByText("Augmentin")).toBeInTheDocument();
    expect(getReception).toHaveBeenCalledWith("s1", "r1");
    expect(screen.getByText("30/06/2028")).toBeInTheDocument();
    expect(screen.getByText("Sans numéro")).toBeInTheDocument();
    expect(screen.getByText("Sans date")).toBeInTheDocument();
    expect(screen.getByText("Fournisseur : UbiPharm")).toBeInTheDocument();
    expect(screen.getByText("Bon de livraison : BL-MAT-0412")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Retour aux réceptions" })).toHaveAttribute("href", "/dashboard/receptions");
    const contenu = document.body.textContent ?? "";
    expect(contenu).not.toContain(String.fromCharCode(0x2014));
    expect(contenu).not.toContain(String.fromCharCode(0x2013));
  });

  it("n'affiche la colonne du coût que si le serveur la transmet, « Inconnu » pour un coût nul", async () => {
    getReception.mockResolvedValueOnce(reception([lot("l1", "Augmentin")]));
    const { unmount } = render(<DetailReceptionPage />);
    await screen.findByText("Augmentin");
    expect(screen.queryByRole("columnheader", { name: "Coût d'achat d'une boîte" })).toBeNull();
    unmount();

    getReception.mockResolvedValueOnce(
      reception([lot("l1", "Augmentin", { coutAchatBoite: 12500 }), lot("l2", "Ibuprofène", { coutAchatBoite: null })]),
    );
    render(<DetailReceptionPage />);
    await screen.findByText("Ibuprofène");
    expect(screen.getByRole("columnheader", { name: "Coût d'achat d'une boîte" })).toBeInTheDocument();
    expect(screen.getByText("Inconnu")).toBeInTheDocument();
    expect(document.body.textContent ?? "").not.toMatch(/(^|\D)0\sGNF/);
  });

  it("annonce une réception introuvable", async () => {
    getReception.mockRejectedValue(new ApiError("Cette réception est introuvable.", 404));
    render(<DetailReceptionPage />);

    expect(await screen.findByText("Cette réception est introuvable.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Retour aux réceptions" })).toHaveAttribute("href", "/dashboard/receptions");
  });

  it("corrige la date d'un lot avec un motif puis recharge le détail", async () => {
    getReception.mockResolvedValue(reception([lot("l1", "Augmentin")]));
    corrigerDateLot.mockResolvedValue({ data: {}, message: "Date du lot corrigée.", success: true });
    render(<DetailReceptionPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Corriger la date du lot AG23C777" }));
    expect(screen.getByText("Augmentin, lot AG23C777, date actuelle : 30/06/2028")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nouvelle date de péremption"), { target: { value: "10/27" } });
    expect(screen.getByText("31/10/2027")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Motif"), { target: { value: "Date relue sur la boîte" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la correction" }));

    await waitFor(() =>
      expect(corrigerDateLot).toHaveBeenCalledWith("s1", "l1", {
        dateExpiration: "2027-10-31",
        motif: "Date relue sur la boîte",
      }),
    );
    await waitFor(() => expect(getReception).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Date du lot corrigée.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("Facture fournisseur", () => {
  const complet = lot("l1", "Doliprane", {
    codeArticleFournisseur: "UBI-00123",
    codeBarres: "3400930000012",
    quantiteCommandee: 12,
    prixPublicBoite: 4500,
    codeTva: "A",
    tauxTvaPourMille: 180,
    montantHTLigne: 36000,
    colisage: 10,
    tableau: "Liste I",
    bonPreparation: "BP-55",
  });

  it("affiche l'en-tête et les lignes de la facture", async () => {
    getReception.mockResolvedValue(
      reception([complet], {
        numeroFacture: "FA-2026-0412",
        referenceCommande: "CMD-778",
        dateFacture: "2026-10-20",
        nombrePages: 3,
        montantHT: 95630,
        totalTva: 17213,
        montantTTC: 112843,
        netAPayer: 112843,
      }),
    );
    render(<DetailReceptionPage />);
    expect(await screen.findByRole("heading", { name: "Facture fournisseur" })).toBeInTheDocument();
    expect(screen.getByText("FA-2026-0412")).toBeInTheDocument();
    expect(screen.getByText("20/10/2026")).toBeInTheDocument();
    expect(screen.getByText("95 630 GNF")).toBeInTheDocument();
    expect(screen.getByText("17 213 GNF")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Lignes de la facture" })).toBeInTheDocument();
    expect(screen.getByText("UBI-00123")).toBeInTheDocument();
    expect(screen.getByText("18 %")).toBeInTheDocument();
    expect(screen.getByText("Liste I")).toBeInTheDocument();
    expect(screen.getByText("36 000 GNF")).toBeInTheDocument();
  });

  it("sans droit de voir la marge, les montants (absents) ne s'affichent pas", async () => {
    const sansMontant = { ...complet, montantHTLigne: undefined };
    getReception.mockResolvedValue(
      reception([sansMontant], { numeroFacture: "FA-2026-0412", nombrePages: 3 }),
    );
    render(<DetailReceptionPage />);
    expect(await screen.findByText("FA-2026-0412")).toBeInTheDocument();
    expect(screen.queryByText("Montant HT")).not.toBeInTheDocument();
    expect(screen.queryByText("Net à payer")).not.toBeInTheDocument();
    expect(screen.getByText("Code-barres")).toBeInTheDocument();
  });

  it("n'affiche aucune section de facture quand rien n'a été saisi", async () => {
    getReception.mockResolvedValue(reception([lot("l1", "Doliprane")]));
    render(<DetailReceptionPage />);
    await screen.findByText(/Fournisseur : UbiPharm/);
    expect(screen.queryByRole("heading", { name: "Facture fournisseur" })).not.toBeInTheDocument();
  });
});
