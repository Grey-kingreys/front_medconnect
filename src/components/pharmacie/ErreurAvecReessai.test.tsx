import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErreurAvecReessai } from "./ErreurAvecReessai";

afterEach(cleanup);

describe("ErreurAvecReessai", () => {
  it("affiche le message dans une alerte et relance sur clic", () => {
    const onReessayer = vi.fn();
    render(<ErreurAvecReessai message="Connexion perdue" onReessayer={onReessayer} />);
    expect(screen.getByRole("alert").textContent).toContain("Connexion perdue");
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(onReessayer).toHaveBeenCalledTimes(1);
  });

  it("n'affiche aucun bouton sans fonction de réessai", () => {
    render(<ErreurAvecReessai message="Accès refusé" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
