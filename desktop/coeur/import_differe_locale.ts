/**
 * Import Excel du stock mis de côté hors ligne (décision Q7). Aucun aperçu, aucune modification du stock local :
 * le fichier part tel quel dans un événement `IMPORT_STOCK_FICHIER` et le serveur l'analyse et l'importe comme en ligne
 * au retour du réseau. Le résultat (lignes importées et refusées) revient par la photographie : les 20 derniers imports
 * du poste, sans coût ni heure.
 *
 * Le contenu du fichier reste dans l'événement du journal ; la liste ci-dessous n'en lit que l'identifiant, le mode et
 * le nom (json_extract), jamais le contenu.
 */
import type { CorpsImportDiffere, ImportDiffere, ModeImportStock, ResultatImportDiffere } from "@/lib/api_pharmacie";
import { TAILLE_MAX_FICHIER_DIFFERE } from "@/lib/api_pharmacie";
import type { Contexte } from "./contexte";
import { exigerUuid, refusValidation } from "./refus";
import type { Utilisateur } from "./types_caisse";
import type { ImportDiffereSynchro } from "./types_synchro";

export const CLE_IMPORTS_DIFFERES_PHOTO = "imports_differes_photo";
export const IMPORTS_DIFFERES_MAX = 20;

export const MESSAGE_FICHIER_DIFFERE_ILLISIBLE = "Ce fichier n'a pas pu être lu. Choisissez-le à nouveau, ou partez du modèle Excel.";
export const MESSAGE_FICHIER_DIFFERE_TROP_GROS = "Hors ligne, le fichier ne doit pas dépasser 1,4 Mo. Gardez seulement vos médicaments dans la feuille « Stock », puis réessayez.";
export const MESSAGE_FICHIER_DIFFERE_FORMAT = "Le fichier doit être un classeur Excel (.xlsx). Téléchargez le modèle pour partir d'un fichier valide.";
export const MESSAGE_IMPORT_MIS_DE_COTE = "Fichier mis de côté : il sera importé automatiquement au retour du réseau. Vous verrez le résultat dans les anomalies et sur la page du stock.";
export const MESSAGE_IMPORT_DIFFERE_REJOUE = "Ce fichier était déjà mis de côté.";

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const REQUETE_PAR_ID = "SELECT sequence FROM evenements WHERE type = 'IMPORT_STOCK_FICHIER' AND json_extract(corps, '$.id') = ?";

function modeValide(mode: unknown): mode is ModeImportStock {
  return mode === "livraison" || mode === "inventaire";
}

/** Vrai si un import de cet identifiant est déjà dans le journal (rejeu). */
export function importDejaMisDeCote(c: Contexte, id: string): boolean {
  const ligne = c.stockage.lireUn<{ sequence: number }>(REQUETE_PAR_ID, [id]);
  return ligne !== undefined && ligne !== null;
}

/** Met le fichier de côté : un seul événement dans le journal, rien d'autre n'est écrit. Rejouable avec le même identifiant. */
export function mettreImportDeCoteLocal(c: Contexte, corps: CorpsImportDiffere & { id: string }, u: Utilisateur): ImportDiffere {
  return c.stockage.transaction(() => {
    const { id, mode, nomFichier, contenuBase64 } = corps;
    exigerUuid(id, "de l'import");
    if (!modeValide(mode)) throw refusValidation(MESSAGE_FICHIER_DIFFERE_ILLISIBLE);
    if (typeof nomFichier !== "string" || !/\.xlsx$/i.test(nomFichier.trim())) throw refusValidation(MESSAGE_FICHIER_DIFFERE_FORMAT);
    if (typeof contenuBase64 !== "string" || contenuBase64.length === 0 || contenuBase64.length % 4 !== 0 || !BASE64.test(contenuBase64)) {
      throw refusValidation(MESSAGE_FICHIER_DIFFERE_ILLISIBLE);
    }
    // Taille réelle du fichier : 3 octets pour 4 caractères, moins le bourrage
    const bourrage = contenuBase64.endsWith("==") ? 2 : contenuBase64.endsWith("=") ? 1 : 0;
    if ((contenuBase64.length / 4) * 3 - bourrage > TAILLE_MAX_FICHIER_DIFFERE) throw refusValidation(MESSAGE_FICHIER_DIFFERE_TROP_GROS);

    const nom = nomFichier.trim();
    const mis: ImportDiffere = { id, mode, nomFichier: nom, statut: "EN_ATTENTE", message: null, resultat: null };
    if (importDejaMisDeCote(c, id)) return mis;
    c.ajouterEvenement("IMPORT_STOCK_FICHIER", u.id, { id, mode, nomFichier: nom, contenuBase64 });
    return mis;
  });
}

