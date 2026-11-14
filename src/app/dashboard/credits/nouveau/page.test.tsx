import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api_auth";
import type { StockMedicament } from "@/lib/api_pharmacie";
import NouveauCreditPage from "./page";
import { corpsCredit } from "./corps_credit";
import { PANIER_VIDE } from "../../vente/panier";

const { listerCredits, creerVente, chargerStock, push } = vi.hoisted(() => ({
  listerCredits: vi.fn(),
  creerVente: vi.fn(),
  chargerStock: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
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
      permissions: ["credit:read", "credit:write", "vente:write", "caisse:utiliser"],
      structureType: "PHARMACIE",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  }),
}));
vi.mock("@/lib/api_credit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api_credit")>()),
  listerCredits,
}));
vi.mock("@/lib/api_ventes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api_ventes")>()),
  creerVente,
}));
vi.mock("@/lib/caisse/source_active", () => ({ sourceCaisse: () => ({ chargerStock }) }));

const stock = (id: string, nom: string): StockMedicament => ({
  id,
  medicamentId: `m-${id}`,
  medicament: { id: `m-${id}`, nom, categorie: "Divers", ordonnanceRequise: false, formes: [] },
  structureId: "p1",
  quantite: 10,
  prixUnitaire: 1500,
  disponible: true,
});

describe("nouveau crédit", () => {
  beforeEach(() => {
    [listerCredits, creerVente, chargerStock, push].forEach((m) => m.mockReset());
    chargerStock.mockResolvedValue([stock("s1", "Paracétamol")]);
    listerCredits.mockResolvedValue({
      data: {
        clients: [
          { id: "c1", nomComplet: "Mamadou Bah", telephone: null, resteAPayer: 0, statut: "SOLDE", dernierePrise: null, resume: "", dateLimite: null, nombrePrises: 0 },
        ],
        total: 1,
        page: 1,
        parPage: 10,
        totalPages: 1,
        resteTotal: 0,
      },
    });
  });
  afterEach(cleanup);

  it("enregistre un crédit pour un client existant avec la date limite", async () => {
    creerVente.mockResolvedValue({ data: { clientCreditId: "c1" }, message: "ok" });
    render(<NouveauCreditPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Ajouter Paracétamol" }));
    fireEvent.click(await screen.findByRole("button", { name: /Mamadou Bah/ }));
    fireEvent.change(screen.getByLabelText(/Date limite/), { target: { value: "2099-01-31" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le crédit" }));
    await waitFor(() => expect(creerVente).toHaveBeenCalledTimes(1));
    const [structureId, corps] = creerVente.mock.calls[0];
    expect(structureId).toBe("p1");
    expect(corps).toEqual({
      lignes: [{ stockId: "s1", quantite: 1, unite: "BOITE" }],
      clientCreditId: "c1",
      dateLimiteCredit: "2099-01-31",
    });
    expect(corps.paiements).toBeUndefined();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard/credits/c1"));
  });

  it("enregistre un crédit pour un nouveau client (téléphone sans lettres)", async () => {
    creerVente.mockResolvedValue({ data: { clientCreditId: "c9" }, message: "ok" });
    render(<NouveauCreditPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Ajouter Paracétamol" }));
    fireEvent.click(screen.getByRole("button", { name: "Nouveau client" }));
    fireEvent.change(screen.getByLabelText("Nom complet"), { target: { value: "Fatoumata Camara" } });
    const tel = screen.getByLabelText(/Téléphone/) as HTMLInputElement;
    fireEvent.change(tel, { target: { value: "6a20 00 00 05" } });
    expect(tel.value).toBe("620 00 00 05");
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le crédit" }));
    await waitFor(() => expect(creerVente).toHaveBeenCalledTimes(1));
    expect(creerVente.mock.calls[0][1]).toEqual({
      lignes: [{ stockId: "s1", quantite: 1, unite: "BOITE" }],
      nouveauClientCredit: { nomComplet: "Fatoumata Camara", telephone: "620 00 00 05" },
    });
  });

  it("envoie la confirmation d'ordonnance pour un médicament sur ordonnance", async () => {
    const augmentin = stock("s2", "Augmentin");
    augmentin.medicament.ordonnanceRequise = true;
    chargerStock.mockResolvedValue([augmentin]);
    creerVente.mockResolvedValue({ data: { clientCreditId: "c1" }, message: "ok" });
    render(<NouveauCreditPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Ajouter Augmentin" }));
    fireEvent.click(await screen.findByRole("button", { name: /Mamadou Bah/ }));
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le crédit" }));
    expect(creerVente).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox", { name: /J'ai vu l'ordonnance/ }));
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le crédit" }));
    await waitFor(() => expect(creerVente).toHaveBeenCalledTimes(1));
    expect(creerVente.mock.calls[0][1]).toMatchObject({ clientCreditId: "c1", ordonnanceVerifiee: true });
  });

  it("refuse sans client ni médicament, sans appeler l'API", async () => {
    render(<NouveauCreditPage />);
    await screen.findByRole("button", { name: "Ajouter Paracétamol" });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le crédit" }));
    expect(await screen.findByText(/Choisissez le client dans la liste/)).toBeTruthy();
    expect(screen.getByText("Ajoutez au moins un médicament.")).toBeTruthy();
    expect(creerVente).not.toHaveBeenCalled();
  });

  it("montre le message du serveur et le lien vers Ma caisse quand la caisse bloque", async () => {
    creerVente.mockRejectedValue(
      new ApiError("La journée est clôturée.", 409, { code: "JOURNEE_CLOTUREE", message: "La journée est clôturée." }),
    );
    render(<NouveauCreditPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Ajouter Paracétamol" }));
    fireEvent.click(await screen.findByRole("button", { name: /Mamadou Bah/ }));
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le crédit" }));
    expect(await screen.findByText("La journée est clôturée.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Aller à Ma caisse" }).getAttribute("href")).toBe("/dashboard/caisse");
  });
});

describe("corpsCredit", () => {
  it("n'envoie ni paiements ni client de vente ordinaire", () => {
    const corps = corpsCredit(
      { ...PANIER_VIDE, clientNom: "X", lignes: [{ stockId: "s1", unite: "UNITE", nombre: 3 }] },
      false,
      { genre: "existant", id: "c1" },
      "",
    );
    expect(corps).toEqual({ lignes: [{ stockId: "s1", quantite: 3, unite: "UNITE" }], clientCreditId: "c1" });
  });
});
