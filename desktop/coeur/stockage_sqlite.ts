import Database from "better-sqlite3";
import { closeSync, existsSync, openSync, readSync, statSync } from "node:fs";
import type { Stockage } from "./stockage";

/** Le mode WAL est obligatoire sur disque (D740) ; une base en mémoire (tests) répond « memory ». */
export function exigerWal(mode: string | undefined, chemin: string): void {
  if (chemin === ":memory:" || mode === "wal") return;
  throw new Error(
    `La base locale n'a pas pu passer en mode WAL (mode obtenu : ${mode ?? "inconnu"}) : les ventes ne seraient plus protégées des coupures de courant.`,
  );
}

/**
 * Ouvre la base locale. `synchronous=FULL` : une coupure de courant ne doit jamais
 * faire perdre une vente déjà encaissée (D740).
 */
export function ouvrirStockage(chemin: string): Stockage {
  const base = new Database(chemin);
  try {
    // Un fichier abîmé échoue ici, dès le premier PRAGMA : la connexion est refermée, sinon le fichier
    // resterait verrouillé et ne pourrait plus être renommé (D740).
    const mode = (base.prepare("PRAGMA journal_mode = WAL").get() as { journal_mode?: string } | undefined)?.journal_mode;
    exigerWal(mode, chemin);
  } catch (erreur) {
    base.close();
    throw erreur;
  }
  base.exec("PRAGMA synchronous = FULL");
  base.exec("PRAGMA foreign_keys = ON");
  base.exec("PRAGMA busy_timeout = 5000");

  return {
    executer(sql, params) {
      if (params === undefined) {
        base.exec(sql);
        return;
      }
      base.prepare(sql).run(...params);
    },
    lire<T>(sql: string, params: unknown[] = []): T[] {
      return base.prepare(sql).all(...params) as T[];
    },
    lireUn<T>(sql: string, params: unknown[] = []): T | undefined {
      return base.prepare(sql).get(...params) as T | undefined;
    },
    transaction<T>(travail: () => T): T {
      return base.transaction(travail)();
    },
    fermer() {
      base.close();
    },
  };
}

const ENTETE_SQLITE = Buffer.from("SQLite format 3\0", "latin1");

/**
 * Examine le fichier SANS l'ouvrir en écriture : fermer la dernière connexion d'une base abîmée supprime
 * son -wal et son -shm (constaté), donc des ventes qui n'ont pas encore été reportées dans le fichier.
 * L'en-tête est lu directement, puis `quick_check` passe par une connexion en lecture seule, qui ne touche
 * à aucun fichier. Les erreurs qui ne disent pas « illisible » (fichier verrouillé, droits) remontent.
 */
export function examinerFichier(chemin: string): "absent" | "sain" | "illisible" {
  if (!existsSync(chemin)) return "absent";
  const taille = statSync(chemin).size;
  if (taille === 0) return "sain";
  const fd = openSync(chemin, "r");
  const entete = Buffer.alloc(ENTETE_SQLITE.length);
  try {
    readSync(fd, entete, 0, entete.length, 0);
  } finally {
    closeSync(fd);
  }
  if (!entete.equals(ENTETE_SQLITE)) return "illisible";
  const base = new Database(chemin, { readonly: true });
  try {
    const lignes = base.prepare("PRAGMA quick_check").all() as Record<string, unknown>[];
    return lignes.length === 1 && Object.values(lignes[0])[0] === "ok" ? "sain" : "illisible";
  } catch (erreur) {
    const code = (erreur as { code?: unknown }).code;
    if (typeof code === "string" && (code === "SQLITE_NOTADB" || code.startsWith("SQLITE_CORRUPT"))) return "illisible";
    throw erreur;
  } finally {
    base.close();
  }
}

/**
 * Identifiant du poste lu par une connexion en lecture seule, refermée aussitôt (ne touche pas au -wal).
 * `null` : aucun identifiant (table absente comprise). `"illisible"` : SQLITE_NOTADB ou SQLITE_CORRUPT*.
 * Les autres erreurs remontent.
 */
export function lireAppareilIdEnLectureSeule(chemin: string): string | null | "illisible" {
  let base: InstanceType<typeof Database>;
  try {
    base = new Database(chemin, { readonly: true });
  } catch (erreur) {
    if (estIllisible(erreur)) return "illisible";
    throw erreur;
  }
  try {
    const ligne = base.prepare("SELECT appareilId FROM etat_poste WHERE id = 1").get() as { appareilId?: unknown } | undefined;
    return typeof ligne?.appareilId === "string" && ligne.appareilId !== "" ? ligne.appareilId : null;
  } catch (erreur) {
    if (estIllisible(erreur)) return "illisible";
    if (erreur instanceof Error && /no such table/i.test(erreur.message)) return null;
    throw erreur;
  } finally {
    base.close();
  }
}

function estIllisible(erreur: unknown): boolean {
  const code = (erreur as { code?: unknown }).code;
  return typeof code === "string" && (code === "SQLITE_NOTADB" || code.startsWith("SQLITE_CORRUPT"));
}

/** Contrôle d'intégrité rapide (`PRAGMA quick_check`) : vrai si la base est saine. */
export function controlerBase(stockage: Stockage): boolean {
  try {
    const lignes = stockage.lire<Record<string, unknown>>("PRAGMA quick_check");
    return lignes.length === 1 && Object.values(lignes[0])[0] === "ok";
  } catch {
    return false;
  }
}
