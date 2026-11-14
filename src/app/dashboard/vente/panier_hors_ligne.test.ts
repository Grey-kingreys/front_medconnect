import { describe, expect, it } from "vitest";
import type { StockMedicament } from "@/lib/api_pharmacie";
import {
  PANIER_VIDE,
  ajouterAuPanier,
  avertissementStock,
  changerNombre,
  cleLigne,
  peutAugmenter,
  plafondVente,
  raisonListe,
  texteAvertissement,
} from "./panier";

const fiche = (surcharge: Partial<StockMedicament> = {}): StockMedicament => ({
  id: "s1",
  medicamentId: "m1",
  medicament: { id: "m1", nom: "Paracétamol", categorie: "Divers", ordonnanceRequise: false, formes: [] },
  structureId: "p1",
  quantite: 0,
  quantiteVendable: 0,
  prixUnitaire: 1500,
  disponible: false,
  ...surcharge,
});

const cle = () => "k1";

describe("vente hors ligne sur le poste (D737)", () => {
  it("le plafond n'existe plus sans plafond, il reste par défaut", () => {
    expect(plafondVente(fiche())).toBe(0);
    expect(plafondVente(fiche(), true)).toBe(Number.POSITIVE_INFINITY);
  });

  it("ajoute un médicament à 0 et continue avec le plus", () => {
    const s = fiche();
    expect(raisonListe(s, "BOITE")).toBe("rupture");
    expect(raisonListe(s, "BOITE", true)).toBeNull();
    const un = ajouterAuPanier(PANIER_VIDE, s, "BOITE", cle, true);
    expect(un.lignes).toHaveLength(1);
    expect(peutAugmenter(un, cleLigne("s1", "BOITE"), s, true)).toBe(true);
    expect(changerNombre(un, cleLigne("s1", "BOITE"), 1, s, true).lignes[0].nombre).toBe(2);
  });

  it("garde le plafond par défaut, comme le web", () => {
    expect(ajouterAuPanier(PANIER_VIDE, fiche(), "BOITE", cle).lignes).toHaveLength(0);
  });

  it("dit que la vente sera à régulariser, sans signe moins", () => {
    const s = fiche();
    const avertissement = avertissementStock(s, 1, true);
    expect(avertissement).toBe("a-regulariser");
    const texte = texteAvertissement("a-regulariser", s);
    expect(texte).toBe("Stock connu sur ce poste : 0. La vente sera à régulariser.");
    expect(texte).not.toContain("-");
    expect(avertissementStock(s, 1)).toBe("stock-insuffisant");
  });

  it("dit le stock connu en plaquettes", () => {
    const s = fiche({ quantite: 2, quantiteVendable: 2, coefficientBoite: 3, uniteMinimale: "PLAQUETTE", deconditionnable: true });
    expect(texteAvertissement("a-regulariser", s)).toBe("Stock connu sur ce poste : 2 plaquettes. La vente sera à régulariser.");
  });
});
