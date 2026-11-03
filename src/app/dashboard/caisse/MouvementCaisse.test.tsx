import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api_auth";
import type { ModePaiement } from "@/lib/api_caisse";
import { MouvementCaisse } from "./MouvementCaisse";

const { enregistrerMouvement } = vi.hoisted(() => ({ enregistrerMouvement: vi.fn() }));
vi.mock("@/lib/api_caisse", () => ({ enregistrerMouvement }));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MODES: ModePaiement[] = [
  { code: "ESPECES", libelle: "Espèces", comptagePhysique: true, referenceAutorisee: false, ordre: 1 },
  { code: "ORANGE_MONEY", libelle: "Orange Money", comptagePhysique: false, referenceAutorisee: true, ordre: 2 },
];

const onEnregistre = vi.fn();
const onRefus = vi.fn();
const onVerifier = vi.fn();
const afficher = () =>
  render(
    <MouvementCaisse
      isOpen
      onClose={vi.fn()}
      structureId="p1"
      sessionId="sc1"
      modes={MODES}
      onEnregistre={onEnregistre}
      onRefus={onRefus}
      onVerifier={onVerifier}
    />,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Mouvement de caisse", () => {
  it("envoie un prélèvement sans mode quand c'est en espèces", async () => {
    enregistrerMouvement.mockResolvedValue({ data: {}, message: "Prélèvement enregistré.", success: true });
    afficher();
    fireEvent.click(screen.getByLabelText("Prélèvement (sortie d'argent)"));
    fireEvent.change(screen.getByLabelText("Montant (GNF)"), { target: { value: "100000" } });
    fireEvent.change(screen.getByLabelText("Motif"), { target: { value: "Dépôt au coffre" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(enregistrerMouvement).toHaveBeenCalledTimes(1));
    const [structureId, sessionId, corps] = enregistrerMouvement.mock.calls[0];
    expect(structureId).toBe("p1");
    expect(sessionId).toBe("sc1");
    expect(corps.id).toMatch(UUID);
    expect(corps).toEqual({ id: corps.id, type: "PRELEVEMENT", montant: 100000, motif: "Dépôt au coffre" });
    await waitFor(() => expect(onEnregistre).toHaveBeenCalledWith("Prélèvement enregistré."));
  });

  it("refuse un motif vide sans rien envoyer", () => {
    afficher();
    fireEvent.click(screen.getByLabelText("Apport (ajout d'argent)"));
    fireEvent.change(screen.getByLabelText("Montant (GNF)"), { target: { value: "5000" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(screen.getByText("Choisissez le type, indiquez un montant et un motif de 3 caractères au moins.")).toBeTruthy();
    expect(enregistrerMouvement).not.toHaveBeenCalled();
  });

  it("nomme le plafond quand le montant est trop grand", () => {
    afficher();
    fireEvent.click(screen.getByLabelText("Apport (ajout d'argent)"));
    fireEvent.change(screen.getByLabelText("Montant (GNF)"), { target: { value: "100000001" } });
    fireEvent.change(screen.getByLabelText("Motif"), { target: { value: "Apport" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(screen.getByRole("alert").textContent).toMatch(/Le montant ne peut pas dépasser 100\s000\s000\sGNF\./);
    expect(enregistrerMouvement).not.toHaveBeenCalled();
  });

  it("après un échec réseau, Fermer et vérifier demande à la page de relire le bilan", async () => {
    enregistrerMouvement.mockRejectedValue(new ApiError("Réseau", 0));
    afficher();
    fireEvent.click(screen.getByLabelText("Apport (ajout d'argent)"));
    fireEvent.change(screen.getByLabelText("Montant (GNF)"), { target: { value: "5000" } });
    fireEvent.change(screen.getByLabelText("Motif"), { target: { value: "Monnaie" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByRole("button", { name: "Réessayer" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Annuler" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Fermer et vérifier" }));
    expect(onVerifier).toHaveBeenCalledTimes(1);
  });

  it("après une coupure, Réessayer rejoue le même identifiant et le même corps", async () => {
    enregistrerMouvement.mockRejectedValueOnce(new ApiError("Réseau", 0));
    enregistrerMouvement.mockResolvedValueOnce({ data: {}, message: "Ce mouvement était déjà enregistré.", success: true });
    afficher();
    fireEvent.click(screen.getByLabelText("Apport (ajout d'argent)"));
    fireEvent.change(screen.getByLabelText("Montant (GNF)"), { target: { value: "5000" } });
    fireEvent.change(screen.getByLabelText("Motif"), { target: { value: "Monnaie" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    fireEvent.click(await screen.findByRole("button", { name: "Réessayer" }));
    await waitFor(() => expect(onEnregistre).toHaveBeenCalledWith("Ce mouvement était déjà enregistré."));
    expect(enregistrerMouvement).toHaveBeenCalledTimes(2);
    expect(enregistrerMouvement.mock.calls[1][2]).toEqual(enregistrerMouvement.mock.calls[0][2]);
    expect(onVerifier).not.toHaveBeenCalled();
  });

  it("Échap ne ferme pas le dialogue pendant l'envoi", async () => {
    let repondre: (valeur: unknown) => void = () => {};
    enregistrerMouvement.mockImplementationOnce(() => new Promise((resolve) => { repondre = resolve; }));
    const onClose = vi.fn();
    render(
      <MouvementCaisse
        isOpen
        onClose={onClose}
        structureId="p1"
        sessionId="sc1"
        modes={MODES}
        onEnregistre={onEnregistre}
        onRefus={onRefus}
        onVerifier={onVerifier}
      />,
    );
    fireEvent.click(screen.getByLabelText("Apport (ajout d'argent)"));
    fireEvent.change(screen.getByLabelText("Montant (GNF)"), { target: { value: "5000" } });
    fireEvent.change(screen.getByLabelText("Motif"), { target: { value: "Monnaie" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(enregistrerMouvement).toHaveBeenCalledTimes(1));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    repondre({ data: {}, message: "Apport enregistré.", success: true });
    await waitFor(() => expect(onEnregistre).toHaveBeenCalledWith("Apport enregistré."));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("transmet à la page le message du serveur quand la caisse est fermée", async () => {
    const message = "Cette caisse est fermée : aucun mouvement ne peut plus y être ajouté.";
    enregistrerMouvement.mockRejectedValue(new ApiError(message, 409, { code: "SESSION_FERMEE" }));
    afficher();
    fireEvent.click(screen.getByLabelText("Remboursement d'un client"));
    fireEvent.change(screen.getByLabelText("Montant (GNF)"), { target: { value: "2000" } });
    fireEvent.change(screen.getByLabelText("Motif"), { target: { value: "Retour client" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(onRefus).toHaveBeenCalledWith(message));
    expect(onEnregistre).not.toHaveBeenCalled();
  });
});
