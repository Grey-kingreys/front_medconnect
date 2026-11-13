import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Referentiels, SessionCaisse } from "@/lib/api_caisse";
import type { StockMedicament } from "@/lib/api_pharmacie";
import type { Vente } from "@/lib/api_ventes";
import type { PontDesktop } from "@/lib/caisse/contrat_desktop";
import { jourConakry } from "../ventes/affichage";
import NouvelleVentePage from "./page";

const { chargerStock, chargerReferentiels, etatCaisse, creerVente, lireReglages, imprimerVente, enLigneChargerStock } = vi.hoisted(() => ({
  chargerStock: vi.fn(),
  chargerReferentiels: vi.fn(),
  etatCaisse: vi.fn(),
  creerVente: vi.fn(),
  lireReglages: vi.fn(),
  imprimerVente: vi.fn(),
  enLigneChargerStock: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", structureId: "p1", email: "u1@exemple.com", nom: "Diallo", prenom: "Mariama", role: "PHARMACIEN" },
    loading: false,
  }),
}));
vi.mock("@/lib/caisse/source_en_ligne", () => ({
  sourceEnLigne: { chargerStock: enLigneChargerStock, chargerReferentiels, etatCaisse, creerVente },
}));

const aujourdhui = jourConakry(new Date());
const STOCKS: StockMedicament[] = [
  {
    id: "s1",
    medicamentId: "m-s1",
    medicament: { id: "m-s1", nom: "Paracétamol", categorie: "Divers", ordonnanceRequise: false, formes: [] },
    structureId: "p1",
    quantite: 3,
    prixUnitaire: 1500,
    disponible: true,
  },
];
const REFERENTIELS: Referentiels = {
  modesPaiement: [{ code: "ESPECES", libelle: "Espèces", comptagePhysique: true, referenceAutorisee: false, ordre: 1 }],
  coupures: [],
  parametres: {
    horizonsPeremptionJours: [90, 30, 7],
    seuilEcartCaisse: 5000,
    seuilAvertissementPrixPct: 30,
    seuilStockBas: 5,
    taillePlageTickets: 500,
    seuilRechargementPlagePct: 20,
    debutCaisse: "2026-09-01",
  },
};
const SESSION: SessionCaisse = {
  id: "sc1",
  poste: { id: "po1", code: "D1", libelle: "Comptoir", type: "DESKTOP" },
  utilisateurId: "u1",
  utilisateurNom: "Mariama Diallo",
  statut: "OUVERTE",
  jourMetier: aujourdhui,
  ouverteLe: `${aujourdhui}T08:15:00.000Z`,
  fermeeLe: null,
  commentaireEcart: null,
  fondCaisse: 0,
  fondCompte: false,
  comptageOuverture: null,
  comptageFermeture: null,
};
const VENTE = {
  id: "22222222-2222-4222-8222-222222222222",
  numero: "T1-0000012",
  typePiece: "VENTE",
  numeroTicket: 12,
  jourMetier: aujourdhui,
  provisoire: false,
  poste: { id: "po1", code: "D1" },
  session: { id: "sc1", ouverteAutomatiquement: false },
  paiements: [],
  annulation: null,
  venteOrigine: null,
  motif: null,
  vendeur: { id: "u1", nom: "Mariama Diallo" },
  pharmacie: { id: "p1", nom: "Pharmacie du Centre", adresse: null, ville: "Conakry", telephone: null, logoUrl: null },
  clientNom: null,
  clientTelephone: null,
  ordonnanceVerifiee: false,
  total: 1500,
  statut: "VALIDEE",
  annuleeLe: null,
  annuleeParId: null,
  motifAnnulation: null,
  createdAt: "2026-10-22T10:00:00.000Z",
  lignes: [],
} as unknown as Vente;

const MESSAGE_ECHEC =
  "Le ticket n'a pas pu être imprimé. Vérifiez que l'imprimante est allumée et réessayez. La vente est bien enregistrée.";

function installerPont() {
  window.medconnecteDesktop = {
    version: "0.1.0",
    etat: vi.fn().mockResolvedValue({ horsLigne: false, enLigne: true, fileEnAttente: 0 }),
    surEtat: vi.fn(() => () => undefined),
    caisse: {
      chargerStock: chargerStock.mockResolvedValue({ ok: true, data: STOCKS, message: "ok" }),
      chargerReferentiels: chargerReferentiels.mockResolvedValue({ ok: true, data: REFERENTIELS, message: "ok" }),
      etatCaisse: etatCaisse.mockResolvedValue({ ok: true, data: { poste: SESSION.poste, session: SESSION }, message: "ok" }),
      creerVente: creerVente.mockResolvedValue({ ok: true, data: VENTE, message: "ok" }),
    },
    impression: { lireReglages, imprimerVente },
  } as unknown as PontDesktop;
}

