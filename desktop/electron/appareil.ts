// Identifiant du poste gardé hors de la base (D752) : une base remise à vide garde le même poste.
// Aucun import d'electron : le dossier est donné par l'appelant (userData), ce qui rend le module testable.
import { closeSync, fsyncSync, openSync, readFileSync, renameSync, statSync, writeSync } from "node:fs";
import path from "node:path";
import { baseVueVideSuspecte } from "../coeur/base_suspecte";
import type { CoeurCaisse } from "../coeur/coeur";
import { lireAppareilIdEnLectureSeule } from "../coeur/stockage_sqlite";

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

function tailleFichier(chemin: string): number | null {
  try {
    return statSync(chemin).size;
  } catch {
    return null;
  }
}

/**
 * Examen sans écriture, avant toute ouverture de la base : vrai si elle serait vue vide alors qu'un -wal et
 * appareil.json existent (voir `base_suspecte`). Une base illisible n'est pas suspecte : `traiterBaseIllisible` s'en charge.
 */
export function baseSuspecteSurDisque(dossier: string): boolean {
  const chemin = path.join(dossier, "caisse.sqlite");
  const tailleBase = tailleFichier(chemin);
  const tailleWal = tailleFichier(`${chemin}-wal`);
  const appareilJsonValide = lireAppareilId(dossier) !== null;
  // Pas la peine d'ouvrir quoi que ce soit si une des trois premières conditions manque.
  if (!tailleBase || !tailleWal || !appareilJsonValide) return false;
  const lu = lireAppareilIdEnLectureSeule(chemin);
  if (lu === "illisible") return false;
  return baseVueVideSuspecte({ tailleBase, tailleWal, appareilJsonValide, appareilIdEnBase: lu });
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
 * s'il manque. Fichier valide et base qui porte déjà un autre identifiant : la base a été remplacée ; rien n'est écrit
 * (ni fichier, ni base), l'erreur `PosteIncoherent` est levée et l'appelant s'arrête.
 */
export class PosteIncoherent extends Error {
  constructor() {
    super(MESSAGE_POSTE_INCOHERENT);
    this.name = "PosteIncoherent";
  }
}

export const MESSAGE_POSTE_INCOHERENT =
  "Les données de ce poste ne correspondent pas à son identifiant. N'enregistrez rien et contactez l'assistance.";

export function fixerAppareil(coeur: CoeurCaisse, dossier: string, journal: (message: string) => void = () => undefined): string {
  const dansFichier = lireAppareilId(dossier);
  const dansBase = coeur.appareilIdConnu();
  if (dansFichier !== null && dansBase && dansBase !== dansFichier) {
    journal("arrêt : appareil.json et la base ne donnent pas le même identifiant de poste ; aucun fichier n'est modifié");
    throw new PosteIncoherent();
  }
  if (dansFichier !== null) coeur.fixerAppareilId(dansFichier);
  const id = coeur.appareilId();
  if (dansFichier === null) ecrireAppareilId(dossier, id);
  return id;
}
