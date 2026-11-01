import { afterEach, describe, expect, it, vi } from "vitest";
import type { StockMedicament } from "@/lib/api_pharmacie";
import {
  PANIER_VIDE,
  MAX_LIGNES_PANIER,
  NOMBRE_MAX_RESULTATS,
  QUANTITE_MAX_LIGNE,
  panierPlein,
  ajouterAuPanier,
  avertissementStock,
  changerNombre,
  changerUnite,
  cleStockagePanier,
  corpsVente,
  definirSortieManuelle,
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
  uniteParDefaut,
  type PanierVente,
} from "./panier";

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

/** Fiche déconditionnable : boîte de 20 comprimés à 3 500, comprimé à 600. */
const fiche = (id: string, surcharge: Partial<StockMedicament> = {}) =>
  stock(id, { coefficientBoite: 20, uniteMinimale: "COMPRIME", deconditionnable: true, prixUnitaire: 3500, prixUnite: 600, ...surcharge });

const panier = (surcharge: Partial<PanierVente> = {}): PanierVente => ({ ...PANIER_VIDE, ...surcharge });
const cle = () => "cle-neuve";

describe("uniteParDefaut", () => {
  it("propose l'unité pour une fiche déconditionnable avec un prix à l'unité, sinon la boîte", () => {
    expect(uniteParDefaut(fiche("a"))).toBe("UNITE");
    expect(uniteParDefaut(fiche("a", { prixUnite: null }))).toBe("BOITE");
    expect(uniteParDefaut(fiche("a", { deconditionnable: false }))).toBe("BOITE");
    expect(uniteParDefaut(stock("a"))).toBe("BOITE");
  });
});

describe("raisonNonVendable", () => {
  it("ne bloque ni la rupture ni la péremption", () => {
    expect(raisonNonVendable(stock("a", { quantite: -1 }), "BOITE")).toBeNull();
    expect(raisonNonVendable(stock("a", { dateExpiration: "2020-01-01T00:00:00.000Z" }), "BOITE")).toBeNull();
  });

  it("refuse une boîte sans prix ou à zéro", () => {
    expect(raisonNonVendable(stock("a", { prixUnitaire: undefined }), "BOITE")).toBe("sans-prix");
    expect(raisonNonVendable(stock("a", { prixUnitaire: 0 }), "BOITE")).toBe("sans-prix");
  });

  it("refuse l'unité sans prix à l'unité ou sur une fiche non déconditionnable", () => {
    expect(raisonNonVendable(fiche("a", { prixUnite: null }), "UNITE")).toBe("sans-prix");
    expect(raisonNonVendable(stock("a"), "UNITE")).toBe("unite-interdite");
    expect(raisonNonVendable(fiche("a"), "UNITE")).toBeNull();
  });
});

describe("avertissementStock", () => {
  it("signale l'attente de stock au-delà de la quantité vendable", () => {
    const s = fiche("a", { quantite: 25, quantiteVendable: 25 });
    expect(avertissementStock(s, "UNITE", 25)).toBeNull();
    expect(avertissementStock(s, "UNITE", 26)).toBe("attente-stock");
    expect(avertissementStock(s, "BOITE", 1)).toBeNull();
    expect(avertissementStock(s, "BOITE", 2)).toBe("attente-stock");
    expect(avertissementStock(stock("b", { quantite: -1 }), "BOITE", 1)).toBe("attente-stock");
  });

  it("signale qu'il ne reste que du périmé", () => {
    expect(avertissementStock(fiche("a", { quantite: 12, quantiteVendable: 0 }), "UNITE", 1)).toBe("perime-seulement");
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
    const un = ajouterAuPanier(PANIER_VIDE, stock("a"), "BOITE", cle);
    expect(un.cleIdempotence).toBe("cle-neuve");
    const deux = ajouterAuPanier(un, stock("b"), "BOITE", () => "autre");
    expect(deux.cleIdempotence).toBe("cle-neuve");
    expect(deux.lignes).toHaveLength(2);
  });

  it("ajoute un à une ligne existante de la même unité, sans plafond au stock", () => {
    const s = stock("a", { quantite: 2 });
    let p = ajouterAuPanier(PANIER_VIDE, s, "BOITE", cle);
    p = ajouterAuPanier(p, s, "BOITE", cle);
    p = ajouterAuPanier(p, s, "BOITE", cle);
    expect(p.lignes).toEqual([{ stockId: "a", unite: "BOITE", nombre: 3 }]);
  });

  it("remet l'ordonnance à non vue pour un nouveau médicament à ordonnance", () => {
    const p = panier({ lignes: [{ stockId: "a", unite: "BOITE", nombre: 1 }], cleIdempotence: "k", ordonnanceVue: true });
    expect(ajouterAuPanier(p, stock("b", {}, "B", true), "BOITE", cle).ordonnanceVue).toBe(false);
    expect(ajouterAuPanier(p, stock("c", {}, "C", false), "BOITE", cle).ordonnanceVue).toBe(true);
  });

  it("ajoute une fiche en rupture (vente sans stock, D689)", () => {
    const p = ajouterAuPanier(PANIER_VIDE, stock("a", { quantite: -1 }), "BOITE", cle);
    expect(p.lignes).toEqual([{ stockId: "a", unite: "BOITE", nombre: 1 }]);
  });

  it("refuse une fiche sans prix de boîte en boîte", () => {
    expect(ajouterAuPanier(PANIER_VIDE, stock("a", { prixUnitaire: undefined }), "BOITE", cle)).toBe(PANIER_VIDE);
  });

  it("garde une ligne par unité pour une même fiche", () => {
    const s = fiche("a");
    const p = ajouterAuPanier(ajouterAuPanier(PANIER_VIDE, s, "BOITE", cle), s, "UNITE", cle);
    expect(p.lignes.map((l) => l.unite)).toEqual(["BOITE", "UNITE"]);
  });
});

