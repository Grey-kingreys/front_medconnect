import { describe, expect, it } from "vitest";
import { calculerLigne, manqueVenteAuDetail, type EntreeLigne } from "./prix";

describe("manqueVenteAuDetail", () => {
  it("renvoie null quand le détail égale le prix de la boîte", () => {
    expect(manqueVenteAuDetail(15000, 1500, 10)).toBeNull();
  });
  it("renvoie null quand le détail rapporte plus que la boîte", () => {
    expect(manqueVenteAuDetail(14000, 1500, 10)).toBeNull();
  });
  it("signale un détail inférieur, même d'un seul franc", () => {
    expect(manqueVenteAuDetail(15001, 1500, 10)).toEqual({ totalDetail: 15000, manque: 1 });
  });
  it("calcule le total et le manque", () => {
    expect(manqueVenteAuDetail(18000, 1500, 10)).toEqual({ totalDetail: 15000, manque: 3000 });
  });
  it("renvoie null si une valeur est vide ou à 0", () => {
    expect(manqueVenteAuDetail(null, 1500, 10)).toBeNull();
    expect(manqueVenteAuDetail(18000, null, 10)).toBeNull();
    expect(manqueVenteAuDetail(18000, 1500, null)).toBeNull();
    expect(manqueVenteAuDetail(0, 1500, 10)).toBeNull();
    expect(manqueVenteAuDetail(18000, 0, 10)).toBeNull();
    expect(manqueVenteAuDetail(18000, 1500, 0)).toBeNull();
  });
  it("gère une boîte d'une seule unité", () => {
    expect(manqueVenteAuDetail(1000, 999, 1)).toEqual({ totalDetail: 999, manque: 1 });
    expect(manqueVenteAuDetail(1000, 1000, 1)).toBeNull();
  });
});

// Vecteurs de back_medconnect/src/pharmacie/domaine/prix.spec.ts (CA1, CA2, CA4, prix absents).
const base: EntreeLigne = {
  unite: "BOITE",
  nombre: 1,
  coefficientBoite: 20,
  prixBoite: 10000,
  prixUnite: 600,
  deconditionnable: true,
};

describe("calculerLigne", () => {
  it("CA1 : 6 unités à 600 donnent 6 unités minimales et 3 600 GNF", () => {
    expect(calculerLigne({ ...base, unite: "UNITE", nombre: 6 })).toEqual({
      ok: true,
      uniteAffichee: "UNITE",
      nombreAffiche: 6,
      coefficientApplique: 1,
      quantiteUm: 6,
      prixAppliqueParUm: 600,
      montantLigne: 3600,
    });
  });

  it("CA2 : 20 boîtes à 500 donnent 10 000 GNF", () => {
    expect(calculerLigne({ ...base, nombre: 20, coefficientBoite: 1, prixBoite: 500, prixUnite: null, deconditionnable: false })).toEqual({
      ok: true,
      uniteAffichee: "BOITE",
      nombreAffiche: 20,
      coefficientApplique: 1,
      quantiteUm: 20,
      prixAppliqueParUm: 500,
      montantLigne: 10000,
    });
  });

  it("CA4 : unité refusée sur une fiche non déconditionnable", () => {
    expect(calculerLigne({ ...base, unite: "UNITE", deconditionnable: false })).toEqual({ ok: false, code: "VENTE_UNITE_INTERDITE" });
  });

  it("refuse les prix manquants", () => {
    expect(calculerLigne({ ...base, unite: "UNITE", prixUnite: null })).toEqual({ ok: false, code: "PRIX_UNITE_MANQUANT" });
    expect(calculerLigne({ ...base, prixBoite: null })).toEqual({ ok: false, code: "PRIX_MANQUANT" });
  });

  it("refuse un nombre non entier sans lever d'exception", () => {
    expect(calculerLigne({ ...base, nombre: 1.5 })).toEqual({ ok: false, code: "PRIX_MANQUANT" });
  });
});
