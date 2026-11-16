import { afterEach, describe, expect, it } from "vitest";
import type { CorpsInventaire } from "@/lib/api_pharmacie";
import { VENDEUR, coeurPret, evenements, fermerTout, fiche, photo, uuid } from "./aide_tests";
import { idLotDeterministe } from "./ids_stables";
import { RefusCaisse } from "./refus";
import type { InventaireSynchro } from "./types_synchro";

afterEach(fermerTout);

const ID = (n: number) => uuid(n, "eeeeeeee");

function refus(f: () => unknown): RefusCaisse {
  try {
    f();
  } catch (e) {
    expect(e).toBeInstanceOf(RefusCaisse);
    return e as RefusCaisse;
  }
  throw new Error("Un refus était attendu.");
}

const inventaire = (n: number, lignes: CorpsInventaire["lignes"] = [{ stockId: "s1", lotId: "l1", nombreBoites: 25 }], plus: Partial<CorpsInventaire> = {}): CorpsInventaire => ({
  id: ID(n),
  commentaire: "Comptage du soir",
  lignes,
  ...plus,
});

describe("inventaire local", () => {
  it("le stock affiché devient exactement le compté ; événement et mouvement écrits ensemble, avec le théorique local", () => {
    const { s, c } = coeurPret();
    const r = c.enregistrerInventaire(inventaire(1), VENDEUR);
    expect(r).toMatchObject({ cree: true, id: ID(1) });
    expect(r.lignes[0]).toMatchObject({ stockId: "s1", lotId: "l1", quantiteTheorique: 40, quantiteComptee: 25, ecart: -15, sousTolerance: false });
    expect(c.lireStock()[0].quantite).toBe(25);
    expect(s.lire("SELECT stockId, lotId, quantiteUm, type, reference FROM mouvements_locaux")).toEqual([{ stockId: "s1", lotId: "l1", quantiteUm: -15, type: "INVENTAIRE", reference: ID(1) }]);
    const evt = evenements(s);
    expect(evt).toHaveLength(1);
    expect(evt[0].type).toBe("INVENTAIRE_ENREGISTRE");
    expect(evt[0].corps).toEqual({ id: ID(1), commentaire: "Comptage du soir", lignes: [{ stockId: "s1", lotId: "l1", quantiteComptee: 25, theoriqueLocal: 40 }] });
  });

  it("le théorique local tient compte des ventes déjà faites sur le poste", () => {
    const { s, c } = coeurPret();
    s.executer("INSERT INTO mouvements_locaux (sequence, stockId, lotId, quantiteUm, type, reference) VALUES (1, 's1', 'l1', -5, 'VENTE', 'v1')");
    const r = c.enregistrerInventaire(inventaire(1, [{ stockId: "s1", lotId: "l1", nombreBoites: 35 }]), VENDEUR);
    expect(r.lignes[0]).toMatchObject({ quantiteTheorique: 35, ecart: 0, sousTolerance: true });
    expect((evenements(s)[0].corps.lignes as Record<string, unknown>[])[0]).toMatchObject({ theoriqueLocal: 35, quantiteComptee: 35 });
  });

  it("rejouée avec le même identifiant : rien de plus n'est écrit", () => {
    const { s, c } = coeurPret();
    c.enregistrerInventaire(inventaire(1), VENDEUR);
    const r = c.enregistrerInventaire(inventaire(1), VENDEUR);
    expect(r.cree).toBe(false);
    expect(c.lireStock()[0].quantite).toBe(25);
    expect(evenements(s)).toHaveLength(1);
  });

  it("un lot trouvé (date) devient un lot local à identifiant stable, compté en boîtes et unités en plus", () => {
    const { s, c } = coeurPret([fiche(1, { coefficientBoite: 10 })]);
    const r = c.enregistrerInventaire(inventaire(1, [{ stockId: "s1", dateExpiration: "2029-03-31", nombreBoites: 2, unitesEnPlus: 3 }]), VENDEUR);
    const lotId = idLotDeterministe(ID(1), 0);
    expect(r.lignes[0]).toMatchObject({ lotId, quantiteTheorique: 0, quantiteComptee: 23, ecart: 23 });
    const stock = c.lireStock()[0];
    expect(stock.quantite).toBe(63);
    expect(stock.lots?.find((l) => l.id === lotId)?.quantite).toBe(23);
    expect(s.lire("SELECT lotId, stockId, dateExpiration, coefficientReception FROM lots_locaux")).toEqual([{ lotId, stockId: "s1", dateExpiration: "2029-03-31", coefficientReception: 10 }]);
    expect((evenements(s)[0].corps.lignes as Record<string, unknown>[])[0]).toEqual({
      stockId: "s1",
      nouveauLot: { id: lotId, dateExpiration: "2029-03-31" },
      quantiteComptee: 23,
      theoriqueLocal: 0,
    });
  });

  it("sans lot ni date : lot unique visé ; plusieurs lots : LOT_REQUIS avec la liste ; aucun lot et quantité : date requise", () => {
    const deux = fiche(1, {
      lots: [
        { id: "l1", numeroLot: "A", dateExpiration: "2027-01-31", dateReception: "2026-10-01T08:00:00.000Z", coefficientReception: 1, solde: 10, lotTechnique: false },
        { id: "l2", numeroLot: "B", dateExpiration: "2028-01-31", dateReception: "2026-10-01T08:00:00.000Z", coefficientReception: 1, solde: 20, lotTechnique: false },
      ],
      quantite: 30,
    });
    const { c } = coeurPret([deux, fiche(2, { quantite: 0, lots: [] })]);
    const e = refus(() => c.enregistrerInventaire(inventaire(1, [{ stockId: "s1", nombreBoites: 5 }]), VENDEUR));
    expect(e).toMatchObject({ status: 409, code: "LOT_REQUIS" });
    expect(JSON.stringify(e.details)).toContain("l2");
    expect(refus(() => c.enregistrerInventaire(inventaire(2, [{ stockId: "s2", nombreBoites: 5 }]), VENDEUR))).toMatchObject({ code: "DATE_PEREMPTION_REQUISE" });
    const ok = c.enregistrerInventaire(inventaire(3, [{ stockId: "s2", nombreBoites: 5, sansPeremption: true }]), VENDEUR);
    expect(ok.lignes[0]).toMatchObject({ quantiteComptee: 5, dateExpiration: null });
  });

  it("tolérance de la fiche : la somme des écarts des lots n'est pas signalée en deçà", () => {
    const { c } = coeurPret([fiche(1, { toleranceInventaire: 5 })]);
    expect(c.enregistrerInventaire(inventaire(1, [{ stockId: "s1", lotId: "l1", nombreBoites: 37 }]), VENDEUR).lignes[0].sousTolerance).toBe(true);
    expect(c.enregistrerInventaire(inventaire(2, [{ stockId: "s1", lotId: "l1", nombreBoites: 20 }]), VENDEUR).lignes[0].sousTolerance).toBe(false);
  });

  it("refuse sans rien écrire : fiche ou lot inconnu, lot compté deux fois, quantité, date, lot vide inconnu", () => {
    const { s, c } = coeurPret();
    expect(refus(() => c.enregistrerInventaire(inventaire(1, [{ stockId: "x", nombreBoites: 1 }]), VENDEUR))).toMatchObject({ status: 404, code: "STOCK_INTROUVABLE" });
    expect(refus(() => c.enregistrerInventaire(inventaire(2, [{ stockId: "s1", lotId: "inconnu", nombreBoites: 1 }]), VENDEUR))).toMatchObject({ status: 404, code: "LOT_INTROUVABLE" });
    expect(
      refus(() =>
        c.enregistrerInventaire(
          inventaire(3, [
            { stockId: "s1", lotId: "l1", nombreBoites: 1 },
            { stockId: "s1", lotId: "l1", nombreBoites: 2 },
          ]),
          VENDEUR,
        ),
      ),
    ).toMatchObject({ status: 400 });
    expect(refus(() => c.enregistrerInventaire(inventaire(4, [{ stockId: "s1", lotId: "l1" }]), VENDEUR))).toMatchObject({ status: 400 });
    expect(refus(() => c.enregistrerInventaire(inventaire(5, [{ stockId: "s1", dateExpiration: "2027-02-30", nombreBoites: 1 }]), VENDEUR))).toMatchObject({ status: 400 });
    expect(refus(() => c.enregistrerInventaire(inventaire(6, [{ stockId: "s1", dateExpiration: "2031-01-31", nombreBoites: 0 }]), VENDEUR))).toMatchObject({ status: 400 });
    expect(refus(() => c.enregistrerInventaire({ ...inventaire(7), id: "pas-un-uuid" }, VENDEUR))).toMatchObject({ status: 400 });
    expect(s.lire("SELECT COUNT(*) AS n FROM mouvements_locaux")).toEqual([{ n: 0 }]);
    expect(s.lire("SELECT COUNT(*) AS n FROM lots_locaux")).toEqual([{ n: 0 }]);
    expect(evenements(s)).toHaveLength(0);
  });

  it("avertit quand la fiche n'est pas qualifiée", () => {
    const { c } = coeurPret([fiche(1, { qualifie: false })]);
    const r = c.enregistrerInventaire(inventaire(1), VENDEUR);
    expect(r.avertissements?.[0]).toMatchObject({ code: "FICHE_NON_QUALIFIEE", stockId: "s1" });
  });
});

