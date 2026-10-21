import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import ReglesMotDePasse, { descriptionMotDePasse } from "./ReglesMotDePasse";

afterEach(() => {
  cleanup();
});

describe("ReglesMotDePasse", () => {
  it("affiche les 4 règles à faire quand le champ est vide", () => {
    render(<ReglesMotDePasse motDePasse="" idChamp="x" />);
    const elements = within(screen.getByRole("list", { name: "Règles à respecter" })).getAllByRole("listitem");
    expect(elements).toHaveLength(4);
    for (const element of elements) expect(element).toHaveTextContent("(à faire)");
  });

  it("marque toutes les règles faites et annonce que tout est respecté", () => {
    render(<ReglesMotDePasse motDePasse="Abcdefg1" idChamp="x" />);
    const elements = screen.getAllByRole("listitem");
    for (const element of elements) expect(element).toHaveTextContent("(fait)");
    expect(screen.getByText("Le mot de passe respecte toutes les règles.")).toBeInTheDocument();
  });

  it("marque seulement la longueur et la minuscule pour abcdefgh", () => {
    render(<ReglesMotDePasse motDePasse="abcdefgh" idChamp="x" />);
    expect(screen.getByText("Au moins 8 caractères").closest("li")).toHaveTextContent("(fait)");
    expect(screen.getByText("Une lettre minuscule").closest("li")).toHaveTextContent("(fait)");
    expect(screen.getByText("Une lettre majuscule").closest("li")).toHaveTextContent("(à faire)");
    expect(screen.getByText("Un chiffre").closest("li")).toHaveTextContent("(à faire)");
    expect(screen.queryByText("Le mot de passe respecte toutes les règles.")).not.toBeInTheDocument();
  });

  it("affiche le message d'erreur avec role alert et l'id du champ", () => {
    render(<ReglesMotDePasse motDePasse="" idChamp="champ" erreur="Message d'erreur" />);
    const erreur = document.getElementById("champ-erreur");
    expect(erreur).toHaveAttribute("role", "alert");
    expect(erreur).toHaveTextContent("Message d'erreur");
    expect(document.getElementById("champ-regles")).not.toBeNull();
  });

  it("n'affiche pas d'élément d'erreur sans erreur", () => {
    render(<ReglesMotDePasse motDePasse="" idChamp="champ" />);
    expect(document.getElementById("champ-erreur")).toBeNull();
  });

  it("descriptionMotDePasse : liste seule, ou erreur puis liste", () => {
    expect(descriptionMotDePasse("x")).toBe("x-regles");
    expect(descriptionMotDePasse("x", "e")).toBe("x-erreur x-regles");
  });
});
