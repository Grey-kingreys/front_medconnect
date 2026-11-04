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
  demandeEnUm,
  peutAugmenter,
  plafondVente,
  raisonListe,
  texteAvertissement,
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
  it("ne juge ni la rupture ni la péremption (la rupture est dite par raisonListe)", () => {
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
  it("signale un stock insuffisant au-delà du plafond, boîtes et unités additionnées", () => {
    const s = fiche("a", { quantite: 25, quantiteVendable: 25 });
    expect(avertissementStock(s, 25)).toBeNull();
    expect(avertissementStock(s, 26)).toBe("stock-insuffisant");
    const p = panier({
      lignes: [
        { stockId: "a", unite: "BOITE", nombre: 1 },
        { stockId: "a", unite: "UNITE", nombre: 6 },
      ],
    });
    expect(demandeEnUm(p, s)).toBe(26);
    expect(avertissementStock(s, demandeEnUm(p, s))).toBe("stock-insuffisant");
    expect(avertissementStock(stock("b", { quantite: 0 }), 1)).toBe("stock-insuffisant");
  });

  it("signale qu'il ne reste que du périmé", () => {
    expect(avertissementStock(fiche("a", { quantite: 12, quantiteVendable: 0 }), 1)).toBe("perime-seulement");
  });

  it("dit le stock restant sans parler de livraison", () => {
    const s = fiche("a", { quantite: 23, quantiteVendable: 23 });
    expect(texteAvertissement("stock-insuffisant", s)).toBe("Stock insuffisant : il reste 1 boîte et 3 comprimés.");
    expect(texteAvertissement("stock-insuffisant", stock("b", { quantite: 1, quantiteVendable: 1 }))).toBe(
      "Stock insuffisant : il reste 1 boîte.",
    );
    expect(texteAvertissement("stock-insuffisant", stock("c", { quantite: 0 }))).toBe("Rupture de stock");
  });
});

describe("plafondVente", () => {
  it("prend le vendable s'il est positif", () => {
    expect(plafondVente(fiche("a", { quantite: 50, quantiteVendable: 30 }))).toBe(30);
  });

  it("prend le stock quand il ne reste que du périmé", () => {
    expect(plafondVente(fiche("a", { quantite: 12, quantiteVendable: 0 }))).toBe(12);
  });

  it("vaut le stock sur un ancien serveur sans vendable", () => {
    expect(plafondVente(stock("a", { quantite: 4 }))).toBe(4);
  });

  it("plafonne en plaquettes : 1 boîte de 10 et 9 plaquettes donnent 19", () => {
    const plaquettes = fiche("p", { coefficientBoite: 10, uniteMinimale: "PLAQUETTE", quantite: 19, quantiteVendable: 19 });
    expect(plafondVente(plaquettes)).toBe(19);
    expect(avertissementStock(plaquettes, 19)).toBeNull();
    expect(avertissementStock(plaquettes, 20)).toBe("stock-insuffisant");
    expect(texteAvertissement("stock-insuffisant", plaquettes)).toBe("Stock insuffisant : il reste 1 boîte et 9 plaquettes.");
    const p = panier({
      lignes: [
        { stockId: "p", unite: "BOITE", nombre: 1 },
        { stockId: "p", unite: "UNITE", nombre: 9 },
      ],
    });
    expect(demandeEnUm(p, plaquettes)).toBe(19);
    expect(peutAugmenter(p, "p:UNITE", plaquettes)).toBe(false);
  });

  it("vaut 0 en rupture, même avec une part à régulariser", () => {
    expect(plafondVente(stock("a", { quantite: 0, quantiteARegulariser: 1, quantiteVendable: 0 }))).toBe(0);
    expect(plafondVente(stock("a", { quantite: -1 }))).toBe(0);
  });
});

