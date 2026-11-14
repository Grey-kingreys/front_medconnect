import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api_auth";
import type { VenteResume, VentesDuJour } from "@/lib/api_ventes";
import { formaterGNF } from "@/lib/format_gnf";
import VentesDuJourPage from "./page";

const { listerVentes, annulerVente, droits } = vi.hoisted(() => ({
  listerVentes: vi.fn(),
  annulerVente: vi.fn(),
  droits: { permissions: [] as string[] },
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
      permissions: droits.permissions,
      structureType: "PHARMACIE",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  }),
}));
vi.mock("@/lib/api_ventes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api_ventes")>()),
  listerVentes,
  annulerVente,
}));

const LECTURE_ET_VENTE = ["vente:read", "vente:write"];
const AVEC_ANNULATION = ["vente:read", "vente:write", "vente:annuler", "caisse:utiliser"];

const resume = (surcharge: Partial<VenteResume> = {}): VenteResume => ({
  id: "v1",
  numero: "V-2026-0001",
  createdAt: "2026-10-22T10:05:00.000Z",
  statut: "VALIDEE",
  total: 4500,
  nombreArticles: 3,
  vendeur: { id: "u1", nom: "Mariama Diallo" },
  clientNom: null,
  typePiece: "VENTE",
  numeroTicket: 1,
  jourMetier: "2026-10-22",
  venteOrigine: null,
  annulation: null,
  ...surcharge,
});

/** Pièce d'annulation rattachée à la vente T1-0000012 : total négatif, sans numéro de ticket. */
const pieceAnnulation = (surcharge: Partial<VenteResume> = {}): VenteResume =>
  resume({
    id: "a1",
    numero: "A-T1-0000012",
    total: -4500,
    nombreArticles: -3,
    typePiece: "ANNULATION",
    numeroTicket: null,
    venteOrigine: { id: "v12", numero: "T1-0000012" },
    ...surcharge,
  });

const journee = (surcharge: Partial<VentesDuJour> = {}): { data: VentesDuJour; message: string; success: boolean } => ({
  data: {
    date: "2026-10-22",
    totalJour: 4500,
    nombre: 1,
    page: 1,
    parPage: 20,
    totalPages: 1,
    ventes: [resume()],
    ...surcharge,
  },
  message: "ok",
  success: true,
});

const TERMES_INTERDITS =
  /\b(ID|UUID|null|undefined|NaN|serveur|session|idempotence|localStorage|STOCK_INSUFFISANT|VENTE_DEJA_ANNULEE|PIECE_NON_ANNULABLE|JOURNEE_CLOTUREE|VALIDEE|ANNULEE|ANNULATION|REGULARISATION)\b/;

const verifierTermes = () => {
  const contenu = document.body.textContent ?? "";
  expect(contenu).not.toMatch(TERMES_INTERDITS);
  expect(contenu).not.toContain(String.fromCharCode(0x2013));
  expect(contenu).not.toContain(String.fromCharCode(0x2014));
};

