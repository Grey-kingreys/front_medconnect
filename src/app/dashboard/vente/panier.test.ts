import { afterEach, describe, expect, it, vi } from "vitest";
import type { StockMedicament } from "@/lib/api_pharmacie";
import {
  PANIER_VIDE,
  MAX_LIGNES_PANIER,
  NOMBRE_MAX_RESULTATS,
  panierPlein,
  quantiteMaxLigne,
  ajouterAuPanier,
  appliquerStockInsuffisant,
  changerQuantite,
  cleStockagePanier,
  corpsVente,
  enregistrerPanier,
  lirePanierStocke,
  medicamentsSurOrdonnance,
  messageCorrections,
  raisonNonVendable,
  rechercherDansStock,
  reconcilierPanier,
  retirerDuPanier,
  retirerLignes,
  telephoneClientValide,
  totalPanier,
  type PanierVente,
} from "./panier";

const MAINTENANT = new Date("2026-10-22T10:00:00.000Z");

const stock = (id: string, surcharge: Partial<StockMedicament> = {}, nom = `Médicament ${id}`, ordonnance = false): StockMedicament => ({
  id,
  medicamentId: `m-${id}`,
  medicament: { id: `m-${id}`, nom, categorie: "Antalgique", ordonnanceRequise: ordonnance, formes: [] },
  structureId: "p1",
  quantite: 5,
  prixUnitaire: 1000,
  disponible: true,
  ...surcharge,
});

const panier = (surcharge: Partial<PanierVente> = {}): PanierVente => ({ ...PANIER_VIDE, ...surcharge });
const cle = () => "cle-neuve";

describe("raisonNonVendable", () => {
  it("considère périmé le jour qui suit la péremption, pas le jour même", () => {
    expect(raisonNonVendable(stock("a", { dateExpiration: "2026-10-21T00:00:00.000Z" }), MAINTENANT)).toBe("perime");
    expect(raisonNonVendable(stock("a", { dateExpiration: "2026-10-22T00:00:00.000Z" }), MAINTENANT)).toBeNull();
  });

  it("respecte l'ordre périmé, puis rupture, puis sans prix", () => {
    const expire = "2026-01-01T00:00:00.000Z";
    expect(raisonNonVendable(stock("a", { dateExpiration: expire, quantite: 0, prixUnitaire: undefined }), MAINTENANT)).toBe("perime");
    expect(raisonNonVendable(stock("a", { quantite: 0, prixUnitaire: undefined }), MAINTENANT)).toBe("rupture");
    expect(raisonNonVendable(stock("a", { prixUnitaire: undefined }), MAINTENANT)).toBe("sans-prix");
  });

  it("refuse un prix de zéro", () => {
    expect(raisonNonVendable(stock("a", { prixUnitaire: 0 }), MAINTENANT)).toBe("sans-prix");
  });

  it("accepte un stock en règle", () => {
    expect(raisonNonVendable(stock("a"), MAINTENANT)).toBeNull();
  });
});

describe("rechercherDansStock", () => {
  const stocks = [
    stock("1", {}, "Paracétamol 500"),
    stock("2", { medicament: { id: "m", nom: "Doliprane", nomGenerique: "Paracétamol", categorie: "x", ordonnanceRequise: false, formes: [] } }),
    stock("3", {}, "Amoxicilline"),
  ];

  it("ignore la casse et les accents", () => {
    expect(rechercherDansStock(stocks, "PARACETAMOL").map((s) => s.id)).toEqual(["1", "2"]);
  });

  it("cherche aussi dans le nom générique", () => {
    expect(rechercherDansStock(stocks, "paracétamol").map((s) => s.id)).toContain("2");
  });

  it("rend tout le stock pour un texte vide", () => {
    expect(rechercherDansStock(stocks, "   ")).toHaveLength(3);
  });

  it("plafonne le nombre de résultats", () => {
    const beaucoup = Array.from({ length: 80 }, (_, i) => stock(String(i)));
    expect(rechercherDansStock(beaucoup, "")).toHaveLength(NOMBRE_MAX_RESULTATS);
  });
});

