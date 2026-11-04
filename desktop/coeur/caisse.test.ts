import type { Vente } from "@/lib/api_ventes";
import { formaterARegulariser, formaterQuantite } from "@/lib/caisse/regles/quantites";
import { afterEach, describe, expect, it } from "vitest";
import {
  AUTRE_VENDEUR,
  SUPERVISEUR,
  VENDEUR,
  base,
  contientNegatif,
  coeurPret,
  evenements,
  fermerTout,
  fiche,
  outils,
  photo,
  uuid,
} from "./aide_tests";
import { CoeurCaisse, type ReponseAnnulation } from "./coeur";
import { RefusCaisse } from "./refus";
import type { Stockage } from "./stockage";

afterEach(fermerTout);

const cle = (n: number) => uuid(n, "cccccccc");

function refus(travail: () => unknown): RefusCaisse {
  try {
    travail();
  } catch (e) {
    if (e instanceof RefusCaisse) return e;
    throw e;
  }
  throw new Error("Un refus était attendu.");
}

function compte(s: Stockage, table: string): number {
  return s.lireUn<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)?.n ?? -1;
}

describe("vente et caisse ouverte automatiquement (CA19)", () => {
  it("SESSION_OUVERTE en séquence 1, VENTE en séquence 2, dans la même transaction", () => {
    const { s, c } = coeurPret();
    const v = c.enregistrerVente({ lignes: [{ stockId: "s1", quantite: 2 }] }, cle(1), VENDEUR);

    expect(evenements(s).map((e) => [e.sequence, e.type, e.statut])).toEqual([
      [1, "SESSION_OUVERTE", "A_ENVOYER"],
      [2, "VENTE", "A_ENVOYER"],
    ]);
    expect(v).toMatchObject({
      id: cle(1),
      numero: "T1-0000001",
      numeroTicket: 1,
      statut: "VALIDEE",
      typePiece: "VENTE",
      total: 10000,
      provisoire: false,
      annulation: null,
      venteOrigine: null,
      jourMetier: "2026-11-04",
      poste: { id: "po1", code: "D1" },
      vendeur: { id: VENDEUR.id, nom: VENDEUR.nom },
      pharmacie: { id: "ph1", nom: "Pharmacie de Kaloum" },
    });
    expect(v.session.ouverteAutomatiquement).toBe(true);
    expect(v.rejeu).toBeUndefined();
    expect(s.lireUn<{ ouverteAutomatiquement: number }>("SELECT ouverteAutomatiquement FROM sessions")?.ouverteAutomatiquement).toBe(1);
    expect(s.lire("SELECT sequence FROM sorties_stock")).toEqual([{ sequence: 2 }]);
    expect(evenements(s)[0].corps).toEqual({ sessionId: v.session.id });
    expect(s.lireUn<{ prochaineSequence: number }>("SELECT prochaineSequence FROM etat_poste")?.prochaineSequence).toBe(3);
    expect(c.sessionOuverte()?.id).toBe(v.session.id);
    expect(c.lireVente(cle(1))).toEqual(v);

    // Une seconde vente réutilise la caisse, sans nouvel événement de session.
    const v2 = c.enregistrerVente({ lignes: [{ stockId: "s1", quantite: 1 }] }, cle(2), VENDEUR);
    expect(v2.session).toEqual({ id: v.session.id, ouverteAutomatiquement: false });
    expect(evenements(s).map((e) => e.type)).toEqual(["SESSION_OUVERTE", "VENTE", "VENTE"]);
  });
});

describe("lots et boîtes entamées (CA5, CA7)", () => {
  it("plaquette de 20 : 6 unités laissent un reliquat de 14, puis 16 unités prennent le reliquat avant le FEFO", () => {
    const f = fiche(1, {
      uniteMinimale: "COMPRIME",
      coefficientBoite: 20,
      deconditionnable: true,
      prixUnitaire: 5000,
      prixUnite: 300,
      quantite: 80,
      lots: [
        { id: "A", numeroLot: "A", dateExpiration: "2027-01-31", dateReception: "2026-10-01T08:00:00.000Z", coefficientReception: 20, solde: 20, lotTechnique: false },
        { id: "B", numeroLot: "B", dateExpiration: "2027-06-30", dateReception: "2026-10-02T08:00:00.000Z", coefficientReception: 20, solde: 60, lotTechnique: false },
      ],
    });
    const { s, c } = coeurPret([f]);

    c.enregistrerVente({ lignes: [{ stockId: "s1", quantite: 6, unite: "UNITE" }] }, cle(1), VENDEUR);
    expect(c.lireStock()[0].reliquat).toEqual([{ lotId: "A", unitesRestantes: 14 }]);
    expect(evenements(s)[1].corps.lignes).toEqual([
      { stockId: "s1", unite: "UNITE", nombre: 6, prixUnitaire: 300, ouvertureConditionnement: true },
    ]);

    const v = c.enregistrerVente({ lignes: [{ stockId: "s1", quantite: 16, unite: "UNITE" }] }, cle(2), VENDEUR);
    expect(v.lignes[0].allocations.map((a) => [a.lotId, a.quantite, a.statut])).toEqual([
      ["A", 14, "DEFINITIVE"],
      ["B", 2, "DEFINITIVE"],
    ]);
    expect(c.lireStock()[0].quantite).toBe(80 - 22);
  });
});

