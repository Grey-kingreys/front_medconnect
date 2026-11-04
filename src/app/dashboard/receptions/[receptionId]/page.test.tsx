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
