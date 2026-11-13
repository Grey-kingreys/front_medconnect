import Database from "better-sqlite3";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { baseSuspecteSurDisque } from "../electron/appareil";
import { baseVueVideSuspecte, type ObservationBase } from "./base_suspecte";

const ID = "11111111-1111-4111-8111-111111111111";

describe("baseVueVideSuspecte (fonction pure)", () => {
  const suspecte: ObservationBase = { tailleBase: 4096, tailleWal: 8272, appareilJsonValide: true, appareilIdEnBase: null };

  it("refuse : base et -wal non vides, appareil.json valide, aucun identifiant en base", () => {
    expect(baseVueVideSuspecte(suspecte)).toBe(true);
  });
  it("premier démarrage (base absente) : pas de refus", () => {
    expect(baseVueVideSuspecte({ ...suspecte, tailleBase: null, tailleWal: null, appareilJsonValide: false })).toBe(false);
  });
  it("base neuve après « Repartir d'une base vide » (base absente, appareil.json valide) : pas de refus", () => {
    expect(baseVueVideSuspecte({ ...suspecte, tailleBase: null, tailleWal: null })).toBe(false);
  });
  it("base normale (identifiant présent) : pas de refus", () => {
    expect(baseVueVideSuspecte({ ...suspecte, appareilIdEnBase: ID })).toBe(false);
  });
  it("pas de -wal, -wal vide, base vide ou appareil.json invalide : pas de refus", () => {
    expect(baseVueVideSuspecte({ ...suspecte, tailleWal: null })).toBe(false);
    expect(baseVueVideSuspecte({ ...suspecte, tailleWal: 0 })).toBe(false);
    expect(baseVueVideSuspecte({ ...suspecte, tailleBase: 0 })).toBe(false);
    expect(baseVueVideSuspecte({ ...suspecte, appareilJsonValide: false })).toBe(false);
  });
});

const empreinte = (f: string) => createHash("sha256").update(readFileSync(f)).digest("hex");
const SCHEMA = "CREATE TABLE etat_poste (id INTEGER PRIMARY KEY, appareilId TEXT); CREATE TABLE ventes (id INTEGER PRIMARY KEY, x TEXT);";

let dossier = "";
beforeEach(() => {
  dossier = mkdtempSync(path.join(tmpdir(), "mc-suspecte-"));
});
afterEach(() => {
  rmSync(dossier, { recursive: true, force: true });
});

describe("incident : -wal d'une base neuve posé à côté de la vraie base", () => {
  it("refuse sans rien modifier ; sans le -wal la vraie base relit ses ventes", async () => {
    const vraie = path.join(dossier, "caisse.sqlite");
    const neuve = path.join(dossier, "neuve.sqlite");

    // Vraie base : identifiant et ventes, refermée proprement (le -wal disparaît).
    const b = new Database(vraie);
    b.exec("PRAGMA journal_mode = WAL");
    b.exec(SCHEMA);
    b.prepare("INSERT INTO etat_poste (id, appareilId) VALUES (1, ?)").run(ID);
    for (let i = 0; i < 300; i++) b.prepare("INSERT INTO ventes (x) VALUES (?)").run("x".repeat(200));
    b.close();
    expect(existsSync(`${vraie}-wal`)).toBe(false);
    writeFileSync(path.join(dossier, "appareil.json"), JSON.stringify({ appareilId: ID }) + "\n");

    // Base neuve migrée dont l'écrivain est tué sans fermeture : son -wal reste.
    const chemin = createRequire(import.meta.url).resolve("better-sqlite3");
    const script = `const D=require(process.argv[1]);const b=new D(process.argv[2]);b.pragma('journal_mode=WAL');b.exec(process.argv[3]);b.prepare('INSERT INTO etat_poste (id) VALUES (1)').run();console.log('PRET');setInterval(()=>{},1000);`;
    const enfant = spawn(process.execPath, ["-e", script, chemin, neuve, SCHEMA], { stdio: ["ignore", "pipe", "inherit"] });
    await new Promise<void>((ok, ko) => {
      enfant.once("error", ko);
      enfant.once("exit", () => ko(new Error("l'écrivain s'est arrêté trop tôt")));
      enfant.stdout.on("data", (d: Buffer) => d.toString().includes("PRET") && ok());
    });
    const fini = new Promise<void>((ok) => enfant.once("exit", () => ok()));
    enfant.kill("SIGKILL");
    await fini;
    expect(existsSync(`${neuve}-wal`)).toBe(true);
    copyFileSync(`${neuve}-wal`, `${vraie}-wal`);

    const avant = [empreinte(vraie), empreinte(`${vraie}-wal`)];
    expect(baseSuspecteSurDisque(dossier)).toBe(true);
    expect([empreinte(vraie), empreinte(`${vraie}-wal`)]).toEqual(avant);

    // Sans le -wal étranger, la vraie base relit ses ventes.
    rmSync(`${vraie}-wal`);
    rmSync(`${vraie}-shm`, { force: true });
    const relue = new Database(vraie);
    try {
      expect((relue.prepare("SELECT COUNT(*) AS n FROM ventes").get() as { n: number }).n).toBe(300);
    } finally {
      relue.close();
    }
  });
});