describe("aucun refus de stock (CA24, D713.2)", () => {
  it("stock 0, 2 boîtes : acceptée, provisoire, à régulariser, jamais de valeur négative", () => {
    const { s, c } = coeurPret([fiche(1, { quantite: 0, lots: [] })]);
    const v = c.enregistrerVente({ lignes: [{ stockId: "s1", quantite: 2 }] }, cle(1), VENDEUR);

    expect(v.provisoire).toBe(true);
    expect(v.lignes[0].allocations).toEqual([
      { lotId: null, numeroLot: null, dateExpiration: null, quantite: 2, statut: "PROVISOIRE", sortieManuelle: false, motif: null, lotTechnique: false },
    ]);
    expect(evenements(s)[1].corps.lignes).toEqual([{ stockId: "s1", unite: "BOITE", nombre: 2, prixUnitaire: 5000, quantiteProvisoireLocale: 2 }]);
    const stock = c.lireStock()[0];
    expect(stock).toMatchObject({ quantite: 0, quantiteARegulariser: 2, quantiteVendable: 0, disponible: false });
    expect(contientNegatif(stock)).toBe(false);
    expect(contientNegatif(v)).toBe(false);
  });

  it("couverture partielle : part définitive et part provisoire, sans question", () => {
    const { c } = coeurPret([fiche(1, { quantite: 3, lots: [{ ...fiche(1).lots[0], solde: 3 }] })]);
    const v = c.enregistrerVente({ lignes: [{ stockId: "s1", quantite: 5 }] }, cle(1), VENDEUR);
    expect(v.lignes[0].allocations.map((a) => [a.lotId, a.quantite, a.statut])).toEqual([
      ["l1", 3, "DEFINITIVE"],
      [null, 2, "PROVISOIRE"],
    ]);
    expect(c.lireStock()[0]).toMatchObject({ quantite: 0, quantiteARegulariser: 2 });
  });

  it("fiche PLAQUETTE de coefficient 10 : 1 boîte et 9 plaquettes, puis « 1 plaquette à régulariser »", () => {
    const plaquette = (i: number, solde: number) =>
      fiche(i, {
        uniteMinimale: "PLAQUETTE",
        coefficientBoite: 10,
        deconditionnable: true,
        prixUnitaire: 6000,
        prixUnite: 700,
        quantite: solde,
        lots: solde === 0 ? [] : [{ ...fiche(i).lots[0], solde, coefficientReception: 10 }],
      });
    const { c } = coeurPret([plaquette(1, 20), plaquette(2, 0)]);
    c.enregistrerVente({ lignes: [{ stockId: "s1", quantite: 1, unite: "UNITE" }] }, cle(1), VENDEUR);
    const f1 = c.lireStock()[0];
    expect(f1.quantite).toBe(19);
    expect(formaterQuantite(f1.quantite, f1.coefficientBoite ?? 1, f1.uniteMinimale ?? "UNITE")).toBe("1 boîte et 9 plaquettes");

    c.enregistrerVente({ lignes: [{ stockId: "s2", quantite: 1, unite: "UNITE" }] }, cle(2), VENDEUR);
    const f2 = c.lireStock()[1];
    expect(f2).toMatchObject({ quantite: 0, quantiteARegulariser: 1 });
    expect(formaterARegulariser(f2.quantiteARegulariser, f2.coefficientBoite ?? 1, f2.uniteMinimale ?? "UNITE")).toBe("1 plaquette à régulariser");
  });
});

describe("deux prix (CA1, CA2)", () => {
  it("boîte à 10 000 et unité à 600 : le ticket porte le prix de la boîte ou de l'unité", () => {
    const f = fiche(1, {
      uniteMinimale: "COMPRIME",
      coefficientBoite: 10,
      deconditionnable: true,
      prixUnitaire: 10000,
      prixUnite: 600,
      quantite: 100,
      lots: [{ ...fiche(1).lots[0], solde: 100, coefficientReception: 10 }],
    });
    const { s, c } = coeurPret([f]);
    const v = c.enregistrerVente(
      { lignes: [{ stockId: "s1", quantite: 2 }, { stockId: "s1", quantite: 3, unite: "UNITE" }] },
      cle(1),
      VENDEUR,
    );
    expect(v.total).toBe(21800);
    expect(v.lignes.map((l) => [l.uniteAffichee, l.nombreAffiche, l.quantite, l.prixUnitaire, l.sousTotal, l.coefficientApplique])).toEqual([
      ["BOITE", 2, 20, 1000, 20000, 10],
      ["UNITE", 3, 3, 600, 1800, 1],
    ]);
    const corps = evenements(s)[1].corps;
    expect((corps.lignes as { prixUnitaire: number }[]).map((l) => l.prixUnitaire)).toEqual([10000, 600]);
    expect(corps.total).toBe(21800);
    expect(corps.paiements).toEqual([{ mode: "ESPECES", montant: 21800 }]);
  });

  it("vente à l'unité refusée sur une fiche non déconditionnable, prix manquant refusé, rien d'écrit", () => {
    const { s, c } = coeurPret([fiche(1), fiche(2, { prixUnitaire: null })]);
    expect(refus(() => c.enregistrerVente({ lignes: [{ stockId: "s1", quantite: 1, unite: "UNITE" }] }, cle(1), VENDEUR))).toMatchObject({
      status: 400,
      code: "VENTE_UNITE_INTERDITE",
      message: "Ce médicament se vend uniquement à la boîte : « Produit 00001 ». Passez-le en vente à la boîte.",
    });
    expect(refus(() => c.enregistrerVente({ lignes: [{ stockId: "s2", quantite: 1 }] }, cle(2), VENDEUR)).code).toBe("PRIX_MANQUANT");
    expect(refus(() => c.enregistrerVente({ lignes: [{ stockId: "inconnue", quantite: 1 }] }, cle(3), VENDEUR))).toMatchObject({ status: 404, code: "STOCK_INTROUVABLE" });
    expect(refus(() => c.enregistrerVente({ lignes: [] }, cle(4), VENDEUR)).code).toBe("VALIDATION");
    expect(refus(() => c.enregistrerVente({ lignes: [{ stockId: "s1", quantite: 10001 }] }, cle(5), VENDEUR)).code).toBe("VALIDATION");
    for (const table of ["ventes", "sessions", "evenements", "sorties_stock", "paiements_locaux"]) expect(compte(s, table)).toBe(0);
  });
});

