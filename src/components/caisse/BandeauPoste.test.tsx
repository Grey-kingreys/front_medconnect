import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EtatPosteDesktop, PontDesktop } from "@/lib/caisse/contrat_desktop";
import { BandeauPoste } from "./BandeauPoste";

const ETAT: EtatPosteDesktop = {
  enLigne: true,
  horsLigne: false,
  connexionARefaire: false,
  nonEnregistre: false,
  catalogueDisponible: true,
  fileEnAttente: 0,
  rejetes: 0,
  plageEpuisee: false,
  heureFausse: false,
  posteDesactive: false,
  autrePharmacie: false,
  dernierContactLe: null,
  photographieLe: null,
  messageEnvoi: null,
};

function brancher(etat: EtatPosteDesktop) {
  let rappel: ((e: EtatPosteDesktop) => void) | null = null;
  const pont = {
    etat: vi.fn().mockResolvedValue(etat),
    surEtat: (r: (e: EtatPosteDesktop) => void) => {
      rappel = r;
      return () => undefined;
    },
  } as unknown as PontDesktop;
  window.medconnecteDesktop = pont;
  return (e: EtatPosteDesktop) => act(() => rappel?.(e));
}

afterEach(() => {
  cleanup();
  delete window.medconnecteDesktop;
});

describe("BandeauPoste", () => {
  it("n'affiche rien sur le web", () => {
    const { container } = render(<BandeauPoste />);
    expect(container).toBeEmptyDOMElement();
  });

  it("dit En ligne, discrètement, file vide", async () => {
    brancher(ETAT);
    render(<BandeauPoste />);
    expect(await screen.findByText("En ligne")).toBeInTheDocument();
  });

  it("au démarrage, ne parle pas de coupure", async () => {
    brancher({ ...ETAT, enLigne: false, horsLigne: false });
    render(<BandeauPoste />);
    expect(await screen.findByText("Connexion au serveur en cours...")).toBeInTheDocument();
    expect(screen.queryByText(/Hors connexion/)).toBeNull();
  });

  it("compte les ventes en cours d'envoi", async () => {
    brancher({ ...ETAT, fileEnAttente: 2 });
    render(<BandeauPoste />);
    expect(await screen.findByText("En ligne : 2 ventes en cours d'envoi.")).toBeInTheDocument();
  });

  it("dit Hors connexion avec le nombre en attente, puis suit l'état", async () => {
    const pousser = brancher({ ...ETAT, enLigne: false, horsLigne: true, fileEnAttente: 4 });
    render(<BandeauPoste />);
    expect(
      await screen.findByText("Hors connexion : les ventes sont enregistrées sur ce poste (4 en attente d'envoi)."),
    ).toBeInTheDocument();
    pousser(ETAT);
    expect(await screen.findByText("En ligne")).toBeInTheDocument();
  });

  it("demande de se reconnecter, de charger le catalogue, ou signale une autre pharmacie", async () => {
    brancher({ ...ETAT, connexionARefaire: true, fileEnAttente: 1 });
    const { unmount } = render(<BandeauPoste />);
    expect(
      await screen.findByText("Reconnectez-vous pour envoyer les ventes de ce poste. Elles restent enregistrées (1 en attente)."),
    ).toBeInTheDocument();
    unmount();

    brancher({ ...ETAT, catalogueDisponible: false });
    const second = render(<BandeauPoste />);
    expect(
      await screen.findByText("Connectez ce poste à internet une première fois pour charger le catalogue."),
    ).toBeInTheDocument();
    second.unmount();

    brancher({ ...ETAT, autrePharmacie: true });
    render(<BandeauPoste />);
    expect(await screen.findByText("Ce poste est rattaché à une autre pharmacie.")).toBeInTheDocument();
  });

  it("affiche tel quel le message d'un envoi bloqué, sans jamais le masquer", async () => {
    brancher({ ...ETAT, messageEnvoi: "Une vente n'a pas pu être envoyée : contactez le titulaire." });
    render(<BandeauPoste />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Une vente n'a pas pu être envoyée : contactez le titulaire.");
  });

  it("affiche les autres alertes", async () => {
    brancher({ ...ETAT, plageEpuisee: true, rejetes: 2, heureFausse: true, posteDesactive: true });
    render(<BandeauPoste />);
    expect(await screen.findByText(/Numéros de tickets épuisés/)).toBeInTheDocument();
    expect(screen.getByText("2 opérations refusées par le serveur : le titulaire les voit dans ses anomalies.")).toBeInTheDocument();
    expect(screen.getByText(/L'heure de cet ordinateur semble fausse/)).toBeInTheDocument();
    expect(screen.getByText(/Ce poste a été désactivé/)).toBeInTheDocument();
  });
});
