import { afterEach, describe, expect, it } from "vitest";
import { VENDEUR, coeurPret, evenements, fermerTout, fiche, photo, uuid } from "./aide_tests";
import type { CoeurCaisse } from "./coeur";
import { RefusCaisse } from "./refus";
import type { MedicamentAllegeSynchro } from "./types_synchro";

afterEach(fermerTout);

const ID = (n: number) => uuid(n, "eeeeeeee");

const CATALOGUE: MedicamentAllegeSynchro[] = [
  { id: "mA", nom: "Amoxicilline 500 mg", nomGenerique: "Amoxicilline", categorie: "ANTIBIOTIQUE", formes: ["GELULE"], ordonnanceRequise: true },
  { id: "mB", nom: "Paracétamol 1 g", nomGenerique: null, categorie: "ANTALGIQUE", formes: ["COMPRIME"], ordonnanceRequise: false },
  { id: "m1", nom: "Produit 00001", nomGenerique: null, categorie: "ANTALGIQUE", formes: ["COMPRIME"], ordonnanceRequise: false },
];

function charger(c: CoeurCaisse, fiches = [fiche(1, { prixUnitaire: 5000, notes: "n0" })], sequenceAppliquee = 0) {
  c.appliquerPhotographie({ ...photo(fiches, { sequenceAppliquee }), medicaments: CATALOGUE }, null, null);
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

describe("modification locale d'une fiche", () => {
  it("change les champs sûrs aussitôt et écrit l'événement avec les valeurs avant et après", () => {
    const { s, c } = coeurPret([fiche(1, { prixUnitaire: 5000, deconditionnable: true, notes: "n0" })]);
    const r = c.modifierFiche("s1", { prixUnitaire: 6000, prixUnite: 300, toleranceInventaire: 2, notes: " nouvelle " }, VENDEUR);
    expect(r.modifiee).toBe(true);
    expect(r.fiche).toMatchObject({ prixUnitaire: 6000, prixUnite: 300, toleranceInventaire: 2, notes: "nouvelle" });
    expect(c.lireStock()[0]).toMatchObject({ prixUnitaire: 6000, prixUnite: 300, toleranceInventaire: 2, notes: "nouvelle" });
    const evt = evenements(s);
    expect(evt).toHaveLength(1);
    expect(evt[0].type).toBe("FICHE_MODIFIEE");
    expect(evt[0].corps).toEqual({
      stockId: "s1",
      avant: { prixUnitaire: 5000, prixUnite: null, toleranceInventaire: null, notes: "n0" },
      apres: { prixUnitaire: 6000, prixUnite: 300, toleranceInventaire: 2, notes: "nouvelle" },
    });
  });

  it("sans changement : rien n'est écrit", () => {
    const { s, c } = coeurPret([fiche(1, { prixUnitaire: 5000 })]);
    expect(c.modifierFiche("s1", { prixUnitaire: 5000, notes: "  " }, VENDEUR).modifiee).toBe(false);
    expect(evenements(s)).toHaveLength(0);
  });

  it("une fiche sans prix garde null dans l'événement (pas 0)", () => {
    const { s, c } = coeurPret([fiche(1, { prixUnitaire: null })]);
    c.modifierFiche("s1", { prixUnitaire: 1200 }, VENDEUR);
    expect(evenements(s)[0].corps).toMatchObject({ avant: { prixUnitaire: null }, apres: { prixUnitaire: 1200 } });
  });

  it("deux modifications de suite : la seconde part de la valeur de la première", () => {
    const { s, c } = coeurPret();
    c.modifierFiche("s1", { prixUnitaire: 6000 }, VENDEUR);
    c.modifierFiche("s1", { prixUnitaire: 7000 }, VENDEUR);
    expect(evenements(s)[1].corps).toMatchObject({ avant: { prixUnitaire: 6000 }, apres: { prixUnitaire: 7000 } });
    expect(c.lireStock()[0].prixUnitaire).toBe(7000);
  });

  it("mêmes validations que le web : prix entiers, prix à l'unité seulement si la fiche se vend à l'unité", () => {
    const { s, c } = coeurPret([fiche(1, { deconditionnable: false })]);
    expect(refus(() => c.modifierFiche("s1", { prixUnite: 100 }, VENDEUR)).code).toBe("PRIX_UNITE_SANS_DECONDITIONNEMENT");
    expect(refus(() => c.modifierFiche("s1", { prixUnitaire: -1 }, VENDEUR)).code).toBe("VALIDATION");
    expect(refus(() => c.modifierFiche("s1", { prixUnitaire: 1.5 }, VENDEUR)).code).toBe("VALIDATION");
    expect(refus(() => c.modifierFiche("s1", { toleranceInventaire: 1_000_001 }, VENDEUR)).code).toBe("VALIDATION");
    expect(refus(() => c.modifierFiche("s1", { prixUnite: 0 }, VENDEUR)).code).toBe("VALIDATION");
    expect(refus(() => c.modifierFiche("inconnue", { prixUnitaire: 1 }, VENDEUR)).code).toBe("STOCK_INTROUVABLE");
    expect(evenements(s)).toHaveLength(0);
  });

  it("la photographie suivante, qui avance la séquence appliquée, remplace la modification locale par la vérité du serveur", () => {
    const { c } = coeurPret();
    c.modifierFiche("s1", { prixUnitaire: 6000 }, VENDEUR);
    expect(c.lireStock()[0].prixUnitaire).toBe(6000);
    // Le serveur a appliqué l'événement de séquence 1 mais a gardé un autre prix (modifié ailleurs entre-temps).
    charger(c, [fiche(1, { prixUnitaire: 5500 })], 1);
    expect(c.lireStock()[0].prixUnitaire).toBe(5500);
  });
});

describe("ajout d'un médicament du catalogue au stock", () => {
  it("copie le catalogue allégé de la photographie, sans prix ni coût, et le trie à la recherche", () => {
    const { s, c } = coeurPret();
    charger(c);
    const lignes = s.lire<{ document: string }>("SELECT document FROM medicaments_catalogue ORDER BY rang").map((l) => l.document);
    expect(lignes).toHaveLength(3);
    expect(lignes.join("")).not.toMatch(/prix|cout|marge/i);
    expect(c.rechercherCatalogue("amox").map((m) => m.id)).toEqual(["mA"]);
    expect(c.rechercherCatalogue("PARACETAMOL").map((m) => m.id)).toEqual(["mB"]);
    expect(c.rechercherCatalogue("a")).toEqual([]);
  });

  it("crée la fiche locale à l'identifiant stable, sans quantité, et écrit FICHE_CREEE", () => {
    const { s, c } = coeurPret();
    charger(c);
    const r = c.creerFiche({ id: ID(1), medicamentId: "mA", prixUnitaire: 2500, notes: "étagère 2" }, VENDEUR);
    expect(r.cree).toBe(true);
    expect(r.fiche).toMatchObject({ id: ID(1), medicamentId: "mA", quantite: 0, prixUnitaire: 2500, notes: "étagère 2", coefficientBoite: 1 });
    expect(c.lireStock().map((f) => f.id)).toContain(ID(1));
    expect(evenements(s)[0]).toMatchObject({ type: "FICHE_CREEE", corps: { id: ID(1), medicamentId: "mA", prixUnitaire: 2500, notes: "étagère 2" } });
  });

  it("rejouée avec le même identifiant, ou médicament déjà dans le stock : rien de plus n'est écrit", () => {
    const { s, c } = coeurPret();
    charger(c);
    c.creerFiche({ id: ID(1), medicamentId: "mA" }, VENDEUR);
    expect(c.creerFiche({ id: ID(1), medicamentId: "mA" }, VENDEUR).cree).toBe(false);
    expect(c.creerFiche({ id: ID(2), medicamentId: "mA" }, VENDEUR).cree).toBe(false);
    expect(c.creerFiche({ id: ID(3), medicamentId: "m1" }, VENDEUR).cree).toBe(false);
    expect(evenements(s)).toHaveLength(1);
  });

  it("refuse un médicament absent du catalogue, un identifiant qui n'est pas un UUID, un prix invalide", () => {
    const { s, c } = coeurPret();
    charger(c);
    expect(refus(() => c.creerFiche({ id: ID(1), medicamentId: "zzz" }, VENDEUR)).code).toBe("MEDICAMENT_INTROUVABLE");
    expect(refus(() => c.creerFiche({ id: "pas-un-uuid", medicamentId: "mA" }, VENDEUR)).code).toBe("VALIDATION");
    expect(refus(() => c.creerFiche({ id: ID(1), medicamentId: "mA", prixUnitaire: -5 }, VENDEUR)).code).toBe("VALIDATION");
    expect(evenements(s)).toHaveLength(0);
  });

  it("la nouvelle fiche se modifie et reçoit une réception avant même l'envoi ; elle disparaît quand le serveur a appliqué", () => {
    const { s, c } = coeurPret();
    charger(c);
    c.creerFiche({ id: ID(1), medicamentId: "mA", prixUnitaire: 2500 }, VENDEUR);
    c.modifierFiche(ID(1), { prixUnitaire: 2600 }, VENDEUR);
    expect(c.lireStock().find((f) => f.id === ID(1))?.prixUnitaire).toBe(2600);
    expect(evenements(s).map((e) => e.type)).toEqual(["FICHE_CREEE", "FICHE_MODIFIEE"]);
    // Le serveur a retenu une autre fiche pour ce médicament : la photographie suivante la donne, la locale s'efface.
    charger(c, [fiche(1), fiche(9, { stockId: "serveur-A", medicamentId: "mA", prixUnitaire: 2500 })], 2);
    const ids = c.lireStock().map((f) => f.id);
    expect(ids).toContain("serveur-A");
    expect(ids).not.toContain(ID(1));
  });
});
