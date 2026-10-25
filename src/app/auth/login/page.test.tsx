import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./page";

vi.mock("@/hooks/useAuth", () => ({ useTerminerConnexion: () => vi.fn() }));
vi.mock("@/components/ComptesDemo", () => ({ default: () => null }));

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe("Page de connexion : motif de déconnexion forcée", () => {
  it("explique que l'appareil a été déconnecté, puis efface le motif", () => {
    sessionStorage.setItem("mc_motif_deconnexion", "SESSION_REVOQUEE");
    render(<LoginPage />);

    expect(screen.getByText("Vous avez été déconnecté de cet appareil.")).toBeInTheDocument();
    expect(sessionStorage.getItem("mc_motif_deconnexion")).toBeNull();
  });

  it("explique que le compte est désactivé", () => {
    sessionStorage.setItem("mc_motif_deconnexion", "COMPTE_DESACTIVE");
    render(<LoginPage />);

    expect(screen.getByText("Votre compte a été désactivé. Contactez votre structure.")).toBeInTheDocument();
  });

  it("n'affiche aucun message sans motif", () => {
    render(<LoginPage />);

    expect(screen.queryByText("Vous avez été déconnecté de cet appareil.")).toBeNull();
    expect(screen.queryByText("Votre compte a été désactivé. Contactez votre structure.")).toBeNull();
  });
});