describe("ajouterAuPanier", () => {
  it("crée la clé au premier ajout seulement", () => {
    const un = ajouterAuPanier(PANIER_VIDE, stock("a"), cle, MAINTENANT);
    expect(un.cleIdempotence).toBe("cle-neuve");
    const deux = ajouterAuPanier(un, stock("b"), () => "autre", MAINTENANT);
    expect(deux.cleIdempotence).toBe("cle-neuve");
    expect(deux.lignes).toHaveLength(2);
  });

  it("ajoute une unité à une ligne existante, bornée au stock", () => {
    const s = stock("a", { quantite: 2 });
    let p = ajouterAuPanier(PANIER_VIDE, s, cle, MAINTENANT);
    p = ajouterAuPanier(p, s, cle, MAINTENANT);
    expect(p.lignes[0].quantite).toBe(2);
    expect(ajouterAuPanier(p, s, cle, MAINTENANT)).toBe(p);
  });

  it("remet l'ordonnance à non vue pour un nouveau médicament à ordonnance", () => {
    const p = panier({ lignes: [{ stockId: "a", quantite: 1 }], cleIdempotence: "k", ordonnanceVue: true });
    expect(ajouterAuPanier(p, stock("b", {}, "B", true), cle, MAINTENANT).ordonnanceVue).toBe(false);
    expect(ajouterAuPanier(p, stock("c", {}, "C", false), cle, MAINTENANT).ordonnanceVue).toBe(true);
  });

  it("refuse un médicament non vendable", () => {
    expect(ajouterAuPanier(PANIER_VIDE, stock("a", { quantite: 0 }), cle, MAINTENANT)).toBe(PANIER_VIDE);
  });
});

describe("changerQuantite", () => {
  const s = stock("a", { quantite: 3 });
  const p = panier({ lignes: [{ stockId: "a", quantite: 2 }], cleIdempotence: "k" });

  it("reste entre 1 et le stock", () => {
    expect(changerQuantite(p, s, 5).lignes[0].quantite).toBe(3);
    expect(changerQuantite(p, s, -5).lignes[0].quantite).toBe(1);
    expect(changerQuantite(p, s, 1).lignes[0].quantite).toBe(3);
  });
});

describe("limites d'une vente", () => {
  const panierDe = (n: number) =>
    panier({ cleIdempotence: "k", lignes: Array.from({ length: n }, (_, i) => ({ stockId: `s${i}`, quantite: 1 })) });

  it("refuse un 51e médicament en renvoyant le même panier", () => {
    const plein = panierDe(50);
    expect(ajouterAuPanier(plein, stock("nouveau"), cle, MAINTENANT)).toBe(plein);
  });

  it("accepte encore une quantité en plus sur une ligne d'un panier plein", () => {
    const plein = panierDe(50);
    const suite = ajouterAuPanier(plein, stock("s0"), cle, MAINTENANT);
    expect(suite.lignes[0].quantite).toBe(2);
  });

  it("dit si le panier est plein", () => {
    expect(panierPlein(panierDe(49))).toBe(false);
    expect(panierPlein(panierDe(50))).toBe(true);
  });

  it("borne la quantité d'une ligne à 10000", () => {
    const gros = stock("g", { quantite: 20000 });
    expect(quantiteMaxLigne(gros)).toBe(10000);
    expect(quantiteMaxLigne(stock("p", { quantite: 3 }))).toBe(3);
    const p = panier({ lignes: [{ stockId: "g", quantite: 9999 }] });
    expect(changerQuantite(p, gros, 5).lignes[0].quantite).toBe(10000);
  });
});

describe("retirerDuPanier et retirerLignes", () => {
  it("efface la clé et l'ordonnance quand le panier se vide, en gardant le client", () => {
    const p = panier({ lignes: [{ stockId: "a", quantite: 1 }], cleIdempotence: "k", ordonnanceVue: true, clientNom: "Barry" });
    const vide = retirerDuPanier(p, "a");
    expect(vide.lignes).toEqual([]);
    expect(vide.cleIdempotence).toBeNull();
    expect(vide.ordonnanceVue).toBe(false);
    expect(vide.clientNom).toBe("Barry");
  });

  it("garde la clé tant qu'il reste une ligne", () => {
    const p = panier({ lignes: [{ stockId: "a", quantite: 1 }, { stockId: "b", quantite: 1 }], cleIdempotence: "k" });
    expect(retirerLignes(p, ["a"]).cleIdempotence).toBe("k");
    expect(retirerLignes(p, ["a", "b"]).cleIdempotence).toBeNull();
  });
});

