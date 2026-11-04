import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CoeurCaisse, type Outils } from "./coeur";
import { migrer, VERSION_SCHEMA } from "./schema";
import type { Stockage } from "./stockage";
import { controlerBase, exigerWal, ouvrirStockage } from "./stockage_sqlite";
import type { FicheSynchro, Photographie } from "./types_synchro";

const OUVERTS: Stockage[] = [];
const DOSSIERS: string[] = [];

function base(chemin = ":memory:"): Stockage {
  const s = ouvrirStockage(chemin);
  OUVERTS.push(s);
  migrer(s);
  return s;
}

afterEach(() => {
  for (const s of OUVERTS.splice(0)) {
    try {
      s.fermer();
    } catch {
      // déjà fermée
    }
  }
  for (const d of DOSSIERS.splice(0)) rmSync(d, { recursive: true, force: true });
});

function outils(maintenant = "2026-11-04T10:00:00.000Z"): Outils {
  let n = 0;
  return { horloge: () => new Date(maintenant), genererId: () => `id-${++n}` };
}

function coeurRattache(s: Stockage, maintenant?: string): CoeurCaisse {
  const c = new CoeurCaisse(s, outils(maintenant));
  c.rattacher({ structureId: "ph1" });
  return c;
}

function fiche(i: number, champs: Partial<FicheSynchro> = {}): FicheSynchro {
  return {
    stockId: `s${i}`,
    medicamentId: `m${i}`,
    nom: `Produit ${String(i).padStart(5, "0")}`,
    nomGenerique: null,
    categorie: "ANTALGIQUE",
    formes: ["COMPRIME"],
    ordonnanceRequise: false,
    prixUnitaire: 5000,
    prixUnite: null,
    coefficientBoite: 1,
    uniteMinimale: "UNITE",
    deconditionnable: false,
    quantite: 40,
    quantiteARegulariser: 0,
    lots: [
      {
        id: `l${i}`,
        numeroLot: `N${i}`,
        dateExpiration: "2027-06-30",
        dateReception: "2026-10-01T08:00:00.000Z",
        coefficientReception: 1,
        solde: 40,
        lotTechnique: false,
      },
    ],
    ...champs,
  };
}

function photo(fiches: FicheSynchro[], champs: Partial<Photographie["poste"]> = {}): Photographie {
  return {
    pharmacie: { id: "ph1", nom: "Pharmacie de Kaloum", adresse: null, ville: "Conakry", telephone: null, logoUrl: null },
    pointDeVente: { id: "pv1", ordre: 1 },
    poste: { id: "po1", code: "D1", libelle: "Comptoir", sequenceAppliquee: 0, sequenceMaxRecue: 0, plages: [], ...champs },
    parametres: {
      horizonsPeremptionJours: [90, 30, 7],
      seuilEcartCaisse: 5000,
      seuilAvertissementPrixPct: 20,
      seuilStockBas: 5,
      taillePlageTickets: 500,
      seuilRechargementPlagePct: 20,
      debutCaisse: "2026-10-01T00:00:00.000Z",
    },
    modesPaiement: [{ code: "ESPECES", libelle: "Espèces", comptagePhysique: true, referenceAutorisee: false, ordre: 1 }],
    coupures: [{ devise: "GNF", valeurFaciale: 20000, type: "BILLET", ordre: 1 }],
    fiches,
  };
}

function sortie(s: Stockage, venteId: string, sequence: number, stockId: string, lotId: string | null, quantiteUm: number) {
  s.executer("INSERT INTO sorties_stock (venteId, sequence, stockId, lotId, quantiteUm) VALUES (?, ?, ?, ?, ?)", [
    venteId,
    sequence,
    stockId,
    lotId,
    quantiteUm,
  ]);
}

