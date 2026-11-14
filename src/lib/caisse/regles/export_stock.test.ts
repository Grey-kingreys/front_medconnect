import { describe, expect, it } from "vitest";
import { COLONNES_EXPORT_STOCK, lignesExportStock, nomFichierExportStock, normaliserPourFichier, type FicheExport } from "./export_stock";

// Mêmes jeux que back_medconnect/src/pharmacie/exporter-stock.spec.ts (coefficient 10, gélules, seuil de 1 boîte).
const base = { nomGenerique: null, prixUnitaire: 5000, coefficientBoite: 10, uniteMinimale: "GELULE" as const, notes: null, qualifie: true, quantiteARegulariser: 0 };
const FICHES: FicheExport[] = [
  {
    ...base,
    nom: "Amoxicilline 500 mg",
    quantite: 50,
    lots: [
      { quantite: 30, dateExpiration: "2027-06-30", numeroLot: "L1" },
      { quantite: 25, dateExpiration: null, numeroLot: null },
    ],
  },
  { ...base, nom: "Paracétamol 500 mg", quantite: 3, lots: [{ quantite: 3, dateExpiration: "2028-01-31", numeroLot: "P9" }] },
  { ...base, nom: "Coartem", quantite: 0, qualifie: false, notes: "À qualifier", lots: [] },
];
const options = { seuilBoites: 1 };

describe("export du stock : lignes", () => {
  it("mêmes titres de colonnes que le modèle d'import du serveur", () => {
    expect(COLONNES_EXPORT_STOCK.map((c) => c.header)).toEqual([
      "Médicament",
      "Quantité (boîtes)",
      "Prix de la boîte (GNF)",
      "Date d'expiration (AAAA-MM-JJ)",
      "Lot",
      "Coût d'achat de la boîte (GNF)",
      "Notes",
    ]);
  });

  it("une ligne par lot, boîtes entières, reste d'une boîte entamée dans les notes, produit sans lot gardé", () => {
    const l = lignesExportStock(FICHES, options);
    expect(l[0]).toEqual(["Amoxicilline 500 mg", 3, 5000, "2027-06-30", "L1", null, null]);
    expect(l[1]).toEqual(["Amoxicilline 500 mg", 2, 5000, null, null, null, "Boîte entamée : 5 gélules en plus"]);
    expect(l[2]).toEqual(["Paracétamol 500 mg", 0, 5000, "2028-01-31", "P9", null, "Boîte entamée : 3 gélules en plus"]);
    expect(l[3]).toEqual(["Coartem", 0, 5000, null, null, null, "À qualifier"]);
    for (const ligne of l) expect(Number.isInteger(ligne[1])).toBe(true);
  });

  it("jamais de coût : la colonne est vide sur toutes les lignes", () => {
    expect(lignesExportStock(FICHES, options).every((l) => l[5] === null)).toBe(true);
  });

  it("filtres alertes, rupture, qualifier et recherche", () => {
    const noms = (o: Parameters<typeof lignesExportStock>[1]) => lignesExportStock(FICHES, o).map((l) => l[0]);
    expect(noms({ ...options, filtre: "alertes" })).toEqual(["Paracétamol 500 mg"]);
    expect(noms({ ...options, filtre: "rupture" })).toEqual(["Coartem"]);
    expect(noms({ ...options, filtre: "qualifier" })).toEqual(["Coartem"]);
    expect(noms({ ...options, q: " AMOX " })).toEqual(["Amoxicilline 500 mg", "Amoxicilline 500 mg"]);
  });

  it("stock négatif : quantité 0 et note explicite", () => {
    const l = lignesExportStock([{ ...base, nom: "Ventoline", quantite: 0, quantiteARegulariser: 4, lots: [] }], options);
    expect(l).toEqual([["Ventoline", 0, 5000, null, null, null, "Stock négatif dans MedConnecte : -4 gélules"]]);
  });

  it("nom du fichier normalisé avec la date du jour", () => {
    expect(nomFichierExportStock("Pharmacie Étoile du Matin", "2026-11-14")).toBe("stock-pharmacie-etoile-du-matin-2026-11-14.xlsx");
    expect(normaliserPourFichier("***")).toBe("pharmacie");
  });
});
