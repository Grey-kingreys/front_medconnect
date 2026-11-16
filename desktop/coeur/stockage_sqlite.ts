import Database from "better-sqlite3-multiple-ciphers";
import { closeSync, copyFileSync, existsSync, mkdirSync, openSync, readSync, renameSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import type { Stockage } from "./stockage";

/**
 * Chiffrement de la base du poste (Q12) : SQLCipher (AES-256) via better-sqlite3-multiple-ciphers.
 * La clé est donnée en hexadécimal (32 octets, 64 caractères) : jamais de phrase de passe, donc pas de dérivation.
 */
const CLE_HEX = /^[0-9a-f]{64}$/i;

type Base = InstanceType<typeof Database>;

function appliquerCle(base: Base, cle: string): void {
  if (!CLE_HEX.test(cle)) throw new Error("Clé de base invalide : 64 caractères hexadécimaux attendus.");
  base.pragma("cipher = 'sqlcipher'");
  base.pragma(`key = "x'${cle}'"`);
}

/** Ouvre une connexion brute (avec la clé si elle est donnée). Aucune lecture : la clé n'est vérifiée qu'au premier accès. */
export function ouvrirBase(chemin: string, cle?: string, options: { readonly?: boolean } = {}): Base {
  const base = new Database(chemin, options);
  if (cle === undefined) return base;
  try {
    appliquerCle(base, cle);
  } catch (erreur) {
    base.close();
    throw erreur;
  }
  return base;
}

/** Le mode WAL est obligatoire sur disque (D740) ; une base en mémoire (tests) répond « memory ». */
export function exigerWal(mode: string | undefined, chemin: string): void {
  if (chemin === ":memory:" || mode === "wal") return;
  throw new Error(
    `La base locale n'a pas pu passer en mode WAL (mode obtenu : ${mode ?? "inconnu"}) : les ventes ne seraient plus protégées des coupures de courant.`,
  );
}

/**
 * Ouvre la base locale. `synchronous=FULL` : une coupure de courant ne doit jamais
 * faire perdre une vente déjà encaissée (D740). Sans `cle`, la base n'est pas chiffrée (tests, mémoire).
 */
export function ouvrirStockage(chemin: string, cle?: string): Stockage {
  const base = ouvrirBase(chemin, cle);
  try {
    // Un fichier abîmé, ou une mauvaise clé, échoue ici (SQLITE_NOTADB), dès le premier PRAGMA : la connexion est
    // refermée, sinon le fichier resterait verrouillé et ne pourrait plus être renommé (D740).
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

/** Vrai si le fichier commence par l'en-tête SQLite en clair : c'est une base NON chiffrée. */
export function enteteSqlite(chemin: string): boolean {
  const fd = openSync(chemin, "r");
  const entete = Buffer.alloc(ENTETE_SQLITE.length);
  try {
    readSync(fd, entete, 0, entete.length, 0);
  } finally {
    closeSync(fd);
  }
  return entete.equals(ENTETE_SQLITE);
}

/** Vrai si le fichier existe, n'est pas vide et est en clair (poste installé avant le chiffrement). */
export function estEnClair(chemin: string): boolean {
  return existsSync(chemin) && statSync(chemin).size > 0 && enteteSqlite(chemin);
}

/**
 * Examine le fichier SANS l'ouvrir en écriture : fermer la dernière connexion d'une base abîmée supprime
 * son -wal et son -shm (constaté), donc des ventes qui n'ont pas encore été reportées dans le fichier.
 * Sans clé, l'en-tête est lu directement ; une base chiffrée n'a pas d'en-tête : seule l'ouverture avec la clé
 * (mauvaise clé = illisible) en dit l'état. `quick_check` passe par une connexion en lecture seule, qui ne touche
 * à aucun fichier. Les erreurs qui ne disent pas « illisible » (fichier verrouillé, droits) remontent.
 */
export function examinerFichier(chemin: string, cle?: string): "absent" | "sain" | "illisible" {
  if (!existsSync(chemin)) return "absent";
  const taille = statSync(chemin).size;
  if (taille === 0) return "sain";
  if (cle === undefined && !enteteSqlite(chemin)) return "illisible";
  const base = ouvrirBase(chemin, cle, { readonly: true });
  try {
    const lignes = base.prepare("PRAGMA quick_check").all() as Record<string, unknown>[];
    return lignes.length === 1 && Object.values(lignes[0])[0] === "ok" ? "sain" : "illisible";
  } catch (erreur) {
    if (estIllisible(erreur)) return "illisible";
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
export function lireAppareilIdEnLectureSeule(chemin: string, cle?: string): string | null | "illisible" {
  let base: Base;
  try {
    base = ouvrirBase(chemin, cle, { readonly: true });
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

export type IssueChiffrement = "inexistante" | "deja-chiffree" | "illisible" | "chiffree";

function comptes(base: Base): Record<string, number> {
  const tables = base
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all() as { name: string }[];
  const resultat: Record<string, number> = {};
  for (const { name } of tables) {
    resultat[name] = (base.prepare(`SELECT COUNT(*) AS n FROM "${name.replace(/"/g, '""')}"`).get() as { n: number }).n;
  }
  return resultat;
}

/**
 * Chiffre une base existante EN CLAIR (postes installés avant le chiffrement), sans perte :
 * 1. copie de sauvegarde (base, -wal, -shm) dans `dossierSauvegarde` ;
 * 2. copie cohérente de la base (API de sauvegarde, -wal rejoué) dans un fichier temporaire, chiffrée là ;
 * 3. contrôle : ouverture avec la clé, `quick_check`, même nombre de lignes dans chaque table ;
 * 4. remplacement du fichier d'origine par le renommage du temporaire, puis suppression de la sauvegarde.
 * Tant que l'étape 4 n'a pas eu lieu, la base d'origine est intacte ; en cas d'échec, la sauvegarde reste.
 * Une base illisible n'est pas touchée (`traiterBaseIllisible` s'en charge).
 */
export async function chiffrerBaseEnClair(
  chemin: string,
  cle: string,
  dossierSauvegarde: string,
  options: { journal?: (message: string) => void; supprimer?: (chemin: string) => void } = {},
): Promise<IssueChiffrement> {
  if (!existsSync(chemin) || statSync(chemin).size === 0) return "inexistante";
  if (!enteteSqlite(chemin)) return "deja-chiffree";
  if (examinerFichier(chemin) === "illisible") return "illisible";
  if (!CLE_HEX.test(cle)) throw new Error("Clé de base invalide : 64 caractères hexadécimaux attendus.");

  const nom = path.basename(chemin);
  mkdirSync(dossierSauvegarde, { recursive: true });
  for (const suffixe of ["", "-wal", "-shm"]) {
    if (existsSync(`${chemin}${suffixe}`)) copyFileSync(`${chemin}${suffixe}`, path.join(dossierSauvegarde, `${nom}${suffixe}`));
  }

  const temporaire = `${chemin}.chiffre.tmp`;
  for (const suffixe of ["", "-wal", "-shm", "-journal"]) rmSync(`${temporaire}${suffixe}`, { force: true });

  const source = new Database(chemin);
  let avant: Record<string, number>;
  try {
    avant = comptes(source);
    await source.backup(temporaire);
  } finally {
    source.close();
  }

  const copie = new Database(temporaire);
  try {
    copie.pragma("journal_mode = DELETE");
    copie.pragma("cipher = 'sqlcipher'");
    copie.pragma(`rekey = "x'${cle}'"`);
  } finally {
    copie.close();
  }

  const verif = ouvrirBase(temporaire, cle, { readonly: true });
  try {
    const ok = verif.prepare("PRAGMA quick_check").all() as Record<string, unknown>[];
    if (!(ok.length === 1 && Object.values(ok[0])[0] === "ok")) throw new Error("Le contrôle de la copie chiffrée a échoué.");
    if (JSON.stringify(comptes(verif)) !== JSON.stringify(avant)) throw new Error("La copie chiffrée ne contient pas les mêmes données.");
  } finally {
    verif.close();
  }

  // Fermée proprement, la base d'origine n'a plus de -wal : s'il en reste un (autre connexion ouverte), on s'arrête
  // AVANT le remplacement, la base d'origine reste intacte. Rien n'est supprimé avant le renommage.
  for (const suffixe of ["-wal", "-shm"]) {
    if (existsSync(`${chemin}${suffixe}`) && statSync(`${chemin}${suffixe}`).size > 0) {
      rmSync(temporaire, { force: true });
      throw new Error("La base d'origine est encore utilisée : le remplacement est annulé.");
    }
  }
  renameSync(temporaire, chemin);
  // Après le remplacement réussi, un échec de nettoyage n'est pas une erreur : la base est chiffrée.
  try {
    (options.supprimer ?? ((c) => rmSync(c, { recursive: true, force: true })))(dossierSauvegarde);
  } catch {
    options.journal?.("nettoyage : la sauvegarde avant chiffrement n'a pas pu être supprimée (la base est bien chiffrée) ; à supprimer à la main");
  }
  return "chiffree";
}
