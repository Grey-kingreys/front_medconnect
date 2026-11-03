import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api_auth";
import type { Cloture, PosteAttendu, PreparationCloture, SessionResume, TotalCloture } from "@/lib/api_caisse";
import { formaterGNF } from "@/lib/format_gnf";
import { jourConakry } from "../ventes/affichage";
import CloturesPage from "./page";

const { getPreparationCloture, cloturerJournee, listerClotures, exporterCloture, listerRemonteesApresCloture } = vi.hoisted(() => ({
  getPreparationCloture: vi.fn(),
  cloturerJournee: vi.fn(),
  listerClotures: vi.fn(),
  exporterCloture: vi.fn(),
  listerRemonteesApresCloture: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", structureId: "s1", email: "u1@exemple.com", nom: "Baldé", prenom: "Djénabou", role: "STRUCTURE_ADMIN" },
    loading: false,
    profile: { permissions: ["cloture:gerer", "anomalie:gerer"], structureType: "PHARMACIE" },
  }),
}));
vi.mock("@/lib/api_caisse", () => ({
  getPreparationCloture,
  cloturerJournee,
  listerClotures,
  exporterCloture,
  listerRemonteesApresCloture,
}));

const jour = jourConakry(new Date());

const session = (surcharge: Partial<SessionResume> = {}): SessionResume => ({
  id: "sc1",
  posteId: "po1",
  posteCode: "W1",
  posteLibelle: "Poste web",
  posteType: "WEB",
  utilisateurId: "u2",
  utilisateurNom: "Ousmane Keita",
  statut: "FERMEE",
  ouverteLe: `${jour}T08:15:00.000Z`,
  fermeeLe: `${jour}T17:40:00.000Z`,
  ...surcharge,
});

const posteDesktop: PosteAttendu = {
  posteId: "po9",
  posteCode: "D1",
  libelle: "Comptoir principal",
  type: "DESKTOP",
  raison: "SYNCHRO_INCOMPLETE",
  sessionId: null,
  utilisateurNom: null,
  dernierContactLe: null,
  message: "Le Comptoir principal n'a pas fini d'envoyer ses ventes.",
};
const posteWeb: PosteAttendu = {
  posteId: "po1",
  posteCode: "W1",
  libelle: "Poste web",
  type: "WEB",
  raison: "SESSION_OUVERTE",
  sessionId: "sc1",
  utilisateurNom: "Ousmane Keita",
  dernierContactLe: null,
  message: "La caisse d'Ousmane Keita est encore ouverte.",
};

const TOTAUX: TotalCloture[] = [
  { mode: "ESPECES", libelle: "Espèces", theorique: 213000, compte: 211000, ecart: -2000, sessionsNonRapprochees: 0 },
  { mode: "ORANGE_MONEY", libelle: "Orange Money", theorique: 87000, compte: null, ecart: null, sessionsNonRapprochees: 2 },
];

const preparation = (surcharge: Partial<PreparationCloture> = {}): PreparationCloture => ({
  jour,
  cloture: null,
  sessions: [session()],
  sessionsOuvertes: [],
  postesAttendus: [],
  totaux: TOTAUX,
  peutCloturer: true,
  peutForcer: false,
  ...surcharge,
});

const clotureFaite = (surcharge: Partial<Cloture> = {}): Cloture => ({
  id: "c1",
  jour,
  clotureeLe: `${jour}T18:30:00.000Z`,
  clotureParId: "u1",
  clotureParNom: "Djénabou Baldé",
  forcee: false,
  motifForcage: null,
  postesManquants: [],
  nombreSessions: 1,
  totaux: TOTAUX,
  ...surcharge,
});

const reponse = <T,>(data: T, message = "ok") => ({ data, message, success: true });

beforeEach(() => {
  vi.clearAllMocks();
  getPreparationCloture.mockResolvedValue(reponse(preparation()));
  listerClotures.mockResolvedValue(reponse({ mois: jour.slice(0, 7), clotures: [] }));
  listerRemonteesApresCloture.mockResolvedValue({ anomalies: [], total: 0 });
});

afterEach(cleanup);

