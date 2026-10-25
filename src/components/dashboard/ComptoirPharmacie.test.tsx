import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api_auth";
import { getMyStock } from "@/lib/api_pharmacie";
import { getMyStructure } from "@/lib/api_structure";
import type { StatutVente, VenteResume } from "@/lib/api_ventes";
import { listerVentes } from "@/lib/api_ventes";
import { formaterGNF } from "@/lib/format_gnf";
import ComptoirPharmacie, { liensComptoir, type DroitsComptoir } from "./ComptoirPharmacie";

vi.mock("@/lib/api_ventes", () => ({ listerVentes: vi.fn() }));
vi.mock("@/lib/api_structure", () => ({ getMyStructure: vi.fn() }));
vi.mock("@/lib/api_pharmacie", () => ({ getMyStock: vi.fn() }));

const reponse = (data: unknown) => ({ data, message: "ok", success: true }) as never;

const DROITS: DroitsComptoir = {
  peutVendre: true,
  peutVoirVentes: true,
  peutVoirOrdonnances: true,
  peutVoirStock: true,
  peutVoirEquipe: false,
};

const vente = (id: string, vendeurId: string, statut: StatutVente, total: number): VenteResume => ({
  id,
  numero: `V-${id}`,
  createdAt: "2026-10-22T09:00:00.000Z",
  statut,
  total,
  nombreArticles: 1,
  vendeur: { id: vendeurId, nom: vendeurId },
  clientNom: null,
});

const journee = (ventes: VenteResume[], totalPages = 1) =>
  reponse({ date: "2026-10-22", totalJour: 99999, nombre: ventes.length, page: 1, parPage: 50, totalPages, ventes });

const VENTES = [
  vente("1", "u1", "VALIDEE", 3000),
  vente("2", "u1", "VALIDEE", 4500),
  vente("3", "u1", "ANNULEE", 800),
  vente("4", "u2", "VALIDEE", 7777),
];

const stock = () =>
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

const groupe = (nom: string) => within(screen.getByRole("group", { name: nom }));

const afficher = (droits: Partial<DroitsComptoir> = {}) =>
  render(<ComptoirPharmacie structureId="s1" utilisateurId="u1" droits={{ ...DROITS, ...droits }} />);

describe("Comptoir de la pharmacie", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getMyStock).mockResolvedValue(stock());
    vi.mocked(getMyStructure).mockResolvedValue(reponse({ membres: [] }));
    vi.mocked(listerVentes).mockResolvedValue(journee(VENTES));
  });
  afterEach(() => {
    cleanup();
  });

  it("met Nouvelle vente en premier, puis les ordonnances", () => {
    afficher();
    const liens = screen.getAllByRole("link");
    expect(liens[0]).toHaveAccessibleName("Nouvelle vente");
    expect(liens[0]).toHaveAttribute("href", "/dashboard/vente");
    expect(screen.getByRole("link", { name: "Ordonnances reçues" })).toHaveAttribute("href", "/dashboard/ordonnances");
  });

  it("ne compte que les ventes du vendeur connecté", async () => {
    afficher();
    await waitFor(() => expect(groupe("Mes ventes").getByText("2")).toBeTruthy());
    expect(screen.getByRole("group", { name: "Montant de mes ventes" }).textContent).toContain(formaterGNF(7500));
    expect(groupe("Mes ventes").getByText("1 vente annulée, non comptée")).toBeTruthy();
    expect(document.body.textContent).not.toContain(formaterGNF(7777));
    expect(document.body.textContent).not.toContain(formaterGNF(99999));
    expect(screen.queryByText("Pilotage de la pharmacie")).toBeNull();
    expect(screen.getByRole("heading", { name: "Au comptoir" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Votre stock" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Voir toutes les ventes du jour/ })).toHaveAttribute("href", "/dashboard/ventes");
  });

  it("précise sur combien de ventes le calcul est fait quand la journée a plusieurs pages", async () => {
    vi.mocked(listerVentes).mockResolvedValue(journee(VENTES, 2));
    afficher();
    expect(await screen.findByText("Calculé sur les 4 dernières ventes de la pharmacie.")).toBeTruthy();
  });

  it("dit au vendeur qu'il n'a encore rien vendu", async () => {
    vi.mocked(listerVentes).mockResolvedValue(journee([vente("4", "u2", "VALIDEE", 7777)]));
    afficher();
    expect(await screen.findByText("Vous n'avez encore enregistré aucune vente aujourd'hui.")).toBeTruthy();
  });

  it("garde le stock quand les ventes échouent, puis les recharge au clic sur Réessayer", async () => {
    vi.mocked(listerVentes).mockRejectedValueOnce(new Error("Hors connexion")).mockResolvedValue(journee(VENTES));
    afficher();
    const alerte = await screen.findByRole("alert");
    expect(alerte.textContent).toContain("Vos ventes du jour n'ont pas pu être chargées. Vérifiez votre connexion puis réessayez.");
    await waitFor(() => expect(groupe("Médicaments disponibles").getByText("1")).toBeTruthy());

    fireEvent.click(within(alerte).getByRole("button", { name: "Réessayer" }));

    await waitFor(() => expect(groupe("Mes ventes").getByText("2")).toBeTruthy());
    expect(listerVentes).toHaveBeenCalledTimes(2);
  });

  it("masque les ventes sans message quand l'accès est refusé", async () => {
    vi.mocked(listerVentes).mockRejectedValue(new ApiError("Accès refusé", 403));
    afficher();
    await waitFor(() => expect(groupe("Médicaments disponibles").getByText("1")).toBeTruthy());
    expect(screen.queryByText("Mes ventes du jour")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("n'affiche pas Nouvelle vente sans le droit de vendre", () => {
    afficher({ peutVendre: false });
    expect(screen.queryByRole("link", { name: "Nouvelle vente" })).toBeNull();
  });

  it("construit les raccourcis selon les droits", () => {
    expect(liensComptoir(DROITS).map((l) => l.libelle)).toEqual([
      "Nouvelle vente",
      "Ordonnances reçues",
      "Voir toutes les ventes du jour",
    ]);
    expect(liensComptoir({ ...DROITS, peutVendre: false, peutVoirVentes: false }).map((l) => l.href)).toEqual([
      "/dashboard/ordonnances",
    ]);
  });
});
