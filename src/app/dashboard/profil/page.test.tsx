import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, changePassword, updateProfile } from "@/lib/api_auth";
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
      telephone: "620000001",
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
  updateProfile: vi.fn(),
}));

const changePasswordMock = vi.mocked(changePassword);
const updateProfileMock = vi.mocked(updateProfile);

const GENERIQUE = "Certaines informations saisies sont manquantes ou invalides. Vérifiez le formulaire puis réessayez.";
const DEJA_UTILISE = "Ce numéro est déjà utilisé par un autre compte.";

function ouvrirEtChangerTelephone() {
  fireEvent.click(screen.getByRole("button", { name: /Modifier/ }));
  fireEvent.change(screen.getByLabelText("Téléphone"), { target: { value: "620000002" } });
}

function envoyerLeFormulaire() {
  const bouton = screen.getByRole("button", { name: /Enregistrer/ });
  fireEvent.submit(bouton.closest("form") as HTMLFormElement);
}

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

describe("Profil : téléphone", () => {
  it("affiche l'aide au format seulement en mode modification", () => {
    render(<ProfilPage />);
    expect(screen.queryByText("Exemple : 620 00 00 00")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Modifier/ }));
    expect(screen.getByText("Exemple : 620 00 00 00")).toBeInTheDocument();
  });

  it("affiche sous le champ un numéro déjà utilisé et garde le mode modification", async () => {
    updateProfileMock.mockRejectedValue(new ApiError(DEJA_UTILISE, 409, { code: "TELEPHONE_DEJA_UTILISE" }));
    render(<ProfilPage />);
    ouvrirEtChangerTelephone();
    envoyerLeFormulaire();

    await waitFor(() => expect(screen.getAllByText(DEJA_UTILISE)).toHaveLength(1));
    expect(document.getElementById("telephone-erreur")).toHaveTextContent(DEJA_UTILISE);
    expect(screen.getByLabelText("Téléphone")).not.toBeDisabled();
  });

  it("garde le bandeau quand seul l'email est refusé", async () => {
    updateProfileMock.mockRejectedValue(
      new ApiError(GENERIQUE, 400, {
        code: "VALIDATION",
        champs: [{ champ: "email", contraintes: ["isEmail"] }],
      }),
    );
    render(<ProfilPage />);
    ouvrirEtChangerTelephone();
    envoyerLeFormulaire();

    await waitFor(() => expect(screen.getByText(GENERIQUE)).toBeInTheDocument());
    expect(document.getElementById("telephone-erreur")).toBeNull();
  });
});
