import { afterEach, describe, expect, it } from "vitest";
import type { CorpsReception } from "@/lib/api_pharmacie";
import { VENDEUR, coeurPret, evenements, fermerTout, fiche, photo, uuid } from "./aide_tests";
import { idLotDeterministe } from "./ids_stables";
import { RefusCaisse } from "./refus";

afterEach(fermerTout);

const ID = (n: number) => uuid(n, "dddddddd");

function refus(f: () => unknown): RefusCaisse {
  try {
    f();
  } catch (e) {
    expect(e).toBeInstanceOf(RefusCaisse);
    return e as RefusCaisse;
  }
  throw new Error("Un refus était attendu.");
}

const reception = (n: number, plus: Partial<CorpsReception> = {}, ligne: Record<string, unknown> = {}): CorpsReception => ({
  id: ID(n),
  numeroFacture: "FAC-1",
  montantHT: 5000,
  netAPayer: 5900,
  lignes: [{ stockId: "s1", nombreBoites: 3, dateExpiration: "2028-01-31", numeroLot: "L1", coutAchatBoite: 500, montantHTLigne: 1500, prixPublicBoite: 900, ...ligne }],
  ...plus,
});

describe("réception locale", () => {
  it("monte le stock aussitôt, avec un lot à identifiant stable, et écrit lot, mouvement et événement ensemble", () => {
    const f = fiche(1, { coefficientBoite: 10 });
    f.lots[0] = { ...f.lots[0], coefficientReception: 10, solde: 40 };
    const { s, c } = coeurPret([f]);
    const r = c.enregistrerReception(reception(1), VENDEUR);
    const lotId = idLotDeterministe(ID(1), 0);
    expect(r).toMatchObject({ cree: true, id: ID(1) });
    expect(r.lots[0]).toMatchObject({ id: lotId, quantiteRecue: 30, coefficientReception: 10, solde: 30, numeroLot: "L1" });
    const stock = c.lireStock()[0];
    expect(stock.quantite).toBe(70);
    expect(stock.lots?.find((l) => l.id === lotId)?.quantite).toBe(30);
    expect(s.lire("SELECT stockId, lotId, quantiteUm, type, reference FROM mouvements_locaux")).toEqual([
      { stockId: "s1", lotId, quantiteUm: 30, type: "RECEPTION", reference: ID(1) },
    ]);
    const evt = evenements(s);
    expect(evt).toHaveLength(1);
    expect(evt[0].type).toBe("RECEPTION_ENREGISTREE");
    expect(evt[0].corps).toMatchObject({ id: ID(1), numeroFacture: "FAC-1", montantHT: 5000, netAPayer: 5900 });
    expect((evt[0].corps.lignes as Record<string, unknown>[])[0]).toMatchObject({
      stockId: "s1",
      lotId,
      coefficientLocal: 10,
      nombreBoites: 3,
      coutAchatBoite: 500,
      montantHTLigne: 1500,
    });
  });

  it("rejouée avec le même identifiant : rien de plus n'est écrit", () => {
    const { s, c } = coeurPret();
    c.enregistrerReception(reception(1), VENDEUR);
    const r = c.enregistrerReception(reception(1), VENDEUR);
    expect(r.cree).toBe(false);
    expect(c.lireStock()[0].quantite).toBe(43);
    expect(evenements(s)).toHaveLength(1);
  });

  it("compte en unités quand la ligne le demande et accepte « sans péremption »", () => {
    const { c } = coeurPret();
    const r = c.enregistrerReception(reception(1, {}, { nombreBoites: undefined, quantiteUnites: 7, dateExpiration: undefined, sansPeremption: true }), VENDEUR);
    expect(r.lots[0]).toMatchObject({ quantiteRecue: 7, dateExpiration: null });
  });

  it("refuse sans rien écrire : médicament inconnu, quantité, date, fournisseur, futur", () => {
    const { s, c } = coeurPret();
    expect(refus(() => c.enregistrerReception(reception(1, {}, { stockId: "x" }), VENDEUR))).toMatchObject({ status: 404, code: "STOCK_INTROUVABLE" });
    expect(refus(() => c.enregistrerReception(reception(2, {}, { nombreBoites: undefined }), VENDEUR))).toMatchObject({ status: 400 });
    expect(refus(() => c.enregistrerReception(reception(3, {}, { quantiteUnites: 2 }), VENDEUR))).toMatchObject({ status: 400 });
    expect(refus(() => c.enregistrerReception(reception(4, {}, { dateExpiration: undefined }), VENDEUR))).toMatchObject({ code: "DATE_PEREMPTION_REQUISE" });
    expect(refus(() => c.enregistrerReception(reception(5, {}, { dateExpiration: "2026-11-03" }), VENDEUR))).toMatchObject({ code: "DATE_PEREMPTION_PASSEE" });
    expect(refus(() => c.enregistrerReception(reception(6, {}, { dateExpiration: "2027-02-30" }), VENDEUR))).toMatchObject({ status: 400 });
    expect(refus(() => c.enregistrerReception(reception(7, { fournisseurId: "inconnu" }), VENDEUR))).toMatchObject({ status: 404, code: "FOURNISSEUR_INTROUVABLE" });
    expect(refus(() => c.enregistrerReception(reception(8, { recueLe: "2026-12-01T00:00:00.000Z" }), VENDEUR))).toMatchObject({ status: 400 });
    expect(refus(() => c.enregistrerReception({ ...reception(9), id: "pas-un-uuid" }, VENDEUR))).toMatchObject({ status: 400 });
    expect(s.lire("SELECT COUNT(*) AS n FROM mouvements_locaux")).toEqual([{ n: 0 }]);
    expect(s.lire("SELECT COUNT(*) AS n FROM lots_locaux")).toEqual([{ n: 0 }]);
    expect(evenements(s)).toHaveLength(0);
  });

  it("avertit quand la fiche n'est pas qualifiée", () => {
    const { c } = coeurPret([fiche(1, { qualifie: false })]);
    const r = c.enregistrerReception(reception(1), VENDEUR);
    expect(r.avertissements?.[0]).toMatchObject({ code: "FICHE_NON_QUALIFIEE", stockId: "s1" });
  });

  it("liste et détail sans aucun coût ni montant de facture, y compris pour une réception faite ici", () => {
    const { c } = coeurPret();
    c.enregistrerReception(reception(1), VENDEUR);
    const page = c.listerReceptions(1);
    expect(page.total).toBe(1);
    expect(page.receptions[0]).toMatchObject({ id: ID(1), nombreLots: 1, quantiteTotale: 3, numeroFacture: "FAC-1" });
    const detail = c.lireReception(ID(1));
    const json = JSON.stringify({ page, detail });
    expect(json).not.toMatch(/cout|montantHT|totalTva|montantTTC|netAPayer/i);
    expect(json).not.toContain("5900");
    expect(detail.lots[0].prixPublicBoite).toBe(900);
    expect(refus(() => c.lireReception(ID(99)))).toMatchObject({ status: 404 });
  });

  it("la lecture suit la photographie : la réception appliquée vient du serveur, la rejetée disparaît", () => {
    const { s, c } = coeurPret();
    c.enregistrerReception(reception(1), VENDEUR);
    c.enregistrerReception(reception(2), VENDEUR);
    // Le serveur a appliqué la séquence 1 (réception 1) et rejeté la 2 : sa photographie ne connaît que la 1.
    const p = photo([fiche(1, { quantite: 43, lots: [{ id: "l1", numeroLot: "N1", dateExpiration: "2027-06-30", dateReception: "2026-10-01T08:00:00.000Z", coefficientReception: 1, solde: 43, lotTechnique: false }] })], {
      sequenceAppliquee: 2,
      sequenceMaxRecue: 2,
    });
    p.receptions = [
      {
        id: ID(1),
        reference: null,
        recueLe: "2026-11-04T10:00:00.000Z",
        createdAt: "2026-11-04T10:00:00.000Z",
        auteurId: VENDEUR.id,
        numeroFacture: "FAC-1",
        referenceCommande: null,
        dateFacture: null,
        nombrePages: null,
        fournisseur: null,
        lots: [],
      },
    ];
    c.appliquerPhotographie(p, null, null);
    expect(c.listerReceptions(1).receptions.map((r) => r.id)).toEqual([ID(1)]);
    expect(s.lire("SELECT COUNT(*) AS n FROM receptions_locales")).toEqual([{ n: 2 }]);
  });

  it("ne garde que les 30 derniers jours de la photographie", () => {
    const { c } = coeurPret();
    const p = photo([fiche(1)]);
    const r = (id: string, recueLe: string) => ({
      id,
      reference: null,
      recueLe,
      createdAt: recueLe,
      auteurId: VENDEUR.id,
      numeroFacture: null,
      referenceCommande: null,
      dateFacture: null,
      nombrePages: null,
      fournisseur: null,
      lots: [],
    });
    p.receptions = [r("recente", "2026-10-20T10:00:00.000Z"), r("ancienne", "2026-09-20T10:00:00.000Z")];
    c.appliquerPhotographie(p, null, null);
    expect(c.listerReceptions(1).receptions.map((x) => x.id)).toEqual(["recente"]);
  });
});