describe("reconcilierPanier", () => {
  it("retire les lignes perdues ou invendables et borne les quantités", () => {
    const p = panier({
      cleIdempotence: "k",
      lignes: [
        { stockId: "a", quantite: 4 },
        { stockId: "b", quantite: 1 },
        { stockId: "c", quantite: 2 },
        { stockId: "disparu", quantite: 1 },
      ],
    });
    const stocks = [stock("a", { quantite: 2 }, "Aspirine"), stock("b", { quantite: 0 }, "Bétadine"), stock("c", {}, "Codéine")];
    const { panier: corrige, corrections } = reconcilierPanier(p, stocks, MAINTENANT);
    expect(corrige.lignes).toEqual([{ stockId: "a", quantite: 2 }, { stockId: "c", quantite: 2 }]);
    expect(corrections).toEqual([
      { nom: "Aspirine", avant: 4, apres: 2 },
      { nom: "Bétadine", avant: 1, apres: 0 },
      { nom: "Un médicament", avant: 1, apres: 0 },
    ]);
  });

  it("vide la clé si plus rien ne reste", () => {
    const p = panier({ cleIdempotence: "k", lignes: [{ stockId: "x", quantite: 1 }], ordonnanceVue: true });
    const { panier: corrige } = reconcilierPanier(p, [], MAINTENANT);
    expect(corrige.cleIdempotence).toBeNull();
    expect(corrige.ordonnanceVue).toBe(false);
  });
});

describe("appliquerStockInsuffisant", () => {
  const p = panier({ cleIdempotence: "k", lignes: [{ stockId: "a", quantite: 3 }, { stockId: "b", quantite: 2 }] });
  const stocks = [stock("a", {}, "Aspirine"), stock("b", {}, "Bétadine")];

  it("ramène la quantité au disponible et retire à zéro", () => {
    const { panier: corrige, corrections } = appliquerStockInsuffisant(
      p,
      [{ stockId: "a", nom: "Aspirine", disponible: 1 }, { stockId: "b", disponible: 0 }],
      stocks,
    );
    expect(corrige.lignes).toEqual([{ stockId: "a", quantite: 1 }]);
    expect(corrections).toEqual([
      { nom: "Aspirine", avant: 3, apres: 1 },
      { nom: "Bétadine", avant: 2, apres: 0 },
    ]);
  });

  it("ignore une ligne sans quantité disponible ou absente du panier", () => {
    const { panier: corrige, corrections } = appliquerStockInsuffisant(p, [{ stockId: "a" }, { stockId: "z", disponible: 0 }], stocks);
    expect(corrige.lignes).toEqual(p.lignes);
    expect(corrections).toEqual([]);
  });

  it("utilise « Un médicament » quand aucun nom n'est connu", () => {
    const { corrections } = appliquerStockInsuffisant(p, [{ stockId: "a", disponible: 1 }], []);
    expect(corrections[0].nom).toBe("Un médicament");
  });
});

describe("totalPanier", () => {
  it("additionne les prix arrondis fois les quantités", () => {
    const p = panier({ lignes: [{ stockId: "a", quantite: 3 }, { stockId: "b", quantite: 1 }] });
    const stocks = [stock("a", { prixUnitaire: 1500.4 }), stock("b", { prixUnitaire: 200.6 })];
    expect(totalPanier(p, stocks)).toBe(1500 * 3 + 201);
  });
});

describe("medicamentsSurOrdonnance", () => {
  it("liste les noms dans l'ordre du panier", () => {
    const p = panier({ lignes: [{ stockId: "b", quantite: 1 }, { stockId: "a", quantite: 1 }, { stockId: "c", quantite: 1 }] });
    const stocks = [stock("a", {}, "A", true), stock("b", {}, "B", true), stock("c", {}, "C", false)];
    expect(medicamentsSurOrdonnance(p, stocks)).toEqual(["B", "A"]);
  });
});

describe("telephoneClientValide", () => {
  it("accepte vide, refuse un format invalide", () => {
    expect(telephoneClientValide("  ")).toBe(true);
    expect(telephoneClientValide("+224 620 00 00 00")).toBe(true);
    expect(telephoneClientValide("12")).toBe(false);
    expect(telephoneClientValide("abc12345678")).toBe(false);
  });
});

