/**
 * Base locale illisible (D740, D752). Une base abîmée n'est jamais supprimée ni écrasée : elle est
 * renommée, avec ses fichiers -wal et -shm, et seulement si le vendeur choisit de repartir d'une base vide.
 *
 * Illisible : l'ouverture échoue avec une erreur SQLite « pas une base » ou « corrompue » (un fichier abîmé
 * échoue dès le premier PRAGMA, avant tout contrôle), ou `quick_check` échoue. Ne sont PAS illisibles :
 * une base plus récente que l'application (`migrer`) et le mode WAL refusé (`exigerWal`) : ces erreurs
 * remontent à l'appelant, qui affiche un message et quitte, sans rien renommer.
 */
import type { Stockage } from "./stockage";
import { controlerBase, examinerFichier, ouvrirStockage } from "./stockage_sqlite";

export const MESSAGE_BASE_ILLISIBLE =
  "Les ventes enregistrées sur ce poste n'ont pas pu être relues. Le fichier est conservé. Appelez le support avant de continuer.";
export const MESSAGE_RENOMMAGE_IMPOSSIBLE =
  "Le fichier de la caisse n'a pas pu être mis de côté (il est peut-être utilisé par un autre programme). Il n'a pas été modifié. Fermez les autres programmes, redémarrez l'ordinateur ou appelez le support.";

export type ChoixBaseIllisible = "QUITTER" | "REPARTIR";

export interface FichiersBase {
  existe(chemin: string): boolean;
  /** Lève si le renommage échoue (fichier verrouillé...). Ne doit jamais écraser une destination. */
  renommer(de: string, vers: string): void;
}

export interface OptionsBaseIllisible {
  /** Boîte de dialogue : « Quitter » (défaut) ou « Repartir d'une base vide ». */
  demander: () => Promise<ChoixBaseIllisible>;
  fichiers: FichiersBase;
  horloge: () => Date;
  /** Ouverture de la base (injectable pour les tests). */
  ouvrir?: (chemin: string) => Stockage;
  /** Examen du fichier sans écriture (injectable pour les tests). */
  examiner?: (chemin: string) => "absent" | "sain" | "illisible";
}

export type IssueBase =
  | { issue: "ouverte"; stockage: Stockage }
  /** Le vendeur a choisi de quitter : le fichier est intact, aucune base neuve. */
  | { issue: "quitter" }
  /** Fichiers mis de côté (chemins) et base neuve ouverte, pas encore migrée. */
  | { issue: "remise-a-vide"; stockage: Stockage; misDeCote: string[] }
  /** Le renommage a échoué : message à afficher, quitter, aucune base neuve. */
  | { issue: "renommage-impossible"; message: string };

const SUFFIXES = ["", "-wal", "-shm"] as const;

/** Erreur SQLite qui dit « ce fichier n'est pas une base lisible ». */
export function estBaseIllisible(erreur: unknown): boolean {
  const code = typeof erreur === "object" && erreur !== null ? (erreur as { code?: unknown }).code : undefined;
  return typeof code === "string" && (code === "SQLITE_NOTADB" || code.startsWith("SQLITE_CORRUPT"));
}

function horodatage(d: Date): string {
  const iso = d.toISOString();
  return `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}-${iso.slice(11, 13)}${iso.slice(14, 16)}`;
}

/** Premier nom `<dossier>/caisse-illisible-<horodatage>[-n].sqlite` dont aucun des trois fichiers n'existe. */
function nomLibre(chemin: string, fichiers: FichiersBase, moment: Date): string {
  const dossier = chemin.slice(0, Math.max(chemin.lastIndexOf("/"), chemin.lastIndexOf("\\")) + 1);
  const base = `${dossier}caisse-illisible-${horodatage(moment)}`;
  for (let n = 1; ; n++) {
    const candidat = n === 1 ? base : `${base}-${n}`;
    if (SUFFIXES.every((s) => !fichiers.existe(`${candidat}.sqlite${s}`))) return candidat;
  }
}

/**
 * Ouvre la base du poste. Saine : ouverte (pas encore migrée). Illisible : boîte de dialogue, puis
 * soit rien (« Quitter »), soit renommage des fichiers et base neuve.
 */
export async function traiterBaseIllisible(chemin: string, options: OptionsBaseIllisible): Promise<IssueBase> {
  const ouvrir = options.ouvrir ?? ouvrirStockage;
  // Examen en lecture seule d'abord : ouvrir puis refermer une base abîmée supprimerait son -wal et son -shm.
  if ((options.examiner ?? examinerFichier)(chemin) !== "illisible") {
    let existante: Stockage | null = null;
    try {
      existante = ouvrir(chemin);
    } catch (erreur) {
      if (!estBaseIllisible(erreur)) throw erreur;
    }
    if (existante !== null) {
      if (controlerBase(existante)) return { issue: "ouverte", stockage: existante };
      existante.fermer();
    }
  }

  if ((await options.demander()) !== "REPARTIR") return { issue: "quitter" };

  const destination = nomLibre(chemin, options.fichiers, options.horloge());
  const faits: { de: string; vers: string }[] = [];
  try {
    for (const suffixe of SUFFIXES) {
      const source = `${chemin}${suffixe}`;
      if (!options.fichiers.existe(source)) continue;
      const vers = `${destination}.sqlite${suffixe}`;
      options.fichiers.renommer(source, vers);
      faits.push({ de: source, vers });
    }
  } catch {
    // Retour en arrière au mieux : rien ne doit rester à moitié déplacé.
    for (const { de, vers } of faits.reverse()) {
      try {
        options.fichiers.renommer(vers, de);
      } catch {
        // Le fichier mis de côté reste dans son nouveau nom : rien n'est perdu.
      }
    }
    return { issue: "renommage-impossible", message: MESSAGE_RENOMMAGE_IMPOSSIBLE };
  }

  const stockage = ouvrir(chemin);
  return { issue: "remise-a-vide", stockage, misDeCote: faits.map((f) => f.vers) };
}
