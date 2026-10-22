import { describe, expect, it } from "vitest";
import type { StockMedicament } from "./api_pharmacie";
import { calculerApercuStock, formaterMontantGNF } from "./apercu_pharmacie";

const MAINTENANT = new Date("2026-10-22T10:00:00Z");

const ligne = (id: string, nom: string, quantite: number, prixUnitaire?: number | null, dateExpiration?: string): StockMedicament => ({
  id,
  medicamentId: `m-${id}`,
  structureId: "s1",
  quantite,
  disponible: quantite > 0,
  prixUnitaire: prixUnitaire as never,
  dateExpiration,
  medicament: { id: `m-${id}`, nom, categorie: "Antalgique", ordonnanceRequise: false, formes: [] },
});

const reference = () => [
  ligne("a", "Doliprane 500", 50, 1000, "2027-06-01"),
  ligne("b", "Amoxicilline 500", 0, 2500),
  ligne("c", "Ibuprofène 400", 4, 1500, "2027-01-01"),
  ligne("d", "Paracétamol sirop", 20, null, "2026-11-03"),
  ligne("e", "Vitamine C", 8, 500, "2026-10-01"),
  ligne("f", "Métronidazole", 30, 2000),
];

describe("calculerApercuStock", () => {
  it("compte le jeu de référence", () => {
    const a = calculerApercuStock(reference(), MAINTENANT);
    expect(a).toMatchObject({
      total: 6,
      disponibles: 4,
      ruptures: 1,
      stockBas: 2,
      expirentBientot: 1,
      perimes: 1,
      valeur: 116000,
      sansPrix: 1,
      aSurveillerTotal: 4,
    });
  });

  it("ordonne la liste à surveiller et donne une seule raison par ligne", () => {
    const a = calculerApercuStock(reference(), MAINTENANT);
    expect(a.aSurveiller.map((l) => [l.stockId, l.raison, l.detail])).toEqual([
      ["e", "perime", "Périmé depuis le 01/10/2026"],
      ["b", "rupture", "Rupture de stock"],
      ["c", "stockBas", "Plus que 4 unités en stock"],
      ["d", "expireBientot", "Expire le 03/11/2026, dans 12 jours"],
    ]);
  });

  it("respecte les bornes de la fenêtre de 60 jours", () => {
    expect(calculerApercuStock([ligne("x", "X", 50, 1, "2026-12-21")], MAINTENANT).expirentBientot).toBe(1);
    expect(calculerApercuStock([ligne("x", "X", 50, 1, "2026-12-22")], MAINTENANT).expirentBientot).toBe(0);
  });

  it("traite aujourd'hui, demain et hier", () => {
    const aujourdhui = calculerApercuStock([ligne("x", "X", 50, 1, "2026-10-22")], MAINTENANT);
    expect(aujourdhui.perimes).toBe(0);
    expect(aujourdhui.expirentBientot).toBe(1);
    expect(aujourdhui.aSurveiller[0].detail).toBe("Expire aujourd'hui (22/10/2026)");
    const demain = calculerApercuStock([ligne("x", "X", 50, 1, "2026-10-23")], MAINTENANT);
    expect(demain.aSurveiller[0].detail).toBe("Expire demain (23/10/2026)");
    expect(calculerApercuStock([ligne("x", "X", 50, 1, "2026-10-21")], MAINTENANT).perimes).toBe(1);
  });

  it("classe en rupture une quantité à zéro même avec une date dépassée", () => {
    const a = calculerApercuStock([ligne("x", "X", 0, 1, "2026-01-01")], MAINTENANT);
    expect(a.ruptures).toBe(1);
    expect(a.perimes).toBe(0);
    expect(a.aSurveiller[0].raison).toBe("rupture");
  });

  it("n'ajoute pas à la valeur une ligne dont le prix est zéro", () => {
    const a = calculerApercuStock([ligne("x", "X", 10, 0)], MAINTENANT);
    expect(a.sansPrix).toBe(1);
    expect(a.valeur).toBe(0);
  });

  it("ignore une date illisible", () => {
    const a = calculerApercuStock([ligne("x", "X", 50, 100, "pas une date")], MAINTENANT);
    expect(a.perimes).toBe(0);
    expect(a.expirentBientot).toBe(0);
    expect(a.disponibles).toBe(1);
  });

  it("coupe la liste à 5 lignes triées par nom", () => {
    const noms = ["G", "B", "F", "A", "E", "D", "C"];
    const a = calculerApercuStock(noms.map((n, i) => ligne(`r${i}`, n, 0)), MAINTENANT);
    expect(a.aSurveiller).toHaveLength(5);
    expect(a.aSurveillerTotal).toBe(7);
    expect(a.aSurveiller.map((l) => l.nom)).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("trie le stock bas par quantité puis nom, au singulier pour une unité", () => {
    const a = calculerApercuStock(
      [ligne("1", "Zinc", 3, 1), ligne("2", "Aspirine", 3, 1), ligne("3", "Fer", 1, 1)],
      MAINTENANT,
    );
    expect(a.aSurveiller.map((l) => l.nom)).toEqual(["Fer", "Aspirine", "Zinc"]);
    expect(a.aSurveiller[0].detail).toBe("Plus que 1 unité en stock");
  });
});

describe("formaterMontantGNF", () => {
  it("sépare les milliers par une espace insécable", () => {
    expect(formaterMontantGNF(0)).toBe("0 GNF");
    expect(formaterMontantGNF(999)).toBe("999 GNF");
    expect(formaterMontantGNF(1234567.4)).toBe("1 234 567 GNF");
  });
});
