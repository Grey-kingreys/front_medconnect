import { afterEach, describe, expect, it, vi } from "vitest";
import type { UtilisateurPoste } from "@/lib/caisse/contrat_desktop";
import { VENDEUR, coeurPret, fermerTout, fiche, photo, uuid } from "./aide_tests";
import { Passerelle } from "./passerelle";
import { RefusCaisse } from "./refus";
import type { CoeurCaisse } from "./coeur";
import type { Stockage } from "./stockage";

afterEach(fermerTout);

const ID = (n: number) => uuid(n, "cccccccc");
const sortie = (n: number, plus: Record<string, unknown> = {}) => ({
  id: ID(n),
  stockId: "s1",
  lotId: "l1",
  unite: "UNITE" as const,
  quantite: 5,
  raison: "CASSE" as const,
  ...plus,
});
const correction = (n: number, variation: number, plus: Record<string, unknown> = {}) => ({
  id: ID(n),
  lotId: "l1",
  variation,
  motif: "Comptage au rangement",
  ...plus,
});

function evenements(c: CoeurCaisse) {
  return c.evenementsAEnvoyer(100).map((e) => ({ type: e.type, sequence: e.sequence, corps: JSON.parse(e.corps as unknown as string) as Record<string, unknown> }));
}

function refus(f: () => unknown): RefusCaisse {
  try {
    f();
  } catch (e) {
    expect(e).toBeInstanceOf(RefusCaisse);
    return e as RefusCaisse;
  }
  throw new Error("Un refus était attendu.");
}

describe("sortie de stock locale", () => {
  it("fait baisser le stock affiché aussitôt et écrit mouvement et événement ensemble", () => {
    const { s, c } = coeurPret();
    const r = c.sortirStock(sortie(1), VENDEUR);
    expect(r).toMatchObject({ cree: true, quantite: 5, soldeLot: 35, type: "PERTE", motif: "Cassé ou abîmé" });
    const f = c.lireStock()[0];
    expect(f.quantite).toBe(35);
    expect(f.lots?.[0].quantite).toBe(35);
    expect(s.lire("SELECT sequence, stockId, lotId, quantiteUm, type, reference FROM mouvements_locaux")).toEqual([
      { sequence: 1, stockId: "s1", lotId: "l1", quantiteUm: -5, type: "SORTIE", reference: ID(1) },
    ]);
    expect(evenements(c)).toEqual([
      {
        type: "SORTIE_STOCK",
        sequence: 1,
        corps: { id: ID(1), stockId: "s1", lotId: "l1", unite: "UNITE", quantite: 5, raison: "CASSE", commentaire: "" },
      },
    ]);
  });

  it("rejouée avec le même identifiant : rien de plus n'est sorti", () => {
    const { c } = coeurPret();
    c.sortirStock(sortie(1), VENDEUR);
    const r = c.sortirStock(sortie(1), VENDEUR);
    expect(r.cree).toBe(false);
    expect(c.lireStock()[0].quantite).toBe(35);
    expect(evenements(c)).toHaveLength(1);
  });

  it("compte les boîtes avec le coefficient du lot", () => {
    const f = fiche(1, { coefficientBoite: 10 });
    f.lots[0] = { ...f.lots[0], coefficientReception: 10, solde: 40 };
    const { c } = coeurPret([f]);
    expect(c.sortirStock(sortie(1, { unite: "BOITE", quantite: 2 }), VENDEUR).quantite).toBe(20);
    expect(c.lireStock()[0].quantite).toBe(20);
  });

  it("refuse sans rien écrire : plus que le lot, raison absente, « Autre » sans précision, lot ou médicament inconnu", () => {
    const { s, c } = coeurPret();
    expect(refus(() => c.sortirStock(sortie(1, { quantite: 41 }), VENDEUR))).toMatchObject({ status: 409, code: "STOCK_LOT_NEGATIF" });
    expect(refus(() => c.sortirStock(sortie(2, { raison: undefined }), VENDEUR))).toMatchObject({ status: 400, code: "MOTIF_REQUIS" });
    expect(refus(() => c.sortirStock(sortie(3, { raison: "AUTRE", commentaire: "a" }), VENDEUR))).toMatchObject({ code: "MOTIF_REQUIS" });
    expect(refus(() => c.sortirStock(sortie(4, { lotId: "inconnu" }), VENDEUR))).toMatchObject({ status: 404, code: "LOT_INTROUVABLE" });
    expect(refus(() => c.sortirStock(sortie(5, { stockId: "x" }), VENDEUR))).toMatchObject({ status: 404, code: "STOCK_INTROUVABLE" });
    expect(refus(() => c.sortirStock({ ...sortie(6), id: "pas-un-uuid" }, VENDEUR))).toMatchObject({ status: 400 });
    expect(s.lire("SELECT COUNT(*) AS n FROM mouvements_locaux")).toEqual([{ n: 0 }]);
    expect(evenements(c)).toHaveLength(0);
  });

  it("la deuxième sortie voit le stock déjà baissé", () => {
    const { c } = coeurPret();
    c.sortirStock(sortie(1, { quantite: 30 }), VENDEUR);
    expect(refus(() => c.sortirStock(sortie(2, { quantite: 11 }), VENDEUR))).toMatchObject({ code: "STOCK_LOT_NEGATIF" });
    expect(c.sortirStock(sortie(3, { quantite: 10 }), VENDEUR).soldeLot).toBe(0);
  });

  it("disparaît de la surcouche après la photographie qui a avancé la séquence appliquée", () => {
    const { s, c } = coeurPret();
    c.sortirStock(sortie(1), VENDEUR);
    expect(c.lireStock()[0].quantite).toBe(35);
    // Le serveur a appliqué l'événement (séquence 1) : sa photographie porte le stock à 35.
    const f = fiche(1);
    f.quantite = 35;
    f.lots[0] = { ...f.lots[0], solde: 35 };
    c.appliquerPhotographie(photo([f], { sequenceAppliquee: 1, sequenceMaxRecue: 1 }), null, null);
    expect(c.lireStock()[0].quantite).toBe(35);
    // La ligne reste en base mais n'a plus d'effet.
    expect(s.lire("SELECT COUNT(*) AS n FROM mouvements_locaux")).toEqual([{ n: 1 }]);
  });

  it("un événement rejeté par le serveur revient à la vérité du serveur", () => {
    const { c } = coeurPret();
    c.sortirStock(sortie(1), VENDEUR);
    // Rejeté : la séquence avance sans que le stock du serveur change.
    c.appliquerPhotographie(photo([fiche(1)], { sequenceAppliquee: 1, sequenceMaxRecue: 1 }), null, null);
    expect(c.lireStock()[0].quantite).toBe(40);
  });
});

