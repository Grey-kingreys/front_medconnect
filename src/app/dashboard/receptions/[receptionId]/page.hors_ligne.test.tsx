import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Reception } from "@/lib/api_pharmacie";
import DetailReceptionPage from "./page";

const { lireReception, chargerStock } = vi.hoisted(() => ({ lireReception: vi.fn(), chargerStock: vi.fn() }));

vi.mock("next/navigation", () => ({ useParams: () => ({ receptionId: "r1" }) }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", structureId: "s1", email: "u1@exemple.com", nom: "Baldé", prenom: "Djénabou", role: "STRUCTURE_ADMIN" },
    loading: false,
    profile: null,
  }),
}));
vi.mock("@/lib/caisse/source_pharmacie_active", () => ({
  sourcePharmacie: () => ({ enLigneSeulement: false, lireReception, chargerStock }),
}));

const reception: Reception = {
  id: "r1",
  reference: "BL-1",
  recueLe: "2026-10-29T10:05:00.000Z",
  createdAt: "2026-10-29T10:06:00.000Z",
  auteurId: "u1",
  numeroFacture: "FAC-1",
  fournisseur: { id: "f1", nom: "UbiPharm" },
  lots: [
    { id: "l1", stockId: "st1", nom: "Augmentin", numeroLot: "A1", dateExpiration: "2028-06-30", quantiteRecue: 40, coefficientReception: 20, solde: 26 },
  ],
  resolutions: [],
};

afterEach(cleanup);

describe("Détail d'une réception sur le poste hors internet", () => {
  it("lit la réception par la source locale, explique l'absence de montants et ne propose pas la correction de date", async () => {
    lireReception.mockResolvedValue({ data: reception, message: "ok", success: true });
    chargerStock.mockResolvedValue([{ id: "st1", uniteMinimale: "COMPRIME" }]);
    render(<DetailReceptionPage />);
    await waitFor(() => expect(screen.getByText("Augmentin")).toBeTruthy());
    expect(lireReception).toHaveBeenCalledWith("s1", "r1");
    expect(screen.getByText("Les montants de la facture s'affichent avec internet.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Corriger la date/ })).toBeNull();
    expect(screen.getAllByText("Cette action demande une connexion.").length).toBeGreaterThan(0);
  });
});
