import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientCreditResume, ListeCredits } from "@/lib/api_credit";
import CreditsPage from "./page";

const { listerCredits, etatCaisse, enregistrerRemboursement } = vi.hoisted(() => ({
  listerCredits: vi.fn(),
  etatCaisse: vi.fn(),
  enregistrerRemboursement: vi.fn(),
}));

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
      permissions: ["credit:read", "credit:write"],
      structureType: "PHARMACIE",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  }),
}));
vi.mock("@/lib/api_credit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api_credit")>()),
  listerCredits,
  enregistrerRemboursement,
}));
vi.mock("@/lib/caisse/source_active", () => ({ sourceCaisse: () => ({ etatCaisse }) }));

const client = (surcharge: Partial<ClientCreditResume> = {}): ClientCreditResume => ({
  id: "c1",
  nomComplet: "Mamadou Bah",
  telephone: "620 00 00 01",
  resteAPayer: 45000,
  statut: "EN_COURS",
  dernierePrise: "2026-11-10T09:00:00.000Z",
  resume: "Paracétamol et Amoxicilline",
  dateLimite: "2026-12-01",
  nombrePrises: 1,
  ...surcharge,
});
const liste = (clients: ClientCreditResume[]): { data: ListeCredits } => ({
  data: { clients, total: clients.length, page: 1, parPage: 200, totalPages: 1, resteTotal: 45000 },
});

describe("page Cahier de crédit", () => {
  beforeEach(() => {
    listerCredits.mockReset();
    etatCaisse.mockReset();
    enregistrerRemboursement.mockReset();
    etatCaisse.mockResolvedValue({ poste: {}, session: null });
  });
  afterEach(cleanup);

  it("affiche le tableau avec un lien vers la fiche et le statut", async () => {
    listerCredits.mockResolvedValue(liste([client(), client({ id: "c2", nomComplet: "Aïssatou Diallo", statut: "EN_RETARD" })]));
    render(<CreditsPage />);
    const lien = await screen.findByRole("link", { name: "Mamadou Bah" });
    expect(lien.getAttribute("href")).toBe("/dashboard/credits/c1");
    const lignes = screen.getAllByRole("row");
    expect(within(lignes[1]).getByText("En cours")).toBeTruthy();
    expect(within(lignes[2]).getByText("En retard")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Cahier de crédit" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Nouveau crédit/ }).getAttribute("href")).toBe("/dashboard/credits/nouveau");
  });

  it("guide l'utilisateur quand le cahier est vide", async () => {
    listerCredits.mockResolvedValue(liste([]));
    render(<CreditsPage />);
    expect(await screen.findByText(/Aucun crédit pour le moment\. Cliquez sur Nouveau crédit/)).toBeTruthy();
  });

  it("filtre par statut et par recherche en appelant l'API", async () => {
    listerCredits.mockResolvedValue(liste([client()]));
    render(<CreditsPage />);
    await screen.findByText("Mamadou Bah");
    fireEvent.click(screen.getByRole("button", { name: "En retard" }));
    await waitFor(() => expect(listerCredits).toHaveBeenLastCalledWith("p1", expect.objectContaining({ statut: "EN_RETARD" })));
    fireEvent.change(screen.getByLabelText("Rechercher un client"), { target: { value: "bah" } });
    await waitFor(() => expect(listerCredits).toHaveBeenLastCalledWith("p1", expect.objectContaining({ q: "bah", statut: "EN_RETARD" })));
    expect(screen.getByRole("button", { name: "En retard" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("le bouton rapide ouvre le remboursement avec choix du client, caisse non cochée et cachée sans caisse ouverte", async () => {
    listerCredits.mockResolvedValue(liste([client(), client({ id: "c3", nomComplet: "Soldé Test", statut: "SOLDE", resteAPayer: 0 })]));
    render(<CreditsPage />);
    await screen.findByText("Mamadou Bah");
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer un remboursement/ }));
    const dialogue = await screen.findByRole("dialog");
    // Le client soldé n'est pas proposé.
    const choix = await within(dialogue).findByRole("button", { name: /Mamadou Bah/ });
    expect(within(dialogue).queryByText("Soldé Test")).toBeNull();
    fireEvent.click(choix);
    expect(within(dialogue).queryByLabelText("Mettre cet argent dans ma caisse")).toBeNull();
  });

  it("propose la case caisse, décochée par défaut, quand une caisse est ouverte, et refuse un montant au-dessus du reste", async () => {
    etatCaisse.mockResolvedValue({ poste: {}, session: { id: "s1" } });
    listerCredits.mockResolvedValue(liste([client()]));
    enregistrerRemboursement.mockResolvedValue({
      data: { remboursement: {}, resteAPayer: 0, statut: "SOLDE" },
      message: "Remboursement enregistré : le crédit est soldé.",
    });
    render(<CreditsPage />);
    await screen.findByText("Mamadou Bah");
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer un remboursement/ }));
    const dialogue = await screen.findByRole("dialog");
    fireEvent.click(await within(dialogue).findByRole("button", { name: /Mamadou Bah/ }));
    const caisse = (await within(dialogue).findByLabelText("Mettre cet argent dans ma caisse")) as HTMLInputElement;
    expect(caisse.checked).toBe(false);

    const montant = within(dialogue).getByLabelText(/Montant remboursé/) as HTMLInputElement;
    fireEvent.change(montant, { target: { value: "abc50000" } });
    expect(montant.value).toBe("50000");
    expect(within(dialogue).getByRole("alert").textContent).toMatch(/Le montant dépasse ce que le client doit/);
    expect((within(dialogue).getByRole("button", { name: "Valider le remboursement" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(montant, { target: { value: "45000" } });
    fireEvent.click(within(dialogue).getByRole("button", { name: "Valider le remboursement" }));
    await waitFor(() =>
      expect(enregistrerRemboursement).toHaveBeenCalledWith("p1", "c1", { montant: 45000, verseEnCaisse: false }),
    );
    expect(await screen.findByText(/le crédit est soldé/)).toBeTruthy();
  });
});