describe("numéros (CA23, D424)", () => {
  it("3 numéros consécutifs, passage à la plage suivante, puis numéros de secours sans blocage", () => {
    const { s, c } = coeurPret([fiche(1, { quantite: 1000, lots: [{ ...fiche(1).lots[0], solde: 1000 }] })], {
      plages: [{ id: "p1", debut: 1, fin: 3 }, { id: "p2", debut: 4, fin: 5 }],
    });
    const numeros: string[] = [];
    for (let i = 1; i <= 7; i++) {
      numeros.push(c.enregistrerVente({ lignes: [{ stockId: "s1", quantite: 1 }] }, cle(i), VENDEUR).numero);
      if (i === 5) expect(c.etatLocal()).toMatchObject({ plageEpuisee: true, plageRestante: 0 });
    }
    expect(numeros).toEqual(["T1-0000001", "T1-0000002", "T1-0000003", "T1-0000004", "T1-0000005", "S1-D1-1", "S1-D1-2"]);
    const ventes = evenements(s).filter((e) => e.type === "VENTE");
    expect(ventes.map((e) => e.corps.numeroTicket ?? null)).toEqual([1, 2, 3, 4, 5, null, null]);
    expect(ventes.slice(5).map((e) => e.corps.numeroSecours)).toEqual([1, 2]);
    expect(ventes[5].corps).not.toHaveProperty("numeroTicket");
    expect(c.lireVente(cle(6))?.numeroTicket).toBeNull();
  });

  it("deux postes, deux bases, plages différentes : aucun numéro en double (CA23)", () => {
    const fiches = [fiche(1, { quantite: 1000, lots: [{ ...fiche(1).lots[0], solde: 1000 }] })];
    const monter = (id: string, code: string, debut: number, fin: number) => {
      const c = new CoeurCaisse(base(), outils());
      c.rattacher({ structureId: "ph1" });
      c.appliquerPhotographie(photo(fiches, { id, code, plages: [{ id: `p-${code}`, debut, fin }] }), null, null);
      return c;
    };
    const d1 = monter("po1", "D1", 1, 500);
    const d2 = monter("po2", "D2", 501, 1000);
    const numeros = [d1, d2].flatMap((c, k) =>
      [1, 2, 3, 4, 5].map((i) => c.enregistrerVente({ lignes: [{ stockId: "s1", quantite: 1 }] }, cle(k * 10 + i), VENDEUR).numero),
    );
    expect(new Set(numeros).size).toBe(10);
    expect(numeros[0]).toBe("T1-0000001");
    expect(numeros[5]).toBe("T1-0000501");
  });
});

describe("périmé seul (D737, CA13)", () => {
  const perime = fiche(1, {
    quantite: 10,
    lots: [{ ...fiche(1).lots[0], dateExpiration: "2026-10-01", solde: 10 }],
  });

  it("choix demandé, rien d'écrit ; accepté avec un lot et un motif", () => {
    const { s, c } = coeurPret([perime]);
    const r = refus(() => c.enregistrerVente({ lignes: [{ stockId: "s1", quantite: 2 }] }, cle(1), VENDEUR));
    expect(r).toMatchObject({ status: 409, code: "SORTIE_MANUELLE_REQUISE" });
    expect(r.details).toMatchObject([
      { stockId: "s1", nom: "Produit 00001", lots: [{ lotId: "l1", numeroLot: "N1", dateExpiration: "2026-10-01", quantite: 10 }] },
    ]);
    expect(compte(s, "evenements") + compte(s, "ventes") + compte(s, "sessions")).toBe(0);

    expect(
      refus(() => c.enregistrerVente({ lignes: [{ stockId: "s1", quantite: 2, sortieManuelle: { lotId: "l1", motif: "ab" } }] }, cle(1), VENDEUR)).code,
    ).toBe("MOTIF_REQUIS");
    expect(
      refus(() => c.enregistrerVente({ lignes: [{ stockId: "s1", quantite: 2, sortieManuelle: { lotId: "inconnu", motif: "Accord du titulaire" } }] }, cle(1), VENDEUR)),
    ).toMatchObject({ status: 404, message: "Ce lot est introuvable pour ce médicament." });

    const v = c.enregistrerVente(
      { lignes: [{ stockId: "s1", quantite: 2, sortieManuelle: { lotId: "l1", motif: "Accord du titulaire" } }] },
      cle(1),
      VENDEUR,
    );
    expect(v.lignes[0].allocations).toMatchObject([{ lotId: "l1", quantite: 2, statut: "DEFINITIVE", sortieManuelle: true, motif: "Accord du titulaire" }]);
    expect((evenements(s)[1].corps.lignes as unknown[])[0]).toMatchObject({ sortieManuelle: { lotId: "l1", motif: "Accord du titulaire" } });
  });
});

describe("ordonnance et paiements (CA16)", () => {
  it("ordonnance non confirmée refusée, confirmée acceptée", () => {
    const { c } = coeurPret([fiche(1, { ordonnanceRequise: true })]);
    expect(refus(() => c.enregistrerVente({ lignes: [{ stockId: "s1", quantite: 1 }] }, cle(1), VENDEUR))).toMatchObject({ status: 400, code: "ORDONNANCE_NON_CONFIRMEE" });
    expect(c.enregistrerVente({ lignes: [{ stockId: "s1", quantite: 1 }], ordonnanceVerifiee: true }, cle(1), VENDEUR).ordonnanceVerifiee).toBe(true);
  });

  it("moitié espèces moitié Orange Money, référence et rendu", () => {
    const { s, c } = coeurPret([fiche(1, { prixUnitaire: 10000 })]);
    const v = c.enregistrerVente(
      {
        lignes: [{ stockId: "s1", quantite: 2 }],
        paiements: [
          { mode: "ESPECES", montant: 10000, montantRecu: 15000 },
          { mode: "ORANGE_MONEY", montant: 10000, reference: "OM-123" },
        ],
        clientNom: "  Aminata Diallo  ",
      },
      cle(1),
      VENDEUR,
    );
    expect(v.clientNom).toBe("Aminata Diallo");
    expect(v.paiements).toMatchObject([
      { mode: "ESPECES", libelle: "Espèces", montant: 10000, montantRecu: 15000, rendu: 5000, reference: null },
      { mode: "ORANGE_MONEY", libelle: "Orange Money", montant: 10000, reference: "OM-123", montantRecu: null, rendu: null },
    ]);
    const corps = evenements(s)[1].corps;
    expect(corps.paiements).toEqual([
      { mode: "ESPECES", montant: 10000, montantRecu: 15000 },
      { mode: "ORANGE_MONEY", montant: 10000, reference: "OM-123" },
    ]);
    expect(corps.clientNom).toBe("Aminata Diallo");
    expect(corps).not.toHaveProperty("clientTelephone");
  });

  it("paiements incohérents ou mode inconnu refusés, avec les messages du serveur", () => {
    const { c } = coeurPret([fiche(1)]);
    expect(
      refus(() => c.enregistrerVente({ lignes: [{ stockId: "s1", quantite: 1 }], paiements: [{ mode: "ESPECES", montant: 4000 }] }, cle(1), VENDEUR)),
    ).toMatchObject({
      code: "PAIEMENTS_INCOHERENTS",
      message: "Le total des paiements (4000 GNF) ne correspond pas au montant de la vente (5000 GNF). Corrigez les montants puis validez de nouveau.",
    });
    expect(
      refus(() => c.enregistrerVente({ lignes: [{ stockId: "s1", quantite: 1 }], paiements: [{ mode: "WAVE", montant: 5000 }] }, cle(2), VENDEUR)),
    ).toMatchObject({ code: "MODE_PAIEMENT_INCONNU", message: "Le mode de paiement WAVE n'existe pas ou n'est plus accepté." });
  });
});

