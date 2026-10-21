import { act, cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser, UserProfile } from "@/lib/api_auth";
import { EVENEMENT_ACCES_REFUSE } from "@/lib/acces";
import DashboardLayout from "./layout";

const etat = vi.hoisted(() => ({
  user: null as AuthUser | null,
  profile: null as UserProfile | null,
  pathname: "/dashboard",
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: etat.user, profile: etat.profile, loading: false, logout: vi.fn() }),
}));
vi.mock("next/navigation", () => ({ usePathname: () => etat.pathname }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/components/ThemeSwitcher", () => ({ ThemeSwitcher: () => null }));
vi.mock("@/components/PWAInstallButton", () => ({ PWAInstallButton: () => null }));
vi.mock("@/components/EmergencyButton", () => ({ default: () => null }));
vi.mock("@/components/EmergencyListener", () => ({ default: () => null }));
vi.mock("@/components/NotificationBell", () => ({ default: () => null }));
vi.mock("@/components/Toast", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/hooks/useNotifications", () => ({
  NotificationsProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const utilisateur = (role: string): AuthUser => ({
  id: "u1",
  email: "u1@exemple.com",
  nom: "Diallo",
  prenom: "Mariama",
  role,
});

const profil = (role: string, structureType: "HOPITAL" | "PHARMACIE", permissions: string[]): UserProfile => ({
  id: "u1",
  email: "u1@exemple.com",
  nom: "Diallo",
  prenom: "Mariama",
  role,
  isActive: true,
  permissions,
  structureType,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

const PERMISSIONS_ADMIN = ["structure:read", "structure:write", "membre:read", "membre:manage", "role:manage"];
const PERMISSIONS_PHARMACIEN = ["stock:read", "stock:write", "catalogue:write", "chat:structure", "structure:read", "membre:read"];

const aller = (chemin: string) => {
  etat.pathname = chemin;
  window.history.pushState({}, "", chemin);
};

const afficher = () =>
  render(
    <DashboardLayout>
      <p>Contenu de la page</p>
    </DashboardLayout>,
  );

const MESSAGE = "Cette page n'est pas disponible pour votre compte.";

describe("garde de page du tableau de bord", () => {
  beforeEach(() => {
    etat.user = null;
    etat.profile = null;
    aller("/dashboard");
  });

  afterEach(() => {
    cleanup();
  });

  it("remplace la page par un message pour l'administrateur de pharmacie sur la liste des patients", async () => {
    etat.user = utilisateur("STRUCTURE_ADMIN");
    etat.profile = profil("STRUCTURE_ADMIN", "PHARMACIE", PERMISSIONS_ADMIN);
    aller("/dashboard/patients");
    afficher();
    expect(await screen.findByText(MESSAGE)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Retour à l'accueil" }).getAttribute("href")).toBe("/dashboard");
    expect(screen.queryByText("Contenu de la page")).toBeNull();
    expect(screen.getByText("Ma pharmacie")).toBeTruthy();
    expect(screen.queryByText("Équipe médicale")).toBeNull();
  });

  it("laisse la page à l'administrateur d'hôpital", async () => {
    etat.user = utilisateur("STRUCTURE_ADMIN");
    etat.profile = profil("STRUCTURE_ADMIN", "HOPITAL", [...PERMISSIONS_ADMIN, "patient:read"]);
    aller("/dashboard/patients");
    afficher();
    expect(await screen.findByText("Contenu de la page")).toBeTruthy();
    expect(screen.getByText("Ma structure")).toBeTruthy();
    expect(screen.getByText("Équipe médicale")).toBeTruthy();
    expect(screen.getByText("Patients")).toBeTruthy();
  });

  it("n'applique pas la garde sur un ancien serveur (repli)", async () => {
    etat.user = utilisateur("STRUCTURE_ADMIN");
    etat.profile = null;
    aller("/dashboard/patients");
    afficher();
    expect(await screen.findByText("Contenu de la page")).toBeTruthy();
    expect(screen.queryByText(MESSAGE)).toBeNull();
  });

  it("remplace la page par le message quand le serveur refuse une lecture", async () => {
    etat.user = utilisateur("PHARMACIEN");
    etat.profile = profil("PHARMACIEN", "PHARMACIE", PERMISSIONS_PHARMACIEN);
    aller("/dashboard/stock");
    afficher();
    expect(await screen.findByText("Contenu de la page")).toBeTruthy();
    act(() => {
      window.dispatchEvent(new Event(EVENEMENT_ACCES_REFUSE));
    });
    expect(screen.getByText(MESSAGE)).toBeTruthy();
    expect(screen.queryByText("Contenu de la page")).toBeNull();
  });

  it("garde l'accueil affiché malgré un refus du serveur", async () => {
    etat.user = utilisateur("PHARMACIEN");
    etat.profile = profil("PHARMACIEN", "PHARMACIE", PERMISSIONS_PHARMACIEN);
    aller("/dashboard");
    afficher();
    expect(await screen.findByText("Contenu de la page")).toBeTruthy();
    act(() => {
      window.dispatchEvent(new Event(EVENEMENT_ACCES_REFUSE));
    });
    expect(screen.getByText("Contenu de la page")).toBeTruthy();
    expect(screen.queryByText(MESSAGE)).toBeNull();
  });
});
