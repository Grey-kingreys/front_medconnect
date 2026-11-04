import Database from "better-sqlite3";
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
  const mode = (base.prepare("PRAGMA journal_mode = WAL").get() as { journal_mode?: string } | undefined)?.journal_mode;
  try {
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

/** Contrôle d'intégrité rapide (`PRAGMA quick_check`) : vrai si la base est saine. */
export function controlerBase(stockage: Stockage): boolean {
  try {
    const lignes = stockage.lire<Record<string, unknown>>("PRAGMA quick_check");
    return lignes.length === 1 && Object.values(lignes[0])[0] === "ok";
  } catch {
    return false;
  }
}