describe("raisonListe", () => {
  it("donne la rupture quand le plafond est 0", () => {
    expect(raisonListe(stock("a", { quantite: 0, quantiteARegulariser: 1 }), "BOITE")).toBe("rupture");
  });

  it("dit « moins d'une boîte » quand la boîte ne peut plus se vendre, sans bouton d'ajout", () => {
    // Déconditionnable sans prix à l'unité : vendue à la boîte, 5 comprimés pour des boîtes de 20.
    const s = fiche("a", { prixUnite: null, quantite: 5, quantiteVendable: 5 });
    expect(raisonListe(s, uniteParDefaut(s))).toBe("moins-d-une-boite");
    expect(ajouterAuPanier(PANIER_VIDE, s, "BOITE", cle)).toBe(PANIER_VIDE);
    // Non déconditionnable : le stock est déjà en boîtes, donc au moins une boîte tant qu'il en reste.
    expect(raisonListe(stock("b", { quantite: 1, quantiteVendable: 1 }), "BOITE")).toBeNull();
    // Avec un prix à l'unité, l'unité reste vendable.
    expect(raisonListe(fiche("c", { quantite: 5, quantiteVendable: 5 }), "UNITE")).toBeNull();
  });

  it("garde les raisons de prix et d'unité sinon", () => {
    expect(raisonListe(stock("a", { prixUnitaire: undefined }), "BOITE")).toBe("sans-prix");
    expect(raisonListe(stock("a"), "UNITE")).toBe("unite-interdite");
    expect(raisonListe(stock("a"), "BOITE")).toBeNull();
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

  it("ajoute un à une ligne existante de la même unité, jusqu'au plafond du stock", () => {
    const s = stock("a", { quantite: 2 });
    let p = ajouterAuPanier(PANIER_VIDE, s, "BOITE", cle);
    p = ajouterAuPanier(p, s, "BOITE", cle);
    expect(p.lignes).toEqual([{ stockId: "a", unite: "BOITE", nombre: 2 }]);
    expect(ajouterAuPanier(p, s, "BOITE", cle)).toBe(p);
  });

  it("additionne boîtes et unités pour le plafond", () => {
    const s = fiche("a", { quantite: 25, quantiteVendable: 25 });
    let p = ajouterAuPanier(PANIER_VIDE, s, "BOITE", cle);
    for (let i = 0; i < 5; i++) p = ajouterAuPanier(p, s, "UNITE", cle);
    expect(p.lignes.map((l) => [l.unite, l.nombre])).toEqual([["BOITE", 1], ["UNITE", 5]]);
    expect(ajouterAuPanier(p, s, "UNITE", cle)).toBe(p);
    expect(ajouterAuPanier(p, s, "BOITE", cle)).toBe(p);
  });

  it("autorise toute la quantité d'un périmé seul (la sortie manuelle suit)", () => {
    const s = stock("a", { quantite: 2, quantiteVendable: 0 });
    expect(ajouterAuPanier(PANIER_VIDE, s, "BOITE", cle).lignes).toHaveLength(1);
  });

  it("remet l'ordonnance à non vue pour un nouveau médicament à ordonnance", () => {
    const p = panier({ lignes: [{ stockId: "a", unite: "BOITE", nombre: 1 }], cleIdempotence: "k", ordonnanceVue: true });
    expect(ajouterAuPanier(p, stock("b", {}, "B", true), "BOITE", cle).ordonnanceVue).toBe(false);
    expect(ajouterAuPanier(p, stock("c", {}, "C", false), "BOITE", cle).ordonnanceVue).toBe(true);
  });

  it("n'ajoute pas une fiche en rupture, même avec une part à régulariser (D713)", () => {
    expect(ajouterAuPanier(PANIER_VIDE, stock("a", { quantite: -1 }), "BOITE", cle)).toBe(PANIER_VIDE);
    expect(
      ajouterAuPanier(PANIER_VIDE, stock("a", { quantite: 0, quantiteARegulariser: 1 }), "BOITE", cle),
    ).toBe(PANIER_VIDE);
  });

  it("refuse une fiche sans prix de boîte en boîte", () => {
    expect(ajouterAuPanier(PANIER_VIDE, stock("a", { prixUnitaire: undefined }), "BOITE", cle)).toBe(PANIER_VIDE);
  });

  it("garde une ligne par unité pour une même fiche", () => {
    const s = fiche("a", { quantite: 100, quantiteVendable: 100 });
    const p = ajouterAuPanier(ajouterAuPanier(PANIER_VIDE, s, "BOITE", cle), s, "UNITE", cle);
    expect(p.lignes.map((l) => l.unite)).toEqual(["BOITE", "UNITE"]);
  });
});

describe("changerNombre", () => {
  const p = panier({ lignes: [{ stockId: "a", unite: "BOITE", nombre: 2 }], cleIdempotence: "k" });

  const grand = stock("a", { quantite: 100000, quantiteVendable: 100000 });
  const petit = stock("a", { quantite: 3, quantiteVendable: 3 });

  it("reste entre 1 et 10000 quand le stock suffit", () => {
    expect(changerNombre(p, "a:BOITE", -5, grand).lignes[0].nombre).toBe(1);
    expect(changerNombre(p, "a:BOITE", 50, grand).lignes[0].nombre).toBe(52);
    expect(changerNombre(changerNombre(p, "a:BOITE", 20000, grand), "a:BOITE", 1, grand).lignes[0].nombre).toBe(
      QUANTITE_MAX_LIGNE,
    );
  });

  it("le « + » s'arrête au plafond du stock", () => {
    expect(peutAugmenter(p, "a:BOITE", petit)).toBe(true);
    const trois = changerNombre(p, "a:BOITE", 1, petit);
    expect(trois.lignes[0].nombre).toBe(3);
    expect(peutAugmenter(trois, "a:BOITE", petit)).toBe(false);
    expect(changerNombre(trois, "a:BOITE", 1, petit)).toBe(trois);
  });

  it("le « + » additionne boîtes et unités de la fiche", () => {
    const s = fiche("a", { quantite: 25, quantiteVendable: 25 });
    const deux = panier({
      lignes: [
        { stockId: "a", unite: "BOITE", nombre: 1 },
        { stockId: "a", unite: "UNITE", nombre: 5 },
      ],
    });
    expect(peutAugmenter(deux, "a:BOITE", s)).toBe(false);
    expect(peutAugmenter(deux, "a:UNITE", s)).toBe(false);
  });

  it("au-dessus du plafond : « - », l'unité et le retrait restent permis (D722)", () => {
    const dessus = panier({ lignes: [{ stockId: "a", unite: "BOITE", nombre: 5 }], cleIdempotence: "k" });
    expect(peutAugmenter(dessus, "a:BOITE", petit)).toBe(false);
    expect(changerNombre(dessus, "a:BOITE", -1, petit).lignes[0].nombre).toBe(4);
    expect(retirerDuPanier(dessus, "a:BOITE").lignes).toHaveLength(0);
    const f = fiche("a", { quantite: 5, quantiteVendable: 5 });
    const enUnites = panier({ lignes: [{ stockId: "a", unite: "UNITE", nombre: 9 }] });
    expect(changerUnite(enUnites, "a:UNITE", f).lignes[0].unite).toBe("BOITE");
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