describe("rejeu", () => {
  it("même clé : rejeu: true, un seul événement de vente, stock décompté une fois", () => {
    const { s, c } = coeurPret();
    const premiere = c.enregistrerVente({ lignes: [{ stockId: "s1", quantite: 2 }] }, cle(1), VENDEUR);
    const seconde = c.enregistrerVente({ lignes: [{ stockId: "s1", quantite: 2 }] }, cle(1), VENDEUR);
    expect(seconde).toEqual({ ...premiere, rejeu: true });
    expect(evenements(s).filter((e) => e.type === "VENTE")).toHaveLength(1);
    expect(compte(s, "ventes")).toBe(1);
    expect(c.lireStock()[0].quantite).toBe(38);
  });
});

describe("caisse (CA15, CA18)", () => {
  const coupures = (nombre20000: number, nombre10000 = 0) => [
    { valeurFaciale: 20000, nombre: nombre20000 },
    { valeurFaciale: 10000, nombre: nombre10000 },
  ];

  it("200 000 de fond + 400 000 de ventes - 100 000 de prélèvement, compté 490 000 : écart de -10 000", () => {
    const { s, c } = coeurPret([fiche(1, { prixUnitaire: 100000 })]);
    const ouverte = c.ouvrirSession({ id: uuid(1), comptage: { coupures: coupures(10) } }, VENDEUR);
    expect(ouverte).toMatchObject({ id: uuid(1), statut: "OUVERTE", fondCaisse: 200000, fondCompte: true, cree: true, ouverteMaintenant: true, jourMetier: "2026-11-04" });
    expect(evenements(s).map((e) => e.type)).toEqual(["SESSION_OUVERTE", "COMPTAGE_SAISI"]);
    expect(evenements(s)[1].corps).toMatchObject({ sessionId: uuid(1), moment: "OUVERTURE", coupures: coupures(10) });

    // Rejeu : même caisse, pas de nouvel événement.
    expect(c.ouvrirSession({ id: uuid(1) }, VENDEUR)).toMatchObject({ id: uuid(1), cree: false, ouverteMaintenant: false });
    expect(c.ouvrirSession({ id: uuid(9) }, VENDEUR)).toMatchObject({ id: uuid(1), ouverteMaintenant: false });
    expect(compte(s, "evenements")).toBe(2);

    const v = c.enregistrerVente({ lignes: [{ stockId: "s1", quantite: 4 }] }, cle(1), VENDEUR);
    expect(v.session).toEqual({ id: uuid(1), ouverteAutomatiquement: false });
    const m = c.enregistrerMouvement(uuid(1), { id: uuid(2), type: "PRELEVEMENT", montant: 100000, motif: "Dépôt à la banque" }, VENDEUR);
    expect(m).toMatchObject({ id: uuid(2), type: "PRELEVEMENT", mode: "ESPECES", montant: 100000, motif: "Dépôt à la banque", auteurId: VENDEUR.id });
    expect(c.enregistrerMouvement(uuid(1), { id: uuid(2), type: "PRELEVEMENT", montant: 100000, motif: "Dépôt à la banque" }, VENDEUR)).toEqual(m);
    expect(evenements(s).filter((e) => e.type === "MOUVEMENT_CAISSE")).toHaveLength(1);

    const avant = c.bilan(uuid(1), VENDEUR);
    expect(avant.activite).toMatchObject({ nombreVentes: 1, nombreAnnulations: 0, montantEncaisse: 400000 });
    expect(avant.theorique.find((t) => t.mode === "ESPECES")?.montant).toBe(500000);
    expect(avant).toMatchObject({ ecartEspeces: null, fige: false, fond: { montant: 200000, compte: true } });
    expect(avant.theorique.map((t) => t.mode)).toEqual(["ESPECES", "ORANGE_MONEY", "MTN_MOMO"]);

    // CA18 : fermeture sans comptage refusée.
    expect(refus(() => c.fermerSession(uuid(1), {}, VENDEUR))).toMatchObject({
      code: "COMPTAGE_FERMETURE_REQUIS",
      message: "Comptez les billets du tiroir avant de fermer la caisse.",
    });
    // Écart au-delà du seuil sans commentaire : refusée, rien d'écrit.
    const comptage = { id: uuid(3), coupures: coupures(24, 1) };
    const sansCommentaire = refus(() => c.fermerSession(uuid(1), { comptageFermeture: comptage }, VENDEUR));
    expect(sansCommentaire).toMatchObject({ status: 400, code: "COMMENTAIRE_ECART_REQUIS" });
    expect(sansCommentaire.message).toContain("-10 000 GNF");
    expect(c.sessionOuverte()?.id).toBe(uuid(1));
    expect(c.sessionOuverte()?.comptageFermeture).toBeNull();
    expect(evenements(s).some((e) => e.type === "SESSION_FERMEE")).toBe(false);

    const figee = c.fermerSession(uuid(1), { comptageFermeture: comptage, commentaire: "Erreur de rendu de monnaie" }, VENDEUR);
    expect(figee).toMatchObject({ fige: true, ecartEspeces: -10000, commentaireRequis: true });
    expect(figee.session).toMatchObject({ statut: "FERMEE", commentaireEcart: "Erreur de rendu de monnaie" });
    expect(figee.ecarts.find((e) => e.mode === "ESPECES")?.ecart).toBe(-10000);
    expect(figee.compte.find((e) => e.mode === "ESPECES")?.montant).toBe(490000);
    expect(figee.compte.find((e) => e.mode === "ORANGE_MONEY")?.montant).toBeNull();
    const fermeture = evenements(s).at(-1);
    expect(fermeture).toMatchObject({ type: "SESSION_FERMEE", corps: { sessionId: uuid(1), comptageFermeture: { comptageId: uuid(3), coupures: coupures(24, 1) }, commentaire: "Erreur de rendu de monnaie" } });

    // Caisse fermée : bilan figé rejoué, fermeture rejouée sans nouvel événement.
    expect(c.bilan(uuid(1), VENDEUR)).toEqual(figee);
    const nombre = compte(s, "evenements");
    expect(c.fermerSession(uuid(1), { comptageFermeture: comptage }, VENDEUR)).toEqual(figee);
    expect(compte(s, "evenements")).toBe(nombre);
    expect(c.sessionOuverte()).toBeNull();
    expect(refus(() => c.enregistrerMouvement(uuid(1), { id: uuid(4), type: "APPORT", montant: 1000, motif: "Monnaie" }, VENDEUR)).code).toBe("SESSION_FERMEE");

    // Une vente suivante ouvre une autre caisse.
    const suivante = c.enregistrerVente({ lignes: [{ stockId: "s1", quantite: 1 }] }, cle(2), VENDEUR);
    expect(suivante.session.id).not.toBe(uuid(1));
    expect(suivante.session.ouverteAutomatiquement).toBe(true);
  });

  it("comptages : coupures du référentiel, doublons, bornes, ouverture sans relevé, comptage déjà saisi", () => {
    const { c } = coeurPret();
    c.ouvrirSession({ id: uuid(1) }, VENDEUR);
    const saisir = (entree: Parameters<typeof c.saisirComptage>[1]) => refus(() => c.saisirComptage(uuid(1), entree, VENDEUR));
    expect(saisir({ id: uuid(2), moment: "OUVERTURE", coupures: [{ valeurFaciale: 3000, nombre: 1 }] })).toMatchObject({ code: "VALIDATION", message: "La coupure de 3 000 GNF n'existe pas : comptez uniquement les billets proposés." });
    expect(saisir({ id: uuid(2), moment: "OUVERTURE", coupures: [{ valeurFaciale: 20000, nombre: 1 }, { valeurFaciale: 20000, nombre: 2 }] }).code).toBe("VALIDATION");
    expect(saisir({ id: uuid(2), moment: "OUVERTURE", coupures: [{ valeurFaciale: 20000, nombre: 10001 }] }).code).toBe("VALIDATION");
    expect(saisir({ id: uuid(2), moment: "OUVERTURE", coupures: [], releves: [{ mode: "ORANGE_MONEY", montant: 1 }] }).code).toBe("VALIDATION");
    expect(saisir({ id: uuid(2), moment: "FERMETURE", coupures: [], releves: [{ mode: "ESPECES", montant: 1 }] }).message).toBe("Les espèces se comptent billet par billet, pas par relevé.");
    expect(saisir({ id: uuid(2), moment: "FERMETURE", coupures: [], releves: [{ mode: "WAVE", montant: 1 }] }).code).toBe("MODE_PAIEMENT_INCONNU");

    const bon = c.saisirComptage(uuid(1), { id: uuid(2), moment: "OUVERTURE", coupures: [{ valeurFaciale: 5000, nombre: 3 }] }, VENDEUR);
    expect(bon).toMatchObject({ id: uuid(2), moment: "OUVERTURE", totalEspeces: 15000, auteurId: VENDEUR.id });
    expect(c.saisirComptage(uuid(1), { id: uuid(2), moment: "OUVERTURE", coupures: [{ valeurFaciale: 5000, nombre: 3 }] }, VENDEUR)).toEqual(bon);
    expect(saisir({ id: uuid(5), moment: "OUVERTURE", coupures: [] })).toMatchObject({ status: 409, code: "COMPTAGE_DEJA_SAISI", message: "Le comptage d'ouverture de cette caisse est déjà enregistré." });

    const releve = c.saisirComptage(uuid(1), { id: uuid(6), moment: "FERMETURE", coupures: [], releves: [{ mode: "ORANGE_MONEY", montant: 5000 }] }, VENDEUR);
    expect(releve.releves).toEqual([{ mode: "ORANGE_MONEY", libelle: "Orange Money", montant: 5000 }]);
  });

  it("mouvements : motif, montant, mode par défaut, mode inconnu", () => {
    const { c } = coeurPret();
    c.ouvrirSession({ id: uuid(1) }, VENDEUR);
    const mouvement = (e: Partial<Parameters<typeof c.enregistrerMouvement>[1]>) =>
      refus(() => c.enregistrerMouvement(uuid(1), { id: uuid(2), type: "APPORT", montant: 1000, motif: "Monnaie", ...e }, VENDEUR));
    expect(mouvement({ motif: " a " })).toMatchObject({ status: 400, code: "MOTIF_REQUIS", message: "Indiquez le motif de ce mouvement de caisse (3 caractères au moins)." });
    expect(mouvement({ montant: 0 }).code).toBe("VALIDATION");
    expect(mouvement({ montant: 100_000_001 }).code).toBe("VALIDATION");
    expect(mouvement({ mode: "WAVE" }).code).toBe("MODE_PAIEMENT_INCONNU");
    expect(c.enregistrerMouvement(uuid(1), { id: uuid(3), type: "REMBOURSEMENT", montant: 2000, motif: "Retour", mode: "ORANGE_MONEY" }, VENDEUR).mode).toBe("ORANGE_MONEY");
  });
});

