import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api_auth";
import { MSG_REGLES_NON_RESPECTEES } from "@/lib/regles_mot_de_passe";
import ResetPasswordPage from "./page";

const { verifyResetToken, resetPassword } = vi.hoisted(() => ({
  verifyResetToken: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("token=jeton") }));
vi.mock("@/lib/api_auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api_auth")>()),
  verifyResetToken,
  resetPassword,
}));

async function ouvrirEtRemplir(motDePasse: string) {
  render(<ResetPasswordPage />);
  fireEvent.change(await screen.findByLabelText("Nouveau mot de passe"), { target: { value: motDePasse } });
  fireEvent.change(screen.getByLabelText("Confirmer le mot de passe"), { target: { value: motDePasse } });
  const bouton = screen.getByRole("button", { name: /Réinitialiser le mot de passe/ });
  fireEvent.submit(bouton.closest("form") as HTMLFormElement);
}

beforeEach(() => {
  vi.clearAllMocks();
  verifyResetToken.mockResolvedValue({ data: { valid: true, email: "a@exemple.com" }, message: "", success: true });
});

afterEach(() => {
  cleanup();
});

describe("Page de réinitialisation du mot de passe", () => {
  it("refuse un mot de passe faible sans appeler le serveur", async () => {
    await ouvrirEtRemplir("faible");

    expect(resetPassword).not.toHaveBeenCalled();
    expect(document.getElementById("password-erreur")).toHaveTextContent(MSG_REGLES_NON_RESPECTEES);
  });

  it("affiche sous le champ le refus du serveur sur le nouveau mot de passe", async () => {
    resetPassword.mockRejectedValue(
      new ApiError("x", 400, {
        code: "VALIDATION",
        champs: [{ champ: "newPassword", contraintes: ["matches"], message: "Message du serveur" }],
      }),
    );
    await ouvrirEtRemplir("Nouveau123");

    await waitFor(() => expect(document.getElementById("password-erreur")).toHaveTextContent("Message du serveur"));
    expect(screen.getAllByText("Message du serveur")).toHaveLength(1);
  });

  it("envoie un mot de passe valide avec le jeton du lien", async () => {
    resetPassword.mockResolvedValue({ data: null, message: "", success: true });
    await ouvrirEtRemplir("Nouveau123");

    await waitFor(() => expect(resetPassword).toHaveBeenCalledWith("jeton", "Nouveau123"));
  });
});