interface LigneEvenement {
  id: string | null;
  mode: string | null;
  nomFichier: string | null;
  statut: "A_ENVOYER" | "ENVOYE" | "EN_ATTENTE" | "REJETE";
  message: string | null;
  sequence: number;
}

function lirePhoto(c: Contexte): ImportDiffereSynchro[] {
  const texte = c.stockage.lireUn<{ valeur: string }>("SELECT valeur FROM reglages WHERE cle = ?", [CLE_IMPORTS_DIFFERES_PHOTO])?.valeur;
  if (texte === undefined) return [];
  try {
    const liste = JSON.parse(texte) as unknown;
    return Array.isArray(liste) ? (liste as ImportDiffereSynchro[]) : [];
  } catch {
    return [];
  }
}

/** Range les imports de la photographie (les 20 derniers du poste, sans contenu) pour les relire hors ligne. */
export function rangerImportsDifferesPhoto(c: Contexte, liste: ImportDiffereSynchro[]): void {
  c.stockage.executer("INSERT OR REPLACE INTO reglages (cle, valeur) VALUES (?, ?)", [CLE_IMPORTS_DIFFERES_PHOTO, JSON.stringify(liste.slice(0, IMPORTS_DIFFERES_MAX))]);
}

function depuisPhoto(p: ImportDiffereSynchro): ImportDiffere {
  const mode = modeValide(p.mode) ? p.mode : null;
  const base = { id: p.id, mode, nomFichier: p.nomFichier ?? "" };
  if (p.statut === "REJETE") return { ...base, statut: "REFUSE", message: p.message, resultat: null };
  if (p.statut === "APPLIQUE") return { ...base, statut: "TRAITE", message: null, resultat: (p.importe as ResultatImportDiffere | null) ?? null };
  return { ...base, statut: "ENVOYE", message: null, resultat: null };
}

/**
 * Imports en attente ou traités, les plus récents d'abord (20 au plus) : ceux du journal local (en attente, envoyés ou
 * refusés), complétés par le résultat de la dernière photographie, puis les imports de la photographie que ce poste n'a
 * plus dans son journal.
 */
export function listerImportsDifferesLocaux(c: Contexte): ImportDiffere[] {
  const lignes = c.stockage.lire<LigneEvenement>(
    `SELECT json_extract(corps, '$.id') AS id, json_extract(corps, '$.mode') AS mode, json_extract(corps, '$.nomFichier') AS nomFichier,
            statut, message, sequence
     FROM evenements WHERE type = 'IMPORT_STOCK_FICHIER' ORDER BY sequence DESC LIMIT ?`,
    [IMPORTS_DIFFERES_MAX],
  );
  const parId = new Map(lirePhoto(c).map((p) => [p.id, p]));
  const vus = new Set<string>();
  const resultat: ImportDiffere[] = [];
  for (const l of lignes) {
    if (l.id === null) continue;
    vus.add(l.id);
    const p = parId.get(l.id);
    const mode = modeValide(l.mode) ? l.mode : null;
    const base = { id: l.id, mode, nomFichier: l.nomFichier ?? "" };
    if (l.statut === "REJETE") resultat.push({ ...base, statut: "REFUSE", message: l.message ?? p?.message ?? null, resultat: null });
    else if (p !== undefined && p.statut === "APPLIQUE") resultat.push(depuisPhoto(p));
    else resultat.push({ ...base, statut: l.statut === "A_ENVOYER" ? "EN_ATTENTE" : "ENVOYE", message: null, resultat: null });
  }
  for (const p of parId.values()) {
    if (!vus.has(p.id)) resultat.push(depuisPhoto(p));
  }
  return resultat.slice(0, IMPORTS_DIFFERES_MAX);
}
