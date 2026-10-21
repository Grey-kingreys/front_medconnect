import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changePassword } from "@/lib/api_auth";
import ProfilPage from "./page";

const { etatAuth } = vi.hoisted(() => ({
  etatAuth: {
    user: {
      id: "u1",
      email: "patient@exemple.com",
      nom: "Camara",
      prenom: "Awa",
      role: "PATIENT",
    },
    profile: {
      id: "u1",
      email: "patient@exemple.com",
      nom: "Camara",
      prenom: "Awa",
      role: "PATIENT",
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    refreshProfile: vi.fn(),
  },
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => etatAuth }));
vi.mock("@/components/FileUpload", () => ({ default: () => null }));
vi.mock("@/components/ImageWithFallback", () => ({ default: () => null }));
vi.mock("@/lib/api_auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api_auth")>()),
  changePassword: vi.fn(),
}));

const changePasswordMock = vi.mocked(changePassword);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("Profil : sécurité et appareils connectés", () => {
  it("propose un lien vers la page des appareils connectés", () => {
    render(<ProfilPage />);

    expect(screen.getByRole("link", { name: /Gérer/ }).closest("a")).toHaveAttribute("href", "/dashboard/appareils");
  });

  it("déconnecte les autres appareils par défaut et montre le message de réussite", async () => {
    changePasswordMock.mockResolvedValue({
      data: { appareilsDeconnectes: 2 },
      message: "Mot de passe modifié. Vos autres appareils ont été déconnectés.",
      success: true,
    });
    render(<ProfilPage />);

    fireEvent.click(screen.getByRole("button", { name: "Changer" }));
    expect(screen.getByLabelText(/Déconnecter mes autres appareils/)).toBeChecked();
    fireEvent.change(screen.getByLabelText("Mot de passe actuel"), { target: { value: "Ancien123" } });
    fireEvent.change(screen.getByLabelText("Nouveau mot de passe"), { target: { value: "Nouveau123" } });
    fireEvent.change(screen.getByLabelText("Confirmer le nouveau mot de passe"), { target: { value: "Nouveau123" } });
    fireEvent.click(screen.getByRole("button", { name: "Changer le mot de passe" }));

    expect(changePasswordMock).toHaveBeenCalledWith("Ancien123", "Nouveau123", true);
    expect(
      await screen.findByText("Mot de passe modifié. Vos autres appareils ont été déconnectés."),
    ).toBeInTheDocument();
  });

  it("n'envoie pas la déconnexion des autres appareils quand la case est décochée", async () => {
    changePasswordMock.mockResolvedValue({
      data: { appareilsDeconnectes: 0 },
      message: "Mot de passe modifié avec succès",
      success: true,
    });
    render(<ProfilPage />);

    fireEvent.click(screen.getByRole("button", { name: "Changer" }));
    fireEvent.click(screen.getByLabelText(/Déconnecter mes autres appareils/));
    fireEvent.change(screen.getByLabelText("Mot de passe actuel"), { target: { value: "Ancien123" } });
    fireEvent.change(screen.getByLabelText("Nouveau mot de passe"), { target: { value: "Nouveau123" } });
    fireEvent.change(screen.getByLabelText("Confirmer le nouveau mot de passe"), { target: { value: "Nouveau123" } });
    fireEvent.click(screen.getByRole("button", { name: "Changer le mot de passe" }));

    await waitFor(() => expect(changePasswordMock).toHaveBeenCalledWith("Ancien123", "Nouveau123", false));
  });
});
