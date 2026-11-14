import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api_auth";
import type { PageReceptions } from "@/lib/api_pharmacie";
import ReceptionsPage from "./page";

const { listerReceptions } = vi.hoisted(() => ({ listerReceptions: vi.fn() }));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", structureId: "p1", email: "u1@exemple.com", nom: "Baldé", prenom: "Djénabou", role: "STRUCTURE_ADMIN" },
    loading: false,
    profile: null,
  }),
}));
vi.mock("@/lib/api_pharmacie", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api_pharmacie")>()),
  listerReceptions,
}));

const page = (surcharge: Partial<PageReceptions> = {}) => ({
  data: {
    receptions: [
      {
        id: "r1",
        reference: "BL-BON-0087",
        recueLe: "2026-10-29T10:05:00.000Z",
        createdAt: "2026-10-29T10:06:00.000Z",
        auteurId: "u1",
        fournisseur: { id: "f1", nom: "UbiPharm" },
        nombreLots: 4,
        quantiteTotale: 120,
      },
      {
        id: "r2",
        reference: null,
        recueLe: "2026-10-12T09:00:00.000Z",
        createdAt: "2026-10-12T09:01:00.000Z",
        auteurId: "u1",
        fournisseur: null,
        nombreLots: 1,
        quantiteTotale: 10,
      },
    ],
    page: 1,
    parPage: 20,
    total: 2,
    ...surcharge,
  } as PageReceptions,
  message: "ok",
  success: true,
});

beforeEach(() => {
  vi.clearAllMocks();
  listerReceptions.mockResolvedValue(page());
});

afterEach(cleanup);

describe("Réceptions, liste", () => {
  it("affiche chaque livraison avec son lien", async () => {
    render(<ReceptionsPage />);

    expect(await screen.findByText("BL-BON-0087")).toBeInTheDocument();
    expect(listerReceptions).toHaveBeenCalledWith("p1", 1);
    expect(screen.getByText("UbiPharm")).toBeInTheDocument();
    expect(screen.getAllByText("Non renseigné")).toHaveLength(2);
    const adresses = screen.getAllByRole("link").map((l) => l.getAttribute("href"));
    expect(adresses).toContain("/dashboard/receptions/r1");
    expect(adresses).toContain("/dashboard/receptions/r2");
    expect(adresses).toContain("/dashboard/receptions/nouvelle");
    const contenu = document.body.textContent ?? "";
    expect(contenu).not.toContain(String.fromCharCode(0x2014));
    expect(contenu).not.toContain(String.fromCharCode(0x2013));
  });

  it("guide vers la première réception quand la liste est vide", async () => {
    listerReceptions.mockResolvedValue(page({ receptions: [], total: 0 }));
    render(<ReceptionsPage />);

    expect(
      await screen.findByText("Aucune réception enregistrée. Enregistrez votre première livraison avec « Nouvelle réception »."),
    ).toBeInTheDocument();
  });

  it("propose de réessayer après une erreur", async () => {
    listerReceptions.mockRejectedValueOnce(new ApiError("boom", 503));
    render(<ReceptionsPage />);

    expect(
      await screen.findByText("Les réceptions n'ont pas pu être chargées. Vérifiez votre connexion puis réessayez."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));

    expect(await screen.findByText("BL-BON-0087")).toBeInTheDocument();
    expect(listerReceptions).toHaveBeenCalledTimes(2);
  });
});
