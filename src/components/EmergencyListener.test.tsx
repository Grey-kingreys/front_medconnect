import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser, UserProfile } from "@/lib/api_auth";
import { gererSessionRevoquee } from "@/lib/deconnexion_forcee";
import EmergencyListener from "./EmergencyListener";

const { etatAuth, ioMock, socketFactice, gestionnaires } = vi.hoisted(() => {
  const gestionnaires: Record<string, (data: unknown) => void> = {};
  const socketFactice = {
    on: vi.fn((evt: string, cb: (data: unknown) => void) => {
      gestionnaires[evt] = cb;
    }),
    off: vi.fn(),
    disconnect: vi.fn(),
  };
  const ioMock = vi.fn(() => socketFactice);
  const etatAuth: { user: unknown; profile: unknown } = { user: null, profile: null };
  return { etatAuth, ioMock, socketFactice, gestionnaires };
});

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => etatAuth }));
vi.mock("socket.io-client", () => ({ io: ioMock }));
vi.mock("@/lib/api_carnet", () => ({ takeChargeSOS: vi.fn() }));

function utilisateur(role: string): AuthUser {
  return { id: "u1", email: "agent@exemple.com", nom: "Camara", prenom: "Awa", role } as AuthUser;
}

function profil(role: string, permissions: string[]): UserProfile {
  return {
    id: "u1",
    email: "agent@exemple.com",
    nom: "Camara",
    prenom: "Awa",
    role,
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    permissions,
  } as UserProfile;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(gestionnaires).forEach(cle => delete gestionnaires[cle]);
  etatAuth.user = null;
  etatAuth.profile = null;
  localStorage.clear();
  localStorage.setItem("access_token", "jeton-test");
  vi.stubGlobal(
    "Audio",
    class {
      loop = false;
      currentTime = 0;
      play = vi.fn().mockResolvedValue(undefined);
      pause = vi.fn();
    }
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("EmergencyListener : écoute selon la permission sos:respond", () => {
  it("ouvre la connexion et affiche l'alerte pour un rôle personnalisé titulaire de sos:respond", () => {
    etatAuth.user = utilisateur("INFIRMIER_URGENCES");
    etatAuth.profile = profil("INFIRMIER_URGENCES", ["sos:respond"]);

    render(<EmergencyListener />);

    expect(ioMock).toHaveBeenCalledTimes(1);
    expect(ioMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ auth: { token: "jeton-test" } }));

    act(() => {
      gestionnaires.emergencyAlert({
        urgenceId: "urg1",
        patientId: "p1",
        patientName: "Mariama Bah",
        latitude: 9.5,
        longitude: -13.7,
        message: "Aide",
        createdAt: new Date().toISOString(),
      });
    });

    expect(screen.getByText("Mariama Bah")).toBeInTheDocument();
  });

  it("écoute la déconnexion à distance de l'appareil (sessionRevoquee)", () => {
    etatAuth.user = utilisateur("INFIRMIER_URGENCES");
    etatAuth.profile = profil("INFIRMIER_URGENCES", ["sos:respond"]);

    render(<EmergencyListener />);

    expect(socketFactice.on).toHaveBeenCalledWith("sessionRevoquee", gererSessionRevoquee);
  });

  it("n'ouvre pas la connexion pour un médecin sans sos:respond", () => {
    etatAuth.user = utilisateur("MEDECIN");
    etatAuth.profile = profil("MEDECIN", ["carnet:read"]);

    render(<EmergencyListener />);

    expect(ioMock).not.toHaveBeenCalled();
  });

  it("n'ouvre pas la connexion tant que le profil n'est pas chargé", () => {
    etatAuth.user = utilisateur("MEDECIN");
    etatAuth.profile = null;

    render(<EmergencyListener />);

    expect(ioMock).not.toHaveBeenCalled();
  });

  it("n'ouvre pas la connexion sans utilisateur connecté", () => {
    etatAuth.user = null;
    etatAuth.profile = null;

    render(<EmergencyListener />);

    expect(ioMock).not.toHaveBeenCalled();
  });

  it("ferme la connexion quand le droit sos:respond est retiré", () => {
    etatAuth.user = utilisateur("INFIRMIER_URGENCES");
    etatAuth.profile = profil("INFIRMIER_URGENCES", ["sos:respond"]);
    const { rerender } = render(<EmergencyListener />);
    expect(ioMock).toHaveBeenCalledTimes(1);

    etatAuth.profile = profil("INFIRMIER_URGENCES", []);
    rerender(<EmergencyListener />);

    expect(socketFactice.disconnect).toHaveBeenCalled();
  });

  it("garde une seule connexion quand le profil est rafraîchi sans changement de droit", () => {
    etatAuth.user = utilisateur("INFIRMIER_URGENCES");
    etatAuth.profile = profil("INFIRMIER_URGENCES", ["sos:respond"]);
    const { rerender } = render(<EmergencyListener />);

    etatAuth.profile = profil("INFIRMIER_URGENCES", ["sos:respond"]);
    rerender(<EmergencyListener />);

    expect(ioMock).toHaveBeenCalledTimes(1);
  });
});
