import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PontDesktop } from "@/lib/caisse/contrat_desktop";
import PostePage from "./page";

const { listerImprimantes, lireReglages, enregistrerReglages, lireInfosPoste, imprimerVente, notFound } = vi.hoisted(() => ({
  listerImprimantes: vi.fn(),
  lireReglages: vi.fn(),
  enregistrerReglages: vi.fn(),
  lireInfosPoste: vi.fn(),
  imprimerVente: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", structureId: "p1", nom: "Diallo", prenom: "Mariama", role: "PHARMACIEN" }, loading: false }),
}));

const IMPRIMANTES = [
  { name: "Ticket 80", displayName: "Imprimante ticket 80", isDefault: false },
  { name: "Bureau", displayName: "Imprimante du bureau", isDefault: true },
];
const VENTE_ID = "44444444-4444-4444-8444-444444444444";

function installerPont() {
  window.medconnecteDesktop = {
    version: "0.1.0",
    etat: vi.fn().mockResolvedValue({ dernierContactLe: "2026-10-22T10:05:00.000Z" }),
    surEtat: vi.fn(() => () => undefined),
    impression: { listerImprimantes, lireReglages, enregistrerReglages, lireInfosPoste, imprimerVente },
  } as unknown as PontDesktop;
}

beforeEach(() => {
  vi.clearAllMocks();
  listerImprimantes.mockResolvedValue({ ok: true, data: IMPRIMANTES, message: "ok" });
  lireReglages.mockResolvedValue({ ok: true, data: { imprimante: null, formatRecu: "58", impressionAutomatique: false }, message: "ok" });
  lireInfosPoste.mockResolvedValue({ ok: true, data: { posteCode: "D3", posteLibelle: "Comptoir principal", derniereVenteId: VENTE_ID }, message: "ok" });
  enregistrerReglages.mockImplementation(async (modif: object) => ({
    ok: true,
    data: { imprimante: null, formatRecu: "58", impressionAutomatique: false, ...modif },
    message: "ok",
  }));
  imprimerVente.mockResolvedValue({ ok: true, data: null, message: "ok" });
});

afterEach(() => {
  cleanup();
  delete window.medconnecteDesktop;
});

