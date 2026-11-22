import { afterEach, describe, expect, it } from "vitest";
import { TAILLE_MAX_FICHIER_DIFFERE } from "@/lib/api_pharmacie";
import { VENDEUR, coeurPret, evenements, fermerTout, photo, uuid } from "./aide_tests";
import { RefusCaisse } from "./refus";
import type { ImportDiffereSynchro } from "./types_synchro";

afterEach(fermerTout);

const ID = (n: number) => uuid(n, "ffffffff");
const base64 = (octets: number) => Buffer.alloc(octets, 1).toString("base64");

const corps = (n: number, plus: Record<string, unknown> = {}) => ({
  id: ID(n),
  mode: "livraison" as const,
  nomFichier: "livraison.xlsx",
  contenuBase64: base64(300),
  ...plus,
});

function refus(f: () => unknown): RefusCaisse {
  try {
    f();
  } catch (e) {
    expect(e).toBeInstanceOf(RefusCaisse);
    return e as RefusCaisse;
  }
  throw new Error("Un refus était attendu.");
}

describe("import Excel mis de côté hors ligne", () => {
  it("un seul événement dans le journal, le stock local ne bouge pas", () => {
    const { s, c } = coeurPret();
    const avant = c.lireStock()[0].quantite;
    const r = c.mettreImportDeCote(corps(1), VENDEUR);
    expect(r.import).toMatchObject({ id: ID(1), mode: "livraison", statut: "EN_ATTENTE", resultat: null });
    expect(r.dejaMisDeCote).toBe(false);
    const evt = evenements(s);
    expect(evt).toHaveLength(1);
    expect(evt[0].type).toBe("IMPORT_STOCK_FICHIER");
    expect(evt[0].corps).toEqual({ id: ID(1), mode: "livraison", nomFichier: "livraison.xlsx", contenuBase64: base64(300) });
    expect(c.lireStock()[0].quantite).toBe(avant);
    expect(s.lire("SELECT * FROM mouvements_locaux")).toEqual([]);
  });

  it("rejoué avec le même identifiant : rien de plus n'est écrit", () => {
    const { s, c } = coeurPret();
    c.mettreImportDeCote(corps(1), VENDEUR);
    const r = c.mettreImportDeCote(corps(1), VENDEUR);
    expect(r.dejaMisDeCote).toBe(true);
    expect(evenements(s)).toHaveLength(1);
  });

  it("refuse un fichier trop gros, un contenu illisible, un nom sans .xlsx ou un identifiant invalide, sans rien écrire", () => {
    const { s, c } = coeurPret();
    expect(refus(() => c.mettreImportDeCote(corps(1, { contenuBase64: base64(TAILLE_MAX_FICHIER_DIFFERE + 10) }), VENDEUR)).message).toContain("1,4 Mo");
    expect(refus(() => c.mettreImportDeCote(corps(2, { contenuBase64: "pas du base64 !" }), VENDEUR)).code).toBe("VALIDATION");
    expect(refus(() => c.mettreImportDeCote(corps(3, { nomFichier: "livraison.csv" }), VENDEUR)).code).toBe("VALIDATION");
    expect(refus(() => c.mettreImportDeCote(corps(4, { id: "abc" }), VENDEUR)).code).toBe("VALIDATION");
    expect(evenements(s)).toHaveLength(0);
  });

  it("un fichier à la taille maximale est accepté", () => {
    const { c } = coeurPret();
    expect(c.mettreImportDeCote(corps(1, { contenuBase64: base64(TAILLE_MAX_FICHIER_DIFFERE) }), VENDEUR).import.statut).toBe("EN_ATTENTE");
  });

  it("la liste suit le sort de l'événement : en attente, envoyé, traité avec résultat, refusé", () => {
    const { s, c } = coeurPret();
    c.mettreImportDeCote(corps(1), VENDEUR);
    c.mettreImportDeCote(corps(2, { nomFichier: "inventaire.xlsx", mode: "inventaire" }), VENDEUR);
    c.mettreImportDeCote(corps(3, { nomFichier: "mauvais.xlsx" }), VENDEUR);
    expect(c.listerImportsDifferes().map((i) => i.statut)).toEqual(["EN_ATTENTE", "EN_ATTENTE", "EN_ATTENTE"]);

    const [e1, e2, e3] = evenements(s);
    c.appliquerResultats([
      { evenementId: e1.evenementId, statut: "ENVOYE" },
      { evenementId: e2.evenementId, statut: "ENVOYE" },
      { evenementId: e3.evenementId, statut: "REJETE", code: "FICHIER_INVALIDE", message: "Le fichier est illisible." },
    ]);
    expect(c.listerImportsDifferes().map((i) => i.statut)).toEqual(["REFUSE", "ENVOYE", "ENVOYE"]);

    const traite: ImportDiffereSynchro = {
      id: ID(1),
      evenementId: e1.evenementId,
      mode: "livraison",
      nomFichier: "livraison.xlsx",
      statut: "APPLIQUE",
      code: null,
      message: null,
      importe: {
        mode: "livraison",
        nomFichier: "livraison.xlsx",
        totalLignes: 3,
        importees: 2,
        rejetees: 1,
        receptionId: ID(1),
        inventaireId: null,
        lignesRejetees: [{ ligne: 4, nom: "Inconnu", raison: "Médicament absent du catalogue." }],
      },
    };
    const p = photo([]);
    p.importsDifferes = [traite];
    c.appliquerPhotographie(p, null, null);
    const liste = c.listerImportsDifferes();
    const lu = liste.find((i) => i.id === ID(1));
    expect(lu).toMatchObject({ statut: "TRAITE", resultat: { importees: 2, rejetees: 1, receptionId: ID(1) } });
    expect(liste.find((i) => i.id === ID(3))).toMatchObject({ statut: "REFUSE", message: "Le fichier est illisible." });
    // Jamais le contenu du fichier dans la liste
    expect(JSON.stringify(liste)).not.toContain(base64(300).slice(0, 40));
  });

  it("une photographie sans la liste (serveur plus ancien) ne l'efface pas ; sinon elle garde 20 imports au plus", () => {
    const { c } = coeurPret();
    const un = (n: number): ImportDiffereSynchro => ({ id: ID(n), evenementId: uuid(n, "dddddddd"), mode: "inventaire", nomFichier: `f${n}.xlsx`, statut: "APPLIQUE", code: null, message: null, importe: null });
    const p = photo([]);
    p.importsDifferes = Array.from({ length: 25 }, (_, i) => un(i + 1));
    c.appliquerPhotographie(p, null, null);
    expect(c.listerImportsDifferes()).toHaveLength(20);
    c.appliquerPhotographie(photo([]), null, null);
    expect(c.listerImportsDifferes()).toHaveLength(20);
  });
});
