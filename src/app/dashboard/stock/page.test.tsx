import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMyStock } from "@/lib/api_pharmacie";
import StockPage from "./page";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "p1", role: "PHARMACIEN", structureId: "s1", email: "p@exemple.com", nom: "Bah", prenom: "Ali" },
  }),
}));
vi.mock("@/lib/api_pharmacie", () => ({
  getMyStock: vi.fn(),
  removeStockItem: vi.fn(),
  updateStockQuantite: vi.fn(),
}));
vi.mock("@/components/modals/ImportStockModal", () => ({
  default: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>Fenêtre d&apos;import ouverte</div> : null),
}));
vi.mock("@/components/modals/StockModal", () => ({ default: () => null }));
vi.mock("@/components/modals/DeleteConfirmModal", () => ({ DeleteConfirmModal: () => null }));

describe("Page du stock", () => {
  beforeEach(() => {
    vi.mocked(getMyStock).mockResolvedValue({
      data: { stocks: [], alertes: { stockBas: [], rupture: [] } },
      message: "ok",
      success: true,
    } as never);
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.history.replaceState(null, "", "/");
  });

  it("ouvre la fenêtre d'import quand l'adresse le demande, puis nettoie l'adresse", async () => {
    window.history.replaceState(null, "", "/dashboard/stock?importer=1");
    render(<StockPage />);
    expect(await screen.findByText("Fenêtre d'import ouverte")).toBeTruthy();
    expect(window.location.search).toBe("");
  });

  it("n'ouvre pas la fenêtre d'import sans cette demande", async () => {
    window.history.replaceState(null, "", "/dashboard/stock");
    render(<StockPage />);
    await waitFor(() => expect(getMyStock).toHaveBeenCalled());
    expect(await screen.findByText("Importer depuis Excel")).toBeTruthy();
    expect(screen.queryByText("Fenêtre d'import ouverte")).toBeNull();
  });
});
