import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api_auth";
import RegisterPage from "./page";

const { register, push, loginUser } = vi.hoisted(() => ({
  register: vi.fn(),
  push: vi.fn(),
  loginUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ loginUser }) }));
vi.mock("@/lib/api_auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api_auth")>()),
  register,
}));

const GENERIQUE = "Certaines informations saisies sont manquantes ou invalides. Vérifiez le formulaire puis réessayez.";
const DEJA_UTILISE = "Ce numéro est déjà utilisé par un autre compte.";

function remplirEtEnvoyer() {
  fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Diallo" } });
  fireEvent.change(screen.getByLabelText("Prénom"), { target: { value: "Mamadou" } });
  fireEvent.change(screen.getByLabelText("Adresse email"), { target: { value: "m@exemple.com" } });
  fireEvent.change(screen.getByLabelText(/Téléphone/), { target: { value: "620000001" } });
  fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value: "Motdepasse1" } });
  fireEvent.change(screen.getByLabelText("Confirmer le mot de passe"), { target: { value: "Motdepasse1" } });
  const bouton = screen.getByRole("button", { name: /Créer mon compte/ });
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

describe("Page d'inscription, téléphone", () => {
  it("affiche l'aide au format dès le rendu", () => {
    render(<RegisterPage />);
    expect(screen.getByText("Exemple : 620 00 00 00")).toBeInTheDocument();
  });

  it("affiche sous le champ un numéro déjà utilisé", async () => {
    register.mockRejectedValue(new ApiError(DEJA_UTILISE, 409, { code: "TELEPHONE_DEJA_UTILISE" }));
    render(<RegisterPage />);
    remplirEtEnvoyer();

    await waitFor(() => expect(screen.getAllByText(DEJA_UTILISE)).toHaveLength(1));
    const erreur = document.getElementById("telephone-erreur");
    expect(erreur).toHaveTextContent(DEJA_UTILISE);
    const champ = screen.getByLabelText(/Téléphone/);
    expect(champ).toHaveAttribute("aria-invalid", "true");
    expect(champ.getAttribute("aria-describedby")).toContain("telephone-erreur");
    expect(push).not.toHaveBeenCalled();
  });

  it("affiche sous le champ un numéro invalide, sans bandeau général", async () => {
    register.mockRejectedValue(
      new ApiError(GENERIQUE, 400, {
        code: "VALIDATION",
        champs: [{ champ: "telephone", contraintes: ["isPhoneNumber"] }],
      }),
    );
    render(<RegisterPage />);
    remplirEtEnvoyer();

    await waitFor(() =>
      expect(document.getElementById("telephone-erreur")).toHaveTextContent("Ce numéro de téléphone n'est pas valide."),
    );
    expect(screen.queryByText(GENERIQUE)).not.toBeInTheDocument();
  });

  it("garde le bandeau pour une autre erreur", async () => {
    register.mockRejectedValue(new ApiError("Un compte existe déjà avec cet email.", 409, {}));
    render(<RegisterPage />);
    remplirEtEnvoyer();

    await waitFor(() => expect(screen.getByText("Un compte existe déjà avec cet email.")).toBeInTheDocument());
    expect(document.getElementById("telephone-erreur")).toBeNull();
  });

  it("efface le message quand on saisit dans le champ téléphone", async () => {
    register.mockRejectedValue(new ApiError(DEJA_UTILISE, 409, { code: "TELEPHONE_DEJA_UTILISE" }));
    render(<RegisterPage />);
    remplirEtEnvoyer();
    await waitFor(() => expect(document.getElementById("telephone-erreur")).not.toBeNull());

    fireEvent.change(screen.getByLabelText(/Téléphone/), { target: { value: "620000002" } });
    expect(document.getElementById("telephone-erreur")).toBeNull();
  });
});
