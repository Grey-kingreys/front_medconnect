import { describe, expect, it } from "vitest";
import { adresseMajValide, messageMajPrete, peutInstaller } from "./maj_regle";

describe("peutInstaller", () => {
  it("refuse avec une caisse ouverte", () => {
    expect(peutInstaller({ sessionOuverte: true, fileEnAttente: 0 })).toBe(false);
  });
  it("refuse avec des ventes pas encore acceptées", () => {
    expect(peutInstaller({ sessionOuverte: false, fileEnAttente: 3 })).toBe(false);
  });
  it("refuse dans les deux cas à la fois", () => {
    expect(peutInstaller({ sessionOuverte: true, fileEnAttente: 1 })).toBe(false);
  });
  it("accepte caisse fermée et file vide", () => {
    expect(peutInstaller({ sessionOuverte: false, fileEnAttente: 0 })).toBe(true);
  });
});

describe("adresseMajValide", () => {
  it("accepte https et http sur 127.0.0.1 seulement", () => {
    expect(adresseMajValide("https://maj.exemple.gn/caisse")).toBe(true);
    expect(adresseMajValide("http://127.0.0.1:5000")).toBe(true);
    expect(adresseMajValide("http://maj.exemple.gn")).toBe(false);
    expect(adresseMajValide("http://localhost:5000")).toBe(false);
  });
  it("refuse une adresse absente ou illisible", () => {
    expect(adresseMajValide(undefined)).toBe(false);
    expect(adresseMajValide("")).toBe(false);
    expect(adresseMajValide("pas une adresse")).toBe(false);
  });
});

describe("messageMajPrete", () => {
  it("annonce la version", () => {
    expect(messageMajPrete("0.1.1")).toBe("Mise à jour 0.1.1 prête : elle s'installera à la fermeture.");
  });
});
