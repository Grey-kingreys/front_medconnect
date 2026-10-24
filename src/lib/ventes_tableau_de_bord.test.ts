import { describe, expect, it } from "vitest";
import type { StatutVente, VenteResume, VentesDuJour } from "./api_ventes";
import { resumerMesVentes, resumerVentesDuJour } from "./ventes_tableau_de_bord";

const vente = (id: string, vendeurId: string, statut: StatutVente, total: number): VenteResume => ({
  id,
  numero: `V-${id}`,
  createdAt: "2026-10-22T09:00:00.000Z",
  statut,
  total,
  nombreArticles: 1,
  vendeur: { id: vendeurId, nom: vendeurId },
  clientNom: null,
});

const journee = (totalPages: number): VentesDuJour => ({
  date: "2026-10-22",
  totalJour: 9000,
  nombre: 4,
  page: 1,
  parPage: 50,
  totalPages,
  ventes: [
    vente("1", "u1", "VALIDEE", 5000),
    vente("2", "u1", "ANNULEE", 700),
    vente("3", "u2", "VALIDEE", 4000),
    vente("4", "u2", "ANNULEE", 1300),
  ],
});

describe("résumé des ventes du jour", () => {
  it("reprend les totaux du serveur et compte les annulées lues", () => {
    expect(resumerVentesDuJour(journee(1))).toEqual({
      totalJour: 9000,
      nombre: 4,
      annulees: 2,
      partiel: false,
      ventesLues: 4,
    });
  });

  it("signale un résultat partiel quand la journée tient sur plusieurs pages", () => {
    expect(resumerVentesDuJour(journee(2)).partiel).toBe(true);
  });

  it("traite une liste absente comme vide", () => {
    const data = { ...journee(1), ventes: undefined } as unknown as VentesDuJour;
    expect(resumerVentesDuJour(data)).toMatchObject({ annulees: 0, ventesLues: 0 });
    expect(resumerMesVentes(data, "u1")).toEqual({ total: 0, nombre: 0, annulees: 0, partiel: false, ventesLues: 0 });
  });
});

describe("résumé de mes ventes", () => {
  it("ne compte que les ventes validées du vendeur, les annulées à part", () => {
    expect(resumerMesVentes(journee(1), "u1")).toEqual({
      total: 5000,
      nombre: 1,
      annulees: 1,
      partiel: false,
      ventesLues: 4,
    });
  });

  it("ignore les ventes des autres vendeurs", () => {
    expect(resumerMesVentes(journee(2), "u2")).toEqual({
      total: 4000,
      nombre: 1,
      annulees: 1,
      partiel: true,
      ventesLues: 4,
    });
    expect(resumerMesVentes(journee(1), "inconnu")).toMatchObject({ total: 0, nombre: 0, annulees: 0 });
  });
});