describe("accès à la caisse d'un autre vendeur (D741)", () => {
  it("409 pour un autre vendeur qui vend ou ouvre, 403 pour son bilan, superviseur permis", () => {
    const { c } = coeurPret();
    c.ouvrirSession({ id: uuid(1) }, VENDEUR);

    expect(refus(() => c.enregistrerVente({ lignes: [{ stockId: "s1", quantite: 1 }] }, cle(1), AUTRE_VENDEUR))).toMatchObject({
      status: 409,
      code: "SESSION_AUTRE_UTILISATEUR",
      message: "La caisse de ce poste est ouverte par Mariama Diallo. Elle doit être fermée avant que vous puissiez encaisser ici.",
    });
    expect(refus(() => c.ouvrirSession({ id: uuid(7) }, AUTRE_VENDEUR)).code).toBe("SESSION_AUTRE_UTILISATEUR");
    expect(refus(() => c.bilan(uuid(1), AUTRE_VENDEUR))).toMatchObject({
      status: 403,
      message: "Cette caisse appartient à un autre vendeur : seul un responsable peut la consulter ou la modifier.",
    });
    expect(refus(() => c.enregistrerMouvement(uuid(1), { id: uuid(2), type: "APPORT", montant: 1000, motif: "Monnaie" }, AUTRE_VENDEUR)).status).toBe(403);
    expect(refus(() => c.bilan(uuid(99), VENDEUR)).status).toBe(404);

    expect(c.bilan(uuid(1), SUPERVISEUR).session.id).toBe(uuid(1));
    expect(c.enregistrerMouvement(uuid(1), { id: uuid(2), type: "APPORT", montant: 1000, motif: "Monnaie" }, SUPERVISEUR).auteurId).toBe(SUPERVISEUR.id);
    const fermee = c.fermerSession(uuid(1), { comptageFermeture: { id: uuid(3), coupures: [{ valeurFaciale: 1000, nombre: 1 }] } }, SUPERVISEUR);
    expect(fermee.session.statut).toBe("FERMEE");
  });
});

