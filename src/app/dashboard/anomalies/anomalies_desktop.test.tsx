import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Anomalie } from "@/lib/api_pilotage";
import type { PontDesktop } from "@/lib/caisse/contrat_desktop";
import AnomaliesPage from "./page";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", structureId: "s1", email: "u1@exemple.com", nom: "Baldé", prenom: "Djénabou", role: "STRUCTURE_ADMIN" },
    loading: false,
    profile: { permissions: ["anomalie:gerer"], structureType: "PHARMACIE" },
  }),
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("") }));

const anomalie: Anomalie = {
  id: "a1",
  type: "ECART_INVENTAIRE",
  libelle: "Écart d'inventaire",
  statut: "OUVERTE",
  creeLe: "2026-11-02T09:00:00.000Z",
  pieceType: "INVENTAIRE",
  pieceId: null,
  details: { message: "Glucophage : 5 unités de moins que prévu." },
  attribueeA: null,
  traiteeLe: null,
  traiteePar: null,
  commentaireTraitement: null,
  rattachement: null,
};

const ok = <T,>(data: T, message = "ok") => Promise.resolve({ ok: true as const, data, message });

describe("Anomalies sur le poste desktop, sans réseau", () => {
  const lister = vi.fn();
  const traiter = vi.fn();
  beforeEach(() => {
    lister.mockReset().mockImplementation(() => ok({ anomalies: [anomalie], page: 1, parPage: 20, total: 1, ouvertes: 1 }));
    traiter.mockReset().mockImplementation(() => ok({ ...anomalie, statut: "TRAITEE" }, "Anomalie traitée sur ce poste."));
    window.medconnecteDesktop = {
      version: "0.1.0",
      etat: () => Promise.resolve({ horsLigne: true, enLigne: false }),
      surEtat: () => () => undefined,
      caisse: {},
      anomalie: { lister, traiter },
    } as unknown as PontDesktop;
  });
  afterEach(() => {
    cleanup();
    delete window.medconnecteDesktop;
  });

  it("lit la file par le pont, sans appeler l'API", async () => {
    render(<AnomaliesPage />);
    expect(await screen.findByText("Glucophage : 5 unités de moins que prévu.")).toBeTruthy();
    expect(lister).toHaveBeenCalledWith("s1", { statut: "OUVERTE", page: 1 });
  });

  it("traite une anomalie par le pont et affiche le message du poste", async () => {
    render(<AnomaliesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Marquer comme traitée" }));
    fireEvent.change(screen.getByLabelText("Ce que vous avez vérifié ou fait"), { target: { value: "Recompté au comptoir" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(traiter).toHaveBeenCalledWith("s1", "a1", { commentaire: "Recompté au comptoir" }));
    expect(await screen.findByText("Anomalie traitée sur ce poste.")).toBeTruthy();
  });

  it("un refus du poste (déjà traitée) est dit clairement", async () => {
    traiter.mockImplementation(() => Promise.resolve({ ok: false, status: 409, code: "ANOMALIE_DEJA_TRAITEE", message: "Cette anomalie a déjà été traitée." }));
    render(<AnomaliesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Marquer comme traitée" }));
    fireEvent.change(screen.getByLabelText("Ce que vous avez vérifié ou fait"), { target: { value: "Recompté" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("Cette anomalie a déjà été traitée.")).toBeTruthy();
  });
});
