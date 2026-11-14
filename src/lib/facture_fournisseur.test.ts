import { describe, expect, it } from "vitest";
import { controlerLigne, controlerSomme, formaterTauxTva, lireMontant, lireTauxTva } from "./facture_fournisseur";

describe("lireMontant", () => {
  it("tolère le point et la virgule des milliers et les espaces", () => {
    expect(lireMontant("95.630")).toBe(95630);
    expect(lireMontant("95,630")).toBe(95630);
    expect(lireMontant("95 630")).toBe(95630);
    expect(lireMontant("95 630")).toBe(95630);
    expect(lireMontant("1.234.567")).toBe(1234567);
    expect(lireMontant("95630")).toBe(95630);
    expect(lireMontant("0")).toBe(0);
  });
  it("refuse ce qui n'est pas un entier de GNF", () => {
    for (const t of ["", "abc", "95.5", "95.6300", "-5", "1.23", "3000000000"]) expect(lireMontant(t)).toBeNull();
  });
});

describe("taux de TVA", () => {
  it("convertit le pourcentage en pour mille et inversement", () => {
    expect(lireTauxTva("18")).toBe(180);
    expect(lireTauxTva("5,5 %")).toBe(55);
    expect(lireTauxTva("0")).toBe(0);
    expect(lireTauxTva("101")).toBeNull();
    expect(lireTauxTva("x")).toBeNull();
    expect(formaterTauxTva(180)).toBe("18 %");
    expect(formaterTauxTva(55)).toBe("5,5 %");
  });
});

describe("contrôles non bloquants", () => {
  it("signale un montant de ligne différent de quantité x prix", () => {
    const base = { quantiteLivree: 10, quantiteCommandee: 10, prixUnitaire: 1000, montantHTLigne: 10000 };
    expect(controlerLigne(base)).toEqual({});
    expect(controlerLigne({ ...base, montantHTLigne: 9000 }).montant).toEqual({ attendu: 10000, saisi: 9000 });
  });
  it("signale une quantité livrée différente de la commandée", () => {
    const r = controlerLigne({ quantiteLivree: 8, quantiteCommandee: 10, prixUnitaire: null, montantHTLigne: null });
    expect(r.quantite).toEqual({ livree: 8, commandee: 10 });
    expect(r.montant).toBeUndefined();
  });
  it("compare la somme des lignes au montant HT seulement si tout est connu", () => {
    expect(controlerSomme([100, 200], 300)).toBeNull();
    expect(controlerSomme([100, 200], 350)).toEqual({ somme: 300, montantHT: 350 });
    expect(controlerSomme([100, null], 350)).toBeNull();
    expect(controlerSomme([100], null)).toBeNull();
  });
});