describe("schéma et stockage", () => {
  it("base neuve à la dernière version, migration rejouée sans erreur", () => {
    const s = base();
    expect(VERSION_SCHEMA).toBe(2);
    expect(s.lireUn<{ user_version: number }>("PRAGMA user_version")?.user_version).toBe(2);
    expect(() => migrer(s)).not.toThrow();
    expect(s.lire("SELECT id FROM etat_poste")).toHaveLength(1);
  });

  it("migration v1 vers v2 sur une base qui contient des données : rien n'est perdu, valeurs par défaut posées", () => {
    const s = ouvrirStockage(":memory:");
    OUVERTS.push(s);
    migrer(s, 1);
    expect(s.lireUn<{ user_version: number }>("PRAGMA user_version")?.user_version).toBe(1);
    s.executer("UPDATE etat_poste SET structureId = 'ph1', posteId = 'po1', posteCode = 'D1', prochaineSequence = 4, prochainSecours = 3 WHERE id = 1");
    s.executer("INSERT INTO sessions (id, utilisateurId, utilisateurNom, statut, jourMetier, ouverteLe, adoptee) VALUES ('s-ancienne', 'u1', 'Mariama', 'OUVERTE', '2026-11-03', '2026-11-03T08:00:00.000Z', 0)");
    s.executer("INSERT INTO ventes (id, sequence, sessionId, jourMetier, numero, total, document, createdAt) VALUES ('v-ancienne', 3, 's-ancienne', '2026-11-03', 'T1-0000007', 5000, '{}', '2026-11-03T09:00:00.000Z')");
    s.executer("INSERT INTO paiements_locaux (venteId, sessionId, mode, montant) VALUES ('v-ancienne', 's-ancienne', 'ESPECES', 5000)");
    s.executer("INSERT INTO plages (id, debut, fin, dernierUtilise) VALUES ('p1', 1, 500, 7)");
    s.executer("INSERT INTO evenements (sequence, evenementId, type, horodatageLocal, utilisateurId, corps, statut) VALUES (3, 'e3', 'VENTE', '2026-11-03T09:00:00.000Z', 'u1', '{}', 'A_ENVOYER')");

    migrer(s);

    expect(s.lireUn<{ user_version: number }>("PRAGMA user_version")?.user_version).toBe(2);
    expect(s.lireUn("SELECT id, statut, adoptee, ouverteAutomatiquement, bilanFige FROM sessions")).toEqual({
      id: "s-ancienne",
      statut: "OUVERTE",
      adoptee: 0,
      ouverteAutomatiquement: 0,
      bilanFige: null,
    });
    expect(s.lireUn("SELECT id, numero, total, typePiece FROM ventes")).toEqual({ id: "v-ancienne", numero: "T1-0000007", total: 5000, typePiece: "VENTE" });
    expect(s.lireUn("SELECT dernierUtilise FROM plages")).toEqual({ dernierUtilise: 7 });
    expect(s.lireUn("SELECT prochaineSequence, prochainSecours FROM etat_poste")).toEqual({ prochaineSequence: 4, prochainSecours: 3 });
    expect(s.lire("SELECT sequence FROM evenements")).toEqual([{ sequence: 3 }]);
    expect(() => migrer(s)).not.toThrow();
    expect(new CoeurCaisse(s, outils()).sessionOuverte()?.id).toBe("s-ancienne");
  });

  it("une base plus récente que l'application est refusée sans rien écrire", () => {
    const s = ouvrirStockage(":memory:");
    OUVERTS.push(s);
    s.executer("PRAGMA user_version = 99");
    expect(() => migrer(s)).toThrow(/plus récente/);
    expect(s.lire("SELECT name FROM sqlite_master WHERE type = 'table'")).toHaveLength(0);
  });

  it("fichier : WAL, synchronous=FULL, clés étrangères, busy_timeout, quick_check vrai", () => {
    const dossier = mkdtempSync(join(tmpdir(), "mc-coeur-"));
    DOSSIERS.push(dossier);
    const s = base(join(dossier, "caisse.db"));
    expect(Object.values(s.lire<Record<string, unknown>>("PRAGMA journal_mode")[0])[0]).toBe("wal");
    expect(Object.values(s.lire<Record<string, unknown>>("PRAGMA synchronous")[0])[0]).toBe(2);
    expect(Object.values(s.lire<Record<string, unknown>>("PRAGMA foreign_keys")[0])[0]).toBe(1);
    expect(Object.values(s.lire<Record<string, unknown>>("PRAGMA busy_timeout")[0])[0]).toBe(5000);
    expect(controlerBase(s)).toBe(true);
  });

  it("exigerWal : refuse tout mode autre que wal sur disque, accepte la mémoire", () => {
    expect(() => exigerWal("wal", "C:/caisse.db")).not.toThrow();
    expect(() => exigerWal("memory", ":memory:")).not.toThrow();
    expect(() => exigerWal("delete", "C:/caisse.db")).toThrow(/WAL/);
    expect(() => exigerWal(undefined, "C:/caisse.db")).toThrow(/WAL/);
  });

  it("controlerBase : vrai sur une base saine en mémoire", () => {
    expect(controlerBase(base())).toBe(true);
  });

  it("transaction : une exception annule tout", () => {
    const s = base();
    expect(() =>
      s.transaction(() => {
        s.executer("UPDATE etat_poste SET structureId = 'x' WHERE id = 1");
        throw new Error("boum");
      }),
    ).toThrow("boum");
    expect(s.lireUn<{ structureId: string | null }>("SELECT structureId FROM etat_poste")?.structureId).toBeNull();
  });
});

