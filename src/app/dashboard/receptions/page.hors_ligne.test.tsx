import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ReceptionsPage from "./page";

const { listerReceptions } = vi.hoisted(() => ({ listerReceptions: vi.fn() }));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", structureId: "s1", email: "u1@exemple.com", nom: "Baldé", prenom: "Djénabou", role: "STRUCTURE_ADMIN" },
    loading: false,
    profile: null,
  }),
}));
vi.mock("@/lib/caisse/source_pharmacie_active", () => ({
  sourcePharmacie: () => ({ enLigneSeulement: false, listerReceptions }),
}));

afterEach(cleanup);

describe("Liste des réceptions sur le poste hors internet", () => {
  it("passe par la source du poste", async () => {
    listerReceptions.mockResolvedValue({
      data: {
        receptions: [
          { id: "r1", reference: "BL-1", recueLe: "2026-10-29T10:05:00.000Z", createdAt: "2026-10-29T10:06:00.000Z", auteurId: "u1", fournisseur: { id: "f1", nom: "UbiPharm" }, nombreLots: 2, quantiteTotale: 10 },
        ],
        page: 1,
        parPage: 20,
        total: 1,
      },
      message: "ok",
      success: true,
    });
    render(<ReceptionsPage />);
    await waitFor(() => expect(screen.getByText("UbiPharm")).toBeTruthy());
    expect(listerReceptions).toHaveBeenCalledWith("s1", 1);
  });
});