describe("atomicité : une coupure à la dernière écriture n'écrit rien", () => {
  it("aucune ligne, séquence, numéro de plage et numéro de secours intacts", () => {
    const reel = base();
    let arme = false;
    const fragile: Stockage = {
      executer(sql, params) {
        if (arme && /UPDATE etat_poste SET prochaineSequence/.test(sql)) throw new Error("coupure de courant");
        reel.executer(sql, params);
      },
      lire: (sql, params) => reel.lire(sql, params),
      lireUn: (sql, params) => reel.lireUn(sql, params),
      transaction: (travail) => reel.transaction(travail),
      fermer: () => reel.fermer(),
    };
    const { c } = coeurPret([fiche(1)], { plages: [{ id: "p1", debut: 1, fin: 500 }] }, fragile);
    arme = true;
    expect(() => c.enregistrerVente({ lignes: [{ stockId: "s1", quantite: 2 }] }, cle(1), VENDEUR)).toThrow("coupure de courant");

    for (const table of ["ventes", "sessions", "evenements", "sorties_stock", "paiements_locaux"]) expect(compte(reel, table)).toBe(0);
    expect(reel.lireUn("SELECT prochaineSequence, prochainSecours FROM etat_poste")).toEqual({ prochaineSequence: 1, prochainSecours: 1 });
    expect(reel.lireUn<{ dernierUtilise: number | null }>("SELECT dernierUtilise FROM plages")?.dernierUtilise).toBeNull();
    expect(c.lireStock()[0].quantite).toBe(40);

    // Même coupure sur un numéro de secours : le compteur de secours n'avance pas.
    reel.executer("UPDATE plages SET dernierUtilise = fin");
    expect(() => c.enregistrerVente({ lignes: [{ stockId: "s1", quantite: 1 }] }, cle(2), VENDEUR)).toThrow("coupure de courant");
    expect(reel.lireUn<{ prochainSecours: number }>("SELECT prochainSecours FROM etat_poste")?.prochainSecours).toBe(1);

    arme = false;
    expect(c.enregistrerVente({ lignes: [{ stockId: "s1", quantite: 1 }] }, cle(2), VENDEUR).numero).toBe("S1-D1-1");
    expect(evenements(reel).map((e) => e.sequence)).toEqual([1, 2]);
  });
});