describe("changerNombre", () => {
  const p = panier({ lignes: [{ stockId: "a", unite: "BOITE", nombre: 2 }], cleIdempotence: "k" });

  it("reste entre 1 et 10000, sans lien avec le stock", () => {
    expect(changerNombre(p, "a:BOITE", -5).lignes[0].nombre).toBe(1);
    expect(changerNombre(p, "a:BOITE", 50).lignes[0].nombre).toBe(52);
    expect(changerNombre(changerNombre(p, "a:BOITE", 20000), "a:BOITE", 1).lignes[0].nombre).toBe(QUANTITE_MAX_LIGNE);
  });
});

describe("changerUnite", () => {
  const s = fiche("a");

  it("bascule la ligne vers l'autre unité", () => {
    const p = panier({ lignes: [{ stockId: "a", unite: "UNITE", nombre: 6 }] });
    expect(changerUnite(p, "a:UNITE", s).lignes).toEqual([{ stockId: "a", unite: "BOITE", nombre: 6 }]);
  });

  it("fusionne avec la ligne de l'autre unité existante", () => {
    const p = panier({
      lignes: [
        { stockId: "a", unite: "BOITE", nombre: 2 },
        { stockId: "a", unite: "UNITE", nombre: 3 },
      ],
    });
    expect(changerUnite(p, "a:UNITE", s).lignes).toEqual([{ stockId: "a", unite: "BOITE", nombre: 5 }]);
  });

  it("refuse l'unité sur une fiche non déconditionnable", () => {
    const simple = stock("b");
    const p = panier({ lignes: [{ stockId: "b", unite: "BOITE", nombre: 1 }] });
    expect(changerUnite(p, "b:BOITE", simple)).toBe(p);
  });
});

describe("limites d'une vente", () => {
  const panierDe = (n: number) =>
    panier({ cleIdempotence: "k", lignes: Array.from({ length: n }, (_, i) => ({ stockId: `s${i}`, unite: "BOITE" as const, nombre: 1 })) });

  it("refuse un 51e médicament en renvoyant le même panier", () => {
    const plein = panierDe(50);
    expect(ajouterAuPanier(plein, stock("nouveau"), "BOITE", cle)).toBe(plein);
  });

  it("accepte encore un en plus sur une ligne d'un panier plein", () => {
    const plein = panierDe(50);
    const suite = ajouterAuPanier(plein, stock("s0"), "BOITE", cle);
    expect(suite.lignes[0].nombre).toBe(2);
  });

  it("dit si le panier est plein", () => {
    expect(panierPlein(panierDe(MAX_LIGNES_PANIER - 1))).toBe(false);
    expect(panierPlein(panierDe(MAX_LIGNES_PANIER))).toBe(true);
  });
});

