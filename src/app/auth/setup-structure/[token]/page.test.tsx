import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MyStructure } from "@/lib/api_structure";
import SetupStructurePage from "./page";

const { verifyInviteToken, setupStructure, loginUser } = vi.hoisted(() => ({
  verifyInviteToken: vi.fn(),
  setupStructure: vi.fn(),
  loginUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ token: "t" }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ loginUser }) }));
vi.mock("@/lib/api_structure", () => ({ verifyInviteToken, setupStructure }));

async function ouvrirEtRemplir(motDePasse: string) {
  render(<SetupStructurePage />);
  await screen.findByText("Vos informations");
  fireEvent.change(screen.getByPlaceholderText("Mamadou"), { target: { value: "Mamadou" } });
  fireEvent.change(screen.getByPlaceholderText("Diallo"), { target: { value: "Diallo" } });
  fireEvent.change(screen.getByPlaceholderText("+224 622..."), { target: { value: "+224620000001" } });
  fireEvent.change(screen.getByLabelText(/^Mot de passe/), { target: { value: motDePasse } });
  fireEvent.change(screen.getByLabelText(/^Confirmer mot de passe/), { target: { value: motDePasse } });
  fireEvent.submit(screen.getByRole("button", { name: /Suivant/ }).closest("form") as HTMLFormElement);
}

beforeEach(() => {
  vi.clearAllMocks();
  verifyInviteToken.mockResolvedValue({
    data: { nom: "Clinique Test", email: "admin@exemple.com" } as MyStructure,
  });
});

afterEach(() => {
  cleanup();
});

describe("Configuration d'une structure invitée, mot de passe", () => {
  it("reste à l'étape 1 avec un mot de passe faible", async () => {
    await ouvrirEtRemplir("faible");

    expect(screen.getByText("Vos informations")).toBeInTheDocument();
    expect(document.getElementById("password-erreur")).not.toBeNull();
    expect(setupStructure).not.toHaveBeenCalled();
  });

  it("passe à l'étape 2 avec un mot de passe valide", async () => {
    await ouvrirEtRemplir("Nouveau123");

    await waitFor(() => expect(screen.getByText("Infos de la structure")).toBeInTheDocument());
    expect(screen.queryByText("Vos informations")).not.toBeInTheDocument();
  });
});