describe("annulation faite en ligne (D745)", () => {
  const SW = uuid(50, "dddddddd"); // caisse web où la vente d'origine a été faite
  const SD = uuid(51, "dddddddd"); // caisse du poste, où le serveur enregistre le remboursement
  const AN = uuid(60, "dddddddd");

  /** Réponse du serveur à l'annulation d'une vente, faite depuis le poste po1 : `session` est celle de l'origine, `annulation` désigne la caisse de l'auteur. */
  function reponseServeur(v: Vente, caisseAuteur: string, options: { posteId?: string; le?: string; id?: string; jourMetier?: string } = {}): ReponseAnnulation {
    return {
      ...v,
      statut: "ANNULEE",
      annulation: {
        id: options.id ?? AN,
        numero: `A-${v.numero}`,
        motif: "Erreur de saisie",
        le: options.le ?? "2026-11-04T11:00:00.000Z",
        par: { id: VENDEUR.id, nom: VENDEUR.nom },
        posteId: options.posteId ?? "po1",
        sessionCaisseId: caisseAuteur,
        jourMetier: options.jourMetier ?? (options.le ?? "2026-11-04T11:00:00.000Z").slice(0, 10),
      },
    };
  }

  /** Vente de 50 000 faite sur la caisse web SW, inconnue du poste. */
  function venteWeb(): Vente {
    const { c } = coeurPret([fiche(1, { prixUnitaire: 50000 })]);
    const v = c.enregistrerVente({ lignes: [{ stockId: "s1", quantite: 1 }] }, cle(70), VENDEUR);
    return { ...v, id: cle(71), numero: "T9-0000042", poste: { id: "web", code: "W1" }, session: { id: SW, ouverteAutomatiquement: false } };
  }

  it("caisse ouverte du poste : le remboursement y est imputé, pas dans la caisse d'origine", () => {
    const { s, c } = coeurPret([fiche(1, { prixUnitaire: 20000 })]);
    const locale = c.enregistrerVente({ lignes: [{ stockId: "s1", quantite: 1 }] }, cle(1), VENDEUR);
    expect(locale.session.id).not.toBe(SW);
    const nombre = compte(s, "evenements");

    // Vente web de 50 000 sur SW, annulée depuis le poste : le serveur rembourse dans la caisse du poste.
    const reponse = reponseServeur(venteWeb(), locale.session.id);
    c.enregistrerAnnulationServeur(reponse);
    c.enregistrerAnnulationServeur(reponse); // rejeu

    const b = c.bilan(locale.session.id, VENDEUR);
    expect(b.theorique[0].montant).toBe(20000 - 50000);
    expect(b.activite).toMatchObject({ nombreVentes: 1, nombreAnnulations: 1, montantEncaisse: -30000 });
    expect(compte(s, "evenements")).toBe(nombre);
    expect(compte(s, "sessions")).toBe(1);
    expect(s.lire("SELECT venteId FROM paiements_locaux WHERE sessionId = ?", [SW])).toEqual([]);
  });

  it("vente locale annulée : marquée annulée, théorique rétabli, deux pièces le même jour", () => {
    const { s, c } = coeurPret();
    const v = c.enregistrerVente({ lignes: [{ stockId: "s1", quantite: 2 }] }, cle(1), VENDEUR);
    const sessionId = v.session.id;
    expect(c.bilan(sessionId, VENDEUR).theorique[0].montant).toBe(10000);
    const nombre = compte(s, "evenements");

    c.enregistrerAnnulationServeur(reponseServeur(v, sessionId));

    expect(c.bilan(sessionId, VENDEUR).theorique[0].montant).toBe(0);
    expect(c.lireVente(cle(1))).toMatchObject({ statut: "ANNULEE", annulation: { numero: "A-T1-0000001" } });
    expect(compte(s, "evenements")).toBe(nombre);
    const liste = c.listerVentes("2026-11-04");
    expect(liste).toMatchObject({ nombre: 2, totalJour: 0 });
    expect(liste.ventes.map((x) => [x.typePiece, x.total, x.statut, x.venteOrigine?.numero ?? null])).toEqual([
      ["ANNULATION", -10000, "VALIDEE", "T1-0000001"],
      ["VENTE", 10000, "ANNULEE", null],
    ]);
  });

  it("aucune caisse ouverte sur le poste : celle du serveur est adoptée, sans événement", () => {
    const { s, c } = coeurPret([fiche(1, { prixUnitaire: 50000 })]);
    const premiere = c.enregistrerVente({ lignes: [{ stockId: "s1", quantite: 1 }] }, cle(1), VENDEUR);
    c.fermerSession(premiere.session.id, { comptageFermeture: { id: uuid(3), coupures: [{ valeurFaciale: 20000, nombre: 2 }, { valeurFaciale: 10000, nombre: 1 }] } }, VENDEUR);
    const nombre = compte(s, "evenements");

    c.enregistrerAnnulationServeur(reponseServeur(venteWeb(), SD));
    expect(s.lireUn("SELECT id, statut, adoptee, jourMetier, utilisateurId FROM sessions WHERE id = ?", [SD])).toEqual({
      id: SD,
      statut: "OUVERTE",
      adoptee: 1,
      jourMetier: "2026-11-04",
      utilisateurId: VENDEUR.id,
    });
    expect(c.sessionOuverte()?.id).toBe(SD);
    expect(c.bilan(SD, VENDEUR).theorique[0].montant).toBe(-50000);
    expect(compte(s, "evenements")).toBe(nombre);
    // Une vente suivante utilise la caisse adoptée : aucune session inconnue du serveur n'est créée.
    expect(c.enregistrerVente({ lignes: [{ stockId: "s1", quantite: 1 }] }, cle(2), VENDEUR).session).toEqual({ id: SD, ouverteAutomatiquement: false });
  });

  it("caisse adoptée : son jour vient du serveur, pas de la date de l'annulation (D753)", () => {
    for (const [nom, jourMetier] of [["rattachée au lendemain d'une clôture", "2026-11-05"], ["ouverte un jour passé", "2026-11-03"]]) {
      const { c } = coeurPret([fiche(1, { prixUnitaire: 50000 })]);
      c.enregistrerAnnulationServeur(reponseServeur(venteWeb(), SD, { jourMetier }));
      expect(c.sessionOuverte()?.jourMetier, nom).toBe(jourMetier);
      expect(c.listerVentes(jourMetier).ventes[0], nom).toMatchObject({ typePiece: "ANNULATION", jourMetier });
      expect(c.listerVentes("2026-11-04").nombre, nom).toBe(0);
      const suivante = c.enregistrerVente({ lignes: [{ stockId: "s1", quantite: 1 }] }, cle(2), VENDEUR);
      expect(suivante.jourMetier, nom).toBe(jourMetier);
    }
  });

  it("réponse sans jour de caisse : refusée à l'adoption, rien d'écrit", () => {
    const { s, c } = coeurPret();
    const reponse = reponseServeur(venteWeb(), SD);
    const avant = compte(s, "sessions");
    expect(() =>
      c.enregistrerAnnulationServeur({ ...reponse, annulation: { ...reponse.annulation, jourMetier: undefined as unknown as string } }),
    ).toThrow(RangeError);
    expect(compte(s, "sessions")).toBe(avant);
  });

  it("une autre caisse est ouverte sur le poste : rien n'est adopté ni écrit, erreur claire", () => {
    const { s, c } = coeurPret();
    const locale = c.enregistrerVente({ lignes: [{ stockId: "s1", quantite: 1 }] }, cle(1), VENDEUR);
    const avant = [compte(s, "sessions"), compte(s, "ventes"), compte(s, "paiements_locaux"), compte(s, "evenements")];

    const r = refus(() => c.enregistrerAnnulationServeur(reponseServeur(venteWeb(), SD)));
    expect(r).toMatchObject({ status: 409, code: "ANNULATION_AUTRE_CAISSE" });
    expect(r.message).toContain("Rien n'a été modifié ici");
    expect([compte(s, "sessions"), compte(s, "ventes"), compte(s, "paiements_locaux"), compte(s, "evenements")]).toEqual(avant);
    expect(c.sessionOuverte()?.id).toBe(locale.session.id);
    expect(c.bilan(locale.session.id, VENDEUR).theorique[0].montant).toBe(5000);
  });

  it("annulation enregistrée pour un autre poste : rien n'est imputé ni adopté", () => {
    const { s, c } = coeurPret();
    const avant = [compte(s, "sessions"), compte(s, "ventes"), compte(s, "paiements_locaux")];
    const r = refus(() => c.enregistrerAnnulationServeur(reponseServeur(venteWeb(), SD, { posteId: "po2" })));
    expect(r).toMatchObject({ status: 409, code: "ANNULATION_AUTRE_POSTE" });
    expect([compte(s, "sessions"), compte(s, "ventes"), compte(s, "paiements_locaux")]).toEqual(avant);
  });

  it("vente de 10 000 le jour J annulée le jour J+1 : J = 10 000, J+1 = -10 000, comme le web", () => {
    const s = base();
    const jourJ = new CoeurCaisse(s, outils("2026-11-04T10:00:00.000Z"));
    jourJ.rattacher({ structureId: "ph1" });
    jourJ.appliquerPhotographie(photo([fiche(1, { prixUnitaire: 10000 })], { plages: [{ id: "p1", debut: 1, fin: 500 }] }), null, null);
    const v = jourJ.enregistrerVente({ lignes: [{ stockId: "s1", quantite: 1 }] }, cle(1), VENDEUR);
    jourJ.fermerSession(v.session.id, { comptageFermeture: { id: uuid(3), coupures: [{ valeurFaciale: 10000, nombre: 1 }] } }, VENDEUR);

    // Le lendemain, la caisse que le serveur ouvre pour l'annulation est adoptée au jour de l'annulation.
    const jourJ1 = new CoeurCaisse(s, outils("2026-11-05T09:00:00.000Z"));
    jourJ1.enregistrerAnnulationServeur(reponseServeur(v, SD, { le: "2026-11-05T09:00:00.000Z" }));

    expect(jourJ1.listerVentes("2026-11-04")).toMatchObject({ nombre: 1, totalJour: 10000 });
    const lendemain = jourJ1.listerVentes("2026-11-05");
    expect(lendemain).toMatchObject({ nombre: 1, totalJour: -10000 });
    expect(lendemain.ventes[0]).toMatchObject({ typePiece: "ANNULATION", total: -10000, jourMetier: "2026-11-05", numero: "A-T1-0000001" });
    expect(jourJ1.lireVente(cle(1))).toMatchObject({ statut: "ANNULEE", jourMetier: "2026-11-04" });
  });
});

