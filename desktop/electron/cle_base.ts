// Clé de chiffrement de la base du poste (Q12) : 32 octets aléatoires, générés au premier démarrage,
// protégés par le coffre du système (Electron safeStorage : DPAPI sous Windows, liée à la session Windows)
// et rangés chiffrés dans `cle-base.bin`. Jamais en clair sur le disque, jamais dans un journal.
// Aucun import d'electron : le coffre est donné par l'appelant, ce qui rend le module testable.
import { randomBytes } from "node:crypto";
import { closeSync, existsSync, fsyncSync, openSync, readFileSync, renameSync, writeSync } from "node:fs";
import path from "node:path";

export interface Coffre {
  disponible(): boolean;
  chiffrer(clair: string): Buffer;
  /** Lève si le contenu n'a pas été protégé par ce compte. */
  dechiffrer(chiffre: Buffer): string;
}

export const NOM_FICHIER_CLE = "cle-base.bin";

export const MESSAGE_COFFRE_INDISPONIBLE =
  "Le coffre de protection de Windows n'est pas disponible : la base de la caisse ne peut pas être chiffrée, donc la caisse ne démarre pas. Ouvrez une session Windows normale (pas une session restreinte) et relancez, ou appelez le support.";
export const MESSAGE_CLE_ILLISIBLE =
  "La clé qui protège la base de la caisse n'est pas lisible avec ce compte Windows (compte différent, ou Windows réinstallé). Les ventes de ce poste déjà envoyées au serveur ne sont pas perdues. Ouvrez la session Windows qui a installé la caisse, ou appelez le support.";

export const MESSAGE_CLE_PERDUE =
  "La clé qui protège la base de la caisse est introuvable (cle-base.bin absent) alors que la base existe et est chiffrée. La base est conservée, rien n'a été modifié ni recréé. Appelez le support : sans cette clé, la base ne peut pas être relue (voir la procédure de reprise de la notice).";

export class ClePerdue extends Error {
  constructor() {
    super(MESSAGE_CLE_PERDUE);
    this.name = "ClePerdue";
  }
}

export class CoffreIndisponible extends Error {
  constructor() {
    super(MESSAGE_COFFRE_INDISPONIBLE);
    this.name = "CoffreIndisponible";
  }
}

export class CleIllisible extends Error {
  constructor() {
    super(MESSAGE_CLE_ILLISIBLE);
    this.name = "CleIllisible";
  }
}

const CLE_HEX = /^[0-9a-f]{64}$/;

function ecrireAtomique(cible: string, contenu: Buffer): void {
  const temporaire = `${cible}.tmp`;
  const fd = openSync(temporaire, "w");
  try {
    writeSync(fd, contenu);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(temporaire, cible);
}

/**
 * Clé de la base, en hexadécimal. Fichier absent : une clé est créée et rangée. Fichier présent mais
 * illisible : `CleIllisible` (rien n'est écrasé : une nouvelle clé ne rouvrirait de toute façon pas la base).
 * Fichier absent alors qu'une base chiffrée existe : `ClePerdue`. Coffre indisponible : `CoffreIndisponible`, aucun repli en clair.
 */
export function obtenirCle(dossier: string, coffre: Coffre, options: { baseChiffreeExiste?: boolean } = {}): string {
  if (!coffre.disponible()) throw new CoffreIndisponible();
  const fichier = path.join(dossier, NOM_FICHIER_CLE);
  if (existsSync(fichier)) {
    let cle: string;
    try {
      cle = coffre.dechiffrer(readFileSync(fichier));
    } catch {
      throw new CleIllisible();
    }
    if (!CLE_HEX.test(cle)) throw new CleIllisible();
    return cle;
  }
  // Base chiffrée sans clé : une nouvelle clé ne la rouvrirait pas, et masquerait la perte. On s'arrête.
  if (options.baseChiffreeExiste === true) throw new ClePerdue();
  const cle = randomBytes(32).toString("hex");
  ecrireAtomique(fichier, coffre.chiffrer(cle));
  return cle;
}
