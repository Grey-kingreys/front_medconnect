import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VenteResume, VentesDuJour } from "@/lib/api_ventes";
import type { PontDesktop } from "@/lib/caisse/contrat_desktop";
import VentesDuJourPage from "./page";

const { listerVentesLocal, imprimerVente } = vi.hoisted(() => ({ listerVentesLocal: vi.fn(), imprimerVente: vi.fn() }));

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
      permissions: ["vente:read", "vente:write", "caisse:utiliser"],
      structureType: "PHARMACIE",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  }),
}));

const VENTE: VenteResume = {
  id: "33333333-3333-4333-8333-333333333333",
  numero: "T1-0000012",
  createdAt: "2026-10-22T10:05:00.000Z",
  statut: "VALIDEE",
  total: 4500,
  nombreArticles: 3,
  vendeur: { id: "u1", nom: "Mariama Diallo" },
  clientNom: null,
  typePiece: "VENTE",
  numeroTicket: 12,
  jourMetier: "2026-10-22",
  venteOrigine: null,
  annulation: null,
};
const JOURNEE: VentesDuJour = { date: "2026-10-22", totalJour: 4500, nombre: 1, page: 1, parPage: 20, totalPages: 1, ventes: [VENTE] };

beforeEach(() => {
  vi.clearAllMocks();
  window.medconnecteDesktop = {
    version: "0.1.0",
    etat: vi.fn().mockResolvedValue({ horsLigne: true, enLigne: false, fileEnAttente: 1, connexionARefaire: false }),
    surEtat: vi.fn(() => () => undefined),
    caisse: { listerVentes: listerVentesLocal.mockResolvedValue({ ok: true, data: JOURNEE, message: "ok" }) },
    impression: { imprimerVente: imprimerVente.mockResolvedValue({ ok: true, data: null, message: "ok" }) },
  } as unknown as PontDesktop;
});

afterEach(() => {
  cleanup();
  delete window.medconnecteDesktop;
});

describe("Ventes du jour sur le poste, réimpression", () => {
  it("« Réimprimer » imprime directement par le pont (pas de lien vers le reçu)", async () => {
    render(<VentesDuJourPage />);
    const bouton = await screen.findByRole("button", { name: "Réimprimer le reçu T1-0000012" });
    expect(screen.queryByRole("link", { name: "Réimprimer le reçu T1-0000012" })).toBeNull();

    fireEvent.click(bouton);
    await waitFor(() => expect(imprimerVente).toHaveBeenCalledWith(VENTE.id));
    expect(await screen.findByText("Le ticket T1-0000012 a été envoyé à l'imprimante.")).toBeInTheDocument();
  });

  it("affiche le message d'échec de l'impression", async () => {
    imprimerVente.mockResolvedValue({ ok: false, status: 409, code: "IMPRIMANTE_NON_CHOISIE", message: "Aucune imprimante n'est choisie pour ce poste." });
    render(<VentesDuJourPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Réimprimer le reçu T1-0000012" }));

    expect(await screen.findByText("Aucune imprimante n'est choisie pour ce poste.")).toBeInTheDocument();
  });
});