describe("CoeurCaisse", () => {
  it("appareilId créé une fois, jamais changé", () => {
    const s = base();
    const c = coeurRattache(s);
    expect(c.appareilId()).toBe("id-1");
    expect(c.appareilId()).toBe("id-1");
    expect(new CoeurCaisse(s, outils()).appareilId()).toBe("id-1");
  });

  it("rattachement à une seule pharmacie (D741)", () => {
    const c = new CoeurCaisse(base(), outils());
    expect(c.structureRattachee()).toBeNull();
    c.rattacher({ structureId: "ph1" });
    c.rattacher({ structureId: "ph1" });
    expect(c.structureRattachee()).toBe("ph1");
    expect(() => c.rattacher({ structureId: "ph2" })).toThrow();
    expect(() => c.appliquerPhotographie({ ...photo([]), pharmacie: { ...photo([]).pharmacie, id: "ph2" } }, null, null)).toThrow();
  });

  it("photographie refusée sans rattachement, sans aucune écriture", () => {
    const s = base();
    const c = new CoeurCaisse(s, outils());
    expect(() => c.appliquerPhotographie(photo([fiche(1)]), "etag", null)).toThrow(/rattaché/);
    expect(c.aUnCatalogue()).toBe(false);
    expect(s.lire("SELECT stockId FROM fiches")).toHaveLength(0);
    expect(s.lireUn<{ posteId: string | null; etag: string | null }>("SELECT posteId, etag FROM etat_poste")).toEqual({
      posteId: null,
      etag: null,
    });
  });

  it("photographie d'un autre poste de la même pharmacie refusée, sans écriture", () => {
    const s = base();
    const c = coeurRattache(s);
    c.appliquerPhotographie(photo([fiche(1)], { sequenceAppliquee: 5, sequenceMaxRecue: 56 }), "e1", null);
    const avant = s.lireUn("SELECT * FROM etat_poste");
    const autre = photo([fiche(2)], { sequenceMaxRecue: 99 });
    autre.poste = { ...autre.poste, id: "po2", code: "D2" };
    expect(() => c.appliquerPhotographie(autre, "e2", null)).toThrow(/autre poste/);
    expect(s.lireUn("SELECT * FROM etat_poste")).toEqual(avant);
    expect(c.lireStock().map((f) => f.id)).toEqual(["s1"]);
  });

  it("photographie : stock lu conforme, sequenceMaxRecue 40 donne prochaineSequence 41", () => {
    const s = base();
    const c = coeurRattache(s);
    c.rattacher({ structureId: "ph1" });
    expect(c.aUnCatalogue()).toBe(false);
    expect(c.lireReferentiels()).toBeNull();
    c.appliquerPhotographie(photo([fiche(1), fiche(2, { quantite: 0, lots: [] })], { sequenceMaxRecue: 40, sequenceAppliquee: 12 }), 'W/"abc"', null);

    expect(c.aUnCatalogue()).toBe(true);
    expect(s.lireUn<{ prochaineSequence: number; sequenceAppliquee: number; etag: string }>("SELECT * FROM etat_poste")).toMatchObject({
      prochaineSequence: 41,
      sequenceAppliquee: 12,
      etag: 'W/"abc"',
    });
    const stock = c.lireStock();
    expect(stock.map((f) => f.id)).toEqual(["s1", "s2"]);
    expect(stock[0]).toMatchObject({
      id: "s1",
      medicamentId: "m1",
      structureId: "ph1",
      quantite: 40,
      quantiteARegulariser: 0,
      quantiteVendable: 40,
      prixUnitaire: 5000,
      prixUnite: null,
      uniteMinimale: "UNITE",
      coefficientBoite: 1,
      deconditionnable: false,
      disponible: true,
      dateExpiration: "2027-06-30",
      medicament: { id: "m1", nom: "Produit 00001", categorie: "ANTALGIQUE", formes: ["COMPRIME"], ordonnanceRequise: false },
    });
    expect(stock[0].lots).toEqual([
      { id: "l1", numeroLot: "N1", dateExpiration: "2027-06-30", quantite: 40, lotTechnique: false, coefficientReception: 1 },
    ]);
    expect(stock[1]).toMatchObject({ quantite: 0, disponible: false, lots: [] });
    expect(c.lireReferentiels()?.modesPaiement[0].code).toBe("ESPECES");

    // Un poste réinstallé ne repart jamais plus bas.
    c.appliquerPhotographie(photo([fiche(1)], { sequenceMaxRecue: 3, sequenceAppliquee: 3 }), null, null);
    expect(s.lireUn<{ prochaineSequence: number }>("SELECT prochaineSequence FROM etat_poste")?.prochaineSequence).toBe(41);
  });

  it("prix absent : 0 sans null ; unité inconnue : UNITE", () => {
    const c = coeurRattache(base());
    c.appliquerPhotographie(photo([fiche(1, { prixUnitaire: null, uniteMinimale: "FLACON" })]), null, null);
    expect(c.lireStock()[0]).toMatchObject({ prixUnitaire: 0, uniteMinimale: "UNITE" });
  });

  it("pas de double décompte : seule la sortie de séquence 6 compte quand sequenceAppliquee vaut 5", () => {
    const s = base();
    const c = coeurRattache(s);
    c.appliquerPhotographie(photo([fiche(1)], { sequenceAppliquee: 5, sequenceMaxRecue: 6 }), null, null);
    sortie(s, "v5", 5, "s1", "l1", 10);
    sortie(s, "v6", 6, "s1", "l1", 3);
    const f = c.lireStock()[0];
    expect(f.quantite).toBe(37);
    expect(f.lots?.[0].quantite).toBe(37);
  });

  it("sortie provisoire : 0 affiché et quantité à régulariser", () => {
    const s = base();
    const c = coeurRattache(s);
    c.appliquerPhotographie(photo([fiche(1, { quantite: 5, lots: [{ ...fiche(1).lots[0], solde: 5 }] })]), null, null);
    sortie(s, "v1", 1, "s1", "l1", 5);
    sortie(s, "v2", 2, "s1", null, 2);
    expect(c.lireStock()[0]).toMatchObject({ quantite: 0, quantiteARegulariser: 2, quantiteVendable: 0, disponible: false });
  });

  it("seconde photographie : dernierUtilise et plage entamée conservés, nouvelle plage ajoutée", () => {
    const s = base();
    const c = coeurRattache(s);
    c.appliquerPhotographie(photo([fiche(1)], { plages: [{ id: "p1", debut: 1, fin: 500 }] }), null, null);
    s.executer("UPDATE plages SET dernierUtilise = 120 WHERE id = 'p1'");
    c.appliquerPhotographie(
      photo([fiche(1)], {
        plages: [
          { id: "p1", debut: 1, fin: 500 },
          { id: "p2", debut: 501, fin: 1000 },
        ],
      }),
      null,
      null,
    );
    expect(s.lire("SELECT id, debut, fin, dernierUtilise FROM plages ORDER BY debut")).toEqual([
      { id: "p1", debut: 1, fin: 500, dernierUtilise: 120 },
      { id: "p2", debut: 501, fin: 1000, dernierUtilise: null },
    ]);
    // Une plage absente de la réponse reste tant qu'il lui reste des numéros, part quand elle est épuisée.
    c.appliquerPhotographie(photo([fiche(1)], { plages: [{ id: "p2", debut: 501, fin: 1000 }] }), null, null);
    expect(s.lire<{ id: string }>("SELECT id FROM plages ORDER BY debut").map((p) => p.id)).toEqual(["p1", "p2"]);
    s.executer("UPDATE plages SET dernierUtilise = 500 WHERE id = 'p1'");
    c.appliquerPhotographie(photo([fiche(1)], { plages: [{ id: "p2", debut: 501, fin: 1000 }] }), null, null);
    expect(s.lire<{ id: string }>("SELECT id FROM plages").map((p) => p.id)).toEqual(["p2"]);
  });

  it("écart d'heure du serveur gardé quand la date est donnée", () => {
    const s = base();
    const c = coeurRattache(s, "2026-11-04T10:00:00.000Z");
    c.appliquerPhotographie(photo([]), null, new Date("2026-11-04T10:00:07.000Z"));
    expect(s.lireUn<{ heureServeurEcartMs: number }>("SELECT heureServeurEcartMs FROM etat_poste")?.heureServeurEcartMs).toBe(7000);
    c.appliquerPhotographie(photo([]), null, null);
    expect(s.lireUn<{ heureServeurEcartMs: number }>("SELECT heureServeurEcartMs FROM etat_poste")?.heureServeurEcartMs).toBe(7000);
  });

  it("plaquette (D723) : uniteMinimale PLAQUETTE, coefficient 10, reliquat", () => {
    const s = base();
    const c = coeurRattache(s);
    c.appliquerPhotographie(
      photo([
        fiche(1, {
          uniteMinimale: "PLAQUETTE",
          coefficientBoite: 10,
          deconditionnable: true,
          prixUnite: 700,
          quantite: 26,
          lots: [{ ...fiche(1).lots[0], solde: 26, coefficientReception: 10 }],
        }),
      ]),
      null,
      null,
    );
    sortie(s, "v1", 1, "s1", "l1", 7);
    const f = c.lireStock()[0];
    expect(f).toMatchObject({ uniteMinimale: "PLAQUETTE", coefficientBoite: 10, prixUnite: 700, deconditionnable: true, quantite: 19 });
    expect(f.reliquat).toEqual([{ lotId: "l1", unitesRestantes: 9 }]);
  });

  it("jour() en UTC quelle que soit TZ", () => {
    const initial = process.env.TZ;
    try {
      for (const tz of ["Pacific/Auckland", "America/Los_Angeles", "Africa/Conakry"]) {
        process.env.TZ = tz;
        expect(new CoeurCaisse(base(), outils("2026-11-04T23:30:00.000Z")).jour()).toBe("2026-11-04");
        expect(new CoeurCaisse(base(), outils("2026-11-05T00:30:00.000Z")).jour()).toBe("2026-11-05");
      }
    } finally {
      if (initial === undefined) delete process.env.TZ;
      else process.env.TZ = initial;
    }
  });

  it("aucune colonne de jeton dans la base après un scénario", () => {
    const s = base();
    const c = coeurRattache(s);
    c.appareilId();
    c.rattacher({ structureId: "ph1" });
    c.appliquerPhotographie(photo([fiche(1)]), null, null);
    const tables = s.lire<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'");
    expect(tables.length).toBeGreaterThan(10);
    for (const { name } of tables) {
      for (const colonne of s.lire<{ name: string }>(`PRAGMA table_info(${name})`)) {
        expect(colonne.name).not.toMatch(/token|jeton|refresh/i);
      }
    }
  });

  it("performance : 5 000 fiches et 500 sorties, lireStock en moins de 150 ms (médiane de 5)", () => {
    const s = base();
    const c = coeurRattache(s);
    const fiches = Array.from({ length: 5000 }, (_, i) => fiche(i + 1));
    c.appliquerPhotographie(photo(fiches, { sequenceAppliquee: 0 }), null, null);
    s.transaction(() => {
      for (let i = 0; i < 500; i++) sortie(s, `v${i}`, i + 1, `s${i + 1}`, `l${i + 1}`, 2);
    });

    const durees: number[] = [];
    for (let i = 0; i < 5; i++) {
      const debut = performance.now();
      const stock = c.lireStock();
      durees.push(performance.now() - debut);
      expect(stock).toHaveLength(5000);
    }
    durees.sort((a, b) => a - b);
    const mediane = durees[2];
    console.log(`lireStock 5000 fiches, 500 sorties : médiane ${mediane.toFixed(1)} ms (mesures ${durees.map((d) => d.toFixed(1)).join(", ")})`);
    expect(c.lireStock()[0].quantite).toBe(38);
    expect(mediane).toBeLessThan(150);
  });
});