describe("retirerDuPanier et retirerLignes", () => {
  it("efface la clé et l'ordonnance quand le panier se vide, en gardant le client", () => {
    const p = panier({ lignes: [{ stockId: "a", unite: "BOITE", nombre: 1 }], cleIdempotence: "k", ordonnanceVue: true, clientNom: "Barry" });
    const vide = retirerDuPanier(p, "a:BOITE");
    expect(vide.lignes).toEqual([]);
    expect(vide.cleIdempotence).toBeNull();
    expect(vide.ordonnanceVue).toBe(false);
    expect(vide.clientNom).toBe("Barry");
  });

  it("garde la clé tant qu'il reste une ligne", () => {
    const p = panier({
      lignes: [
        { stockId: "a", unite: "BOITE", nombre: 1 },
        { stockId: "b", unite: "BOITE", nombre: 1 },
      ],
      cleIdempotence: "k",
    });
    expect(retirerLignes(p, ["a"]).cleIdempotence).toBe("k");
    expect(retirerLignes(p, ["a", "b"]).cleIdempotence).toBeNull();
  });
});

describe("reconcilierPanier", () => {
  it("retire les lignes perdues ou invendables dans leur unité, sans plafond au stock", () => {
    const p = panier({
      cleIdempotence: "k",
      lignes: [
        { stockId: "a", unite: "BOITE", nombre: 40 },
        { stockId: "b", unite: "UNITE", nombre: 1 },
        { stockId: "c", unite: "BOITE", nombre: 2 },
        { stockId: "disparu", unite: "BOITE", nombre: 1 },
      ],
    });
    const stocks = [stock("a", { quantite: 2 }, "Aspirine"), stock("b", {}, "Bétadine"), stock("c", { quantite: -3 }, "Codéine")];
    const { panier: corrige, corrections } = reconcilierPanier(p, stocks);
    expect(corrige.lignes).toEqual([
      { stockId: "a", unite: "BOITE", nombre: 40 },
      { stockId: "c", unite: "BOITE", nombre: 2 },
    ]);
    expect(corrections).toEqual([
      { nom: "Bétadine", avant: 1, apres: 0 },
      { nom: "Un médicament", avant: 1, apres: 0 },
    ]);
  });

  it("vide la clé si plus rien ne reste", () => {
    const p = panier({ cleIdempotence: "k", lignes: [{ stockId: "x", unite: "BOITE", nombre: 1 }], ordonnanceVue: true });
    const { panier: corrige } = reconcilierPanier(p, []);
    expect(corrige.cleIdempotence).toBeNull();
    expect(corrige.ordonnanceVue).toBe(false);
  });
});

describe("totalPanier", () => {
  it("additionne 6 comprimés à 600 et 2 boîtes à 3 500", () => {
    const s = fiche("a");
    const p = panier({
      lignes: [
        { stockId: "a", unite: "UNITE", nombre: 6 },
        { stockId: "b", unite: "BOITE", nombre: 2 },
      ],
    });
    expect(totalPanier(p, [s, fiche("b")])).toBe(6 * 600 + 2 * 3500);
    expect(6 * 600 + 2 * 3500).toBe(10600);
  });
});

