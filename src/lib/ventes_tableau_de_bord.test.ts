import { describe, expect, it } from "vitest";
import type { VenteResume, VentesDuJour } from "./api_ventes";
import { resumerMesVentes, resumerVentesDuJour } from "./ventes_tableau_de_bord";

const vente = (id: string, vendeurId: string, total: number, surcharge: Partial<VenteResume> = {}): VenteResume => ({
  id,
  numero: `T1-${id}`,
  createdAt: "2026-10-22T09:00:00.000Z",
  statut: "VALIDEE",
  total,
  nombreArticles: 1,
  vendeur: { id: vendeurId, nom: vendeurId },
  clientNom: null,
  typePiece: "VENTE",
  numeroTicket: Number(id),
  jourMetier: "2026-10-22",
  venteOrigine: null,
  annulation: null,
  ...surcharge,
});

/** Pièce d'annulation : total négatif, sans numéro de ticket, rattachée à une vente d'origine. */
const annulation = (id: string, vendeurId: string, total: number, surcharge: Partial<VenteResume> = {}): VenteResume =>
  vente(id, vendeurId, total, {
    numero: `A-T1-${id}`,
    typePiece: "ANNULATION",
    numeroTicket: null,
    venteOrigine: { id: "origine", numero: "T1-0" },
    ...surcharge,
  });

const journee = (totalPages: number): VentesDuJour => ({
  date: "2026-10-22",
  totalJour: 6700,
  nombre: 4,
  page: 1,
  parPage: 50,
  totalPages,
  ventes: [
    vente("1", "u1", 5000),
    annulation("2", "u1", -700),
    vente("3", "u2", 4000),
    annulation("4", "u2", -1300),
  ],
});

describe("résumé des ventes du jour", () => {
  it("reprend les totaux du serveur et compte les pièces d'annulation lues", () => {
    expect(resumerVentesDuJour(journee(1))).toEqual({
      totalJour: 6700,
      nombre: 4,
      annulees: 2,
      partiel: false,
      ventesLues: 4,
    });
  });

  it("compte une annulation du jour d'une vente d'hier", () => {
    const data: VentesDuJour = {
      ...journee(1),
      ventes: [
        vente("1", "u1", 5000, { statut: "ANNULEE" }),
        annulation("2", "u1", -3000, {
          venteOrigine: { id: "hier", numero: "T1-0000009" },
        }),
      ],
    };
    // La vente annulée du jour n'est pas une annulation du jour ; la pièce d'annulation, si.
    expect(resumerVentesDuJour(data).annulees).toBe(1);
    expect(resumerVentesDuJour({ ...data, ventes: [vente("1", "u1", 5000, { statut: "ANNULEE" })] }).annulees).toBe(0);
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
  it("déduit les annulations du vendeur de son total", () => {
    expect(resumerMesVentes(journee(1), "u1")).toEqual({
      total: 4300,
      nombre: 1,
      annulees: 1,
      partiel: false,
      ventesLues: 4,
    });
  });

  it("peut donner un total négatif : c'est un montant, pas un stock", () => {
    const data: VentesDuJour = { ...journee(1), ventes: [annulation("1", "u1", -2500)] };
    expect(resumerMesVentes(data, "u1")).toMatchObject({ total: -2500, nombre: 0, annulees: 1 });
  });

  it("ignore les ventes des autres vendeurs", () => {
    expect(resumerMesVentes(journee(2), "u2")).toEqual({
      total: 2700,
      nombre: 1,
      annulees: 1,
      partiel: true,
      ventesLues: 4,
    });
    expect(resumerMesVentes(journee(1), "inconnu")).toMatchObject({ total: 0, nombre: 0, annulees: 0 });
  });
});