describe("correction de quantité locale", () => {
  it("retire et ajoute, avec un événement chacune", () => {
    const { c } = coeurPret();
    const moins = c.corrigerQuantite("s1", correction(1, -10), VENDEUR);
    expect(moins.fiche.quantite).toBe(30);
    const plus = c.corrigerQuantite("s1", correction(2, 4), VENDEUR);
    expect(plus.fiche.quantite).toBe(34);
    expect(evenements(c).map((e) => [e.type, e.sequence, e.corps.variation])).toEqual([
      ["CORRECTION_QUANTITE", 1, -10],
      ["CORRECTION_QUANTITE", 2, 4],
    ]);
    expect(evenements(c)[0].corps).toEqual({ id: ID(1), stockId: "s1", lotId: "l1", variation: -10, motif: "Comptage au rangement", notes: "" });
  });

  it("choisit seule le lot unique, et exige le lot quand il y en a plusieurs", () => {
    const f = fiche(1);
    f.lots.push({ ...f.lots[0], id: "l2", numeroLot: "N2", solde: 10 });
    const { c } = coeurPret([f]);
    expect(refus(() => c.corrigerQuantite("s1", correction(1, -1, { lotId: undefined }), VENDEUR))).toMatchObject({ status: 409, code: "LOT_REQUIS" });
    const { c: c2 } = coeurPret();
    expect(c2.corrigerQuantite("s1", correction(1, -1, { lotId: undefined }), VENDEUR).fiche.quantite).toBe(39);
  });

  it("rejouée avec le même identifiant : appliquée une seule fois", () => {
    const { c } = coeurPret();
    c.corrigerQuantite("s1", correction(1, -10), VENDEUR);
    c.corrigerQuantite("s1", correction(1, -10), VENDEUR);
    expect(c.lireStock()[0].quantite).toBe(30);
    expect(evenements(c)).toHaveLength(1);
  });

  it("refuse sans rien écrire : motif trop court, variation nulle, lot qui passerait sous zéro, lot inconnu", () => {
    const { s, c } = coeurPret();
    expect(refus(() => c.corrigerQuantite("s1", correction(1, -1, { motif: "ab" }), VENDEUR))).toMatchObject({ status: 400, code: "MOTIF_REQUIS" });
    expect(refus(() => c.corrigerQuantite("s1", correction(2, 0), VENDEUR))).toMatchObject({ status: 400 });
    expect(refus(() => c.corrigerQuantite("s1", correction(3, -41), VENDEUR))).toMatchObject({ status: 409, code: "STOCK_LOT_NEGATIF" });
    expect(refus(() => c.corrigerQuantite("s1", correction(4, 1, { lotId: "x" }), VENDEUR))).toMatchObject({ status: 404, code: "LOT_INTROUVABLE" });
    expect(refus(() => c.corrigerQuantite("zz", correction(5, 1), VENDEUR))).toMatchObject({ status: 404, code: "STOCK_INTROUVABLE" });
    expect(s.lire("SELECT COUNT(*) AS n FROM evenements")).toEqual([{ n: 0 }]);
  });
});