describe("identifiants : UUID exigés à l'entrée", () => {
  it("clé de vente, caisse, comptage et mouvement non UUID : VALIDATION, rien d'écrit", () => {
    const { s, c } = coeurPret();
    const invalide = (travail: () => unknown) => expect(refus(travail)).toMatchObject({ status: 400, code: "VALIDATION" });
    invalide(() => c.enregistrerVente({ lignes: [{ stockId: "s1", quantite: 1 }] }, "annulation:abc", VENDEUR));
    invalide(() => c.enregistrerVente({ lignes: [{ stockId: "s1", quantite: 1 }] }, "v1", VENDEUR));
    invalide(() => c.ouvrirSession({ id: "session-1" }, VENDEUR));
    for (const table of ["ventes", "sessions", "evenements"]) expect(compte(s, table)).toBe(0);

    c.ouvrirSession({ id: uuid(1) }, VENDEUR);
    invalide(() => c.saisirComptage(uuid(1), { id: "c1", moment: "OUVERTURE", coupures: [] }, VENDEUR));
    invalide(() => c.enregistrerMouvement(uuid(1), { id: "m1", type: "APPORT", montant: 1000, motif: "Monnaie" }, VENDEUR));
    invalide(() => c.fermerSession(uuid(1), { comptageFermeture: { id: "c2", coupures: [] } }, VENDEUR));
    expect(compte(s, "evenements")).toBe(1);
    expect(c.sessionOuverte()?.id).toBe(uuid(1));
  });
});

describe("liste des ventes et état local", () => {
  it("ventes du jour, nombre d'articles en unités, état de la file", () => {
    const { c } = coeurPret();
    expect(c.etatLocal()).toEqual({ fileEnAttente: 0, rejetes: 0, plageRestante: 500, plageEpuisee: false, sessionOuverte: false });
    c.enregistrerVente({ lignes: [{ stockId: "s1", quantite: 2 }] }, cle(1), VENDEUR);
    c.enregistrerVente({ lignes: [{ stockId: "s1", quantite: 1 }], clientNom: "Aminata" }, cle(2), VENDEUR);
    const liste = c.listerVentes("2026-11-04");
    expect(liste).toMatchObject({ date: "2026-11-04", totalJour: 15000, nombre: 2, page: 1, totalPages: 1 });
    expect(liste.ventes.map((x) => [x.numero, x.nombreArticles, x.clientNom])).toEqual([["T1-0000002", 1, "Aminata"], ["T1-0000001", 2, null]]);
    expect(c.listerVentes("2026-11-03").nombre).toBe(0);
    expect(c.etatLocal()).toEqual({ fileEnAttente: 3, rejetes: 0, plageRestante: 498, plageEpuisee: false, sessionOuverte: true });
  });

  it("sans catalogue : refus clair, rien d'écrit", () => {
    const c = new CoeurCaisse(base(), outils());
    c.rattacher({ structureId: "ph1" });
    expect(refus(() => c.enregistrerVente({ lignes: [{ stockId: "s1", quantite: 1 }] }, cle(1), VENDEUR)).code).toBe("CATALOGUE_ABSENT");
    expect(refus(() => c.ouvrirSession({ id: uuid(1) }, VENDEUR)).code).toBe("CATALOGUE_ABSENT");
    expect(c.sessionOuverte()).toBeNull();
  });
});
