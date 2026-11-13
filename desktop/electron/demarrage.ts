// Ouverture de la caisse locale au démarrage : base, contrôle, migrations, identifiant du poste.
// Une base illisible n'est jamais supprimée (D740) ; une base plus récente que l'application ou un
// mode WAL refusé s'arrêtent avec un message, sans rien renommer.
import { app, dialog } from "electron";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { MESSAGE_BASE_ILLISIBLE, traiterBaseIllisible, type ChoixBaseIllisible } from "../coeur/base_illisible";
import { MESSAGE_BASE_SUSPECTE } from "../coeur/base_suspecte";
import { CoeurCaisse } from "../coeur/coeur";
import { migrer } from "../coeur/schema";
import type { Stockage } from "../coeur/stockage";
import { MESSAGE_POSTE_INCOHERENT, PosteIncoherent, baseSuspecteSurDisque, fixerAppareil, lireAppareilId } from "./appareil";
import { creerJournalFichier, decrireFichiers } from "./journal_fichier";
import { fichiersReels } from "./fichiers";

const TITRE = "MedConnecte Caisse";
const MESSAGE_OUVERTURE_IMPOSSIBLE =
  "La base de la caisse n'a pas pu être ouverte. Elle n'a pas été modifiée. Redémarrez l'ordinateur ou appelez le support.";

export interface CaisseOuverte {
  coeur: CoeurCaisse;
  stockage: Stockage;
  /** Dossier des données du poste (userData) : base et appareil.json. */
  dossier: string;
}

function arret(message: string): null {
  dialog.showErrorBox(TITRE, message);
  app.exit(1);
  return null;
}

/** Messages écrits pour le vendeur dans le cœur (base plus récente, WAL refusé) : affichés tels quels. */
function messageLisible(erreur: unknown): string {
  const message = erreur instanceof Error ? erreur.message : "";
  return message.startsWith("La base locale") ? message : MESSAGE_OUVERTURE_IMPOSSIBLE;
}

/** `null` : l'application s'arrête (choix du vendeur ou erreur déjà affichée). */
export async function ouvrirCaisse(options: { sansInterface: boolean }): Promise<CaisseOuverte | null> {
  const dossier = app.getPath("userData");
  mkdirSync(dossier, { recursive: true });
  const chemin = path.join(dossier, "caisse.sqlite");

  const demander = async (): Promise<ChoixBaseIllisible> => {
    // Sonde sans interface : aucune boîte à cliquer, le fichier est conservé.
    if (options.sansInterface) return "QUITTER";
    const { response } = await dialog.showMessageBox({
      type: "error",
      title: TITRE,
      message: MESSAGE_BASE_ILLISIBLE,
      buttons: ["Quitter", "Repartir d'une base vide"],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    return response === 1 ? "REPARTIR" : "QUITTER";
  };

  // Avant toute ouverture de la base : l'état des fichiers tel que le poste les a trouvés.
  const journalFichier = creerJournalFichier(dossier);
  const idFichier = lireAppareilId(dossier);
  for (const ligne of decrireFichiers(dossier, idFichier !== null, idFichier)) journalFichier(ligne);

  // Base vue vide avec un -wal alors que appareil.json existe : rien n'est ouvert en écriture ni renommé.
  let suspecte = false;
  try {
    suspecte = baseSuspecteSurDisque(dossier);
  } catch (erreur) {
    return arret(messageLisible(erreur));
  }
  if (suspecte) {
    journalFichier("arrêt : base vue vide avec un -wal alors que appareil.json existe ; aucun fichier n'est modifié");
    if (options.sansInterface) {
      app.exit(1);
      return null;
    }
    return arret(MESSAGE_BASE_SUSPECTE);
  }

  let stockage: Stockage;
  try {
    const issue = await traiterBaseIllisible(chemin, { demander, fichiers: fichiersReels, horloge: () => new Date() });
    if (issue.issue === "quitter") {
      app.exit(0);
      return null;
    }
    if (issue.issue === "renommage-impossible") return arret(issue.message);
    stockage = issue.stockage;
  } catch (erreur) {
    return arret(messageLisible(erreur));
  }

  try {
    migrer(stockage);
  } catch (erreur) {
    stockage.fermer();
    return arret(messageLisible(erreur));
  }

  const coeur = new CoeurCaisse(stockage, { horloge: () => new Date(), genererId: () => randomUUID() });
  try {
    const dansBase = coeur.appareilIdConnu();
    const retenu = fixerAppareil(coeur, dossier, (message) => {
      console.warn(`[caisse] ${message}`);
      journalFichier(message);
    });
    let ventes = "inconnu";
    try {
      ventes = String(stockage.lireUn<{ n: number }>("SELECT COUNT(*) AS n FROM ventes")?.n ?? "inconnu");
    } catch {
      // Le comptage ne doit jamais empêcher le démarrage.
    }
    journalFichier(`démarrage : identifiant retenu ${retenu}, identifiant trouvé en base avant ${dansBase ?? "aucun"}, ${ventes} vente(s) locale(s)`);
  } catch (erreur) {
    stockage.fermer();
    if (erreur instanceof PosteIncoherent) {
      // Sonde sans interface : aucune boîte à cliquer, l'arrêt suffit.
      if (options.sansInterface) {
        app.exit(1);
        return null;
      }
      return arret(MESSAGE_POSTE_INCOHERENT);
    }
    return arret(messageLisible(erreur));
  }
  return { coeur, stockage, dossier };
}
