import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CLE_FORMAT_RECU,
  enregistrerFormatRecu,
  formaterDateHeure,
  formaterJour,
  jourConakry,
  libelleArticles,
  libelleLigneVente,
  lireFormatRecu,
  motifValide,
  prixUnitaireAffiche,
} from "./affichage";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("lireFormatRecu", () => {
  it("rend le ticket 58 mm sans valeur mémorisée", () => {
    expect(lireFormatRecu()).toBe("58");
  });

  it("rend le format mémorisé", () => {
    localStorage.setItem(CLE_FORMAT_RECU, "A4");
    expect(lireFormatRecu()).toBe("A4");
  });

  it("revient au défaut pour une valeur inconnue", () => {
    localStorage.setItem(CLE_FORMAT_RECU, "A3");
    expect(lireFormatRecu()).toBe("58");
  });

  it("revient au défaut si la lecture échoue", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("indisponible");
    });
    expect(lireFormatRecu()).toBe("58");
  });
});

describe("enregistrerFormatRecu", () => {
  it("mémorise le format", () => {
    enregistrerFormatRecu("80");
    expect(localStorage.getItem(CLE_FORMAT_RECU)).toBe("80");
  });

  it("n'échoue pas si l'écriture est impossible", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("plein");
    });
    expect(() => enregistrerFormatRecu("80")).not.toThrow();
  });
});

describe("dates", () => {
  it("affiche la date et l'heure de Conakry", () => {
    expect(formaterDateHeure("2026-10-22T10:05:00.000Z")).toBe("22/10/2026 à 10:05");
  });

  it("écrit le jour en toutes lettres", () => {
    expect(formaterJour("2026-10-22")).toBe("jeudi 22 octobre 2026");
  });

  it("donne le jour d'une date", () => {
    expect(jourConakry(new Date("2026-10-22T23:59:00.000Z"))).toBe("2026-10-22");
  });
});

describe("motifValide", () => {
  it("accepte de 3 à 300 caractères", () => {
    expect(motifValide("ab")).toBe(false);
    expect(motifValide("abc")).toBe(true);
    expect(motifValide("a".repeat(300))).toBe(true);
    expect(motifValide("a".repeat(301))).toBe(false);
  });

  it("refuse des espaces seuls et ignore ceux qui entourent", () => {
    expect(motifValide("     ")).toBe(false);
    expect(motifValide("  ab  ")).toBe(false);
  });
});

describe("libelleArticles", () => {
  it("accorde le mot article", () => {
    expect(libelleArticles(1)).toBe("1 article");
    expect(libelleArticles(3)).toBe("3 articles");
    expect(libelleArticles(-3)).toBe("3 articles");
    expect(libelleArticles(-1)).toBe("1 article");
  });
});

describe("ligne de vente", () => {
  it("écrit une ligne en boîtes", () => {
    expect(libelleLigneVente({ uniteAffichee: "BOITE", nombreAffiche: 2, nomMedicament: "Paracétamol" })).toBe(
      "2 boîtes de Paracétamol",
    );
    expect(libelleLigneVente({ uniteAffichee: "BOITE", nombreAffiche: 1, nomMedicament: "Amoxicilline" })).toBe(
      "1 boîte d'Amoxicilline",
    );
  });

  it("écrit une ligne en unités", () => {
    expect(libelleLigneVente({ uniteAffichee: "UNITE", nombreAffiche: 6, nomMedicament: "Paracétamol" })).toBe(
      "6 unités de Paracétamol",
    );
    expect(libelleLigneVente({ uniteAffichee: "UNITE", nombreAffiche: 1, nomMedicament: "Paracétamol" })).toBe(
      "1 unité de Paracétamol",
    );
  });

  it("affiche le prix d'une boîte ou d'une unité comme le sous-total divisé par le nombre, arrondi", () => {
    expect(prixUnitaireAffiche({ sousTotal: 3000, nombreAffiche: 2 })).toBe(1500);
    expect(prixUnitaireAffiche({ sousTotal: 1000, nombreAffiche: 3 })).toBe(333);
    expect(prixUnitaireAffiche({ sousTotal: 2000, nombreAffiche: 3 })).toBe(667);
  });
});
