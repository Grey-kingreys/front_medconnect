import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3-multiple-ciphers";
import { ClePerdue, CleIllisible, CoffreIndisponible, NOM_FICHIER_CLE, obtenirCle, type Coffre } from "../electron/cle_base";
import { chiffrerBaseEnClair, enteteSqlite, estEnClair, examinerFichier, ouvrirStockage } from "./stockage_sqlite";

const CLE = "ab".repeat(32);
const AUTRE_CLE = "cd".repeat(32);
let dossier: string;
let chemin: string;

beforeEach(() => {
  dossier = mkdtempSync(path.join(tmpdir(), "mc-chiffre-"));
  chemin = path.join(dossier, "caisse.sqlite");
});
afterEach(() => rmSync(dossier, { recursive: true, force: true }));

function creerEnClair(lignes: number): void {
  const b = new Database(chemin);
  b.pragma("journal_mode = WAL");
  b.exec("CREATE TABLE ventes (id INTEGER PRIMARY KEY, client TEXT); CREATE TABLE clients (tel TEXT)");
  for (let i = 0; i < lignes; i++) b.prepare("INSERT INTO ventes (client) VALUES (?)").run(`client-${i}`);
  b.prepare("INSERT INTO clients (tel) VALUES (?)").run("+224620000000");
  b.close();
}

describe("base chiffrée", () => {
  it("s'ouvre avec la bonne clé, garde ses données, et n'a pas l'en-tête SQLite", () => {
    const s = ouvrirStockage(chemin, CLE);
    s.executer("CREATE TABLE t (x TEXT)");
    s.executer("INSERT INTO t (x) VALUES (?)", ["secret-lisible-?"]);
    s.fermer();
    expect(enteteSqlite(chemin)).toBe(false);
    expect(readFileSync(chemin).includes("secret-lisible")).toBe(false);
    const r = ouvrirStockage(chemin, CLE);
    expect(r.lire<{ x: string }>("SELECT x FROM t")).toEqual([{ x: "secret-lisible-?" }]);
    r.fermer();
  });

  it("refuse de s'ouvrir sans clé ou avec une mauvaise clé", () => {
    ouvrirStockage(chemin, CLE).fermer();
    expect(() => ouvrirStockage(chemin, AUTRE_CLE)).toThrow(/not a database|NOTADB/i);
    expect(() => ouvrirStockage(chemin)).toThrow(/not a database|NOTADB/i);
    expect(examinerFichier(chemin, AUTRE_CLE)).toBe("illisible");
    expect(examinerFichier(chemin, CLE)).toBe("sain");
  });

  it("refuse une clé mal formée", () => {
    expect(() => ouvrirStockage(chemin, "trop-court")).toThrow(/Clé de base invalide/);
  });
});

