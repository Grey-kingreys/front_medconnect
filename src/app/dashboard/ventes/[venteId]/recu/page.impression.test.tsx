import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Vente } from "@/lib/api_ventes";
import type { PontDesktop } from "@/lib/caisse/contrat_desktop";
import RecuVentePage from "./page";

const { getVenteWeb, getVenteLocale, imprimerVente, signalerPret, lireReglages, enregistrerReglages } = vi.hoisted(() => ({
  getVenteWeb: vi.fn(),
  getVenteLocale: vi.fn(),
  imprimerVente: vi.fn(),
  signalerPret: vi.fn(),
  lireReglages: vi.fn(),
  enregistrerReglages: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useParams: () => ({ venteId: "11111111-1111-4111-8111-111111111111" }) }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", structureId: "p1", email: "u1@exemple.com", nom: "Diallo", prenom: "Mariama", role: "PHARMACIEN" },
    loading: false,
    profile: null,
  }),
}));

vi.mock("@/lib/api_ventes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api_ventes")>()),
  getVente: getVenteWeb,
}));

const VENTE: Vente = {
  id: "11111111-1111-4111-8111-111111111111",
  numero: "T1-0000012",
  statut: "VALIDEE",
  createdAt: "2026-10-22T10:05:00.000Z",
  total: 3000,
  ordonnanceVerifiee: false,
  clientNom: null,
  clientTelephone: null,
  vendeur: { id: "u1", nom: "Mariama Diallo" },
  annuleeLe: null,
  annuleeParId: null,
  motifAnnulation: null,
  lignes: [
    {
      id: "l1",
      stockId: "s1",
      medicamentId: "m1",
      nomMedicament: "Paracétamol 500 mg",
      prixUnitaire: 1500,
      quantite: 2,
      sousTotal: 3000,
      uniteAffichee: "BOITE",
      nombreAffiche: 2,
      coefficientApplique: 1,
      allocations: [],
    },
  ],
  pharmacie: { id: "p1", nom: "Pharmacie du Centre", adresse: null, ville: "Conakry", telephone: null, logoUrl: null },
  typePiece: "VENTE",
  numeroTicket: 12,
  jourMetier: "2026-10-22",
  provisoire: false,
  poste: { id: "po1", code: "D1" },
  session: { id: "se1", ouverteAutomatiquement: false },
  paiements: [],
  annulation: null,
  venteOrigine: null,
  motif: null,
};

function installerPont() {
  const pont = {
    version: "0.1.0",
    etat: vi.fn().mockResolvedValue({ horsLigne: false, enLigne: true, fileEnAttente: 0 }),
    surEtat: vi.fn(() => () => undefined),
    caisse: { getVente: getVenteLocale },
    impression: { imprimerVente, signalerPret, lireReglages, enregistrerReglages },
  } as unknown as PontDesktop;
  window.medconnecteDesktop = pont;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  window.print = vi.fn();
  window.history.pushState({}, "", "/dashboard/ventes/x/recu");
  getVenteLocale.mockResolvedValue({ ok: true, data: VENTE, message: "ok" });
  lireReglages.mockResolvedValue({ ok: true, data: { imprimante: "Ticket 80", formatRecu: "80", impressionAutomatique: true }, message: "ok" });
  enregistrerReglages.mockResolvedValue({ ok: true, data: { imprimante: "Ticket 80", formatRecu: "A4", impressionAutomatique: true }, message: "ok" });
  imprimerVente.mockResolvedValue({ ok: true, data: null, message: "ok" });
  signalerPret.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  delete window.medconnecteDesktop;
});