describe("fournisseurs locaux", () => {
  it("crée un fournisseur : écriture locale et événement, visible aussitôt", () => {
    const { s, c } = coeurPret();
    const f = c.creerFournisseur({ nom: "  Sopharma ", telephone: "+224 620 00 00 00" }, VENDEUR);
    expect(f).toMatchObject({ cree: true, nom: "Sopharma", telephone: "+224 620 00 00 00" });
    expect(c.listerFournisseurs().map((x) => x.nom)).toEqual(["Sopharma"]);
    const evt = evenements(s);
    expect(evt).toHaveLength(1);
    expect(evt[0]).toMatchObject({ type: "FOURNISSEUR_CREE", corps: { id: f.id, nom: "Sopharma", telephone: "+224 620 00 00 00" } });
  });

  it("un nom déjà connu (casse ignorée, photographie ou poste) rend le fournisseur existant sans événement", () => {
    const { s, c } = coeurPret();
    const p = photo([fiche(1)]);
    p.fournisseurs = [{ id: "f-serveur", nom: "Laborex Guinée", telephone: null }];
    c.appliquerPhotographie(p, null, null);
    const r = c.creerFournisseur({ nom: "LABOREX guinée" }, VENDEUR);
    expect(r).toMatchObject({ cree: false, id: "f-serveur" });
    c.creerFournisseur({ nom: "Pharmalab" }, VENDEUR);
    expect(c.creerFournisseur({ nom: "pharmalab" }, VENDEUR).cree).toBe(false);
    expect(evenements(s)).toHaveLength(1);
  });

  it("refuse un nom trop court ou un téléphone invalide", () => {
    const { s, c } = coeurPret();
    expect(refus(() => c.creerFournisseur({ nom: "S" }, VENDEUR))).toMatchObject({ status: 400 });
    expect(refus(() => c.creerFournisseur({ nom: "Sopharma", telephone: "abc" }, VENDEUR))).toMatchObject({ status: 400 });
    expect(evenements(s)).toHaveLength(0);
  });

  it("une réception peut citer un fournisseur créé sur le poste, dans l'ordre des événements", () => {
    const { s, c } = coeurPret();
    const f = c.creerFournisseur({ nom: "Sopharma" }, VENDEUR);
    const r = c.enregistrerReception(reception(1, { fournisseurId: f.id }), VENDEUR);
    expect(r.fournisseur).toEqual({ id: f.id, nom: "Sopharma" });
    expect(evenements(s).map((e) => e.type)).toEqual(["FOURNISSEUR_CREE", "RECEPTION_ENREGISTREE"]);
  });

  it("le fournisseur local disparaît de la liste une fois la séquence appliquée, remplacé par la photographie", () => {
    const { c } = coeurPret();
    c.creerFournisseur({ nom: "Sopharma" }, VENDEUR);
    const p = photo([fiche(1)], { sequenceAppliquee: 1, sequenceMaxRecue: 1 });
    p.fournisseurs = [{ id: "f-serveur", nom: "Sopharma", telephone: null }];
    c.appliquerPhotographie(p, null, null);
    expect(c.listerFournisseurs().map((x) => x.id)).toEqual(["f-serveur"]);
  });
});