describe("migration d'une base en clair", () => {
  it("chiffre sans perte (ventes récentes comprises) et supprime la sauvegarde", async () => {
    creerEnClair(50);
    const ouverte = new Database(chemin);
    ouverte.prepare("INSERT INTO ventes (client) VALUES ('dans-le-wal')").run();
    ouverte.close();
    const sauvegarde = path.join(dossier, "sauvegarde-avant-chiffrement");
    expect(estEnClair(chemin)).toBe(true);
    const issue = await chiffrerBaseEnClair(chemin, CLE, sauvegarde);
    expect(issue).toBe("chiffree");
    expect(enteteSqlite(chemin)).toBe(false);
    expect(existsSync(sauvegarde)).toBe(false);
    expect(existsSync(`${chemin}.chiffre.tmp`)).toBe(false);
    const s = ouvrirStockage(chemin, CLE);
    expect(s.lireUn<{ n: number }>("SELECT COUNT(*) AS n FROM ventes")?.n).toBe(51);
    expect(s.lire("SELECT client FROM ventes WHERE client = 'dans-le-wal'")).toHaveLength(1);
    expect(s.lireUn<{ tel: string }>("SELECT tel FROM clients")?.tel).toBe("+224620000000");
    s.fermer();
    expect(readFileSync(chemin).includes("+224620000000")).toBe(false);
    expect(() => ouvrirStockage(chemin)).toThrow();
  });

  it("ne touche ni une base déjà chiffrée, ni un fichier absent", async () => {
    expect(await chiffrerBaseEnClair(chemin, CLE, path.join(dossier, "sauv"))).toBe("inexistante");
    ouvrirStockage(chemin, CLE).fermer();
    expect(await chiffrerBaseEnClair(chemin, CLE, path.join(dossier, "sauv"))).toBe("deja-chiffree");
    expect(existsSync(path.join(dossier, "sauv"))).toBe(false);
  });

  it("annule le remplacement, base d'origine intacte, si elle est encore utilisée", async () => {
    creerEnClair(3);
    const ouverte = new Database(chemin);
    ouverte.prepare("INSERT INTO ventes (client) VALUES ('en-cours')").run();
    const avant = readFileSync(chemin);
    await expect(chiffrerBaseEnClair(chemin, CLE, path.join(dossier, "sauv"))).rejects.toThrow(/encore utilisée/);
    expect(enteteSqlite(chemin)).toBe(true);
    expect(readFileSync(chemin).equals(avant)).toBe(true);
    expect(existsSync(`${chemin}-wal`)).toBe(true);
    ouverte.close();
    expect(existsSync(`${chemin}.chiffre.tmp`)).toBe(false);
  });

  it("un échec de nettoyage de la sauvegarde après remplacement n'est pas une erreur", async () => {
    creerEnClair(2);
    const messages: string[] = [];
    const issue = await chiffrerBaseEnClair(chemin, CLE, path.join(dossier, "sauv"), {
      journal: (m) => messages.push(m),
      supprimer: () => {
        throw new Error("verrouillé");
      },
    });
    expect(issue).toBe("chiffree");
    expect(enteteSqlite(chemin)).toBe(false);
    expect(messages.join(" ")).toMatch(/sauvegarde/);
    ouvrirStockage(chemin, CLE).fermer();
  });

  it("garde la sauvegarde et la base d'origine si le chiffrement échoue", async () => {
    creerEnClair(3);
    const avant = readFileSync(chemin);
    await expect(chiffrerBaseEnClair(chemin, "pas-une-cle", path.join(dossier, "sauv"))).rejects.toThrow();
    expect(readFileSync(chemin).equals(avant)).toBe(true);
  });
});

describe("clé protégée par le coffre", () => {
  const coffreFactice = (dispo = true): Coffre => ({
    disponible: () => dispo,
    chiffrer: (clair) => Buffer.from(`PROTEGE:${Buffer.from(clair).toString("base64")}`),
    dechiffrer: (b) => {
      const t = b.toString();
      if (!t.startsWith("PROTEGE:")) throw new Error("autre compte");
      return Buffer.from(t.slice(8), "base64").toString();
    },
  });

  it("génère 32 octets au premier démarrage, la range chiffrée, puis la relit", () => {
    const cle = obtenirCle(dossier, coffreFactice());
    expect(cle).toMatch(/^[0-9a-f]{64}$/);
    const fichier = readFileSync(path.join(dossier, NOM_FICHIER_CLE)).toString();
    expect(fichier.includes(cle)).toBe(false);
    expect(obtenirCle(dossier, coffreFactice())).toBe(cle);
  });

  it("refuse de démarrer sans coffre, sans rien écrire", () => {
    expect(() => obtenirCle(dossier, coffreFactice(false))).toThrow(CoffreIndisponible);
    expect(existsSync(path.join(dossier, NOM_FICHIER_CLE))).toBe(false);
  });

  it("clé absente alors qu'une base chiffrée existe : refus, aucune clé recréée", () => {
    expect(() => obtenirCle(dossier, coffreFactice(), { baseChiffreeExiste: true })).toThrow(ClePerdue);
    expect(existsSync(path.join(dossier, NOM_FICHIER_CLE))).toBe(false);
  });

  it("clé illisible avec ce compte : erreur claire, fichier conservé", () => {
    obtenirCle(dossier, coffreFactice());
    const autreCompte: Coffre = { ...coffreFactice(), dechiffrer: () => { throw new Error("DPAPI"); } };
    expect(() => obtenirCle(dossier, autreCompte)).toThrow(CleIllisible);
    expect(existsSync(path.join(dossier, NOM_FICHIER_CLE))).toBe(true);
  });
});
