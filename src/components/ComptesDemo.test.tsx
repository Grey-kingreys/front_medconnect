import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ToastProvider from "@/components/Toast";
import ComptesDemo from "./ComptesDemo";
import { ApiError, connexionDemo, getComptesDemo, type CompteDemo } from "@/lib/api_auth";

const terminerConnexion = vi.fn();

vi.mock("@/lib/api_auth", async (original) => ({
  ...(await original<typeof import("@/lib/api_auth")>()),
  getComptesDemo: vi.fn(),
  connexionDemo: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useTerminerConnexion: () => terminerConnexion,
}));

const compte = (id: string, role: CompteDemo["role"], prenom: string, structureNom: string | null = null): CompteDemo => ({
  id,
  email: `${id}@exemple.com`,
  nom: "Demo",
  prenom,
  role,
  roleLibelle: `Libellé ${role}`,
  structureNom,
  description: `Description ${prenom}`,
});

// Volontairement dans le désordre : le composant doit réordonner les groupes
const COMPTES: CompteDemo[] = [
  compte("s1", "SUPER_ADMIN", "Sira"),
  compte("ph1", "PHARMACIEN", "Fodé", "Pharmacie de Kaloum"),
  compte("p1", "PATIENT", "Aïssatou"),
  compte("m1", "MEDECIN", "Mamadou", "Hôpital Donka"),
  compte("a1", "ACCUEIL", "Kadiatou", "Hôpital Donka"),
  compte("sa1", "STRUCTURE_ADMIN", "Ibrahima", "Hôpital Donka"),
  compte("p2", "PATIENT", "Ousmane"),
];

const afficher = () =>
  render(
    <ToastProvider>
      <ComptesDemo />
    </ToastProvider>
  );

beforeEach(() => {
  vi.mocked(getComptesDemo).mockReset();
  vi.mocked(connexionDemo).mockReset();
  terminerConnexion.mockReset();
});

// Sans les globales Vitest, Testing Library ne démonte pas tout seul entre deux tests
afterEach(cleanup);

describe("ComptesDemo", () => {
  it("n'affiche rien si la liste est vide (production)", async () => {
    vi.mocked(getComptesDemo).mockResolvedValue([]);
    const { container } = render(<ComptesDemo />);
    await act(async () => {});
    expect(getComptesDemo).toHaveBeenCalledTimes(1);
    expect(container).toBeEmptyDOMElement();
  });

  it("regroupe les comptes par rôle dans l'ordre attendu", async () => {
    vi.mocked(getComptesDemo).mockResolvedValue(COMPTES);
    afficher();
    expect(await screen.findByRole("heading", { name: "Mode démonstration" })).toBeInTheDocument();

    const titres = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(titres).toEqual([
      "Patients",
      "Médecins",
      "Agents d'accueil",
      "Pharmaciens",
      "Administrateurs de structure",
      "Super administrateur",
    ]);

    const patients = screen.getByRole("list", { name: "Patients" });
    expect(within(patients).getAllByRole("button")).toHaveLength(2);

    const medecin = screen.getByRole("button", { name: /Mamadou Demo/ });
    expect(medecin).toHaveTextContent("Libellé MEDECIN · Hôpital Donka");
    expect(medecin).toHaveTextContent("Description Mamadou");
  });

  it("connecte en un clic et désactive les boutons pendant le chargement", async () => {
    vi.mocked(getComptesDemo).mockResolvedValue(COMPTES);
    let resoudre: (v: Awaited<ReturnType<typeof connexionDemo>>) => void = () => {};
    vi.mocked(connexionDemo).mockReturnValue(new Promise((r) => (resoudre = r)));
    afficher();

    fireEvent.click(await screen.findByRole("button", { name: /Aïssatou Demo/ }));
    expect(connexionDemo).toHaveBeenCalledWith("p1");
    screen.getAllByRole("button", { name: /Demo/ }).forEach((b) => expect(b).toBeDisabled());
    expect(screen.getByText("Connexion en cours")).toBeInTheDocument();

    const donnees = { access_token: "jeton", user: { id: "p1", email: "p1@exemple.com", nom: "Demo", prenom: "Aïssatou", role: "PATIENT" } };
    await act(async () => resoudre({ success: true, message: "", data: donnees }));
    expect(terminerConnexion).toHaveBeenCalledWith(donnees);
  });

  it("affiche un message humain en cas d'échec et réactive les boutons", async () => {
    vi.mocked(getComptesDemo).mockResolvedValue(COMPTES);
    vi.mocked(connexionDemo).mockRejectedValue(new ApiError("Forbidden resource", 403));
    afficher();

    fireEvent.click(await screen.findByRole("button", { name: /Mamadou Demo/ }));
    const alerte = await screen.findByRole("alert");
    expect(alerte).toHaveTextContent("n'a pas abouti. Réessayez dans un instant.");
    expect(alerte).not.toHaveTextContent("Forbidden");
    expect(terminerConnexion).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("button", { name: /Mamadou Demo/ })).toBeEnabled());
  });
});
