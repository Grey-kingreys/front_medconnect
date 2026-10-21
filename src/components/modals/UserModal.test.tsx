import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api_auth";
import { UserModal } from "./UserModal";

const { createUser, createMembre, createSuperAdmin } = vi.hoisted(() => ({
  createUser: vi.fn(),
  createMembre: vi.fn(),
  createSuperAdmin: vi.fn(),
}));

vi.mock("@/lib/api_admin", () => ({ createUser }));
vi.mock("@/lib/api_structure", () => ({ createMembre, createSuperAdmin }));

const GENERIQUE = "Certaines informations saisies sont manquantes ou invalides. Vérifiez le formulaire puis réessayez.";
const DEJA_UTILISE = "Ce numéro est déjà utilisé par un autre compte.";

const onClose = vi.fn();
const onSuccess = vi.fn();

function remplirEtEnvoyer(avecMotDePasse: boolean) {
  fireEvent.change(screen.getByPlaceholderText("Mamadou"), { target: { value: "Mamadou" } });
  fireEvent.change(screen.getByPlaceholderText("Diallo"), { target: { value: "Diallo" } });
  fireEvent.change(screen.getByPlaceholderText("exemple@email.com"), { target: { value: "m@exemple.com" } });
  fireEvent.change(screen.getByLabelText("Téléphone"), { target: { value: "620000001" } });
  if (avecMotDePasse) {
    fireEvent.change(screen.getByPlaceholderText("Min. 8 caractères"), { target: { value: "Motdepasse1" } });
  }
  const bouton = screen.getByRole("button", { name: /Créer/ });
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

describe("UserModal, téléphone", () => {
  it("affiche sous le champ un numéro déjà utilisé (administrateur)", async () => {
    createUser.mockRejectedValue(new ApiError(DEJA_UTILISE, 409, { code: "TELEPHONE_DEJA_UTILISE" }));
    render(<UserModal mode="create_admin_user" onClose={onClose} onSuccess={onSuccess} />);
    remplirEtEnvoyer(true);

    await waitFor(() => expect(screen.getAllByText(DEJA_UTILISE)).toHaveLength(1));
    expect(document.getElementById("user-telephone-erreur")).toHaveTextContent(DEJA_UTILISE);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("affiche sous le champ un numéro invalide (membre d'une structure)", async () => {
    createMembre.mockRejectedValue(
      new ApiError(GENERIQUE, 400, {
        code: "VALIDATION",
        champs: [{ champ: "telephone", contraintes: ["isPhoneNumber"] }],
      }),
    );
    render(
      <UserModal mode="create_membre" structureId="s1" structureType="HOPITAL" onClose={onClose} onSuccess={onSuccess} />,
    );
    remplirEtEnvoyer(false);

    await waitFor(() =>
      expect(document.getElementById("user-telephone-erreur")).toHaveTextContent(
        "Ce numéro de téléphone n'est pas valide.",
      ),
    );
    expect(screen.queryByText(GENERIQUE)).not.toBeInTheDocument();
  });

  it("garde le bandeau pour une autre erreur (super administrateur)", async () => {
    createSuperAdmin.mockRejectedValue(new ApiError("Un compte existe déjà avec cet email.", 409, {}));
    render(<UserModal mode="create_super_admin" onClose={onClose} onSuccess={onSuccess} />);
    remplirEtEnvoyer(true);

    await waitFor(() => expect(screen.getByText("Un compte existe déjà avec cet email.")).toBeInTheDocument());
    expect(document.getElementById("user-telephone-erreur")).toBeNull();
  });
});
