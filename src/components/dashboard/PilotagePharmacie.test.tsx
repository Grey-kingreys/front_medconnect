import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api_auth";
import { getMyStock } from "@/lib/api_pharmacie";
import { getMyStructure } from "@/lib/api_structure";
import type { StatutVente, VenteResume } from "@/lib/api_ventes";
import { listerVentes } from "@/lib/api_ventes";
import { formaterGNF } from "@/lib/format_gnf";
import PilotagePharmacie, { liensPilotage, type DroitsPilotage } from "./PilotagePharmacie";

vi.mock("@/lib/api_ventes", () => ({ listerVentes: vi.fn() }));
vi.mock("@/lib/api_structure", () => ({ getMyStructure: vi.fn() }));
vi.mock("@/lib/api_pharmacie", () => ({ getMyStock: vi.fn() }));

const reponse = (data: unknown) => ({ data, message: "ok", success: true }) as never;

const DROITS: DroitsPilotage = {
  peutModifier: true,
  peutVoirEquipe: true,
  peutVoirVentes: true,
  peutAnnuler: true,
  peutVoirStock: true,
};

const vente = (id: string, statut: StatutVente): VenteResume => ({
  id,
  numero: `V-${id}`,
  createdAt: "2026-10-22T09:00:00.000Z",
  statut,
  total: 1000,
  nombreArticles: 1,
  vendeur: { id: "u1", nom: "Keita" },
  clientNom: null,
});

const journee = (surcharge: Record<string, unknown> = {}) =>
  reponse({
    date: "2026-10-22",
    totalJour: 12000,
    nombre: 10,
    page: 1,
    parPage: 50,
    totalPages: 1,
    ventes: [vente("1", "VALIDEE"), vente("2", "ANNULEE"), vente("3", "ANNULEE"), vente("4", "VALIDEE")],
    ...surcharge,
  });

const stockVide = () =>
  reponse({
    stocks: [
      {
        id: "a",
        medicamentId: "ma",
        structureId: "s1",
        quantite: 12,
        prixUnitaire: 1000,
        disponible: true,
        medicament: { id: "ma", nom: "Doliprane", categorie: "Antalgique", ordonnanceRequise: false, formes: [] },
      },
    ],
    alertes: { stockBas: [], rupture: [] },
  });

const equipe = () => reponse({ membres: [{ isActive: true }, { isActive: false }] });

const groupe = (nom: string) => within(screen.getByRole("group", { name: nom }));

const afficher = (droits: Partial<DroitsPilotage> = {}) =>
  render(<PilotagePharmacie structureId="s1" droits={{ ...DROITS, ...droits }} />);

describe("Pilotage de la pharmacie", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getMyStock).mockResolvedValue(stockVide());
    vi.mocked(getMyStructure).mockResolvedValue(equipe());
    vi.mocked(listerVentes).mockResolvedValue(journee());
  });
  afterEach(() => {
    cleanup();
  });

  it("affiche les raccourcis, les ventes, l'équipe et le stock", async () => {
    afficher();
    expect(screen.getByRole("heading", { name: "Pilotage de la pharmacie" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Modifier ma pharmacie" })).toHaveAttribute("href", "/dashboard/structure");
    expect(screen.getByRole("link", { name: "Équipe" })).toHaveAttribute("href", "/dashboard/membres");
    expect(screen.getByRole("link", { name: "Ventes du jour" })).toHaveAttribute("href", "/dashboard/ventes");
    expect(screen.getByText(/Pour annuler une vente enregistrée par erreur/)).toBeTruthy();

    await waitFor(() => expect(groupe("Encaissé aujourd'hui").getByText(/GNF/)).toBeTruthy());
    expect(screen.getByRole("group", { name: "Encaissé aujourd'hui" }).textContent).toContain(formaterGNF(12000));
    expect(groupe("Ventes enregistrées").getByText("10")).toBeTruthy();
    expect(groupe("Ventes annulées").getByText("2")).toBeTruthy();
    expect(groupe("Ventes annulées").getByText("Aujourd'hui")).toBeTruthy();
    await waitFor(() => expect(groupe("Membres actifs").getByText("1")).toBeTruthy());
    expect(groupe("Membres actifs").getByText("sur 2 membres de l'équipe")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Votre stock" })).toBeTruthy();
    await waitFor(() => expect(groupe("Médicaments disponibles").getByText("1")).toBeTruthy());
    expect(getMyStructure).toHaveBeenCalledTimes(1);
    expect(listerVentes).toHaveBeenCalledWith("s1");
  });

  it("précise que les annulées sont comptées sur les dernières ventes quand la journée a plusieurs pages", async () => {
    vi.mocked(listerVentes).mockResolvedValue(journee({ totalPages: 2 }));
    afficher();
    expect(await screen.findByText("Compté sur les 4 dernières ventes du jour")).toBeTruthy();
  });

  it("dit qu'il n'y a pas encore de vente", async () => {
    vi.mocked(listerVentes).mockResolvedValue(journee({ nombre: 0, totalJour: 0, ventes: [] }));
    afficher();
    expect(await screen.findByText("Aucune vente enregistrée aujourd'hui pour le moment.")).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Encaissé aujourd'hui" })).toBeNull();
  });

  it("garde le stock quand les ventes échouent, puis les recharge au clic sur Réessayer", async () => {
    vi.mocked(listerVentes).mockRejectedValueOnce(new Error("Hors connexion")).mockResolvedValue(journee());
    afficher();
    const alerte = await screen.findByRole("alert");
    expect(alerte.textContent).toContain("Les ventes du jour n'ont pas pu être chargées. Vérifiez votre connexion puis réessayez.");
    expect(screen.queryByRole("group", { name: "Encaissé aujourd'hui" })).toBeNull();
    await waitFor(() => expect(groupe("Médicaments disponibles").getByText("1")).toBeTruthy());

    fireEvent.click(within(alerte).getByRole("button", { name: "Réessayer" }));

    await waitFor(() => expect(groupe("Ventes enregistrées").getByText("10")).toBeTruthy());
    expect(listerVentes).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("masque les ventes sans message quand l'accès est refusé", async () => {
    vi.mocked(listerVentes).mockRejectedValue(new ApiError("Accès refusé", 403));
    afficher();
    await waitFor(() => expect(groupe("Médicaments disponibles").getByText("1")).toBeTruthy());
    expect(screen.queryByRole("group", { name: "Encaissé aujourd'hui" })).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("n'affiche pas Modifier ma pharmacie sans le droit de modification", () => {
    afficher({ peutModifier: false });
    expect(screen.queryByRole("link", { name: "Modifier ma pharmacie" })).toBeNull();
    expect(screen.getByRole("link", { name: "Équipe" })).toBeTruthy();
  });

  it("construit les raccourcis selon les droits", () => {
    expect(liensPilotage(DROITS).map((l) => l.href)).toEqual([
      "/dashboard/structure",
      "/dashboard/membres",
      "/dashboard/ventes",
    ]);
    expect(
      liensPilotage({ ...DROITS, peutModifier: false, peutVoirEquipe: false }).map((l) => l.libelle),
    ).toEqual(["Ventes du jour"]);
    expect(liensPilotage({ ...DROITS, peutModifier: false, peutVoirEquipe: false, peutVoirVentes: false })).toEqual([]);
  });
});
