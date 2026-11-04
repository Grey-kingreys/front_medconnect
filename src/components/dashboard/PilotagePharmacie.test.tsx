import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api_auth";
import { getMyStock } from "@/lib/api_pharmacie";
import { getAlertesPeremption, getRapportMarge, listerAnomalies } from "@/lib/api_pilotage";
import { getMyStructure } from "@/lib/api_structure";
import type { StatutVente, VenteResume } from "@/lib/api_ventes";
import { listerVentes } from "@/lib/api_ventes";
import { formaterGNF } from "@/lib/format_gnf";
import PilotagePharmacie, { liensPilotage, type DroitsPilotage } from "./PilotagePharmacie";

vi.mock("@/lib/api_ventes", () => ({ listerVentes: vi.fn() }));
vi.mock("@/lib/api_structure", () => ({ getMyStructure: vi.fn() }));
vi.mock("@/lib/api_pharmacie", () => ({ getMyStock: vi.fn() }));
vi.mock("@/lib/api_pilotage", () => ({ listerAnomalies: vi.fn(), getAlertesPeremption: vi.fn(), getRapportMarge: vi.fn() }));

const reponse = (data: unknown) => ({ data, message: "ok", success: true }) as never;

const DROITS: DroitsPilotage = {
  peutModifier: true,
  peutVoirEquipe: true,
  peutVoirVentes: true,
  peutAnnuler: true,
  peutVoirStock: true,
  peutVoirAnomalies: false,
  peutVoirMarge: false,
};

const alertesVides = () =>
  reponse({
    jour: "2026-11-03",
    horizons: [],
    perimes: { nombreLots: 0, valeurVente: null, nombreLotsSansPrix: 0, lots: [] },
    sansDate: { nombreLots: 0 },
  });

const rapportVide = () =>
  reponse({
    du: "2026-11-01",
    au: "2026-11-03",
    debutFiabilite: null,
    periodeAvantFiabilite: false,
    nombrePieces: 0,
    chiffreAffairesTotal: 0,
    chiffreAffairesValorise: 0,
    coutAlloue: 0,
    marge: 0,
    nonValorisable: { nombreVentes: 0, chiffreAffaires: 0 },
    provisoires: { nombreLignes: 0, chiffreAffaires: 0 },
  });

const vente = (id: string, statut: StatutVente): VenteResume => ({
  id,
  numero: `V-${id}`,
  createdAt: "2026-10-22T09:00:00.000Z",
  statut,
  total: 1000,
  nombreArticles: 1,
  vendeur: { id: "u1", nom: "Keita" },
  clientNom: null,
  typePiece: "VENTE",
  numeroTicket: Number(id),
  jourMetier: "2026-10-22",
  venteOrigine: null,
  annulation: null,
});

/** Pièce d'annulation du jour : total négatif, sans numéro de ticket. */
const pieceAnnulation = (id: string): VenteResume => ({
  ...vente(id, "VALIDEE"),
  numero: `A-V-${id}`,
  total: -1000,
  typePiece: "ANNULATION",
  numeroTicket: null,
  venteOrigine: { id: "origine", numero: "V-0" },
});

const journee = (surcharge: Record<string, unknown> = {}) =>
  reponse({
    date: "2026-10-22",
    totalJour: 12000,
    nombre: 10,
    page: 1,
    parPage: 50,
    totalPages: 1,
    ventes: [vente("1", "VALIDEE"), pieceAnnulation("2"), pieceAnnulation("3"), vente("4", "VALIDEE")],
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
    vi.mocked(getAlertesPeremption).mockResolvedValue(alertesVides());
    vi.mocked(getRapportMarge).mockResolvedValue(rapportVide());
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

  it("affiche la carte Anomalies à traiter avec un lien vers la file", async () => {
    vi.mocked(listerAnomalies).mockResolvedValue(reponse({ anomalies: [], page: 1, parPage: 20, total: 4, ouvertes: 4 }));
    afficher({ peutVoirAnomalies: true });
    await waitFor(() => expect(groupe("Anomalies à traiter").getByText("4")).toBeTruthy());
    expect(groupe("Anomalies à traiter").getByText("Ouvrez la file pour les traiter")).toBeTruthy();
    const liens = screen.getAllByRole("link").filter((l) => l.getAttribute("href") === "/dashboard/anomalies");
    expect(liens.length).toBeGreaterThanOrEqual(1);
    expect(listerAnomalies).toHaveBeenCalledWith("s1");
  });

  it("n'affiche pas la carte des anomalies sans le droit", () => {
    afficher();
    expect(screen.queryByRole("group", { name: "Anomalies à traiter" })).toBeNull();
    expect(listerAnomalies).not.toHaveBeenCalled();
  });

  it("n'affiche pas le bloc Marge et ne demande rien au serveur sans marge:read", async () => {
    afficher({ peutVoirMarge: false });
    await waitFor(() => expect(groupe("Médicaments disponibles").getByText("1")).toBeTruthy());
    expect(screen.queryByRole("heading", { name: "Marge" })).toBeNull();
    expect(getRapportMarge).not.toHaveBeenCalled();
  });

  it("affiche le bloc Péremptions à surveiller avec le droit sur le stock", async () => {
    afficher({ peutVoirStock: true });
    expect(await screen.findByRole("heading", { name: "Péremptions à surveiller" })).toBeTruthy();
    expect(getAlertesPeremption).toHaveBeenCalledWith("s1");
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