describe("Reçu sur le poste desktop, fenêtre d'impression", () => {
  it("avec ?impression=1 : aucun bouton ni entête d'écran, et le poste est prévenu quand le reçu est rendu", async () => {
    installerPont();
    window.history.pushState({}, "", "/dashboard/ventes/x/recu?impression=1&format=80");
    const { container } = render(<RecuVentePage />);
    const recu = await screen.findByRole("article", { name: "Reçu T1-0000012" });

    expect(recu.className).toContain("w-[80mm]");
    expect(screen.queryByRole("button", { name: "Imprimer" })).toBeNull();
    expect(screen.queryByText("Format du ticket")).toBeNull();
    expect(screen.queryByText("Reçu de la vente")).toBeNull();
    expect(container.querySelector(".print\\:hidden")).toBeNull();
    await waitFor(() => expect(signalerPret).toHaveBeenCalledTimes(1));
    expect(lireReglages).not.toHaveBeenCalled();
  });

  it("n'appelle jamais signalerPret quand la vente ne se charge pas", async () => {
    installerPont();
    window.history.pushState({}, "", "/dashboard/ventes/x/recu?impression=1&format=58");
    getVenteLocale.mockResolvedValue({ ok: false, status: 500, message: "Échec", code: "ECHEC_ENREGISTREMENT" });
    render(<RecuVentePage />);
    await screen.findByRole("alert");
    await new Promise((r) => setTimeout(r, 200));
    expect(signalerPret).not.toHaveBeenCalled();
  });

  it("sans pont, ?impression=1 est ignoré : le reçu garde ses boutons et rien n'est signalé", async () => {
    window.history.pushState({}, "", "/dashboard/ventes/x/recu?impression=1&format=80");
    getVenteWeb.mockResolvedValue({ data: VENTE, message: "ok", success: true });
    render(<RecuVentePage />);
    await screen.findByRole("article");

    expect(screen.getByRole("button", { name: "Imprimer" })).toBeInTheDocument();
    expect(screen.getByText("Format du ticket")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Imprimer" }));
    expect(window.print).toHaveBeenCalledTimes(1);
    await new Promise((r) => setTimeout(r, 200));
    expect(signalerPret).not.toHaveBeenCalled();
  });
});

describe("Reçu d'une vente locale du poste", () => {
  it("nomme les plaquettes et mentionne « À régulariser » quand une part n'était pas en stock", async () => {
    installerPont();
    const locale = {
      ...VENTE,
      provisoire: true,
      aRegulariserLocal: true,
      lignes: [{ ...VENTE.lignes[0], uniteAffichee: "UNITE" as const, nombreAffiche: 25, uniteMinimale: "PLAQUETTE", nomMedicament: "Spasfon" }],
    };
    getVenteLocale.mockResolvedValue({ ok: true, data: locale, message: "ok" });
    render(<RecuVentePage />);
    const recu = await screen.findByRole("article");

    expect(recu.textContent).toContain("25 plaquettes de Spasfon");
    expect(recu.textContent).toContain("À régulariser : une partie de cette vente n'était pas en stock.");
  });

  it("une vente lue depuis l'API garde « unités » et n'a aucune mention", async () => {
    installerPont();
    const api = { ...VENTE, provisoire: true, lignes: [{ ...VENTE.lignes[0], uniteAffichee: "UNITE" as const, nombreAffiche: 25, nomMedicament: "Spasfon" }] };
    getVenteLocale.mockResolvedValue({ ok: true, data: api, message: "ok" });
    render(<RecuVentePage />);
    const recu = await screen.findByRole("article");

    expect(recu.textContent).toContain("25 unités de Spasfon");
    expect(recu.textContent).not.toContain("À régulariser");
  });
});

describe("Reçu sur le poste desktop, bouton Imprimer", () => {
  it("imprime par le pont, sans window.print", async () => {
    installerPont();
    render(<RecuVentePage />);
    await screen.findByRole("article");
    fireEvent.click(screen.getByRole("button", { name: "Imprimer" }));

    await waitFor(() => expect(imprimerVente).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111"));
    expect(window.print).not.toHaveBeenCalled();
  });

  it("le format du ticket est celui du poste et le choix devient le réglage du poste", async () => {
    installerPont();
    render(<RecuVentePage />);
    await screen.findByRole("article");
    await waitFor(() => expect(screen.getByRole("radio", { name: "Ticket 80 mm" })).toBeChecked());

    fireEvent.click(screen.getByRole("radio", { name: "Feuille A4" }));
    expect(enregistrerReglages).toHaveBeenCalledWith({ formatRecu: "A4" });
  });

  it("sans imprimante choisie : lien « Choisir l'imprimante » et repli sur window.print", async () => {
    installerPont();
    imprimerVente.mockResolvedValue({ ok: false, status: 409, code: "IMPRIMANTE_NON_CHOISIE", message: "Aucune imprimante." });
    render(<RecuVentePage />);
    await screen.findByRole("article");
    fireEvent.click(screen.getByRole("button", { name: "Imprimer" }));

    const lien = await screen.findByRole("link", { name: "Choisir l'imprimante" });
    expect(lien).toHaveAttribute("href", "/dashboard/poste");
    expect(window.print).toHaveBeenCalledTimes(1);
  });

  it("un échec d'impression affiche le message, sans window.print", async () => {
    installerPont();
    imprimerVente.mockResolvedValue({
      ok: false,
      status: 502,
      code: "IMPRESSION_ECHOUEE",
      message: "Le ticket n'a pas pu être imprimé. Vérifiez que l'imprimante est allumée et réessayez. La vente est bien enregistrée.",
    });
    render(<RecuVentePage />);
    await screen.findByRole("article");
    fireEvent.click(screen.getByRole("button", { name: "Imprimer" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Le ticket n'a pas pu être imprimé.");
    expect(window.print).not.toHaveBeenCalled();
  });
});
