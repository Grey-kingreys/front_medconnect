import { closeSync, copyFileSync, mkdtempSync, openSync, readdirSync, readFileSync, rmSync, writeFileSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fixerAppareil } from "../electron/appareil";
import { fichiersReels } from "../electron/fichiers";
import { estBaseIllisible, traiterBaseIllisible, type FichiersBase } from "./base_illisible";
import { CoeurCaisse } from "./coeur";
import { outils } from "./aide_tests";
import { migrer } from "./schema";
import { ouvrirStockage } from "./stockage_sqlite";

const MOMENT = new Date("2026-11-04T10:07:00.000Z");
let dossier = "";
let chemin = "";

beforeEach(() => {
  dossier = mkdtempSync(path.join(tmpdir(), "mc-base-"));
  chemin = path.join(dossier, "caisse.sqlite");
});
afterEach(() => {
  rmSync(dossier, { recursive: true, force: true });
});

/** Base saine, migrée, avec un identifiant de poste et assez de lignes pour occuper plusieurs pages. */
function creerBase(): string {
  const s = ouvrirStockage(chemin);
  migrer(s);
  s.executer("CREATE TABLE bourrage (x TEXT)");
  s.transaction(() => {
    for (let i = 0; i < 3000; i++) s.executer("INSERT INTO bourrage (x) VALUES (?)", ["x".repeat(100) + i]);
  });
  const coeur = new CoeurCaisse(s, outils());
  const id = fixerAppareil(coeur, dossier);
  s.fermer();
  return id;
}

function abimerEntete(): void {
  const fd = openSync(chemin, "r+");
  writeSync(fd, Buffer.from("ceci n'est plus une base sqlite, contenu abime".padEnd(100, "#")), 0, 100, 0);
  closeSync(fd);
}

function abimerPage(): void {
  const fd = openSync(chemin, "r+");
  writeSync(fd, Buffer.alloc(4096, 0xff), 0, 4096, 4096 * 6);
  closeSync(fd);
}

const contenu = () => readFileSync(chemin);
const fichiers = () => readdirSync(dossier).sort();