describe("lecture des inventaires hors ligne", () => {
  const lisible = (id: string, createdAt: string): InventaireSynchro => ({
    id,
    createdAt,
    commentaire: null,
    auteur: { id: VENDEUR.id, nom: VENDEUR.nom },
    lignes: [
      { id: `${id}:0`, stockId: "s1", nom: "Produit 00001", lotId: "l1", numeroLot: "N1", dateExpiration: "2027-06-30", lotTechnique: false, quantiteTheorique: 40, quantiteARegulariser: 0, quantiteComptee: 38, ecart: -2, sousTolerance: false, anomalieId: "a1" },
    ],
  });

  it("liste et détail : les 30 derniers jours de la photographie, plus ceux faits ici, sans aucun coût", () => {
    const { c } = coeurPret();
    c.enregistrerInventaire(inventaire(1), VENDEUR);
    const p = photo([fiche(1)], { sequenceAppliquee: 0, sequenceMaxRecue: 0 });
    p.inventaires = [lisible(ID(2), "2026-10-20T10:00:00.000Z"), lisible(ID(3), "2026-09-01T10:00:00.000Z")];
    c.appliquerPhotographie(p, null, null);
    const page = c.listerInventaires(1);
    expect(page.total).toBe(2);
    expect(page.inventaires.map((i) => i.id)).toEqual([ID(1), ID(2)]);
    expect(page.inventaires[1]).toMatchObject({ nombreLignes: 1, nombreEcarts: 1, nombreAnomalies: 1, auteur: { nom: VENDEUR.nom } });
    const detail = c.lireInventaire(ID(2));
    expect(detail.lignes[0]).toMatchObject({ quantiteComptee: 38, ecart: -2 });
    expect(JSON.stringify({ page, detail })).not.toMatch(/cout/i);
    expect(refus(() => c.lireInventaire(ID(3)))).toMatchObject({ status: 404 });
    expect(refus(() => c.lireInventaire(ID(99)))).toMatchObject({ status: 404 });
  });

  it("l'inventaire appliqué par le serveur n'est plus lu en double ; le rejeté disparaît", () => {
    const { s, c } = coeurPret();
    c.enregistrerInventaire(inventaire(1), VENDEUR);
    c.enregistrerInventaire(inventaire(2, [{ stockId: "s1", lotId: "l1", nombreBoites: 20 }]), VENDEUR);
    const p = photo([fiche(1, { quantite: 25, lots: [{ id: "l1", numeroLot: "N1", dateExpiration: "2027-06-30", dateReception: "2026-10-01T08:00:00.000Z", coefficientReception: 1, solde: 25, lotTechnique: false }] })], {
      sequenceAppliquee: 2,
      sequenceMaxRecue: 2,
    });
    p.inventaires = [lisible(ID(1), "2026-11-04T10:00:00.000Z")];
    c.appliquerPhotographie(p, null, null);
    expect(c.listerInventaires(1).inventaires.map((i) => i.id)).toEqual([ID(1)]);
    expect(s.lire("SELECT COUNT(*) AS n FROM inventaires_locales")).toEqual([{ n: 2 }]);
    expect(c.lireStock()[0].quantite).toBe(25);
  });
});