describe("passerelle du domaine stock", () => {
  const UTILISATEUR: UtilisateurPoste = { id: VENDEUR.id, nom: VENDEUR.nom, structureId: "ph1", permissions: ["caisse:utiliser", "stock:write"] };
  function monter(permissions: string[] = UTILISATEUR.permissions): { p: Passerelle; apresVente: ReturnType<typeof vi.fn>; c: CoeurCaisse; s: Stockage } {
    const { c, s } = coeurPret();
    const apresVente = vi.fn();
    const p = new Passerelle({ coeur: c, apresVente, apresRattachement: vi.fn(), etatChange: vi.fn(), journal: vi.fn() });
    p.confirmerIdentite({ ...UTILISATEUR, permissions });
    return { p, apresVente, c, s };
  }

  it("sort du stock avec stock:write, écrit l'événement et lance l'envoi", async () => {
    const { p, apresVente, c } = monter();
    const r = await p.appeler("sortir", ["ph1", sortie(1)], "stock");
    expect(r).toMatchObject({ ok: true, message: "Sortie de stock enregistrée sur ce poste." });
    expect(apresVente).toHaveBeenCalled();
    expect(evenements(c)).toHaveLength(1);
    const c2 = await p.appeler("corriger", ["ph1", "s1", correction(2, -3)], "stock");
    expect(c2).toMatchObject({ ok: true, message: "Stock réduit sur ce poste (nouvelle quantité : 32)" });
  });

  it("refuse sans stock:write, sans rien écrire", async () => {
    const { p, c } = monter(["caisse:utiliser"]);
    expect(await p.appeler("sortir", ["ph1", sortie(1)], "stock")).toMatchObject({ ok: false, status: 403, code: "PERMISSION_REFUSEE" });
    expect(await p.appeler("corriger", ["ph1", "s1", correction(2, -3)], "stock")).toMatchObject({ ok: false, status: 403 });
    expect(evenements(c)).toHaveLength(0);
  });

  it("rend le refus métier du cœur et refuse un corps invalide ou une autre pharmacie", async () => {
    const { p } = monter();
    expect(await p.appeler("sortir", ["ph1", sortie(1, { quantite: 99 })], "stock")).toMatchObject({ ok: false, status: 409, code: "STOCK_LOT_NEGATIF" });
    expect(await p.appeler("sortir", ["ph1", { ...sortie(2), prix: 1 }], "stock")).toMatchObject({ ok: false, status: 400, code: "VALIDATION" });
    expect(await p.appeler("sortir", ["autre", sortie(3)], "stock")).toMatchObject({ ok: false, status: 403, code: "POSTE_AUTRE_PHARMACIE" });
  });
});