describe("base illisible (D740)", () => {
  it("preuve 1 : un fichier dont l'en-tête est écrasé échoue à l'ouverture et est reconnu illisible", () => {
    creerBase();
    abimerEntete();
    let erreur: unknown = null;
    try {
      ouvrirStockage(chemin);
    } catch (e) {
      erreur = e;
    }
    expect(erreur).not.toBeNull();
    expect(estBaseIllisible(erreur)).toBe(true);
  });

  it("preuve 1 : une page interne abîmée fait échouer quick_check", async () => {
    creerBase();
    abimerPage();
    const demander = vi.fn().mockResolvedValue("QUITTER");
    const issue = await traiterBaseIllisible(chemin, { demander, fichiers: fichiersReels, horloge: () => MOMENT });
    expect(demander).toHaveBeenCalledTimes(1);
    expect(issue.issue).toBe("quitter");
  });

  it("preuve 2 : « Quitter » laisse le fichier intact, sans base neuve", async () => {
    creerBase();
    abimerEntete();
    const avant = contenu();
    const liste = fichiers();
    const issue = await traiterBaseIllisible(chemin, {
      demander: async () => "QUITTER",
      fichiers: fichiersReels,
      horloge: () => MOMENT,
    });
    expect(issue.issue).toBe("quitter");
    expect(contenu().equals(avant)).toBe(true);
    expect(fichiers()).toEqual(liste);
  });

  it("« Quitter » avec un vrai -wal : le -wal et le -shm sont conservés (fermer une base abîmée les supprimait)", async () => {
    const source = path.join(dossier, "origine.sqlite");
    const s = ouvrirStockage(source);
    s.executer("PRAGMA wal_autocheckpoint = 0");
    s.executer("CREATE TABLE bourrage (x TEXT)");
    s.transaction(() => {
      for (let i = 0; i < 500; i++) s.executer("INSERT INTO bourrage (x) VALUES (?)", ["y".repeat(200)]);
    });
    // Copie prise pendant que la base est ouverte : comme après une coupure de courant.
    for (const suffixe of ["", "-wal", "-shm"]) copyFileSync(`${source}${suffixe}`, `${chemin}${suffixe}`);
    s.fermer();
    abimerEntete();
    const wal = readFileSync(`${chemin}-wal`);
    expect(wal.length).toBeGreaterThan(100_000);

    const issue = await traiterBaseIllisible(chemin, {
      demander: async () => "QUITTER",
      fichiers: fichiersReels,
      horloge: () => MOMENT,
    });
    expect(issue.issue).toBe("quitter");
    expect(readFileSync(`${chemin}-wal`).equals(wal)).toBe(true);
    expect(fichiers()).toContain("caisse.sqlite-shm");
  });

  it("preuve 3 : « Repartir » renomme sans rien perdre, suit -wal et -shm, garde le même poste", async () => {
    const idAvant = creerBase();
    abimerEntete();
    writeFileSync(`${chemin}-wal`, "wal-de-test");
    writeFileSync(`${chemin}-shm`, "shm-de-test");
    const avant = contenu();

    const issue = await traiterBaseIllisible(chemin, {
      demander: async () => "REPARTIR",
      fichiers: fichiersReels,
      horloge: () => MOMENT,
    });
    if (issue.issue !== "remise-a-vide") throw new Error(`issue inattendue : ${issue.issue}`);
    const base = path.join(dossier, "caisse-illisible-20261104-1007");
    expect(issue.misDeCote).toEqual([`${base}.sqlite`, `${base}.sqlite-wal`, `${base}.sqlite-shm`]);
    expect(readFileSync(`${base}.sqlite`).equals(avant)).toBe(true);
    expect(readFileSync(`${base}.sqlite-wal`, "utf8")).toBe("wal-de-test");
    expect(readFileSync(`${base}.sqlite-shm`, "utf8")).toBe("shm-de-test");

    migrer(issue.stockage);
    const coeur = new CoeurCaisse(issue.stockage, outils());
    expect(fixerAppareil(coeur, dossier)).toBe(idAvant);
    expect(coeur.appareilId()).toBe(idAvant);
    issue.stockage.fermer();
  });

  it("preuve 4 : un renommage en échec ne crée aucune base neuve et ne perd rien", async () => {
    creerBase();
    abimerEntete();
    const avant = contenu();
    const liste = fichiers();
    const verrouille: FichiersBase = {
      existe: fichiersReels.existe,
      renommer() {
        throw new Error("EBUSY");
      },
    };
    const issue = await traiterBaseIllisible(chemin, {
      demander: async () => "REPARTIR",
      fichiers: verrouille,
      horloge: () => MOMENT,
    });
    expect(issue.issue).toBe("renommage-impossible");
    expect(contenu().equals(avant)).toBe(true);
    expect(fichiers()).toEqual(liste);
  });

  it("preuve 4 : un renommage qui échoue au deuxième fichier remet le premier à sa place", async () => {
    creerBase();
    abimerEntete();
    writeFileSync(`${chemin}-wal`, "wal-de-test");
    const avant = contenu();
    let appels = 0;
    const capricieux: FichiersBase = {
      existe: fichiersReels.existe,
      renommer(de, vers) {
        appels += 1;
        if (appels === 2) throw new Error("EBUSY");
        fichiersReels.renommer(de, vers);
      },
    };
    const issue = await traiterBaseIllisible(chemin, {
      demander: async () => "REPARTIR",
      fichiers: capricieux,
      horloge: () => MOMENT,
    });
    expect(issue.issue).toBe("renommage-impossible");
    expect(contenu().equals(avant)).toBe(true);
    expect(readFileSync(`${chemin}-wal`, "utf8")).toBe("wal-de-test");
    expect(fichiers().filter((f) => f.startsWith("caisse-illisible"))).toEqual([]);
  });

  it("preuve 5 : un nom déjà pris n'est jamais écrasé", async () => {
    creerBase();
    abimerEntete();
    const pris = path.join(dossier, "caisse-illisible-20261104-1007.sqlite");
    writeFileSync(pris, "ancien-fichier-a-ne-pas-toucher");
    const avant = contenu();

    const issue = await traiterBaseIllisible(chemin, {
      demander: async () => "REPARTIR",
      fichiers: fichiersReels,
      horloge: () => MOMENT,
    });
    if (issue.issue !== "remise-a-vide") throw new Error(`issue inattendue : ${issue.issue}`);
    expect(readFileSync(pris, "utf8")).toBe("ancien-fichier-a-ne-pas-toucher");
    expect(issue.misDeCote).toEqual([path.join(dossier, "caisse-illisible-20261104-1007-2.sqlite")]);
    expect(readFileSync(issue.misDeCote[0]).equals(avant)).toBe(true);
    issue.stockage.fermer();
  });

  it("preuve 6 : une base plus récente n'est jamais renommée (message de mise à jour)", async () => {
    creerBase();
    const s = ouvrirStockage(chemin);
    s.executer("PRAGMA user_version = 99");
    s.fermer();
    const demander = vi.fn();
    const issue = await traiterBaseIllisible(chemin, { demander, fichiers: fichiersReels, horloge: () => MOMENT });
    expect(demander).not.toHaveBeenCalled();
    if (issue.issue !== "ouverte") throw new Error(`issue inattendue : ${issue.issue}`);
    expect(() => migrer(issue.stockage)).toThrow(/Mettez l'application à jour/);
    issue.stockage.fermer();
    expect(fichiers().filter((f) => f.startsWith("caisse-illisible"))).toEqual([]);
  });

  it("une base saine s'ouvre sans question", async () => {
    creerBase();
    const demander = vi.fn();
    const issue = await traiterBaseIllisible(chemin, { demander, fichiers: fichiersReels, horloge: () => MOMENT });
    expect(issue.issue).toBe("ouverte");
    expect(demander).not.toHaveBeenCalled();
    if (issue.issue === "ouverte") issue.stockage.fermer();
  });
});