describe("base en retard sur le serveur : aucun numéro réutilisé (D752)", () => {
  const vendeur = { id: "u1", nom: "Mariama Diallo", superviseur: false };
  const gros = [fiche(1, { quantite: 1000, lots: [{ ...fiche(1).lots[0], solde: 1000 }] })];
  // « v2 » donne l'UUID `…0002` : le cœur exige un UUID pour la clé de vente.
  const vendre = (c: CoeurCaisse, nom: string) =>
    c.enregistrerVente({ lignes: [{ stockId: "s1", quantite: 1 }] }, `00000000-0000-4000-8000-${nom.replace(/\D/g, "").padStart(12, "0")}`, vendeur);
  const plagesLocales = (s: Stockage) =>
    s.lire<{ id: string; dernierUtilise: number | null; fin: number }>("SELECT id, dernierUtilise, fin FROM plages ORDER BY debut");
  const P1 = { id: "p1", debut: 1, fin: 500 };
  const P2 = { id: "p2", debut: 501, fin: 1000 };

  it("1. marche normale : sequenceMaxRecue 40 pour prochaineSequence 41, rien d'abandonné", () => {
    const s = base();
    const c = coeurRattache(s);
    c.appliquerPhotographie(photo(gros, { sequenceMaxRecue: 40, plages: [P1] }), null, null);
    s.executer("UPDATE plages SET dernierUtilise = 5 WHERE id = 'p1'");
    c.appliquerPhotographie(photo(gros, { sequenceMaxRecue: 40, plages: [P1] }), null, null);
    expect(plagesLocales(s)).toEqual([{ id: "p1", dernierUtilise: 5, fin: 500 }]);
    expect(vendre(c, "v1").numero).toBe("T1-0000006");
  });

  it("2. poste neuf : sequenceMaxRecue 0, plage utilisable depuis debut", () => {
    const s = base();
    const c = coeurRattache(s);
    c.appliquerPhotographie(photo(gros, { sequenceMaxRecue: 0, plages: [P1] }), null, null);
    expect(plagesLocales(s)).toEqual([{ id: "p1", dernierUtilise: null, fin: 500 }]);
    expect(vendre(c, "v1").numero).toBe("T1-0000001");
  });

  it("3. base neuve, une plage : abandonnée, numéro de secours 41, puis plage neuve utilisée", () => {
    const s = base();
    const c = coeurRattache(s);
    c.appliquerPhotographie(photo(gros, { sequenceMaxRecue: 40, plages: [P1] }), null, null);
    expect(plagesLocales(s)).toEqual([{ id: "p1", dernierUtilise: 500, fin: 500 }]);
    expect(s.lireUn<{ prochainSecours: number; prochaineSequence: number }>("SELECT prochainSecours, prochaineSequence FROM etat_poste")).toEqual({
      prochainSecours: 41,
      prochaineSequence: 41,
    });
    expect(c.etatLocal().plageEpuisee).toBe(true);
    expect(vendre(c, "v1").numero).toBe("S1-D1-41");
    expect(s.lire<{ sequence: number }>("SELECT sequence FROM evenements ORDER BY sequence").map((e) => e.sequence)).toEqual([41, 42]);

    // Le cycle suivant apporte une plage neuve : elle n'est pas abandonnée à son tour.
    c.appliquerPhotographie(photo(gros, { sequenceMaxRecue: 40, plages: [P1, P2] }), null, null);
    expect(plagesLocales(s)).toEqual([
      { id: "p1", dernierUtilise: 500, fin: 500 },
      { id: "p2", dernierUtilise: null, fin: 1000 },
    ]);
    expect(vendre(c, "v2").numero).toBe("T1-0000501");
  });

  it("4. base neuve, deux plages : la première vente prend le debut de la plus récente", () => {
    const s = base();
    const c = coeurRattache(s);
    c.appliquerPhotographie(photo(gros, { sequenceMaxRecue: 40, plages: [P1, P2] }), null, null);
    expect(plagesLocales(s)).toEqual([
      { id: "p1", dernierUtilise: 500, fin: 500 },
      { id: "p2", dernierUtilise: null, fin: 1000 },
    ]);
    expect(vendre(c, "v1").numero).toBe("T1-0000501");
  });

  it("5. copie restaurée : prochaineSequence 10, sequenceMaxRecue 40, plage entamée abandonnée, événement suivant en 41", () => {
    const s = base();
    const c = coeurRattache(s);
    c.appliquerPhotographie(photo(gros, { sequenceMaxRecue: 9, plages: [P1] }), null, null);
    s.executer("UPDATE plages SET dernierUtilise = 120 WHERE id = 'p1'");
    expect(s.lireUn<{ prochaineSequence: number }>("SELECT prochaineSequence FROM etat_poste")?.prochaineSequence).toBe(10);

    c.appliquerPhotographie(photo(gros, { sequenceMaxRecue: 40, plages: [P1] }), null, null);
    expect(plagesLocales(s)).toEqual([{ id: "p1", dernierUtilise: 500, fin: 500 }]);
    const v = vendre(c, "v1");
    expect(v.numero).toBe("S1-D1-41");
    expect(s.lire<{ sequence: number }>("SELECT sequence FROM evenements ORDER BY sequence")[0].sequence).toBe(41);
  });

  it("6. photographie suivante redevenue normale : plage neuve entamée conservée, abandon non rejoué", () => {
    const s = base();
    const c = coeurRattache(s);
    c.appliquerPhotographie(photo(gros, { sequenceMaxRecue: 40, plages: [P1] }), null, null);
    vendre(c, "v1");
    c.appliquerPhotographie(photo(gros, { sequenceMaxRecue: 40, plages: [P1, P2] }), null, null);
    expect(vendre(c, "v2").numero).toBe("T1-0000501");
    c.appliquerPhotographie(photo(gros, { sequenceMaxRecue: 42, plages: [P1, P2] }), null, null);
    expect(plagesLocales(s)).toEqual([
      { id: "p1", dernierUtilise: 500, fin: 500 },
      { id: "p2", dernierUtilise: 501, fin: 1000 },
    ]);
    expect(vendre(c, "v3").numero).toBe("T1-0000502");
  });
});
