import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api_auth";
import type { BilanCaisse, Referentiels, SessionCaisse } from "@/lib/api_caisse";
import { formaterGNF } from "@/lib/format_gnf";
import { jourConakry } from "../ventes/affichage";
import MaCaissePage from "./page";

const { getReferentiels, assurerPosteWeb, getSessionCourante, ouvrirSession, saisirComptage, getBilan, fermerSession, enregistrerMouvement } =
  vi.hoisted(() => ({
    getReferentiels: vi.fn(),
    assurerPosteWeb: vi.fn(),
    getSessionCourante: vi.fn(),
    ouvrirSession: vi.fn(),
    saisirComptage: vi.fn(),
    getBilan: vi.fn(),
    fermerSession: vi.fn(),
    enregistrerMouvement: vi.fn(),
  }));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", structureId: "p1", email: "u1@exemple.com", nom: "Diallo", prenom: "Mariama", role: "PHARMACIEN" },
    loading: false,
  }),
}));
vi.mock("@/lib/api_caisse", () => ({
  getReferentiels,
  assurerPosteWeb,
  getSessionCourante,
  ouvrirSession,
  saisirComptage,
  getBilan,
  fermerSession,
  enregistrerMouvement,
}));

const REFERENTIELS: Referentiels = {
  modesPaiement: [
    { code: "ESPECES", libelle: "Espèces", comptagePhysique: true, referenceAutorisee: false, ordre: 1 },
    { code: "ORANGE_MONEY", libelle: "Orange Money", comptagePhysique: false, referenceAutorisee: true, ordre: 2 },
  ],
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
const BILAN: BilanCaisse = {
  activite: {
    nombreVentes: 3,
    nombreAnnulations: 1,
    montantEncaisse: 150000,
    parMode: [
      { mode: "ESPECES", libelle: "Espèces", montant: 63000, nombrePaiements: 2 },
      { mode: "ORANGE_MONEY", libelle: "Orange Money", montant: 87000, nombrePaiements: 3 },
    ],
  },
  session: SESSION,
  fond: { montant: 0, compte: false },
  mouvements: [],
  theorique: [
    { mode: "ESPECES", libelle: "Espèces", montant: 63000 },
    { mode: "ORANGE_MONEY", libelle: "Orange Money", montant: 87000 },
  ],
  compte: [],
  ecarts: [],
  ecartEspeces: null,
  seuilEcartCaisse: 5000,
  commentaireRequis: false,
  fige: false,
};

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
  getBilan.mockResolvedValue({ data: BILAN, message: "ok", success: true });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Ma caisse", () => {
  it("ouvre la caisse avec le fond saisi en un seul montant, sans coupures", async () => {
    await afficher(null);
    expect(screen.queryByLabelText(/Nombre de billets/)).toBeNull();
    fireEvent.change(screen.getByLabelText(/Monnaie dans le tiroir/), { target: { value: "51 500" } });
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir la caisse avec ce fond" }));
    await waitFor(() => expect(ouvrirSession).toHaveBeenCalledTimes(1));
    const [structureId, corps] = ouvrirSession.mock.calls[0];
    expect(structureId).toBe("p1");
    expect(corps.posteId).toBe("po1");
    expect(corps.id).toMatch(UUID);
    expect(corps.comptage).toEqual({ montantEspeces: 51500 });
  });

  it("ouvre avec un fond de 0 : le comptage part avec 0", async () => {
    await afficher(null);
    fireEvent.change(screen.getByLabelText(/Monnaie dans le tiroir/), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir la caisse avec ce fond" }));
    await waitFor(() => expect(ouvrirSession).toHaveBeenCalledTimes(1));
    const corps = ouvrirSession.mock.calls[0][1];
    expect(corps.comptage).toEqual({ montantEspeces: 0 });
    expect(corps.posteId).toBe("po1");
  });

  it("refuse un fond vide : aucun appel, message lié au champ, focus, effacé à la frappe", async () => {
    await afficher(null);
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir la caisse avec ce fond" }));
    const message = await screen.findByText("Indiquez la monnaie du tiroir (0 si le tiroir est vide).");
    const champ = screen.getByLabelText(/Monnaie dans le tiroir/) as HTMLInputElement;
    expect(ouvrirSession).not.toHaveBeenCalled();
    expect(champ.getAttribute("aria-invalid")).toBe("true");
    expect(champ.getAttribute("aria-describedby")).toContain(message.id);
    expect(document.activeElement).toBe(champ);
    fireEvent.change(champ, { target: { value: "5" } });
    expect(screen.queryByText("Indiquez la monnaie du tiroir (0 si le tiroir est vide).")).toBeNull();
  });

  it("refuse un fond vide pour une caisse ouverte sans fond", async () => {
    await afficher(SESSION);
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le fond" }));
    expect(await screen.findByText("Indiquez la monnaie du tiroir (0 si le tiroir est vide).")).toBeTruthy();
    expect(saisirComptage).not.toHaveBeenCalled();
  });

  it("affiche tel quel le message d'ouverture pour le lendemain", async () => {
    const message = "Caisse ouverte. La journée d'aujourd'hui est déjà clôturée : cette caisse compte pour le 04/11/2026.";
    ouvrirSession.mockResolvedValue({ data: { ...SESSION, cree: true, ouverteMaintenant: true }, message, success: true });
    await afficher(null);
    fireEvent.change(screen.getByLabelText(/Monnaie dans le tiroir/), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir la caisse avec ce fond" }));
    expect(await screen.findByText(message)).toBeTruthy();
  });

  it("propose de compter le fond d'une caisse ouverte sans fond", async () => {
    await afficher(SESSION);
    expect(screen.getByText("Fond de caisse : pas encore compté")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Monnaie dans le tiroir/), { target: { value: "40000" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le fond" }));
    await waitFor(() => expect(saisirComptage).toHaveBeenCalledTimes(1));
    const [structureId, sessionId, corps] = saisirComptage.mock.calls[0];
    expect(structureId).toBe("p1");
    expect(sessionId).toBe("sc1");
    expect(corps.moment).toBe("OUVERTURE");
    expect(corps.montantEspeces).toBe(40000);
    expect(corps.coupures).toBeUndefined();
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
    fireEvent.change(screen.getByLabelText(/Monnaie dans le tiroir/), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir la caisse avec ce fond" }));
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
    fireEvent.change(screen.getByLabelText(/Monnaie dans le tiroir/), { target: { value: "0" } });
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

  it("affiche l'activité du vendeur avant l'attendu dans la caisse", async () => {
    await afficher(SESSION);
    const ventes = await screen.findByText("Ventes : 3");
    const attendu = screen.getByText("Attendu dans la caisse");
    expect(ventes.compareDocumentPosition(attendu) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText(`Orange Money : ${formaterGNF(87000).replace(/\s/g, " ")} (3 paiements)`)).toBeTruthy();
  });

  it("ferme depuis le bandeau une caisse restée ouverte un jour passé, pour cette caisse", async () => {
    const figee = { ...BILAN, fige: true, session: { ...SESSION, jourMetier: "2026-11-01", commentaireEcart: null } };
    fermerSession.mockResolvedValue({ data: figee, message: "Caisse fermée.", success: true });
    await afficher({ ...SESSION, jourMetier: "2026-11-01", ouverteLe: "2026-11-01T08:15:00.000Z" });
    const bouton = await screen.findByRole("button", { name: "Fermer cette caisse" });
    await waitFor(() => expect(bouton.hasAttribute("disabled")).toBe(false));
    fireEvent.click(bouton);
    expect(await screen.findByText("Comptez l'argent de votre caisse.")).toBeTruthy();
    expect(screen.getByText("Les ventes de cette caisse sont comptées pour le dimanche 1 novembre 2026.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Espèces dans le tiroir (GNF)"), { target: { value: "60000" } });
    fireEvent.click(screen.getByRole("button", { name: "Fermer ma caisse" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirmer la fermeture" }));
    await waitFor(() => expect(fermerSession).toHaveBeenCalledTimes(1));
    expect(fermerSession.mock.calls[0][0]).toBe("p1");
    expect(fermerSession.mock.calls[0][1]).toBe("sc1");
    expect(await screen.findByRole("heading", { name: "Caisse fermée" })).toBeTruthy();
    expect(screen.getByText("Les ventes de cette caisse sont comptées pour le dimanche 1 novembre 2026.")).toBeTruthy();
  });

  it("après une coupure, Fermer et vérifier relit le bilan et demande de vérifier la liste", async () => {
    enregistrerMouvement.mockRejectedValueOnce(new ApiError("Réseau", 0));
    await afficher(SESSION);
    await screen.findByText("Aucun mouvement de caisse.");
    const lectures = getBilan.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Mouvement de caisse" }));
    fireEvent.click(screen.getByLabelText("Apport (ajout d'argent)"));
    fireEvent.change(screen.getByLabelText("Montant (GNF)"), { target: { value: "5000" } });
    fireEvent.change(screen.getByLabelText("Motif"), { target: { value: "Monnaie" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    const fermer = await screen.findByRole("button", { name: "Fermer et vérifier" });

    // Le serveur avait bien reçu le mouvement : la relecture le montre.
    getBilan.mockResolvedValue({
      data: {
        ...BILAN,
        mouvements: [{ id: "m1", type: "APPORT", mode: "ESPECES", montant: 5000, motif: "Monnaie", auteurId: "u1", horodatageServeur: new Date().toISOString() }],
        theorique: [
          { mode: "ESPECES", libelle: "Espèces", montant: 68000 },
          { mode: "ORANGE_MONEY", libelle: "Orange Money", montant: 87000 },
        ],
      },
      message: "ok",
      success: true,
    });
    fireEvent.click(fermer);

    expect(
      await screen.findByText("Vérifiez la liste des mouvements avant d'en saisir un autre : le précédent a peut-être été enregistré."),
    ).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(getBilan.mock.calls.length).toBe(lectures + 1);
    expect(await screen.findByText(/^Apport de 5.000 GNF, Monnaie, à /)).toBeTruthy();
    expect(screen.getByText(`Espèces : ${formaterGNF(68000).replace(/\s/g, " ")}`)).toBeTruthy();
    expect(enregistrerMouvement).toHaveBeenCalledTimes(1);
  });

  it("date la caisse d'un autre vendeur ouverte un autre jour", async () => {
    await afficher({ ...SESSION, utilisateurId: "u2", utilisateurNom: "Ousmane Keita", ouverteLe: "2026-11-02T22:00:00.000Z" });
    expect(screen.getByText(/occupé par la caisse de Ousmane Keita, ouverte le lundi 2 novembre 2026 à 22:00\./)).toBeTruthy();
  });
});
