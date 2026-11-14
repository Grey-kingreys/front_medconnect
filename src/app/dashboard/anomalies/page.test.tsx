import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api_auth";
import type { Anomalie, PageAnomalies } from "@/lib/api_pilotage";
import AnomaliesPage from "./page";

const { listerAnomalies, traiterAnomalie } = vi.hoisted(() => ({
  listerAnomalies: vi.fn(),
  traiterAnomalie: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", structureId: "s1", email: "u1@exemple.com", nom: "Baldé", prenom: "Djénabou", role: "STRUCTURE_ADMIN" },
    loading: false,
    profile: { permissions: ["anomalie:gerer"], structureType: "PHARMACIE" },
  }),
}));
vi.mock("@/lib/api_pilotage", () => ({
  listerAnomalies,
  traiterAnomalie,
}));
let adresse = "";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(adresse) }));

const anomalie = (id: string, surcharge: Partial<Anomalie> = {}): Anomalie => ({
  id,
  type: "ECART_INVENTAIRE",
  libelle: "Écart d'inventaire",
  statut: "OUVERTE",
  creeLe: "2026-11-02T09:00:00.000Z",
  pieceType: "INVENTAIRE",
  pieceId: "piece-technique-123",
  details: { message: "Glucophage : 5 unités de moins que prévu." },
  attribueeA: null,
  traiteeLe: null,
  traiteePar: null,
  commentaireTraitement: null,
  rattachement: null,
  ...surcharge,
});

const reponse = (anomalies: Anomalie[], surcharge: Partial<PageAnomalies> = {}) =>
  ({
    data: { anomalies, page: 1, parPage: 20, total: anomalies.length, ouvertes: 4, ...surcharge },
    message: "ok",
    success: true,
  }) as never;