const ouvrirAnnulation = async () => {
  fireEvent.click(await screen.findByRole("button", { name: "Annuler la vente V-2026-0001" }));
  return screen.findByRole("dialog");
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-22T10:00:00Z"));
  droits.permissions = AVEC_ANNULATION;
  listerVentes.mockResolvedValue(journee());
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Ventes du jour", () => {
  it("charge les ventes d'aujourd'hui et les affiche", async () => {
    render(<VentesDuJourPage />);

    const ligne = (await screen.findByText("V-2026-0001")).closest("li") as HTMLElement;
    expect(listerVentes).toHaveBeenCalledWith("p1", { date: "2026-10-22", page: 1 });
    expect(ligne).toHaveTextContent("10:05");
    expect(ligne).toHaveTextContent("3 articles");
    expect(ligne.textContent).toContain(formaterGNF(4500));
    expect(within(ligne).getByText("Validée")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "jeudi 22 octobre 2026" })).toBeInTheDocument();
    expect(document.body.textContent).toContain(`Total du jour (annulations déduites) : ${formaterGNF(4500)}`);
    expect(screen.getByText("1 vente")).toBeInTheDocument();
    verifierTermes();
  });

  it("marque une vente annulée avec sa pièce d'annulation et masque son bouton Annuler", async () => {
    listerVentes.mockResolvedValue(
      journee({
        ventes: [resume({ numero: "T1-0000012", statut: "ANNULEE", annulation: { id: "a1", numero: "A-T1-0000012" } })],
      }),
    );
    render(<VentesDuJourPage />);

    const ligne = (await screen.findByText("T1-0000012")).closest("li") as HTMLElement;
    expect(within(ligne).getByText("Annulée")).toBeInTheDocument();
    expect(within(ligne).getByText("Annulée par A-T1-0000012")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Annuler la vente/ })).toBeNull();
    verifierTermes();
  });

  it("liste une pièce d'annulation avec son total négatif, sans bouton Annuler", async () => {
    listerVentes.mockResolvedValue(journee({ totalJour: 0, nombre: 1, ventes: [pieceAnnulation()] }));
    render(<VentesDuJourPage />);

    const ligne = (await screen.findByText("A-T1-0000012")).closest("li") as HTMLElement;
    expect(ligne.textContent).toContain(formaterGNF(-4500));
    expect(within(ligne).getByText("Annulation")).toBeInTheDocument();
    expect(ligne).toHaveTextContent("3 articles");
    expect(ligne.textContent).not.toContain("-3 articles");
    expect(within(ligne).getByText("Annule la vente T1-0000012")).toBeInTheDocument();
    expect(within(ligne).queryByRole("button", { name: /Annuler/ })).toBeNull();
    expect(within(ligne).getByRole("link", { name: "Réimprimer le reçu A-T1-0000012" })).toBeInTheDocument();
    verifierTermes();
  });

  it("liste une régularisation sans bouton Annuler", async () => {
    listerVentes.mockResolvedValue(
      journee({
        ventes: [resume({ id: "r1", numero: "T2-0000009", typePiece: "REGULARISATION", numeroTicket: 9 })],
      }),
    );
    render(<VentesDuJourPage />);

    const ligne = (await screen.findByText("T2-0000009")).closest("li") as HTMLElement;
    expect(within(ligne).getByText("Régularisation")).toBeInTheDocument();
    expect(within(ligne).getByText("Vente remontée d'un poste de caisse")).toBeInTheDocument();
    expect(within(ligne).queryByRole("button", { name: /Annuler/ })).toBeNull();
  });

  it("cache Annuler sans le droit d'annuler", async () => {
    droits.permissions = LECTURE_ET_VENTE;
    render(<VentesDuJourPage />);

    await screen.findByText("V-2026-0001");
    expect(screen.queryByRole("button", { name: /Annuler la vente/ })).toBeNull();
  });

  it("cache Annuler sans le droit d'utiliser la caisse", async () => {
    droits.permissions = ["vente:read", "vente:write", "vente:annuler"];
    render(<VentesDuJourPage />);

    await screen.findByText("V-2026-0001");
    expect(screen.queryByRole("button", { name: /Annuler la vente/ })).toBeNull();
  });

  it("recharge à la nouvelle date et propose toujours l'annulation d'une vente validée d'un jour passé", async () => {
    render(<VentesDuJourPage />);
    await screen.findByText("V-2026-0001");
    expect(screen.queryByText(/Une annulation faite aujourd'hui/)).toBeNull();

    listerVentes.mockResolvedValue(journee({ date: "2026-10-21" }));
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-10-21" } });

    await waitFor(() => expect(listerVentes).toHaveBeenLastCalledWith("p1", { date: "2026-10-21", page: 1 }));
    await screen.findByText("V-2026-0001");
    expect(screen.getByRole("button", { name: "Annuler la vente V-2026-0001" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "mercredi 21 octobre 2026" })).toBeInTheDocument();
    expect(
      screen.getByText("Une annulation faite aujourd'hui apparaît dans la journée d'aujourd'hui, pas dans celle-ci."),
    ).toBeInTheDocument();
  });

  it("refuse un motif trop court", async () => {
    render(<VentesDuJourPage />);
    const dialogue = await ouvrirAnnulation();

    fireEvent.change(within(dialogue).getByLabelText("Motif de l'annulation"), { target: { value: "ab" } });
    fireEvent.click(within(dialogue).getByRole("button", { name: "Annuler la vente" }));

    expect(within(dialogue).getByText("Indiquez un motif de 3 à 300 caractères.")).toBeInTheDocument();
    expect(within(dialogue).getByLabelText("Motif de l'annulation")).toHaveFocus();
    expect(annulerVente).not.toHaveBeenCalled();
  });

  it("annule la vente avec le motif, affiche le message du serveur et recharge la liste", async () => {
    const message =
      "Vente V-2026-0001 annulée (A-V-2026-0001). Les quantités ont été remises en stock et le remboursement est enregistré dans votre caisse.";
    annulerVente.mockResolvedValue({ data: {}, message, success: true });
    render(<VentesDuJourPage />);
    const dialogue = await ouvrirAnnulation();

    fireEvent.change(within(dialogue).getByLabelText("Motif de l'annulation"), { target: { value: "  Erreur de quantité " } });
    fireEvent.click(within(dialogue).getByRole("button", { name: "Annuler la vente" }));

    await waitFor(() => expect(annulerVente).toHaveBeenCalledWith("p1", "v1", "Erreur de quantité"));
    expect(await screen.findByRole("status")).toHaveTextContent(message);
    await waitFor(() => expect(listerVentes).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("explique qu'une vente était déjà annulée", async () => {
    annulerVente.mockRejectedValue(new ApiError("Déjà annulée.", 409, { code: "VENTE_DEJA_ANNULEE" }));
    render(<VentesDuJourPage />);
    const dialogue = await ouvrirAnnulation();

    fireEvent.change(within(dialogue).getByLabelText("Motif de l'annulation"), { target: { value: "Doublon" } });
    fireEvent.click(within(dialogue).getByRole("button", { name: "Annuler la vente" }));

    expect(await screen.findByText("Cette vente avait déjà été annulée. La liste a été mise à jour.")).toBeInTheDocument();
    await waitFor(() => expect(listerVentes).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("dialog")).toBeNull();
    verifierTermes();
  });

  it("affiche le message du serveur dans le dialogue pour une pièce non annulable, sans réessai", async () => {
    const message = "Cette pièce ne peut pas être annulée.";
    annulerVente.mockRejectedValue(new ApiError(message, 409, { code: "PIECE_NON_ANNULABLE" }));
    render(<VentesDuJourPage />);
    const dialogue = await ouvrirAnnulation();

    fireEvent.change(within(dialogue).getByLabelText("Motif de l'annulation"), { target: { value: "Doublon" } });
    fireEvent.click(within(dialogue).getByRole("button", { name: "Annuler la vente" }));

    expect(await within(dialogue).findByText(message)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const confirmer = within(dialogue).getByRole("button", { name: "Annuler la vente" });
    expect(confirmer).toBeDisabled();
    fireEvent.click(confirmer);
    expect(annulerVente).toHaveBeenCalledTimes(1);
    expect(listerVentes).toHaveBeenCalledTimes(1);
    verifierTermes();
  });

  it("affiche le message du serveur pour une journée clôturée, sans réessai", async () => {
    const message = "Cette journée est clôturée.";
    annulerVente.mockRejectedValue(new ApiError(message, 409, { code: "JOURNEE_CLOTUREE" }));
    render(<VentesDuJourPage />);
    const dialogue = await ouvrirAnnulation();

    fireEvent.change(within(dialogue).getByLabelText("Motif de l'annulation"), { target: { value: "Doublon" } });
    fireEvent.click(within(dialogue).getByRole("button", { name: "Annuler la vente" }));

    expect(await within(dialogue).findByText(message)).toBeInTheDocument();
    expect(within(dialogue).getByRole("button", { name: "Annuler la vente" })).toBeDisabled();
  });

  it("demande de vérifier la liste après un échec de connexion et la recharge à la fermeture", async () => {
    annulerVente.mockRejectedValue(new ApiError("Connexion perdue.", 0));
    render(<VentesDuJourPage />);
    const dialogue = await ouvrirAnnulation();

    fireEvent.change(within(dialogue).getByLabelText("Motif de l'annulation"), { target: { value: "Doublon" } });
    fireEvent.click(within(dialogue).getByRole("button", { name: "Annuler la vente" }));

    expect(
      await within(dialogue).findByText(
        "L'annulation n'a peut-être pas été enregistrée. Fermez cette fenêtre et vérifiez la liste avant de recommencer.",
      ),
    ).toBeInTheDocument();
    expect(within(dialogue).getByRole("button", { name: "Annuler la vente" })).toBeDisabled();
    expect(listerVentes).toHaveBeenCalledTimes(1);

    fireEvent.click(within(dialogue).getByRole("button", { name: "Fermer" }));

    await waitFor(() => expect(listerVentes).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(annulerVente).toHaveBeenCalledTimes(1);
  });

  it("guide vers une nouvelle vente quand la journée est vide", async () => {
    listerVentes.mockResolvedValue(journee({ ventes: [], nombre: 0, totalJour: 0 }));
    render(<VentesDuJourPage />);

    expect(await screen.findByText("Aucune vente le jeudi 22 octobre 2026.")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Nouvelle vente" })[0]).toHaveAttribute("href", "/dashboard/vente");
    expect(screen.getByText("Aucune vente")).toBeInTheDocument();
    verifierTermes();
  });

  it("propose de réessayer quand la liste ne se charge pas", async () => {
    listerVentes.mockRejectedValueOnce(new ApiError("Connexion perdue.", 0));
    render(<VentesDuJourPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Connexion perdue.");
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(await screen.findByText("V-2026-0001")).toBeInTheDocument();
  });

  it("renvoie vers le reçu pour le réimprimer", async () => {
    render(<VentesDuJourPage />);
    const lien = await screen.findByRole("link", { name: "Réimprimer le reçu V-2026-0001" });
    expect(lien).toHaveAttribute("href", "/dashboard/ventes/v1/recu");
  });

  it("pagine quand il y a plusieurs pages", async () => {
    listerVentes.mockResolvedValue(journee({ totalPages: 2, nombre: 25 }));
    render(<VentesDuJourPage />);

    expect(await screen.findByText("Page 1 sur 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page précédente" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Page suivante" }));

    await waitFor(() => expect(listerVentes).toHaveBeenLastCalledWith("p1", { date: "2026-10-22", page: 2 }));
    expect(await screen.findByText("Page 2 sur 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page suivante" })).toBeDisabled();
  });
});