describe("medicamentsSurOrdonnance", () => {
  it("liste les noms dans l'ordre du panier", () => {
    const p = panier({
      lignes: [
        { stockId: "b", unite: "BOITE", nombre: 1 },
        { stockId: "a", unite: "BOITE", nombre: 1 },
        { stockId: "c", unite: "BOITE", nombre: 1 },
      ],
    });
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
  const p = panier({
    lignes: [{ stockId: "a", unite: "BOITE", nombre: 2 }],
    clientNom: "  ",
    clientTelephone: " 620000000 ",
    ordonnanceVue: true,
  });

  it("n'envoie pas de clé paiements sans paiement explicite, ni un client vide", () => {
    const corps = corpsVente(p, false);
    expect(corps).toEqual({ lignes: [{ stockId: "a", quantite: 2, unite: "BOITE" }], clientTelephone: "620000000" });
    expect("paiements" in corps).toBe(false);
  });

  it("porte tels quels les paiements d'un partage espèces et Orange Money", () => {
    const paiements = [
      { mode: "ESPECES", montant: 5000 },
      { mode: "ORANGE_MONEY", montant: 5600, reference: "OM-1" },
    ];
    expect(corpsVente(p, false, paiements).paiements).toEqual(paiements);
  });

  it("n'envoie l'ordonnance vérifiée que si elle est requise et vue", () => {
    expect(corpsVente(p, true).ordonnanceVerifiee).toBe(true);
    expect(corpsVente({ ...p, ordonnanceVue: false }, true).ordonnanceVerifiee).toBeUndefined();
  });

  it("porte la sortie manuelle d'une ligne", () => {
    const avec = definirSortieManuelle(p, "a", { lotId: "l1", motif: "Demande du médecin" });
    expect(corpsVente(avec, false).lignes[0].sortieManuelle).toEqual({ lotId: "l1", motif: "Demande du médecin" });
    expect(corpsVente(definirSortieManuelle(avec, "a", null), false).lignes[0]).toEqual({ stockId: "a", quantite: 2, unite: "BOITE" });
  });
});

describe("messageCorrections", () => {
  it("décrit les lignes retirées", () => {
    expect(
      messageCorrections([
        { nom: "Aspirine", avant: 4, apres: 0 },
        { nom: "Bétadine", avant: 1, apres: 0 },
      ]),
    ).toBe("Le panier a été corrigé : Aspirine (retiré), Bétadine (retiré).");
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

  it("relit un panier version 2", () => {
    localStorage.setItem(
      cleP,
      JSON.stringify({ version: 2, cleIdempotence: "k", lignes: [{ stockId: "a", unite: "UNITE", nombre: 2 }], clientNom: "Barry", clientTelephone: "620", ordonnanceVue: true }),
    );
    expect(lirePanierStocke(cleP)).toEqual({
      cleIdempotence: "k",
      lignes: [{ stockId: "a", unite: "UNITE", nombre: 2 }],
      clientNom: "Barry",
      clientTelephone: "620",
      ordonnanceVue: true,
    });
  });

  it("convertit un panier version 1 : la quantité devient un nombre de boîtes", () => {
    localStorage.setItem(cleP, JSON.stringify({ version: 1, lignes: [{ stockId: "a", quantite: 3 }] }));
    expect(lirePanierStocke(cleP).lignes).toEqual([{ stockId: "a", unite: "BOITE", nombre: 3 }]);
  });

  it("rend un panier vide pour un JSON cassé, une version inconnue ou un stockage qui échoue", () => {
    localStorage.setItem(cleP, "{pas du json");
    expect(lirePanierStocke(cleP)).toEqual(PANIER_VIDE);
    localStorage.setItem(cleP, JSON.stringify({ version: 3, lignes: [] }));
    expect(lirePanierStocke(cleP)).toEqual(PANIER_VIDE);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("indisponible");
    });
    expect(lirePanierStocke(cleP)).toEqual(PANIER_VIDE);
  });

  it("garde les 50 premières lignes d'un panier de 60", () => {
    const lignes = Array.from({ length: 60 }, (_, i) => ({ stockId: `s${i}`, unite: "BOITE", nombre: 1 }));
    localStorage.setItem(cleP, JSON.stringify({ version: 2, lignes }));
    const relu = lirePanierStocke(cleP);
    expect(relu.lignes).toHaveLength(MAX_LIGNES_PANIER);
    expect(relu.lignes[49].stockId).toBe("s49");
  });

  it("ignore les éléments invalides", () => {
    localStorage.setItem(
      cleP,
      JSON.stringify({
        version: 2,
        cleIdempotence: 3,
        lignes: [
          { stockId: "a", unite: "BOITE", nombre: 0 },
          { stockId: "", unite: "BOITE", nombre: 1 },
          { stockId: "b", unite: "BOITE", nombre: 1.5 },
          { stockId: "d", unite: "CARTON", nombre: 1 },
          null,
          { stockId: "c", unite: "BOITE", nombre: 4 },
        ],
        clientNom: 5,
        ordonnanceVue: "oui",
      }),
    );
    expect(lirePanierStocke(cleP)).toEqual({ ...PANIER_VIDE, lignes: [{ stockId: "c", unite: "BOITE", nombre: 4 }] });
  });

  it("enregistre en version 2 sans la sortie manuelle, et retire la clé quand tout est vide", () => {
    enregistrerPanier(
      cleP,
      panier({ lignes: [{ stockId: "a", unite: "BOITE", nombre: 1, sortieManuelle: { lotId: "l1", motif: "Demande du médecin" } }], cleIdempotence: "k" }),
    );
    const brut = JSON.parse(localStorage.getItem(cleP) ?? "null");
    expect(brut.version).toBe(2);
    expect(brut.lignes).toEqual([{ stockId: "a", unite: "BOITE", nombre: 1 }]);
    enregistrerPanier(cleP, PANIER_VIDE);
    expect(localStorage.getItem(cleP)).toBeNull();
  });

  it("garde le client même sans ligne", () => {
    enregistrerPanier(cleP, panier({ clientNom: "Barry" }));
    expect(localStorage.getItem(cleP)).not.toBeNull();
  });
});