const vendre = async () => {
  await screen.findByText("Paracétamol");
  fireEvent.click(screen.getByRole("button", { name: "Ajouter Paracétamol au panier" }));
  fireEvent.click(screen.getByRole("button", { name: "Valider la vente" }));
  const dialogue = await screen.findByRole("dialog");
  fireEvent.click(within(dialogue).getByRole("button", { name: "Confirmer la vente" }));
  await screen.findByText("Vente enregistrée");
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  lireReglages.mockResolvedValue({ ok: true, data: { imprimante: "Ticket 80", formatRecu: "80", impressionAutomatique: true }, message: "ok" });
  imprimerVente.mockResolvedValue({ ok: true, data: null, message: "ok" });
});

afterEach(() => {
  cleanup();
  delete window.medconnecteDesktop;
});

describe("Nouvelle vente sur le poste, impression automatique", () => {
  it("imprime une fois, sans attendre, dès que la vente est enregistrée", async () => {
    installerPont();
    render(<NouvelleVentePage />);
    await vendre();

    await waitFor(() => expect(imprimerVente).toHaveBeenCalledTimes(1));
    expect(imprimerVente).toHaveBeenCalledWith(VENTE.id);
    expect(screen.queryByText(/n'a pas pu être imprimé/)).toBeNull();
  });

  it("n'imprime pas quand l'impression automatique est désactivée", async () => {
    installerPont();
    lireReglages.mockResolvedValue({ ok: true, data: { imprimante: "Ticket 80", formatRecu: "80", impressionAutomatique: false }, message: "ok" });
    render(<NouvelleVentePage />);
    await vendre();

    await waitFor(() => expect(lireReglages).toHaveBeenCalled());
    expect(imprimerVente).not.toHaveBeenCalled();
  });

  it("un échec d'impression n'a aucun effet sur la vente : message sous le succès et « Réimprimer »", async () => {
    installerPont();
    imprimerVente.mockResolvedValueOnce({ ok: false, status: 502, code: "IMPRESSION_ECHOUEE", message: MESSAGE_ECHEC });
    render(<NouvelleVentePage />);
    await vendre();

    expect(await screen.findByText(MESSAGE_ECHEC)).toBeInTheDocument();
    expect(screen.getByText("Vente enregistrée")).toBeInTheDocument();
    expect(screen.getByText("Numéro : T1-0000012")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Réimprimer" }));
    await waitFor(() => expect(imprimerVente).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText(MESSAGE_ECHEC)).toBeNull());
  });

  it("un échec arrivé après la vente suivante nomme son ticket, et « Réimprimer » reprend cette vente-là", async () => {
    installerPont();
    let terminerPremiere: (rep: unknown) => void = () => undefined;
    imprimerVente.mockImplementationOnce(() => new Promise((resolve) => (terminerPremiere = resolve)));
    render(<NouvelleVentePage />);
    await vendre();
    await waitFor(() => expect(imprimerVente).toHaveBeenCalledTimes(1));

    const suivante = { ...VENTE, id: "33333333-3333-4333-8333-333333333333", numero: "T1-0000013" } as Vente;
    creerVente.mockResolvedValue({ ok: true, data: suivante, message: "ok" });
    fireEvent.click(screen.getByRole("button", { name: "Nouvelle vente" }));
    await vendre();
    await screen.findByText("Numéro : T1-0000013");
    await waitFor(() => expect(imprimerVente).toHaveBeenCalledTimes(2));

    terminerPremiere({ ok: false, status: 502, code: "IMPRESSION_ECHOUEE", message: MESSAGE_ECHEC });
    expect(await screen.findByText(MESSAGE_ECHEC)).toBeInTheDocument();
    expect(screen.getByText("Ticket T1-0000012")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Réimprimer" }));
    await waitFor(() => expect(imprimerVente).toHaveBeenCalledTimes(3));
    expect(imprimerVente).toHaveBeenLastCalledWith(VENTE.id);
  });
});

describe("Nouvelle vente sur le web", () => {
  it("n'appelle jamais l'impression directe", async () => {
    enLigneChargerStock.mockResolvedValue(STOCKS);
    chargerReferentiels.mockResolvedValue(REFERENTIELS);
    etatCaisse.mockResolvedValue({ poste: SESSION.poste, session: SESSION });
    creerVente.mockResolvedValue(VENTE);
    render(<NouvelleVentePage />);
    await vendre();

    expect(imprimerVente).not.toHaveBeenCalled();
    expect(lireReglages).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Réimprimer" })).toBeNull();
  });
});
