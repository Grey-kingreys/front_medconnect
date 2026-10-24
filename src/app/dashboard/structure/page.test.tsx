import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api_auth";
import type { MyStructure } from "@/lib/api_structure";
import MyStructurePage from "./page";

const { getMyStructure, updateMyStructure, setMyLogo, removeMyLogo, droits } = vi.hoisted(() => ({
  getMyStructure: vi.fn(),
  updateMyStructure: vi.fn(),
  setMyLogo: vi.fn(),
  removeMyLogo: vi.fn(),
  droits: { role: "STRUCTURE_ADMIN", structureType: "PHARMACIE", permissions: [] as string[] },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", structureId: "p1", email: "u1@exemple.com", nom: "Keita", prenom: "Ousmane", role: droits.role },
    loading: false,
    profile: {
      id: "u1",
      email: "u1@exemple.com",
      nom: "Keita",
      prenom: "Ousmane",
      role: droits.role,
      isActive: true,
      permissions: droits.permissions,
      structureType: droits.structureType,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  }),
}));
vi.mock("@/lib/api_structure", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api_structure")>()),
  getMyStructure,
  updateMyStructure,
  setMyLogo,
  removeMyLogo,
}));
vi.mock("@/components/modals/MapModal", () => ({ MapModal: () => null }));
vi.mock("@/components/FileUpload", () => ({
  default: ({ label }: { label: string }) => <button type="button">{label}</button>,
}));
vi.mock("@/components/charts/DonutChart", () => ({ DonutChart: () => <div>graphique-equipe</div> }));

const PERMISSIONS_ADMIN = [
  "membre:manage", "membre:read", "role:manage", "stock:read", "stock:write", "structure:read",
  "structure:write", "vente:annuler", "vente:read", "vente:write",
];
const PERMISSIONS_PHARMACIEN = [
  "catalogue:write", "chat:structure", "membre:read", "stock:read", "stock:write", "structure:read",
  "vente:read", "vente:write",
];

const HORAIRES_KALOUM = JSON.stringify({
  Lundi: "08:00-21:00", Mardi: "08:00-21:00", Mercredi: "08:00-21:00", Jeudi: "08:00-21:00",
  Vendredi: "08:00-21:00", Samedi: "08:00-21:00", Dimanche: "09:00-13:00",
});