describe("Réglages de ce poste", () => {
  it("sans pont (web), la page est introuvable", () => {
    expect(() => render(<PostePage />)).toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  it("liste les imprimantes et montre le poste, la version et le dernier échange", async () => {
    installerPont();
    render(<PostePage />);

    expect(await screen.findByRole("heading", { name: "Réglages de ce poste" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("option", { name: "Imprimante ticket 80" })).toBeInTheDocument());
    expect(screen.getByRole("option", { name: "Imprimante du bureau (par défaut du système)" })).toBeInTheDocument();
    expect(screen.getByText("D3")).toBeInTheDocument();
    expect(screen.getByText("Comptoir principal")).toBeInTheDocument();
    expect(screen.getByText("0.1.0")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/22\/10\/2026/)).toBeInTheDocument());
  });

  it("enregistre l'imprimante, le format et la case d'impression automatique", async () => {
    installerPont();
    render(<PostePage />);
    await screen.findByRole("option", { name: "Imprimante ticket 80" });

    fireEvent.change(screen.getByLabelText("Imprimante"), { target: { value: "Ticket 80" } });
    await waitFor(() => expect(enregistrerReglages).toHaveBeenCalledWith({ imprimante: "Ticket 80" }));

    fireEvent.click(screen.getByRole("radio", { name: "Ticket 80 mm" }));
    await waitFor(() => expect(enregistrerReglages).toHaveBeenCalledWith({ formatRecu: "80" }));

    fireEvent.click(screen.getByRole("checkbox", { name: "Imprimer le ticket après chaque vente" }));
    await waitFor(() => expect(enregistrerReglages).toHaveBeenCalledWith({ impressionAutomatique: true }));
  });

  it("imprime un ticket d'essai de la dernière vente locale", async () => {
    installerPont();
    lireReglages.mockResolvedValue({ ok: true, data: { imprimante: "Ticket 80", formatRecu: "80", impressionAutomatique: true }, message: "ok" });
    render(<PostePage />);
    const bouton = await screen.findByRole("button", { name: "Imprimer un ticket d'essai" });
    await waitFor(() => expect(bouton).not.toBeDisabled());

    fireEvent.click(bouton);
    await waitFor(() => expect(imprimerVente).toHaveBeenCalledWith(VENTE_ID));
    expect(await screen.findByText("Le ticket d'essai a été envoyé à l'imprimante.")).toBeInTheDocument();
  });

  it("sans vente locale, le ticket d'essai est désactivé et le dit", async () => {
    installerPont();
    lireReglages.mockResolvedValue({ ok: true, data: { imprimante: "Ticket 80", formatRecu: "80", impressionAutomatique: true }, message: "ok" });
    lireInfosPoste.mockResolvedValue({ ok: true, data: { posteCode: "D3", posteLibelle: "Comptoir", derniereVenteId: null }, message: "ok" });
    render(<PostePage />);

    expect(await screen.findByText("Faites d'abord une vente.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Imprimer un ticket d'essai" })).toBeDisabled();
  });

  it("montre l'échec d'impression du ticket d'essai", async () => {
    installerPont();
    lireReglages.mockResolvedValue({ ok: true, data: { imprimante: "Ticket 80", formatRecu: "80", impressionAutomatique: true }, message: "ok" });
    imprimerVente.mockResolvedValue({ ok: false, status: 502, code: "IMPRESSION_ECHOUEE", message: "Le ticket n'a pas pu être imprimé." });
    render(<PostePage />);
    const bouton = await screen.findByRole("button", { name: "Imprimer un ticket d'essai" });
    await waitFor(() => expect(bouton).not.toBeDisabled());
    fireEvent.click(bouton);

    expect(await screen.findByRole("alert")).toHaveTextContent("Le ticket n'a pas pu être imprimé.");
  });

  it("affiche l'adresse du serveur et annonce des mises à jour à la main", async () => {
    installerPont();
    lireInfosPoste.mockResolvedValue({
      ok: true,
      data: { posteCode: "D3", posteLibelle: "Comptoir", derniereVenteId: null, adresseApi: "http://127.0.0.1:3101", majAutomatique: false },
      message: "ok",
    });
    render(<PostePage />);

    expect(await screen.findByText("http://127.0.0.1:3101")).toBeInTheDocument();
    expect(screen.getByText(/mises à jour se font à la main/)).toBeInTheDocument();
  });

  it("propose d'installer une mise à jour prête, désactivé tant que la règle l'interdit", async () => {
    installerPont();
    const pont = window.medconnecteDesktop as unknown as { etat: ReturnType<typeof vi.fn> };
    pont.etat.mockResolvedValue({ dernierContactLe: null, majPrete: "0.1.1", majInstallable: false });
    render(<PostePage />);

    expect(await screen.findByText("Mise à jour 0.1.1 prête : elle s'installera à la fermeture.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Installer maintenant" })).toBeDisabled();
    expect(screen.getByText("Fermez d'abord la caisse et attendez l'envoi des ventes.")).toBeInTheDocument();
  });

  it("installe maintenant quand la règle l'autorise", async () => {
    installerPont();
    const installer = vi.fn().mockResolvedValue({ ok: true, data: null, message: "ok" });
    const pont = window.medconnecteDesktop as unknown as { etat: ReturnType<typeof vi.fn>; maj: { installer: typeof installer } };
    pont.etat.mockResolvedValue({ dernierContactLe: null, majPrete: "0.1.1", majInstallable: true });
    pont.maj = { installer };
    render(<PostePage />);

    const bouton = await screen.findByRole("button", { name: "Installer maintenant" });
    await waitFor(() => expect(bouton).not.toBeDisabled());
    fireEvent.click(bouton);
    await waitFor(() => expect(installer).toHaveBeenCalled());
  });
});
