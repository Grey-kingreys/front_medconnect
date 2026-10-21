import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api_auth";
import type { AppareilConnecte } from "@/lib/api_appareils";
import MesAppareilsPage from "./page";

const { getAppareilsConnectes, deconnecterAppareil, deconnecterAutresAppareils } = vi.hoisted(() => ({
  getAppareilsConnectes: vi.fn(),
  deconnecterAppareil: vi.fn(),
  deconnecterAutresAppareils: vi.fn(),
}));

vi.mock("@/lib/api_appareils", () => ({ getAppareilsConnectes, deconnecterAppareil, deconnecterAutresAppareils }));

const maintenant = () => new Date().toISOString();

const COURANT: AppareilConnecte = {
  id: "a1",
  type: "web",
  nom: "Chrome sur Windows",
  plateforme: "web",
  versionApp: null,
  creeLe: maintenant(),
  derniereActivite: maintenant(),
  expireLe: maintenant(),
  appareilCourant: true,
};

const AUTRE: AppareilConnecte = {
  ...COURANT,
  id: "a2",
  type: "mobile",
  nom: "Téléphone Android",
  plateforme: "android",
  appareilCourant: false,
};

const reponse = (data: AppareilConnecte[]) => ({ data, message: "ok", success: true });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Mes appareils connectés", () => {
  it("affiche la liste, repère l'appareil courant et propose de déconnecter les autres", async () => {
    getAppareilsConnectes.mockResolvedValue(reponse([COURANT, AUTRE]));
    render(<MesAppareilsPage />);

    expect(await screen.findByText("Chrome sur Windows")).toBeInTheDocument();
    expect(screen.getByText("Téléphone Android")).toBeInTheDocument();
    const badges = screen.getAllByText("Cet appareil");
    expect(badges).toHaveLength(1);
    const ligneCourante = screen.getByText("Chrome sur Windows").closest("li") as HTMLElement;
    expect(within(ligneCourante).getByText("Cet appareil")).toBeInTheDocument();
    expect(screen.getByText("Application Android")).toBeInTheDocument();
    expect(screen.getAllByText("Dernière activité : à l'instant").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Déconnecter Téléphone Android" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Déconnecter Chrome sur Windows" })).toBeNull();
    expect(screen.getByRole("button", { name: "Déconnecter tous mes autres appareils" })).toBeInTheDocument();
  });

  it("déconnecte un appareil après confirmation", async () => {
    getAppareilsConnectes.mockResolvedValue(reponse([COURANT, AUTRE]));
    deconnecterAppareil.mockResolvedValue({ data: { id: "a2" }, message: "Appareil déconnecté.", success: true });
    render(<MesAppareilsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Déconnecter Téléphone Android" }));
    const modale = screen.getByRole("dialog");
    expect(within(modale).getByText("Déconnecter cet appareil ?")).toBeInTheDocument();
    fireEvent.click(within(modale).getByRole("button", { name: "Déconnecter" }));

    await waitFor(() => expect(deconnecterAppareil).toHaveBeenCalledWith("a2"));
    await waitFor(() => expect(screen.queryByText("Téléphone Android")).toBeNull());
    expect(screen.getByText("Vous n'êtes connecté sur aucun autre appareil.")).toBeInTheDocument();
  });

  it("affiche le message d'échec dans la modale et garde la ligne", async () => {
    getAppareilsConnectes.mockResolvedValue(reponse([COURANT, AUTRE]));
    deconnecterAppareil.mockRejectedValue(new ApiError("Cet appareil est introuvable ou déjà déconnecté.", 404));
    render(<MesAppareilsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Déconnecter Téléphone Android" }));
    const modale = screen.getByRole("dialog");
    fireEvent.click(within(modale).getByRole("button", { name: "Déconnecter" }));

    expect(await within(modale).findByText("Cet appareil est introuvable ou déjà déconnecté.")).toBeInTheDocument();
    expect(screen.getAllByText("Téléphone Android").length).toBeGreaterThan(0);
  });

  it("déconnecte tous les autres appareils après confirmation", async () => {
    getAppareilsConnectes.mockResolvedValue(reponse([COURANT, AUTRE]));
    deconnecterAutresAppareils.mockResolvedValue({ data: { nombre: 1 }, message: "Vos autres appareils ont été déconnectés.", success: true });
    render(<MesAppareilsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Déconnecter tous mes autres appareils" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Tout déconnecter" }));

    await waitFor(() => expect(deconnecterAutresAppareils).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText("Téléphone Android")).toBeNull());
    expect(screen.getByText("Chrome sur Windows")).toBeInTheDocument();
  });

  it("propose de réessayer après une erreur de chargement", async () => {
    getAppareilsConnectes
      .mockRejectedValueOnce(new ApiError("Vous semblez hors connexion. Vérifiez votre connexion internet puis réessayez.", 0))
      .mockResolvedValueOnce(reponse([COURANT, AUTRE]));
    render(<MesAppareilsPage />);

    expect(await screen.findByText("Vous semblez hors connexion. Vérifiez votre connexion internet puis réessayez.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));

    expect(await screen.findByText("Téléphone Android")).toBeInTheDocument();
  });

  it("n'affiche pas le bouton groupé quand seul l'appareil courant est connecté", async () => {
    getAppareilsConnectes.mockResolvedValue(reponse([COURANT]));
    render(<MesAppareilsPage />);

    expect(await screen.findByText("Chrome sur Windows")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Déconnecter tous mes autres appareils" })).toBeNull();
    expect(screen.getByText("Vous n'êtes connecté sur aucun autre appareil.")).toBeInTheDocument();
  });

  it("guide l'utilisateur quand la liste est vide", async () => {
    getAppareilsConnectes.mockResolvedValue(reponse([]));
    render(<MesAppareilsPage />);

    expect(await screen.findByText("Aucun appareil à afficher pour le moment.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Actualiser" })).toBeInTheDocument();
  });
});