describe("File des anomalies", () => {
  beforeEach(() => {
    adresse = "";
    listerAnomalies.mockReset();
    traiterAnomalie.mockReset();
    listerAnomalies.mockResolvedValue(reponse([anomalie("a1")]));
  });
  afterEach(() => {
    cleanup();
  });

  it("affiche le compteur des anomalies à traiter dans l'onglet", async () => {
    render(<AnomaliesPage />);
    expect(await screen.findByRole("tab", { name: "À traiter (4)" })).toHaveAttribute("aria-selected", "true");
    expect(listerAnomalies).toHaveBeenCalledWith("s1", { statut: "OUVERTE", page: 1 });
  });

  it("affiche le message du serveur tel quel, sans identifiant technique", async () => {
    render(<AnomaliesPage />);
    expect(await screen.findByText("Glucophage : 5 unités de moins que prévu.")).toBeTruthy();
    expect(document.body.textContent).not.toContain("piece-technique-123");
    expect(document.body.textContent).not.toContain("ECART_INVENTAIRE");
  });

  it("affiche un type inconnu avec son libellé", async () => {
    listerAnomalies.mockResolvedValue(
      reponse([anomalie("a2", { type: "NOUVEAU_TYPE", libelle: "Cas nouveau", details: {} })]),
    );
    render(<AnomaliesPage />);
    expect(await screen.findByRole("heading", { name: "Cas nouveau" })).toBeTruthy();
    expect(screen.getByText("Pas de détail.")).toBeTruthy();
    expect(document.body.textContent).not.toContain("NOUVEAU_TYPE");
  });

  it("montre le rattachement d'une vente sans stock déjà régularisée", async () => {
    listerAnomalies.mockResolvedValue(
      reponse([
        anomalie("a3", {
          type: "STOCK_NEGATIF",
          libelle: "Vente sans stock",
          rattachement: { etat: "RATTACHEE", quantiteInitiale: 1, quantiteEnAttente: 0, message: "Le stock de cette vente a été rattaché à un lot." },
        }),
      ]),
    );
    render(<AnomaliesPage />);
    expect(await screen.findByText("Le stock de cette vente a été rattaché à un lot.")).toBeTruthy();
    expect(screen.getByText(/Le stock est déjà régularisé/)).toBeTruthy();
  });

  it("traite une anomalie avec un commentaire puis recharge la liste", async () => {
    traiterAnomalie.mockResolvedValue({ data: anomalie("a1"), message: "Anomalie traitée.", success: true });
    render(<AnomaliesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Marquer comme traitée" }));
    const dialogue = within(await screen.findByRole("dialog"));
    fireEvent.change(dialogue.getByLabelText("Ce que vous avez vérifié ou fait"), { target: { value: "Recompté en rayon" } });
    fireEvent.click(dialogue.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(traiterAnomalie).toHaveBeenCalledWith("s1", "a1", "Recompté en rayon"));
    expect(await screen.findByText("Anomalie traitée.")).toBeTruthy();
    await waitFor(() => expect(listerAnomalies).toHaveBeenCalledTimes(2));
  });

  it("refuse un commentaire de 2 caractères sans rien envoyer", async () => {
    render(<AnomaliesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Marquer comme traitée" }));
    const dialogue = within(await screen.findByRole("dialog"));
    fireEvent.change(dialogue.getByLabelText("Ce que vous avez vérifié ou fait"), { target: { value: "ok" } });
    fireEvent.click(dialogue.getByRole("button", { name: "Enregistrer" }));
    expect(dialogue.getByText("Indiquez ce que vous avez vérifié ou fait (3 caractères au moins).")).toBeTruthy();
    expect(traiterAnomalie).not.toHaveBeenCalled();
  });

  it("affiche le message du serveur quand une autre personne a déjà traité l'anomalie", async () => {
    traiterAnomalie.mockRejectedValue(new ApiError("Cette anomalie a déjà été traitée.", 409, { code: "ANOMALIE_DEJA_TRAITEE" }));
    render(<AnomaliesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Marquer comme traitée" }));
    const dialogue = within(await screen.findByRole("dialog"));
    fireEvent.change(dialogue.getByLabelText("Ce que vous avez vérifié ou fait"), { target: { value: "Vérifié" } });
    fireEvent.click(dialogue.getByRole("button", { name: "Enregistrer" }));
    expect(await dialogue.findByText("Cette anomalie a déjà été traitée.")).toBeTruthy();
    expect(dialogue.getByRole("button", { name: "Enregistrer" })).toBeDisabled();
    fireEvent.click(dialogue.getByRole("button", { name: "Fermer" }));
    await waitFor(() => expect(listerAnomalies).toHaveBeenCalledTimes(2));
  });

  it("après une coupure, bloque le second envoi et relit la liste à la fermeture", async () => {
    traiterAnomalie.mockRejectedValue(new ApiError("Hors connexion", 0));
    render(<AnomaliesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Marquer comme traitée" }));
    const dialogue = within(await screen.findByRole("dialog"));
    fireEvent.change(dialogue.getByLabelText("Ce que vous avez vérifié ou fait"), { target: { value: "Vérifié" } });
    fireEvent.click(dialogue.getByRole("button", { name: "Enregistrer" }));
    expect(await dialogue.findByText("Le traitement n'a peut-être pas été enregistré. Fermez cette fenêtre et vérifiez la liste.")).toBeTruthy();
    expect(dialogue.getByRole("button", { name: "Enregistrer" })).toBeDisabled();
    fireEvent.click(dialogue.getByRole("button", { name: "Fermer" }));
    await waitFor(() => expect(listerAnomalies).toHaveBeenCalledTimes(2));
    expect(traiterAnomalie).toHaveBeenCalledTimes(1);
  });

  it("un double clic sur Enregistrer n'envoie qu'un traitement", async () => {
    traiterAnomalie.mockImplementation(() => new Promise(() => {}));
    render(<AnomaliesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Marquer comme traitée" }));
    const dialogue = within(await screen.findByRole("dialog"));
    fireEvent.change(dialogue.getByLabelText("Ce que vous avez vérifié ou fait"), { target: { value: "Vérifié" } });
    const enregistrer = dialogue.getByRole("button", { name: "Enregistrer" });
    fireEvent.click(enregistrer);
    fireEvent.click(enregistrer);
    await waitFor(() => expect(traiterAnomalie).toHaveBeenCalledTimes(1));
    expect(enregistrer).toBeDisabled();
    expect(traiterAnomalie).toHaveBeenCalledTimes(1);
  });

  it("filtre par type en revenant à la page 1", async () => {
    render(<AnomaliesPage />);
    await screen.findByText("Glucophage : 5 unités de moins que prévu.");
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "ECART_CAISSE" } });
    await waitFor(() =>
      expect(listerAnomalies).toHaveBeenLastCalledWith("s1", { statut: "OUVERTE", type: "ECART_CAISSE", page: 1 }),
    );
  });

  it("reprend le filtre de l'adresse et ignore un type inconnu", async () => {
    adresse = "type=REMONTEE_APRES_CLOTURE";
    render(<AnomaliesPage />);
    await waitFor(() =>
      expect(listerAnomalies).toHaveBeenCalledWith("s1", { statut: "OUVERTE", type: "REMONTEE_APRES_CLOTURE", page: 1 }),
    );
    cleanup();
    listerAnomalies.mockClear();
    adresse = "type=N_IMPORTE_QUOI";
    render(<AnomaliesPage />);
    await waitFor(() => expect(listerAnomalies).toHaveBeenCalledWith("s1", { statut: "OUVERTE", page: 1 }));
  });

  it("propose de voir tous les types quand le filtre ne donne rien", async () => {
    adresse = "type=ECART_CAISSE";
    listerAnomalies.mockResolvedValue(reponse([]));
    render(<AnomaliesPage />);
    expect(await screen.findByText("Aucune anomalie de ce type à traiter.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Voir tous les types" }));
    await waitFor(() => expect(listerAnomalies).toHaveBeenLastCalledWith("s1", { statut: "OUVERTE", page: 1 }));
  });

  it("montre la somme d'une vente remontée après la clôture, même négative", async () => {
    listerAnomalies.mockResolvedValue(
      reponse([
        anomalie("a5", { type: "REMONTEE_APRES_CLOTURE", libelle: "Autre", details: { message: "Vente remontée.", total: -15000 } }),
      ]),
    );
    render(<AnomaliesPage />);
    expect(await screen.findByText(/Montant : -15 000 GNF/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Vente remontée après la clôture" })).toBeTruthy();
  });

  it("efface le message de succès au changement d'onglet", async () => {
    traiterAnomalie.mockResolvedValue({ data: anomalie("a1"), message: "Anomalie traitée.", success: true });
    render(<AnomaliesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Marquer comme traitée" }));
    const dialogue = within(await screen.findByRole("dialog"));
    fireEvent.change(dialogue.getByLabelText("Ce que vous avez vérifié ou fait"), { target: { value: "Vérifié" } });
    fireEvent.click(dialogue.getByRole("button", { name: "Enregistrer" }));
    await screen.findByText("Anomalie traitée.");
    fireEvent.click(screen.getByRole("tab", { name: /Traitées/ }));
    await waitFor(() => expect(screen.queryByText("Anomalie traitée.")).toBeNull());
  });

  it("pagine la file au-delà de la première page", async () => {
    listerAnomalies.mockResolvedValue(reponse([anomalie("a1")], { total: 45 }));
    render(<AnomaliesPage />);
    expect(await screen.findByText("Page 1 sur 3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Page suivante" }));
    await waitFor(() => expect(listerAnomalies).toHaveBeenLastCalledWith("s1", { statut: "OUVERTE", page: 2 }));
  });

  it("montre les anomalies traitées avec leur commentaire", async () => {
    listerAnomalies.mockResolvedValue(
      reponse([
        anomalie("a4", {
          statut: "TRAITEE",
          traiteeLe: "2026-11-02T12:00:00.000Z",
          traiteePar: { id: "u1", nom: "Djénabou Baldé" },
          commentaireTraitement: "Argent recompté",
        }),
      ]),
    );
    render(<AnomaliesPage />);
    fireEvent.click(await screen.findByRole("tab", { name: /Traitées/ }));
    expect(await screen.findByText(/par Djénabou Baldé : Argent recompté/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Marquer comme traitée" })).toBeNull();
  });
});
