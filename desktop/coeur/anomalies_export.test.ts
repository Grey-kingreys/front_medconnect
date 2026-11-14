import { inflateRawSync } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { UtilisateurPoste } from "@/lib/caisse/contrat_desktop";
import { MAINTENANT, VENDEUR, base, coeurPret, fermerTout, fiche, photo, uuid } from "./aide_tests";
import { CoeurCaisse } from "./coeur";
import { Passerelle } from "./passerelle";
import { RefusCaisse } from "./refus";
import type { AnomalieSynchro } from "./types_synchro";

afterEach(fermerTout);

const anomalie = (id: string, plus: Partial<AnomalieSynchro> = {}): AnomalieSynchro => ({
  id,
  type: "ECART_INVENTAIRE",
  libelle: "Écart d'inventaire",
  statut: "OUVERTE",
  creeLe: "2026-11-02T09:00:00.000Z",
  pieceType: "INVENTAIRE",
  pieceId: "p1",
  details: { message: "Doliprane : 5 unités de moins que prévu." },
  attribueeA: null,
  traiteeLe: null,
  traiteePar: null,
  commentaireTraitement: null,
  rattachement: null,
  ...plus,
});

function coeurAvecAnomalies(liste: AnomalieSynchro[]) {
  const { s, c } = coeurPret();
  c.appliquerPhotographie({ ...photo([fiche(1)], { plages: [{ id: "p1", debut: 1, fin: 500 }] }), anomalies: liste }, null, null);
  return { s, c };
}

describe("anomalies hors ligne : lecture", () => {
  it("lit les anomalies ouvertes de la photographie, détails lisibles, et ouvertes comptées", () => {
    const { c } = coeurAvecAnomalies([anomalie("a1"), anomalie("a2", { type: "ECART_CAISSE" })]);
    const page = c.listerAnomalies({});
    expect(page).toMatchObject({ page: 1, parPage: 20, total: 2, ouvertes: 2 });
    expect(page.anomalies[0].details).toEqual({ message: "Doliprane : 5 unités de moins que prévu." });
    expect(c.listerAnomalies({ type: "ECART_CAISSE" }).anomalies.map((a) => a.id)).toEqual(["a2"]);
    expect(c.listerAnomalies({ statut: "TRAITEE" }).total).toBe(0);
  });

  it("pagine par 20", () => {
    const { c } = coeurAvecAnomalies(Array.from({ length: 25 }, (_, i) => anomalie(`a${i}`)));
    expect(c.listerAnomalies({ page: 2 }).anomalies).toHaveLength(5);
    expect(c.listerAnomalies({ page: 2 }).total).toBe(25);
  });

  it("une photographie d'un serveur plus ancien (sans anomalies) donne une liste vide", () => {
    const { c } = coeurPret();
    expect(c.listerAnomalies({}).total).toBe(0);
  });

  it("une nouvelle photographie remplace les anomalies", () => {
    const { c } = coeurAvecAnomalies([anomalie("a1")]);
    c.appliquerPhotographie({ ...photo([fiche(1)]), anomalies: [anomalie("a9")] }, null, null);
    expect(c.listerAnomalies({}).anomalies.map((a) => a.id)).toEqual(["a9"]);
  });
});