describe("page Clôture de caisse", () => {
  it("liste les caisses et les totaux, avec un compté inconnu affiché « non rapproché » sans écart", async () => {
    render(<CloturesPage />);
    expect(await screen.findByText("Poste web (W1), Ousmane Keita")).toBeTruthy();
    expect(screen.getByText(/Fermée à/)).toBeTruthy();
    const ligneEspeces = screen.getByRole("row", { name: /Espèces/ });
    expect(ligneEspeces.textContent).toContain(formaterGNF(-2000));
    const ligneOrange = screen.getByRole("row", { name: /Orange Money/ });
    expect(within(ligneOrange).getByText("non rapproché")).toBeTruthy();
    expect(within(ligneOrange).getByText("2 caisse(s) sans relevé")).toBeTruthy();
    expect(ligneOrange.textContent).not.toContain("aucun");
  });

  it("désactive la clôture quand le serveur attend un poste et affiche son message tel quel", async () => {
    getPreparationCloture.mockResolvedValue(reponse(preparation({ postesAttendus: [posteWeb], peutCloturer: false })));
    render(<CloturesPage />);
    expect(await screen.findByText("La caisse d'Ousmane Keita est encore ouverte.")).toBeTruthy();
    expect(screen.getAllByText("Poste web (W1), Ousmane Keita")).toHaveLength(2);
    expect(screen.getByText(/Le vendeur doit fermer sa caisse/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Clôturer la journée" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Réglez les points ci-dessus pour pouvoir clôturer.")).toBeTruthy();
  });

  it("clôture après confirmation puis recharge la préparation", async () => {
    getPreparationCloture
      .mockResolvedValueOnce(reponse(preparation()))
      .mockResolvedValue(reponse(preparation({ cloture: clotureFaite() })));
    cloturerJournee.mockResolvedValue(reponse(clotureFaite(), "La journée est clôturée."));
    render(<CloturesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Clôturer la journée" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer la clôture" }));
    await waitFor(() => expect(cloturerJournee).toHaveBeenCalledWith("s1", { jour }));
    expect(await screen.findByText(/Journée clôturée le/)).toBeTruthy();
    expect(screen.getByText("La journée est clôturée.")).toBeTruthy();
    // Chargement, relecture immédiate après la clôture, puis rechargement.
    expect(getPreparationCloture.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("refuse un motif de 2 caractères puis envoie la clôture forcée avec un motif valide", async () => {
    getPreparationCloture.mockResolvedValue(reponse(preparation({ postesAttendus: [posteDesktop], peutCloturer: false, peutForcer: true })));
    cloturerJournee.mockResolvedValue(reponse(clotureFaite({ forcee: true }), "Journée clôturée."));
    render(<CloturesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Clôturer quand même (poste hors connexion)" }));
    const dialogue = await screen.findByRole("dialog");
    fireEvent.change(within(dialogue).getByLabelText("Motif"), { target: { value: "ab" } });
    fireEvent.click(within(dialogue).getByRole("button", { name: "Clôturer quand même" }));
    expect(within(dialogue).getByText("Indiquez un motif de 3 à 500 caractères.")).toBeTruthy();
    expect(cloturerJournee).not.toHaveBeenCalled();
    fireEvent.change(within(dialogue).getByLabelText("Motif"), { target: { value: "Poste en panne" } });
    fireEvent.click(within(dialogue).getByRole("button", { name: "Clôturer quand même" }));
    await waitFor(() => expect(cloturerJournee).toHaveBeenCalledWith("s1", { jour, forcer: true, motifForcage: "Poste en panne" }));
  });

  it("affiche le message global et le détail poste par poste d'un refus CAISSES_A_FERMER", async () => {
    cloturerJournee.mockRejectedValue(
      new ApiError("Fermez d'abord cette caisse ouverte sur un navigateur : Ousmane Keita (W1).", 409, {
        code: "CAISSES_A_FERMER",
        details: [{ message: "La caisse d'Ousmane Keita sur le poste W1 est encore ouverte." }],
      }),
    );
    render(<CloturesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Clôturer la journée" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer la clôture" }));
    expect(await screen.findByText(/Fermez d'abord cette caisse ouverte sur un navigateur : Ousmane Keita \(W1\)/)).toBeTruthy();
    expect(screen.getByText("La caisse d'Ousmane Keita sur le poste W1 est encore ouverte.")).toBeTruthy();
    await waitFor(() => expect(getPreparationCloture).toHaveBeenCalledTimes(2));
  });

  it("affiche le message d'un refus CLOTURE_INCOMPLETE avec ses détails", async () => {
    cloturerJournee.mockRejectedValue(
      new ApiError("La journée ne peut pas encore être clôturée. Poste à attendre : Comptoir principal.", 409, {
        code: "CLOTURE_INCOMPLETE",
        details: [{ message: posteDesktop.message }],
      }),
    );
    render(<CloturesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Clôturer la journée" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer la clôture" }));
    expect(await screen.findByText(/Poste à attendre : Comptoir principal/)).toBeTruthy();
    expect(screen.getByText(posteDesktop.message)).toBeTruthy();
  });

  it("recharge la préparation sans message d'erreur quand la journée est déjà clôturée", async () => {
    getPreparationCloture
      .mockResolvedValueOnce(reponse(preparation()))
      .mockResolvedValue(reponse(preparation({ cloture: clotureFaite() })));
    cloturerJournee.mockRejectedValue(new ApiError("La journée est déjà clôturée.", 409, { code: "JOURNEE_DEJA_CLOTUREE" }));
    render(<CloturesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Clôturer la journée" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer la clôture" }));
    expect(await screen.findByText(/Journée clôturée le/)).toBeTruthy();
    expect(screen.queryByText("La journée est déjà clôturée.")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("affiche le motif dans le dialogue pour MOTIF_REQUIS", async () => {
    getPreparationCloture.mockResolvedValue(reponse(preparation({ postesAttendus: [posteDesktop], peutCloturer: false, peutForcer: true })));
    cloturerJournee.mockRejectedValue(new ApiError("Indiquez pourquoi vous clôturez sans attendre ces postes.", 400, { code: "MOTIF_REQUIS" }));
    render(<CloturesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Clôturer quand même (poste hors connexion)" }));
    const dialogue = await screen.findByRole("dialog");
    fireEvent.change(within(dialogue).getByLabelText("Motif"), { target: { value: "Panne" } });
    fireEvent.click(within(dialogue).getByRole("button", { name: "Clôturer quand même" }));
    expect(await within(dialogue).findByText("Indiquez pourquoi vous clôturez sans attendre ces postes.")).toBeTruthy();
  });

  it("ne renvoie jamais la clôture après une erreur réseau et propose « Vérifier »", async () => {
    cloturerJournee.mockRejectedValue(new ApiError("Hors connexion", 0));
    render(<CloturesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Clôturer la journée" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer la clôture" }));
    expect(await screen.findByText(/La clôture n'a peut-être pas été enregistrée/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Vérifier" }));
    await waitFor(() => expect(getPreparationCloture).toHaveBeenCalledTimes(2));
    expect(cloturerJournee).toHaveBeenCalledTimes(1);
  });

  it("après une erreur réseau, bloque les boutons de clôture ; une vérification hors connexion ne montre pas l'ancien état", async () => {
    getPreparationCloture
      .mockResolvedValueOnce(reponse(preparation({ postesAttendus: [posteDesktop], peutForcer: true })))
      .mockRejectedValue(new ApiError("Hors connexion", 0));
    cloturerJournee.mockRejectedValue(new ApiError("Hors connexion", 0));
    render(<CloturesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Clôturer la journée" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer la clôture" }));
    await screen.findByText(/La clôture n'a peut-être pas été enregistrée/);
    expect((screen.getByRole("button", { name: "Clôturer la journée" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Clôturer quand même (poste hors connexion)" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Vérifier" }));
    expect(await screen.findByText("La journée n'a pas pu être chargée. Vérifiez votre connexion puis réessayez.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Clôturer la journée" })).toBeNull();
    expect(cloturerJournee).toHaveBeenCalledTimes(1);
  });

  it("clôture réussie, relecture impossible : l'ancien état n'est plus proposé", async () => {
    getPreparationCloture.mockResolvedValueOnce(reponse(preparation())).mockRejectedValue(new ApiError("Hors connexion", 0));
    cloturerJournee.mockResolvedValue(reponse(clotureFaite(), "La journée est clôturée."));
    render(<CloturesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Clôturer la journée" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer la clôture" }));
    expect(await screen.findByText("La journée est clôturée.")).toBeTruthy();
    expect(await screen.findByText("La journée n'a pas pu être chargée. Vérifiez votre connexion puis réessayez.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Clôturer la journée" })).toBeNull();
  });

  it("un double clic sur la confirmation n'envoie qu'une clôture", async () => {
    cloturerJournee.mockImplementation(() => new Promise(() => {}));
    render(<CloturesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Clôturer la journée" }));
    const confirmer = screen.getByRole("button", { name: "Confirmer la clôture" });
    fireEvent.click(confirmer);
    fireEvent.click(confirmer);
    await waitFor(() => expect(cloturerJournee).toHaveBeenCalledTimes(1));
    expect((confirmer as HTMLButtonElement).disabled).toBe(true);
    expect(cloturerJournee).toHaveBeenCalledTimes(1);
  });

  it("n'offre pas la clôture forcée sans l'accord du serveur", async () => {
    getPreparationCloture.mockResolvedValue(reponse(preparation({ postesAttendus: [posteWeb], peutCloturer: false, peutForcer: false })));
    render(<CloturesPage />);
    await screen.findByText("La caisse d'Ousmane Keita est encore ouverte.");
    expect(screen.queryByRole("button", { name: "Clôturer quand même (poste hors connexion)" })).toBeNull();
  });

  it("montre le motif et le poste manquant d'une journée clôturée de force, avec l'export et sans bouton de clôture", async () => {
    getPreparationCloture.mockResolvedValue(
      reponse(
        preparation({
          cloture: clotureFaite({
            forcee: true,
            motifForcage: "Poste en panne",
            postesManquants: [{ ...posteDesktop, message: undefined } as never],
          }),
        }),
      ),
    );
    render(<CloturesPage />);
    expect(await screen.findByText(/Clôture forcée. Motif : Poste en panne/)).toBeTruthy();
    expect(screen.getByText("Comptoir principal (D1)")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Télécharger le fichier Excel (CSV)" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Clôturer la journée" })).toBeNull();
  });

  it("télécharge le fichier tel que reçu, sous le nom du serveur", async () => {
    getPreparationCloture.mockResolvedValue(reponse(preparation({ cloture: clotureFaite() })));
    const blob = new Blob(["﻿Jour;Pièce"], { type: "text/csv" });
    exporterCloture.mockResolvedValue({ blob, filename: "cloture-2026-10-30.csv" });
    const creer = vi.fn(() => "blob:fichier");
    const revoquer = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: creer, revokeObjectURL: revoquer }));
    const noms: string[] = [];
    const clic = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      noms.push(this.download);
    });
    render(<CloturesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Télécharger le fichier Excel (CSV)" }));
    await waitFor(() => expect(exporterCloture).toHaveBeenCalledWith("s1", jour));
    await waitFor(() => expect(noms).toEqual(["cloture-2026-10-30.csv"]));
    expect(creer).toHaveBeenCalledTimes(1);
    expect(creer.mock.calls[0] as unknown[]).toEqual([blob]);
    expect((creer.mock.calls[0] as unknown[])[0]).toBe(blob);
    clic.mockRestore();
    vi.unstubAllGlobals();
  });

  it("affiche le message du serveur quand l'export est refusé", async () => {
    getPreparationCloture.mockResolvedValue(reponse(preparation({ cloture: clotureFaite() })));
    exporterCloture.mockRejectedValue(
      new ApiError("La journée n'est pas encore clôturée : clôturez-la avant de l'exporter.", 409, { code: "JOURNEE_NON_CLOTUREE" }),
    );
    render(<CloturesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Télécharger le fichier Excel (CSV)" }));
    expect(await screen.findByText(/clôturez-la avant de l'exporter/)).toBeTruthy();
  });

  it("affiche le message du serveur pour un jour avant le début de la caisse, sans bouton", async () => {
    getPreparationCloture.mockRejectedValue(
      new ApiError("La caisse est utilisée depuis le 1 octobre 2026 : les journées précédentes ne se clôturent pas.", 400, {
        code: "JOUR_AVANT_DEBUT_CAISSE",
      }),
    );
    render(<CloturesPage />);
    expect(await screen.findByText(/les journées précédentes ne se clôturent pas/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Réessayer" })).toBeNull();
  });

  it("affiche l'anomalie « somme arrivée après une clôture » ouverte", async () => {
    listerRemonteesApresCloture.mockResolvedValue({
      anomalies: [
        {
          id: "a1",
          libelle: "Somme arrivée après la clôture",
          creeLe: `${jour}T09:00:00.000Z`,
          details: { message: "Une vente de 25 000 GNF est arrivée après la clôture du poste Comptoir principal." },
        },
      ],
      total: 1,
    });
    render(<CloturesPage />);
    expect(await screen.findByText("Sommes arrivées après une clôture (toutes journées)")).toBeTruthy();
    expect(screen.getByText("Une vente de 25 000 GNF est arrivée après la clôture du poste Comptoir principal.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "anomalies" }).getAttribute("href")).toBe("/dashboard/anomalies");
    expect(screen.queryByText(/autres, à voir dans les anomalies/)).toBeNull();
  });

  it("signale les anomalies au-delà de la première page quand le total dépasse la liste", async () => {
    const anomalies = Array.from({ length: 20 }, (_, i) => ({
      id: `a${i}`,
      libelle: "Somme arrivée après la clôture",
      creeLe: `${jour}T09:00:00.000Z`,
      details: { message: `Somme numéro ${i}` },
    }));
    listerRemonteesApresCloture.mockResolvedValue({ anomalies, total: 21 });
    render(<CloturesPage />);
    expect(await screen.findByText("et 1 autres, à voir dans les anomalies")).toBeTruthy();
  });

  it("explique un compté « non rapproché » sur une journée clôturée et signale l'absence de paiement", async () => {
    getPreparationCloture.mockResolvedValue(
      reponse(preparation({ cloture: clotureFaite({ totaux: [{ mode: "ORANGE_MONEY", libelle: "Orange Money", theorique: 87000, compte: null, ecart: null }] }) })),
    );
    const { unmount } = render(<CloturesPage />);
    expect(await screen.findByText(/Aucun relevé n'a été saisi pour ce mode/)).toBeTruthy();
    unmount();
    getPreparationCloture.mockResolvedValue(reponse(preparation({ cloture: clotureFaite({ totaux: [] }) })));
    render(<CloturesPage />);
    expect(await screen.findByText("Aucun paiement ce jour-là.")).toBeTruthy();
  });
});
