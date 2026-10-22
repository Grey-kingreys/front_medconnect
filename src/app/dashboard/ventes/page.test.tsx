import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api_auth";
import type { VenteResume, VentesDuJour } from "@/lib/api_ventes";
import { formaterGNF } from "@/lib/format_gnf";
import VentesDuJourPage from "./page";

const { listerVentes, annulerVente, notifier, droits } = vi.hoisted(() => ({
  listerVentes: vi.fn(),
  annulerVente: vi.fn(),
  notifier: vi.fn(),
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
vi.mock("@/hooks/useToast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/useToast")>()),
  useToast: () => ({ notifier }),
}));

const LECTURE_ET_VENTE = ["vente:read", "vente:write"];
const AVEC_ANNULATION = ["vente:read", "vente:write", "vente:annuler"];

const resume = (surcharge: Partial<VenteResume> = {}): VenteResume => ({
  id: "v1",
  numero: "V-2026-0001",
  createdAt: "2026-10-22T10:05:00.000Z",
  statut: "VALIDEE",
  total: 4500,
  nombreArticles: 3,
  vendeur: { id: "u1", nom: "Mariama Diallo" },
  clientNom: null,
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
  /\b(ID|UUID|null|undefined|NaN|serveur|session|idempotence|localStorage|STOCK_INSUFFISANT|VENTE_DEJA_ANNULEE|ANNULATION_HORS_DELAI|VALIDEE|ANNULEE)\b/;

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
    expect(document.body.textContent).toContain(`Total des ventes validées : ${formaterGNF(4500)}`);
    expect(screen.getByText("1 vente")).toBeInTheDocument();
    verifierTermes();
  });

  it("marque une vente annulée et masque son bouton Annuler", async () => {
    listerVentes.mockResolvedValue(journee({ ventes: [resume({ statut: "ANNULEE" })] }));
    render(<VentesDuJourPage />);

    const ligne = (await screen.findByText("V-2026-0001")).closest("li") as HTMLElement;
    expect(within(ligne).getByText("Annulée")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Annuler la vente/ })).toBeNull();
  });

  it("cache Annuler sans le droit d'annuler", async () => {
    droits.permissions = LECTURE_ET_VENTE;
    render(<VentesDuJourPage />);

    await screen.findByText("V-2026-0001");
    expect(screen.queryByRole("button", { name: /Annuler la vente/ })).toBeNull();
  });

  it("recharge à la nouvelle date et n'offre plus d'annulation un autre jour", async () => {
    render(<VentesDuJourPage />);
    await screen.findByText("V-2026-0001");

    listerVentes.mockResolvedValue(journee({ date: "2026-10-21" }));
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-10-21" } });

    await waitFor(() => expect(listerVentes).toHaveBeenLastCalledWith("p1", { date: "2026-10-21", page: 1 }));
    await screen.findByText("V-2026-0001");
    expect(screen.queryByRole("button", { name: /Annuler la vente/ })).toBeNull();
    expect(screen.getByRole("heading", { name: "mercredi 21 octobre 2026" })).toBeInTheDocument();
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

  it("annule la vente avec le motif, prévient et recharge la liste", async () => {
    annulerVente.mockResolvedValue({ data: {}, message: "Vente annulée.", success: true });
    render(<VentesDuJourPage />);
    const dialogue = await ouvrirAnnulation();

    fireEvent.change(within(dialogue).getByLabelText("Motif de l'annulation"), { target: { value: "  Erreur de quantité " } });
    fireEvent.click(within(dialogue).getByRole("button", { name: "Annuler la vente" }));

    await waitFor(() => expect(annulerVente).toHaveBeenCalledWith("p1", "v1", "Erreur de quantité"));
    await waitFor(() => expect(notifier).toHaveBeenCalledWith("Vente annulée.", "succes"));
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

  it("explique qu'une vente ne s'annule que le jour même", async () => {
    annulerVente.mockRejectedValue(new ApiError("Trop tard.", 409, { code: "ANNULATION_HORS_DELAI" }));
    render(<VentesDuJourPage />);
    const dialogue = await ouvrirAnnulation();

    fireEvent.change(within(dialogue).getByLabelText("Motif de l'annulation"), { target: { value: "Doublon" } });
    fireEvent.click(within(dialogue).getByRole("button", { name: "Annuler la vente" }));

    expect(
      await screen.findByText("Cette vente ne peut plus être annulée : une vente s'annule seulement le jour même."),
    ).toBeInTheDocument();
    verifierTermes();
  });

  it("garde le dialogue ouvert avec un message après un échec de connexion", async () => {
    annulerVente.mockRejectedValue(new ApiError("Connexion perdue.", 0));
    render(<VentesDuJourPage />);
    const dialogue = await ouvrirAnnulation();

    fireEvent.change(within(dialogue).getByLabelText("Motif de l'annulation"), { target: { value: "Doublon" } });
    fireEvent.click(within(dialogue).getByRole("button", { name: "Annuler la vente" }));

    expect(
      await within(dialogue).findByText("L'annulation n'a pas pu être envoyée. Vérifiez votre connexion puis réessayez."),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
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