describe("anomalies hors ligne : traitement", () => {
  it("écrit la marque locale et l'événement ANOMALIE_TRAITEE ensemble, l'anomalie passe dans « Traitées »", () => {
    const { c } = coeurAvecAnomalies([anomalie("a1"), anomalie("a2")]);
    const r = c.traiterAnomalie("a1", "  Recompté au comptoir ", VENDEUR);
    expect(r).toMatchObject({ id: "a1", statut: "TRAITEE", commentaireTraitement: "Recompté au comptoir", traiteePar: { id: VENDEUR.id, nom: VENDEUR.nom } });
    const evenements = c.evenementsAEnvoyer(100);
    expect(evenements).toHaveLength(1);
    expect(evenements[0].type).toBe("ANOMALIE_TRAITEE");
    expect(JSON.parse(evenements[0].corps as unknown as string)).toEqual({ anomalieId: "a1", commentaire: "Recompté au comptoir" });

    expect(c.listerAnomalies({}).anomalies.map((a) => a.id)).toEqual(["a2"]);
    expect(c.listerAnomalies({}).ouvertes).toBe(1);
    const traitees = c.listerAnomalies({ statut: "TRAITEE" });
    expect(traitees.anomalies.map((a) => [a.id, a.statut, a.commentaireTraitement])).toEqual([["a1", "TRAITEE", "Recompté au comptoir"]]);
  });

  it("refuse une anomalie déjà traitée sur le poste, une anomalie inconnue et un commentaire trop court, sans rien écrire", () => {
    const { c } = coeurAvecAnomalies([anomalie("a1")]);
    const refus = (f: () => unknown) => {
      try {
        f();
      } catch (e) {
        expect(e).toBeInstanceOf(RefusCaisse);
        return e as RefusCaisse;
      }
      throw new Error("Un refus était attendu.");
    };
    expect(refus(() => c.traiterAnomalie("a1", "ab", VENDEUR)).code).toBe("MOTIF_REQUIS");
    expect(refus(() => c.traiterAnomalie("inconnue", "Vérifié", VENDEUR)).code).toBe("ANOMALIE_INTROUVABLE");
    expect(c.evenementsAEnvoyer(100)).toHaveLength(0);
    c.traiterAnomalie("a1", "Vérifié", VENDEUR);
    expect(refus(() => c.traiterAnomalie("a1", "Encore", VENDEUR)).code).toBe("ANOMALIE_DEJA_TRAITEE");
    expect(c.evenementsAEnvoyer(100)).toHaveLength(1);
  });

  it("la marque masque l'anomalie jusqu'à une photographie postérieure, qui fait foi (rejet : elle réapparaît)", () => {
    let maintenant = MAINTENANT;
    let n = 0;
    const s = base();
    const c = new CoeurCaisse(s, { horloge: () => new Date(maintenant), genererId: () => uuid(++n, "aaaaaaaa") });
    c.rattacher({ structureId: "ph1" });
    c.appliquerPhotographie({ ...photo([fiche(1)]), anomalies: [anomalie("a1")] }, null, null);
    maintenant = "2026-11-04T10:05:00.000Z";
    c.traiterAnomalie("a1", "Vérifié", VENDEUR);
    // Le serveur a appliqué l'événement, mais aucune photographie n'est encore arrivée : elle reste masquée.
    expect(c.listerAnomalies({}).total).toBe(0);
    // Réponse 304 (catalogue inchangé) : ne compte pas comme une photographie des anomalies.
    maintenant = "2026-11-04T10:06:00.000Z";
    c.confirmerPhotographie(null);
    expect(c.listerAnomalies({}).total).toBe(0);
    // Photographie postérieure sans l'anomalie (traitée par le serveur) : absente, et plus de marque active.
    maintenant = "2026-11-04T10:07:00.000Z";
    c.appliquerPhotographie({ ...photo([fiche(1)]), anomalies: [] }, null, null);
    expect(c.listerAnomalies({}).total).toBe(0);
    expect(c.listerAnomalies({ statut: "TRAITEE" }).total).toBe(0);
    // Rejet côté serveur : la photographie suivante la montre encore ouverte, elle réapparaît et se retraite.
    maintenant = "2026-11-04T10:08:00.000Z";
    c.appliquerPhotographie({ ...photo([fiche(1)]), anomalies: [anomalie("a1")] }, null, null);
    expect(c.listerAnomalies({}).anomalies.map((a) => a.id)).toEqual(["a1"]);
    expect(() => c.traiterAnomalie("a1", "Cette fois", VENDEUR)).not.toThrow();
  });
});

const UTILISATEUR: UtilisateurPoste = { id: VENDEUR.id, nom: VENDEUR.nom, structureId: "ph1", permissions: ["caisse:utiliser", "anomalie:gerer", "stock:read"] };

function monter(c: CoeurCaisse, enregistrerFichier?: (n: string, b: Buffer) => Promise<boolean>) {
  const apresVente = vi.fn();
  const p = new Passerelle({ coeur: c, apresVente, apresRattachement: vi.fn(), etatChange: vi.fn(), enregistrerFichier, journal: vi.fn() });
  return { p, apresVente };
}

describe("passerelle : anomalie et export", () => {
  it("lister et traiter passent par le pont, avec la permission anomalie:gerer", async () => {
    const { c } = coeurAvecAnomalies([anomalie("a1")]);
    const { p, apresVente } = monter(c);
    p.confirmerIdentite({ ...UTILISATEUR, permissions: ["caisse:utiliser"] });
    expect(await p.appeler("lister", ["ph1", {}], "anomalie")).toMatchObject({ ok: false, status: 403 });
    p.confirmerIdentite(UTILISATEUR);
    expect(await p.appeler("lister", ["ph1", { statut: "OUVERTE" }], "anomalie")).toMatchObject({ ok: true, data: { total: 1 } });
    expect(await p.appeler("traiter", ["ph1", "a1", { commentaire: "Vérifié" }], "anomalie")).toMatchObject({ ok: true, message: "Anomalie traitée sur ce poste." });
    expect(apresVente).toHaveBeenCalled();
    expect(await p.appeler("traiter", ["ph1", "a1", { commentaire: "Vérifié" }], "anomalie")).toMatchObject({ ok: false, status: 409, code: "ANOMALIE_DEJA_TRAITEE" });
    expect(await p.appeler("traiter", ["ph1", "a1", { commentaire: "x", en: "trop" }], "anomalie")).toMatchObject({ ok: false, status: 400, code: "VALIDATION" });
  });

  it("l'export exige stock:read, génère le classeur et l'enregistre par la boîte « Enregistrer sous »", async () => {
    const { c } = coeurAvecAnomalies([]);
    const enregistrer = vi.fn().mockResolvedValue(true);
    const { p } = monter(c, enregistrer);
    p.confirmerIdentite({ ...UTILISATEUR, permissions: ["caisse:utiliser"] });
    expect(await p.appeler("exporter", ["ph1", {}], "stock")).toMatchObject({ ok: false, status: 403 });
    p.confirmerIdentite(UTILISATEUR);
    const r = await p.appeler("exporter", ["ph1", { filtre: "tous" }], "stock");
    expect(r).toMatchObject({ ok: true, data: { enregistre: true, nomFichier: "stock-pharmacie-de-kaloum-2026-11-04.xlsx" } });
    expect(enregistrer).toHaveBeenCalledWith("stock-pharmacie-de-kaloum-2026-11-04.xlsx", expect.any(Buffer));
    enregistrer.mockResolvedValue(false);
    expect(await p.appeler("exporter", ["ph1", {}], "stock")).toMatchObject({ ok: true, data: { enregistre: false }, message: "Export annulé." });
  });
});

