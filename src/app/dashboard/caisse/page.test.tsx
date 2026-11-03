import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api_auth";
import type { Referentiels, SessionCaisse } from "@/lib/api_caisse";
import { jourConakry } from "../ventes/affichage";
import MaCaissePage from "./page";

const { getReferentiels, assurerPosteWeb, getSessionCourante, ouvrirSession, saisirComptage } = vi.hoisted(() => ({
  getReferentiels: vi.fn(),
  assurerPosteWeb: vi.fn(),
  getSessionCourante: vi.fn(),
  ouvrirSession: vi.fn(),
  saisirComptage: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", structureId: "p1", email: "u1@exemple.com", nom: "Diallo", prenom: "Mariama", role: "PHARMACIEN" },
    loading: false,
  }),
}));
vi.mock("@/lib/api_caisse", () => ({ getReferentiels, assurerPosteWeb, getSessionCourante, ouvrirSession, saisirComptage }));

const REFERENTIELS: Referentiels = {
  modesPaiement: [],
  coupures: [
    { devise: "GNF", valeurFaciale: 20000, type: "BILLET", ordre: 1 },
    { devise: "GNF", valeurFaciale: 10000, type: "BILLET", ordre: 2 },
    { devise: "GNF", valeurFaciale: 500, type: "BILLET", ordre: 3 },
  ],
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
const POSTE = { id: "po1", code: "W1", libelle: "Poste web", type: "WEB" as const };
const aujourdhui = jourConakry(new Date());
const SESSION: SessionCaisse = {
  id: "sc1",
  poste: POSTE,
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
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const afficher = async (session: SessionCaisse | null) => {
  getSessionCourante.mockResolvedValue({ data: session, message: "ok", success: true });
  render(<MaCaissePage />);
  await screen.findByRole("heading", { name: "Ma caisse" });
  await waitFor(() => expect(screen.queryByText("Chargement de votre caisse...")).toBeNull());
};
const champs = () => screen.getAllByRole("textbox") as HTMLInputElement[];

beforeEach(() => {
  getReferentiels.mockResolvedValue({ data: REFERENTIELS, message: "ok", success: true });
  assurerPosteWeb.mockResolvedValue({ data: POSTE, message: "ok", success: true });
  ouvrirSession.mockResolvedValue({ data: { ...SESSION, cree: true, ouverteMaintenant: true }, message: "Caisse ouverte.", success: true });
  saisirComptage.mockResolvedValue({ data: {}, message: "ok", success: true });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Ma caisse", () => {
  it("ouvre la caisse avec le fond compté, seules les coupures non nulles partent", async () => {
    await afficher(null);
    fireEvent.change(champs()[0], { target: { value: "2" } });
    fireEvent.change(champs()[2], { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir la caisse avec ce fond" }));
    await waitFor(() => expect(ouvrirSession).toHaveBeenCalledTimes(1));
    const [structureId, corps] = ouvrirSession.mock.calls[0];
    expect(structureId).toBe("p1");
    expect(corps.posteId).toBe("po1");
    expect(corps.id).toMatch(UUID);
    expect(corps.comptage).toEqual({
      coupures: [
        { valeurFaciale: 20000, nombre: 2 },
        { valeurFaciale: 500, nombre: 3 },
      ],
    });
  });

  it("ouvre sans compter : aucun comptage dans le corps", async () => {
    await afficher(null);
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir sans compter" }));
    await waitFor(() => expect(ouvrirSession).toHaveBeenCalledTimes(1));
    const corps = ouvrirSession.mock.calls[0][1];
    expect(corps.comptage).toBeUndefined();
    expect(corps.posteId).toBe("po1");
  });

  it("affiche tel quel le message d'ouverture pour le lendemain", async () => {
    const message = "Caisse ouverte. La journée d'aujourd'hui est déjà clôturée : cette caisse compte pour le 04/11/2026.";
    ouvrirSession.mockResolvedValue({ data: { ...SESSION, cree: true, ouverteMaintenant: true }, message, success: true });
    await afficher(null);
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir sans compter" }));
    expect(await screen.findByText(message)).toBeTruthy();
  });

  it("propose de compter le fond d'une caisse ouverte sans fond", async () => {
    await afficher(SESSION);
    expect(screen.getByText("Fond de caisse : pas encore compté")).toBeTruthy();
    fireEvent.change(champs()[1], { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le fond" }));
    await waitFor(() => expect(saisirComptage).toHaveBeenCalledTimes(1));
    const [structureId, sessionId, corps] = saisirComptage.mock.calls[0];
    expect(structureId).toBe("p1");
    expect(sessionId).toBe("sc1");
    expect(corps.moment).toBe("OUVERTURE");
    expect(corps.coupures).toEqual([{ valeurFaciale: 10000, nombre: 4 }]);
  });

  it("n'affiche ni montant ni bouton pour la caisse d'un autre vendeur", async () => {
    await afficher({ ...SESSION, utilisateurId: "u2", utilisateurNom: "Ousmane Keita", fondCaisse: 120000, fondCompte: true });
    expect(screen.getByText(/Ce poste est occupé par la caisse de Ousmane Keita, ouverte à/)).toBeTruthy();
    expect(screen.queryByText(/GNF/)).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("rejoue avec le même identifiant après un échec réseau", async () => {
    ouvrirSession.mockRejectedValueOnce(new ApiError("Réseau", 0));
    await afficher(null);
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir sans compter" }));
    const reessayer = await screen.findByRole("button", { name: "Réessayer" });
    expect(screen.getByText(/ne sera pas comptée deux fois/)).toBeTruthy();
    expect(champs().every((c) => c.matches(":disabled"))).toBe(true);
    fireEvent.click(reessayer);
    await waitFor(() => expect(ouvrirSession).toHaveBeenCalledTimes(2));
    expect(ouvrirSession.mock.calls[1][1].id).toBe(ouvrirSession.mock.calls[0][1].id);
  });

  it("affiche le refus du serveur, relit l'état et ne propose pas de réessai", async () => {
    const message = "Le fond de cette caisse a déjà été compté.";
    saisirComptage.mockRejectedValueOnce(new ApiError(message, 409, { code: "COMPTAGE_DEJA_SAISI" }));
    await afficher(SESSION);
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le fond" }));
    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Réessayer" })).toBeNull();
    await waitFor(() => expect(getSessionCourante).toHaveBeenCalledTimes(2));
  });

  it("prévient quand la caisse est restée ouverte depuis un jour précédent", async () => {
    await afficher({
      ...SESSION,
      jourMetier: "2026-11-01",
      ouverteLe: "2026-11-01T08:15:00.000Z",
    });
    expect(screen.getByText(/Cette caisse est restée ouverte depuis le dimanche 1 novembre 2026/)).toBeTruthy();
    expect(screen.getByText("Ventes comptées pour le dimanche 1 novembre 2026")).toBeTruthy();
  });

  it("n'alerte pas quand la caisse ouverte hier soir est rattachée à aujourd'hui", async () => {
    await afficher({ ...SESSION, jourMetier: aujourdhui, ouverteLe: "2026-11-02T22:00:00.000Z" });
    expect(screen.queryByText(/restée ouverte depuis/)).toBeNull();
    expect(screen.getByText("Ouverte le lundi 2 novembre 2026 à 22:00")).toBeTruthy();
  });

  it("ne date pas une caisse ouverte aujourd'hui", async () => {
    await afficher(SESSION);
    expect(screen.getByText("Ouverte à 08:15")).toBeTruthy();
  });

  it("date la caisse d'un autre vendeur ouverte un autre jour", async () => {
    await afficher({ ...SESSION, utilisateurId: "u2", utilisateurNom: "Ousmane Keita", ouverteLe: "2026-11-02T22:00:00.000Z" });
    expect(screen.getByText(/occupé par la caisse de Ousmane Keita, ouverte le lundi 2 novembre 2026 à 22:00\./)).toBeTruthy();
  });
});