describe("corpsVente", () => {
  const p = panier({ lignes: [{ stockId: "a", quantite: 2 }], clientNom: "  ", clientTelephone: " 620000000 ", ordonnanceVue: true });

  it("n'envoie pas un client vide et nettoie le reste", () => {
    expect(corpsVente(p, false)).toEqual({ lignes: [{ stockId: "a", quantite: 2 }], clientTelephone: "620000000" });
  });

  it("n'envoie l'ordonnance vérifiée que si elle est requise et vue", () => {
    expect(corpsVente(p, true).ordonnanceVerifiee).toBe(true);
    expect(corpsVente({ ...p, ordonnanceVue: false }, true).ordonnanceVerifiee).toBeUndefined();
  });
});

describe("messageCorrections", () => {
  it("décrit retraits et quantités réduites", () => {
    expect(
      messageCorrections([
        { nom: "Aspirine", avant: 4, apres: 2 },
        { nom: "Bétadine", avant: 1, apres: 0 },
      ]),
    ).toBe("Le panier a été corrigé : Aspirine (2 au lieu de 4), Bétadine (épuisé, retiré).");
  });
});

describe("stockage du panier", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  const cleP = cleStockagePanier("p1", "u1");

  it("construit la clé de stockage", () => {
    expect(cleP).toBe("medconnecte:panier-vente:p1:u1");
  });

  it("relit un panier valide", () => {
    localStorage.setItem(
      cleP,
      JSON.stringify({ version: 1, cleIdempotence: "k", lignes: [{ stockId: "a", quantite: 2 }], clientNom: "Barry", clientTelephone: "620", ordonnanceVue: true }),
    );
    expect(lirePanierStocke(cleP)).toEqual({
      cleIdempotence: "k",
      lignes: [{ stockId: "a", quantite: 2 }],
      clientNom: "Barry",
      clientTelephone: "620",
      ordonnanceVue: true,
    });
  });

  it("rend un panier vide pour un JSON cassé, une version inconnue ou un stockage qui échoue", () => {
    localStorage.setItem(cleP, "{pas du json");
    expect(lirePanierStocke(cleP)).toEqual(PANIER_VIDE);
    localStorage.setItem(cleP, JSON.stringify({ version: 2, lignes: [] }));
    expect(lirePanierStocke(cleP)).toEqual(PANIER_VIDE);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("indisponible");
    });
    expect(lirePanierStocke(cleP)).toEqual(PANIER_VIDE);
  });

  it("garde les 50 premières lignes d'un panier de 60", () => {
    const lignes = Array.from({ length: 60 }, (_, i) => ({ stockId: `s${i}`, quantite: 1 }));
    localStorage.setItem(cleP, JSON.stringify({ version: 1, lignes }));
    const relu = lirePanierStocke(cleP);
    expect(relu.lignes).toHaveLength(MAX_LIGNES_PANIER);
    expect(relu.lignes[49].stockId).toBe("s49");
  });

  it("ignore les éléments invalides", () => {
    localStorage.setItem(
      cleP,
      JSON.stringify({
        version: 1,
        cleIdempotence: 3,
        lignes: [{ stockId: "a", quantite: 0 }, { stockId: "", quantite: 1 }, { stockId: "b", quantite: 1.5 }, null, { stockId: "c", quantite: 4 }],
        clientNom: 5,
        ordonnanceVue: "oui",
      }),
    );
    expect(lirePanierStocke(cleP)).toEqual({ ...PANIER_VIDE, lignes: [{ stockId: "c", quantite: 4 }] });
  });

  it("enregistre le panier, et retire la clé quand tout est vide", () => {
    enregistrerPanier(cleP, panier({ lignes: [{ stockId: "a", quantite: 1 }], cleIdempotence: "k" }));
    expect(localStorage.getItem(cleP)).not.toBeNull();
    enregistrerPanier(cleP, PANIER_VIDE);
    expect(localStorage.getItem(cleP)).toBeNull();
  });

  it("garde le client même sans ligne", () => {
    enregistrerPanier(cleP, panier({ clientNom: "Barry" }));
    expect(localStorage.getItem(cleP)).not.toBeNull();
  });
});
