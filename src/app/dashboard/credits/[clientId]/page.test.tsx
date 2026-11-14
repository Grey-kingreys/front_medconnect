import { Suspense } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FicheClientCredit } from "@/lib/api_credit";
import FicheClientCreditPage from "./page";

const { getFicheClientCredit, modifierClientCredit, modifierDateLimitePrise, enregistrerRemboursement, etatCaisse } = vi.hoisted(() => ({
  getFicheClientCredit: vi.fn(),
  modifierClientCredit: vi.fn(),
  modifierDateLimitePrise: vi.fn(),
  enregistrerRemboursement: vi.fn(),
  etatCaisse: vi.fn(),
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
  getFicheClientCredit,
  modifierClientCredit,
  modifierDateLimitePrise,
  enregistrerRemboursement,
}));
vi.mock("@/lib/caisse/source_active", () => ({ sourceCaisse: () => ({ etatCaisse }) }));

const fiche = (surcharge: Partial<FicheClientCredit> = {}): FicheClientCredit => ({
  id: "c1",
  nomComplet: "Mamadou Bah",
  telephone: "620 00 00 01",
  note: "Voisin",
  createdAt: "2026-11-01T09:00:00.000Z",
  resteAPayer: 30000,
  totalPris: 45000,
  totalRembourse: 15000,
  statut: "EN_COURS",
  dateLimite: "2026-12-01",
  prises: [
    {
      venteId: "v1",
      numero: "V-0001",
      createdAt: "2026-11-10T09:00:00.000Z",
      jourMetier: "2026-11-10",
      vendeurNom: "Mariama Diallo",
      total: 45000,
      resteSurPrise: 30000,
      soldee: false,
      annulee: false,
      motifAnnulation: null,
      dateLimite: "2026-12-01",
      lignes: [{ nomMedicament: "Paracétamol", quantite: 2, nombreAffiche: 2, uniteAffichee: "BOITE", sousTotal: 45000 }],
    },
    {
      venteId: "v0",
      numero: "V-0000",
      createdAt: "2026-11-02T09:00:00.000Z",
      jourMetier: "2026-11-02",
      vendeurNom: "Mariama Diallo",
      total: 9000,
      resteSurPrise: 0,
      soldee: false,
      annulee: true,
      motifAnnulation: "Erreur",
      dateLimite: null,
      lignes: [{ nomMedicament: "Vitamine C", quantite: 1, nombreAffiche: 1, uniteAffichee: "BOITE", sousTotal: 9000 }],
    },
  ],
  remboursements: [
    { id: "r1", montant: 15000, note: "Premier versement", verseEnCaisse: true, auteurNom: "Mariama Diallo", createdAt: "2026-11-11T09:00:00.000Z" },
    { id: "r2", montant: 0, note: null, verseEnCaisse: false, auteurNom: "Mariama Diallo", createdAt: "2026-11-12T09:00:00.000Z" },
  ],
  ...surcharge,
});

const afficher = async () => {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <FicheClientCreditPage params={Promise.resolve({ clientId: "c1" })} />
      </Suspense>,
    );
  });
};

describe("fiche d'un client de crédit", () => {
  beforeEach(() => {
    [getFicheClientCredit, modifierClientCredit, modifierDateLimitePrise, enregistrerRemboursement, etatCaisse].forEach((m) => m.mockReset());
    etatCaisse.mockResolvedValue({ poste: {}, session: null });
  });
  afterEach(cleanup);

  it("affiche le reste à payer, l'historique des prises et des remboursements", async () => {
    getFicheClientCredit.mockResolvedValue({ data: fiche() });
    await afficher();
    expect(await screen.findByRole("heading", { name: "Mamadou Bah" })).toBeTruthy();
    expect(screen.getByLabelText("Reste à payer").textContent).toMatch(/30\s000\sGNF/);
    expect(screen.getByText("En cours")).toBeTruthy();
    expect(screen.getByText("Annulée")).toBeTruthy();
    expect(screen.getByText(/2 boîte\(s\) Paracétamol/)).toBeTruthy();
    expect(screen.getByText("Versé en caisse, enregistré par Mariama Diallo")).toBeTruthy();
    expect(screen.getByText("Premier versement")).toBeTruthy();
  });

  it("modifie la date limite d'une prise", async () => {
    getFicheClientCredit.mockResolvedValue({ data: fiche() });
    modifierDateLimitePrise.mockResolvedValue({ data: fiche({ dateLimite: "2026-12-20" }) });
    await afficher();
    fireEvent.click(await screen.findByRole("button", { name: "Modifier la date limite" }));
    fireEvent.change(screen.getByLabelText("Date limite"), { target: { value: "2026-12-20" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la date" }));
    await waitFor(() => expect(modifierDateLimitePrise).toHaveBeenCalledWith("p1", "v1", "2026-12-20"));
  });

  it("modifie le nom, le téléphone (lettres bloquées) et la note", async () => {
    getFicheClientCredit.mockResolvedValue({ data: fiche() });
    modifierClientCredit.mockResolvedValue({ data: fiche({ nomComplet: "Mamadou Barry" }) });
    await afficher();
    fireEvent.click(await screen.findByRole("button", { name: /Modifier$/ }));
    fireEvent.change(screen.getByLabelText("Nom complet"), { target: { value: "Mamadou Barry" } });
    const tel = screen.getByLabelText(/Téléphone/) as HTMLInputElement;
    fireEvent.change(tel, { target: { value: "62a0 00 00 02" } });
    expect(tel.value).toBe("620 00 00 02");
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() =>
      expect(modifierClientCredit).toHaveBeenCalledWith("p1", "c1", { nomComplet: "Mamadou Barry", telephone: "620 00 00 02", note: "Voisin" }),
    );
  });

  it("le remboursement qui solde la dette l'annonce et recharge la fiche en Soldé", async () => {
    getFicheClientCredit.mockResolvedValueOnce({ data: fiche() }).mockResolvedValue({
      data: fiche({ resteAPayer: 0, statut: "SOLDE", prises: [] }),
    });
    enregistrerRemboursement.mockResolvedValue({
      data: { remboursement: {}, resteAPayer: 0, statut: "SOLDE" },
      message: "Remboursement enregistré : le crédit est soldé.",
    });
    await afficher();
    fireEvent.click((await screen.findAllByRole("button", { name: /Enregistrer un remboursement/ }))[0]);
    const dialogue = await screen.findByRole("dialog");
    // Pas de caisse ouverte : la case n'existe pas.
    expect(within(dialogue).queryByLabelText("Mettre cet argent dans ma caisse")).toBeNull();
    expect(dialogue.textContent).toMatch(/30\s000\sGNF/);
    fireEvent.change(within(dialogue).getByLabelText(/Montant remboursé/), { target: { value: "30000" } });
    fireEvent.click(within(dialogue).getByRole("button", { name: "Valider le remboursement" }));
    await waitFor(() => expect(enregistrerRemboursement).toHaveBeenCalledWith("p1", "c1", { montant: 30000, verseEnCaisse: false }));
    expect(await screen.findByText("Soldé")).toBeTruthy();
    expect(screen.getByText(/le crédit est soldé/)).toBeTruthy();
  });
});