const kaloum = (surcharge: Partial<MyStructure> = {}): MyStructure => ({
  id: "s1",
  nom: "Pharmacie de Kaloum",
  type: "PHARMACIE",
  email: "admin.kaloum@demo.medconnecte.gn",
  telephone: "+224 621 33 44 55",
  adresse: "Avenue de la République, Kaloum",
  ville: "Conakry",
  description: null as unknown as undefined,
  latitude: 9.5092,
  longitude: -13.7122,
  horaires: HORAIRES_KALOUM,
  estDeGarde: true,
  estOuvertManuel: null,
  isActive: true,
  isConfigured: true,
  logoUrl: null,
  admin: { id: "a1", nom: "Camara", prenom: "Fatoumata", email: "admin.kaloum@demo.medconnecte.gn" },
  membres: [
    { id: "m1", nom: "Keita", prenom: "Ousmane", email: "o@exemple.com", role: "PHARMACIEN", isActive: true, createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "m2", nom: "Sylla", prenom: "Mariama", email: "m@exemple.com", role: "ACCUEIL", isActive: false, createdAt: "2026-01-01T00:00:00.000Z" },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...surcharge,
});

const charger = (structure: MyStructure) => getMyStructure.mockResolvedValue({ data: structure, message: "ok", success: true });

const bloc = async (nom: string) => within(await screen.findByRole("region", { name: nom }));

beforeEach(() => {
  vi.clearAllMocks();
  droits.role = "STRUCTURE_ADMIN";
  droits.structureType = "PHARMACIE";
  droits.permissions = PERMISSIONS_ADMIN;
  charger(kaloum());
  // La réponse du serveur contient les champs envoyés
  updateMyStructure.mockImplementation(async (corps: Partial<MyStructure>) => ({ data: { ...corps }, message: "ok", success: true }));
});

afterEach(() => cleanup());

describe("Ma pharmacie", () => {
  it("enregistre le bloc Informations et contact avec ses seuls champs", async () => {
    render(<MyStructurePage />);
    const informations = await bloc("Informations et contact");

    fireEvent.change(informations.getByLabelText("Téléphone"), { target: { value: "+224 621 00 00 00" } });
    fireEvent.click(informations.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(updateMyStructure).toHaveBeenCalledTimes(1));
    const corps = updateMyStructure.mock.calls[0][0] as Record<string, unknown>;
    const autorisees = ["nom", "telephone", "ville", "adresse", "description"];
    expect(Object.keys(corps).every((cle) => autorisees.includes(cle))).toBe(true);
    for (const interdite of ["horaires", "latitude", "longitude", "estDeGarde", "estOuvertManuel", "email"]) {
      expect(corps).not.toHaveProperty(interdite);
    }
    expect(corps.telephone).toBe("+224 621 00 00 00");
    expect(await informations.findByText("Modifications enregistrées.")).toBeInTheDocument();
  });

  it("enregistre les horaires avec la seule clé horaires", async () => {
    render(<MyStructurePage />);
    const horaires = await bloc("Horaires d'ouverture");

    fireEvent.click(horaires.getByLabelText("Fermé le dimanche"));
    fireEvent.click(horaires.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(updateMyStructure).toHaveBeenCalledTimes(1));
    const corps = updateMyStructure.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(corps)).toEqual(["horaires"]);
    expect(corps.horaires as string).toContain('"Dimanche":"Fermé"');
  });

  it("applique De garde et Ouverture tout de suite, sans autre champ", async () => {
    charger(kaloum({ estOuvertManuel: true }));
    render(<MyStructurePage />);

    fireEvent.click(await screen.findByRole("switch", { name: "De garde" }));
    await waitFor(() => expect(updateMyStructure).toHaveBeenCalledWith({ estDeGarde: false }));

    fireEvent.click(screen.getByRole("radio", { name: "Selon les horaires" }));
    await waitFor(() => expect(updateMyStructure).toHaveBeenCalledWith({ estOuvertManuel: null }));
    expect(updateMyStructure).toHaveBeenCalledTimes(2);
  });

  it("affiche un message humain quand le serveur refuse la saisie", async () => {
    updateMyStructure.mockRejectedValue(new ApiError("nom must be longer than or equal to 2 characters", 400, { code: "VALIDATION" }));
    render(<MyStructurePage />);
    const informations = await bloc("Informations et contact");

    fireEvent.change(informations.getByLabelText("Téléphone"), { target: { value: "+224 621 00 00 00" } });
    fireEvent.click(informations.getByRole("button", { name: "Enregistrer" }));

    const alerte = await informations.findByRole("alert");
    expect(alerte).toHaveTextContent("Certaines informations n'ont pas été acceptées. Vérifiez ce bloc puis réessayez.");
    expect(document.body.textContent).not.toContain("must be longer");
  });

  it("montre la pharmacie en lecture seule à un pharmacien", async () => {
    droits.role = "PHARMACIEN";
    droits.permissions = PERMISSIONS_PHARMACIEN;
    render(<MyStructurePage />);

    await screen.findByRole("heading", { level: 1, name: "Pharmacie de Kaloum" });
    expect(screen.queryByRole("button", { name: "Enregistrer" })).toBeNull();
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
    expect(document.querySelectorAll("input, textarea, select")).toHaveLength(0);
    expect(screen.getByRole("note")).toHaveTextContent(
      "Pour modifier ces informations, contactez l'administrateur de votre pharmacie.",
    );
    expect(screen.getByRole("link", { name: /Voir l'équipe/ })).toBeInTheDocument();
    expect(screen.queryByText(/Gérer l'équipe/)).toBeNull();
    expect(screen.queryByText("Changer le logo")).toBeNull();
    expect(screen.queryByText("Ajouter un logo")).toBeNull();
    expect(updateMyStructure).not.toHaveBeenCalled();
  });

  it("n'affiche ni médecins ni graphique pour une pharmacie", async () => {
    render(<MyStructurePage />);

    await screen.findByText("Pharmaciens");
    expect(screen.getByText("Membres actifs")).toBeInTheDocument();
    expect(screen.queryByText(/Médecins/)).toBeNull();
    expect(screen.queryByText("graphique-equipe")).toBeNull();
  });

  it("laisse la page d'un hôpital inchangée", async () => {
    droits.structureType = "HOPITAL";
    droits.permissions = [];
    charger(
      kaloum({
        type: "HOPITAL",
        nom: "Hôpital Donka",
        membres: [
          { id: "m1", nom: "Diallo", prenom: "Mamadou", email: "d@exemple.com", role: "MEDECIN", isActive: true, createdAt: "2026-01-01T00:00:00.000Z" },
        ],
      }),
    );
    render(<MyStructurePage />);

    expect(await screen.findByRole("button", { name: "Modifier" })).toBeInTheDocument();
    expect(screen.getByText("Médecins")).toBeInTheDocument();
    expect(screen.getByText("graphique-equipe")).toBeInTheDocument();
    expect(screen.queryByText("Informations et contact")).toBeNull();
  });
});
