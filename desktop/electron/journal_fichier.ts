// Journal local en fichier (`journal.log` dans userData), visible par le support : en paquet, la console n'existe pas.
// Jamais de jeton ni de vente : seulement des événements de démarrage, en français. Le fichier est créé s'il manque
// et repart à zéro au-delà de 256 Ko.
import { appendFileSync, existsSync, renameSync, statSync } from "node:fs";
import path from "node:path";

const TAILLE_MAX = 256 * 1024;

export function creerJournalFichier(dossier: string): (message: string) => void {
  const fichier = path.join(dossier, "journal.log");
  return (message) => {
    try {
      if (existsSync(fichier) && statSync(fichier).size > TAILLE_MAX) renameSync(fichier, `${fichier}.ancien`);
      appendFileSync(fichier, `${new Date().toISOString()} ${message}\n`);
    } catch {
      // Le journal ne doit jamais empêcher la caisse de démarrer.
    }
  };
}

/** Une ligne par fichier de données du poste : présent ou absent, taille, date de modification. Aucun contenu. */
export function decrireFichiers(dossier: string, appareilValide: boolean, appareilId: string | null): string[] {
  return ["caisse.sqlite", "caisse.sqlite-wal", "caisse.sqlite-shm", "appareil.json"].map((nom) => {
    const complet = path.join(dossier, nom);
    try {
      const stat = statSync(complet);
      const base = `fichier ${nom} : présent, ${stat.size} octets, modifié le ${stat.mtime.toISOString()}`;
      if (nom !== "appareil.json") return base;
      return appareilValide ? `${base}, valide, identifiant ${appareilId}` : `${base}, non valide`;
    } catch {
      return `fichier ${nom} : absent`;
    }
  });
}
