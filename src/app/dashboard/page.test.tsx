import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, type AuthUser, type UserProfile } from "@/lib/api_auth";
import { getConsultations, getRendezVous } from "@/lib/api_carnet";
import { getMyPatients } from "@/lib/api_patients";
import { getMyStructure } from "@/lib/api_structure";
import DashboardPage from "./page";

const medecin = { id: "m1", email: "medecin@exemple.com", nom: "Camara", prenom: "Awa", role: "MEDECIN", structureId: "s1" };
const etat = vi.hoisted(() => ({
  utilisateur: null as AuthUser | null,
  profil: null as UserProfile | null,
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: etat.utilisateur, profile: etat.profil }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/lib/api_structure", () => ({ getMyStructure: vi.fn(), getAllStructures: vi.fn() }));
const { graphiquesRendus } = vi.hoisted(() => ({ graphiquesRendus: vi.fn() }));
vi.mock("@/components/DashboardCharts", () => ({ default: graphiquesRendus }));
vi.mock("@/lib/api_carnet", () => ({ getConsultations: vi.fn(), getRendezVous: vi.fn() }));
vi.mock("@/lib/api_patients", () => ({ getMyPatients: vi.fn() }));

// Réponse d'API simulée (le type exact n'importe pas pour ces tests)
const reponse = (data: unknown) => ({ data, message: "ok", success: true }) as never;

const MESSAGE_ERREUR = "Certains chiffres n'ont pas pu être chargés. Vérifiez votre connexion puis réessayez.";

const carteDe = (label: string) => screen.getByText(label).parentElement as HTMLElement;

const aujourdhui = () => new Date().toISOString();
const dansUnAn = () => new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();

const consultationsDuJour = () =>
  reponse([{ dateConsultation: aujourdhui() }, { dateConsultation: aujourdhui() }, { dateConsultation: aujourdhui() }]);

const rendezVousAVenir = () =>
  reponse([
    { medecinId: "m1", date: dansUnAn(), status: "PROGRAMME" },
    { medecinId: "m1", date: dansUnAn(), status: "CONFIRME" },
    { medecinId: "m2", date: dansUnAn(), status: "PROGRAMME" },
  ]);

describe("Aperçu du tableau de bord", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    etat.utilisateur = medecin;
    etat.profil = null;
  });

  afterEach(() => {
    cleanup();
  });

  it("affiche un état de chargement et aucune carte retirée", () => {
    vi.mocked(getMyPatients).mockReturnValue(new Promise(() => {}));
    vi.mocked(getConsultations).mockReturnValue(new Promise(() => {}));
    vi.mocked(getRendezVous).mockReturnValue(new Promise(() => {}));
    render(<DashboardPage />);
    expect(screen.getAllByText("Chargement")).toHaveLength(3);
    expect(screen.queryByText("Ordonnances émises")).toBeNull();
  });

  it("affiche la valeur de chaque carte une fois les données reçues", async () => {
    vi.mocked(getMyPatients).mockResolvedValue(reponse(Array.from({ length: 7 }, () => ({}))));
    vi.mocked(getConsultations).mockResolvedValue(consultationsDuJour());
    vi.mocked(getRendezVous).mockResolvedValue(rendezVousAVenir());
    render(<DashboardPage />);
    expect(await within(carteDe("Patients de la structure")).findByText("7")).toBeTruthy();
    expect(await within(carteDe("Consultations aujourd'hui")).findByText("3")).toBeTruthy();
    expect(await within(carteDe("Rendez-vous à venir")).findByText("2")).toBeTruthy();
    expect(screen.queryByText(MESSAGE_ERREUR)).toBeNull();
  });

  it("signale une carte indisponible puis la recharge au clic sur Réessayer", async () => {
    vi.mocked(getMyPatients).mockResolvedValue(reponse(Array.from({ length: 7 }, () => ({}))));
    vi.mocked(getConsultations)
      .mockRejectedValueOnce(new ApiError("Hors connexion", 0))
      .mockResolvedValue(consultationsDuJour());
    vi.mocked(getRendezVous).mockResolvedValue(rendezVousAVenir());
    render(<DashboardPage />);
    expect(await within(carteDe("Consultations aujourd'hui")).findByText("Indisponible")).toBeTruthy();
    expect(screen.getByText(MESSAGE_ERREUR)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));

    expect(await within(carteDe("Consultations aujourd'hui")).findByText("3")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText(MESSAGE_ERREUR)).toBeNull());
    expect(within(carteDe("Patients de la structure")).getByText("7")).toBeTruthy();
    expect(within(carteDe("Rendez-vous à venir")).getByText("2")).toBeTruthy();
  });

  it("n'affiche ni graphiques fictifs ni badge « En direct »", async () => {
    vi.mocked(getMyPatients).mockResolvedValue(reponse(Array.from({ length: 7 }, () => ({}))));
    vi.mocked(getConsultations).mockResolvedValue(consultationsDuJour());
    vi.mocked(getRendezVous).mockResolvedValue(rendezVousAVenir());
    render(<DashboardPage />);
    expect(await within(carteDe("Patients de la structure")).findByText("7")).toBeTruthy();
    expect(screen.queryByText("Analyses et Tendances")).toBeNull();
    expect(screen.queryByText("En direct")).toBeNull();
    expect(graphiquesRendus).not.toHaveBeenCalled();
    expect(screen.getByText("Accès rapide")).toBeTruthy();
  });

  it("masque la carte dont le droit est absent sans afficher d'erreur", async () => {
    vi.mocked(getMyPatients).mockRejectedValue(new ApiError("Accès refusé", 403));
    vi.mocked(getConsultations).mockResolvedValue(consultationsDuJour());
    vi.mocked(getRendezVous).mockResolvedValue(rendezVousAVenir());
    render(<DashboardPage />);
    expect(await within(carteDe("Consultations aujourd'hui")).findByText("3")).toBeTruthy();
    expect(within(carteDe("Rendez-vous à venir")).getByText("2")).toBeTruthy();
    expect(screen.queryByText("Patients de la structure")).toBeNull();
    expect(screen.queryByText(MESSAGE_ERREUR)).toBeNull();
  });

  it("n'affiche à l'administrateur de pharmacie que ce qui concerne sa pharmacie", async () => {
    etat.utilisateur = { id: "a1", email: "admin@exemple.com", nom: "Bah", prenom: "Fanta", role: "STRUCTURE_ADMIN", structureId: "s2" };
    etat.profil = {
      id: "a1",
      email: "admin@exemple.com",
      nom: "Bah",
      prenom: "Fanta",
      role: "STRUCTURE_ADMIN",
      isActive: true,
      permissions: ["structure:read", "structure:write", "membre:read", "membre:manage", "role:manage"],
      structureType: "PHARMACIE",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    vi.mocked(getMyStructure).mockResolvedValue(reponse({ membres: [{ role: "PHARMACIEN" }, { role: "PHARMACIEN" }] }));
    render(<DashboardPage />);
    expect(await within(carteDe("Pharmaciens")).findByText("2")).toBeTruthy();
    expect(screen.queryByText("Patients de la structure")).toBeNull();
    expect(screen.queryByText("Médecins")).toBeNull();
    const acces = screen.getByText("Accès rapide").parentElement as HTMLElement;
    expect(within(acces).getByText("Ma pharmacie")).toBeTruthy();
    expect(within(acces).getByText("Équipe de la pharmacie")).toBeTruthy();
    expect(getMyPatients).not.toHaveBeenCalled();
  });
});
