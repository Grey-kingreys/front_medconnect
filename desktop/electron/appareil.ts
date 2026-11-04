// Identifiant du poste gardé hors de la base (D752) : une base remise à vide garde le même poste.
// Aucun import d'electron : le dossier est donné par l'appelant (userData), ce qui rend le module testable.
import { closeSync, fsyncSync, openSync, readFileSync, renameSync, writeSync } from "node:fs";
import path from "node:path";
import type { CoeurCaisse } from "../coeur/coeur";

const NOM_FICHIER = "appareil.json";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Identifiant écrit dans `appareil.json`, ou null si le fichier manque ou est illisible. */
export function lireAppareilId(dossier: string): string | null {
  try {
    const brut: unknown = JSON.parse(readFileSync(path.join(dossier, NOM_FICHIER), "utf8"));
    const id = typeof brut === "object" && brut !== null ? (brut as { appareilId?: unknown }).appareilId : undefined;
    return typeof id === "string" && UUID.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** Écriture atomique et durable : fichier temporaire, fsync, puis renommage. */
function ecrireAppareilId(dossier: string, id: string): void {
  const cible = path.join(dossier, NOM_FICHIER);
  const temporaire = `${cible}.tmp`;
  const fd = openSync(temporaire, "w");
  try {
    writeSync(fd, JSON.stringify({ appareilId: id }) + "\n");
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(temporaire, cible);
}

/**
 * Fixe l'identifiant du poste. Base sans identifiant et fichier valide : le fichier fait foi (même poste au
 * serveur après une remise à vide). Sinon l'identifiant de la base est créé si besoin et écrit dans le fichier
 * s'il manque. Fichier et base en désaccord : la base fait foi, une alerte est journalisée et le fichier corrigé.
 */
export function fixerAppareil(coeur: CoeurCaisse, dossier: string, journal: (message: string) => void = () => undefined): string {
  const dansFichier = lireAppareilId(dossier);
  if (dansFichier !== null) coeur.fixerAppareilId(dansFichier);
  const id = coeur.appareilId();
  if (dansFichier !== id) {
    if (dansFichier !== null) {
      journal("alerte : appareil.json et la base ne donnent pas le même identifiant de poste ; le fichier est corrigé sur la base");
    }
    ecrireAppareilId(dossier, id);
  }
  return id;
}