/** Lecteur minimal d'archive ZIP pour relire le classeur produit. */
function lireZip(contenu: Buffer): Map<string, string> {
  const fin = contenu.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const nombre = contenu.readUInt16LE(fin + 10);
  let o = contenu.readUInt32LE(fin + 16);
  const fichiers = new Map<string, string>();
  for (let i = 0; i < nombre; i++) {
    const tailleNom = contenu.readUInt16LE(o + 28);
    const local = contenu.readUInt32LE(o + 42);
    const nom = contenu.subarray(o + 46, o + 46 + tailleNom).toString("utf8");
    const compresse = contenu.readUInt32LE(o + 20);
    const debut = local + 30 + contenu.readUInt16LE(local + 26) + contenu.readUInt16LE(local + 28);
    fichiers.set(nom, inflateRawSync(contenu.subarray(debut, debut + compresse)).toString("utf8"));
    o += 46 + tailleNom;
  }
  return fichiers;
}

describe("export du stock sur le poste : classeur", () => {
  it("colonnes du modèle, boîtes entières, notes, date Excel, aucun coût, filtre appliqué", () => {
    const { c } = coeurPret(
      [
        fiche(1, { nom: "Amoxicilline & Co", coefficientBoite: 10, uniteMinimale: "GELULE", quantite: 55, lots: [{ id: "l1", numeroLot: "L1", dateExpiration: "2027-06-30", dateReception: "2026-10-01T08:00:00.000Z", coefficientReception: 10, solde: 55, lotTechnique: false }] }),
        fiche(2, { nom: "Coartem", quantite: 0, lots: [], qualifie: false }),
      ],
    );
    const tout = c.preparerExportStock({});
    expect(tout.nomFichier).toBe("stock-pharmacie-de-kaloum-2026-11-04.xlsx");
    const f = lireZip(tout.contenu);
    expect([...f.keys()]).toEqual(["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/worksheets/sheet1.xml"]);
    expect(f.get("xl/workbook.xml")).toContain('name="Stock"');
    const feuille = f.get("xl/worksheets/sheet1.xml") as string;
    for (const titre of ["Médicament", "Quantité (boîtes)", "Prix de la boîte (GNF)", "Date d'expiration", "Coût d'achat de la boîte (GNF)", "Notes"]) {
      expect(feuille).toContain(titre);
    }
    expect(feuille).toContain("Amoxicilline &amp; Co");
    // 55 gélules en boîtes de 10 : 5 boîtes entières, reste de 5 dans les notes ; date 2027-06-30 = série 46568
    expect(feuille).toContain('<c r="B2"><v>5</v></c>');
    expect(feuille).toContain("Boîte entamée : 5 gélules en plus");
    expect(feuille).toContain('<c r="D2" s="2"><v>46568</v></c>');
    // Aucune cellule de la colonne de coût (F)
    expect(feuille).not.toMatch(/r="F[2-9]/);
    expect(feuille).toContain("Coartem");

    const aQualifier = lireZip(c.preparerExportStock({ filtre: "qualifier" }).contenu).get("xl/worksheets/sheet1.xml") as string;
    expect(aQualifier).toContain("Coartem");
    expect(aQualifier).not.toContain("Amoxicilline");
  });

  it("l'export reflète le stock local (sortie faite hors ligne)", () => {
    const { c } = coeurPret([fiche(1, { nom: "Doliprane", quantite: 40 })]);
    c.sortirStock({ id: uuid(1, "cccccccc"), stockId: "s1", lotId: "l1", unite: "UNITE", quantite: 15, raison: "CASSE" }, VENDEUR);
    const feuille = lireZip(c.preparerExportStock({}).contenu).get("xl/worksheets/sheet1.xml") as string;
    expect(feuille).toContain('<c r="B2"><v>25</v></c>');
  });
});
