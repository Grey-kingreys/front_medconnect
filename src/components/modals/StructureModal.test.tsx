import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api_auth";
import { invitationNonEnvoyee, type StructureCreee } from "@/lib/api_admin";
import { StructureModal } from "./StructureModal";

const { createStructure, resendStructureInvitation } = vi.hoisted(() => ({
  createStructure: vi.fn(),
  resendStructureInvitation: vi.fn(),
}));

vi.mock("@/lib/api_admin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api_admin")>()),
  createStructure,
  resendStructureInvitation,
}));
vi.mock("@/lib/api_structure", () => ({ updateMyStructure: vi.fn() }));
vi.mock("./MapModal", () => ({ MapModal: () => null }));

const MESSAGE_SERVEUR = "Le service d'envoi des emails est momentanément indisponible. Réessayez dans quelques minutes.";
const AVERTISSEMENT = "Structure créée, mais l'email d'invitation n'a pas pu être envoyé.";

const structure = (extra: Partial<StructureCreee> = {}): StructureCreee => ({
  id: "s1",
  nom: "Clinique Test",
  type: "CLINIQUE",
  email: "c@exemple.com",
  isConfigured: false,
  createdAt: "2026-10-21T00:00:00.000Z",
  ...extra,
});

const reponseCreation = (extra: Partial<StructureCreee> = {}) => ({
  success: true,
  message: "",
  data: structure(extra),
});

const onClose = vi.fn();
const onSuccess = vi.fn();

function remplirEtEnvoyer() {
  fireEvent.change(screen.getByPlaceholderText("Ex: Hôpital Donka"), { target: { value: "Clinique Test" } });
  fireEvent.change(screen.getByPlaceholderText("admin@structure.com"), { target: { value: "c@exemple.com" } });
  const bouton = screen.getByRole("button", { name: /Créer et inviter/ });
  fireEvent.submit(bouton.closest("form") as HTMLFormElement);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("StructureModal, création sans invitation", () => {
  it("garde la fenêtre ouverte avec l'avertissement et le bouton de renvoi", async () => {
    createStructure.mockResolvedValue(reponseCreation({ invitationEnvoyee: false }));
    render(<StructureModal mode="create" onClose={onClose} onSuccess={onSuccess} />);
    remplirEtEnvoyer();

    await waitFor(() => expect(screen.getByText(AVERTISSEMENT)).toBeInTheDocument());
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Renvoyer l'invitation/ })).toBeInTheDocument();
  });

  it("affiche le message du serveur quand le renvoi échoue", async () => {
    createStructure.mockResolvedValue(reponseCreation({ invitationEnvoyee: false }));
    resendStructureInvitation.mockRejectedValue(new ApiError(MESSAGE_SERVEUR, 503, { code: "EMAIL_INDISPONIBLE" }));
    render(<StructureModal mode="create" onClose={onClose} onSuccess={onSuccess} />);
    remplirEtEnvoyer();

    fireEvent.click(await screen.findByRole("button", { name: /Renvoyer l'invitation/ }));

    await waitFor(() => expect(screen.getByText(MESSAGE_SERVEUR)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Renvoyer l'invitation/ })).toBeInTheDocument();
    expect(screen.queryByText("Une erreur est survenue")).not.toBeInTheDocument();
  });

  it("confirme l'envoi quand le renvoi réussit", async () => {
    createStructure.mockResolvedValue(reponseCreation({ invitationEnvoyee: false }));
    resendStructureInvitation.mockResolvedValue({ success: true, message: "", data: null });
    render(<StructureModal mode="create" onClose={onClose} onSuccess={onSuccess} />);
    remplirEtEnvoyer();

    fireEvent.click(await screen.findByRole("button", { name: /Renvoyer l'invitation/ }));

    await waitFor(() => expect(screen.getByText("Invitation envoyée à c@exemple.com.")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /Renvoyer l'invitation/ })).not.toBeInTheDocument();
  });

  it("ferme la fenêtre sans avertissement sur une ancienne réponse", async () => {
    createStructure.mockResolvedValue(reponseCreation());
    render(<StructureModal mode="create" onClose={onClose} onSuccess={onSuccess} />);
    remplirEtEnvoyer();

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(AVERTISSEMENT)).not.toBeInTheDocument();
  });
});

describe("invitationNonEnvoyee", () => {
  it("n'est vrai que si le serveur le dit explicitement", () => {
    expect(invitationNonEnvoyee(reponseCreation())).toBe(false);
    expect(invitationNonEnvoyee(reponseCreation({ invitationEnvoyee: true }))).toBe(false);
    expect(invitationNonEnvoyee(reponseCreation({ invitationEnvoyee: false }))).toBe(true);
    expect(invitationNonEnvoyee({ ...reponseCreation(), invitationEnvoyee: false } as never)).toBe(true);
  });
});
