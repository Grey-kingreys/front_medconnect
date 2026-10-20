import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api_auth";
import { getConsultations, getRendezVous } from "@/lib/api_carnet";
import { getMyPatients } from "@/lib/api_patients";
import DashboardPage from "./page";

vi.mock("@/hooks/useAuth", () => {
  const user = { id: "m1", email: "medecin@exemple.com", nom: "Camara", prenom: "Awa", role: "MEDECIN", structureId: "s1" };
  return { useAuth: () => ({ user, profile: null }) };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/components/DashboardCharts", () => ({ default: () => null }));
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
});
