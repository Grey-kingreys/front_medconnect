/**
 * Réglages du poste (PD05) : imprimante, format du ticket, impression automatique.
 * Table `reglages` (clé, valeur en texte), jamais d'information de vente ni de jeton.
 */
import type { FormatTicket, ReglagesPoste } from "@/lib/caisse/contrat_desktop";
import type { Stockage } from "./stockage";

export const FORMAT_PAR_DEFAUT: FormatTicket = "58";
const FORMATS: readonly FormatTicket[] = ["58", "80", "A4"];

const CLE_IMPRIMANTE = "imprimante";
const CLE_FORMAT = "formatRecu";
const CLE_AUTOMATIQUE = "impressionAutomatique";

function lireCle(s: Stockage, cle: string): string | null {
  return s.lireUn<{ valeur: string }>("SELECT valeur FROM reglages WHERE cle = ?", [cle])?.valeur ?? null;
}

/**
 * Lit les réglages. L'impression automatique est active dès qu'une imprimante est choisie (D746),
 * tant que le vendeur ne l'a pas désactivée : sans valeur enregistrée, elle suit l'imprimante.
 */
export function lireReglages(s: Stockage): ReglagesPoste {
  const imprimante = lireCle(s, CLE_IMPRIMANTE);
  const format = lireCle(s, CLE_FORMAT);
  const automatique = lireCle(s, CLE_AUTOMATIQUE);
  const avecImprimante = imprimante !== null && imprimante !== "";
  return {
    imprimante: avecImprimante ? imprimante : null,
    formatRecu: (FORMATS as readonly string[]).includes(format ?? "") ? (format as FormatTicket) : FORMAT_PAR_DEFAUT,
    // Sans imprimante, rien ne peut s'imprimer : jamais active.
    impressionAutomatique: avecImprimante && (automatique === null ? true : automatique === "1"),
  };
}

/** Enregistre les seules clés fournies, en une transaction ; renvoie les réglages à jour. */
export function enregistrerReglages(s: Stockage, modif: Partial<ReglagesPoste>): ReglagesPoste {
  s.transaction(() => {
    if (modif.imprimante !== undefined) {
      if (modif.imprimante === null) s.executer("DELETE FROM reglages WHERE cle = ?", [CLE_IMPRIMANTE]);
      else s.executer("INSERT OR REPLACE INTO reglages (cle, valeur) VALUES (?, ?)", [CLE_IMPRIMANTE, modif.imprimante]);
    }
    if (modif.formatRecu !== undefined) {
      s.executer("INSERT OR REPLACE INTO reglages (cle, valeur) VALUES (?, ?)", [CLE_FORMAT, modif.formatRecu]);
    }
    if (modif.impressionAutomatique !== undefined) {
      s.executer("INSERT OR REPLACE INTO reglages (cle, valeur) VALUES (?, ?)", [
        CLE_AUTOMATIQUE,
        modif.impressionAutomatique ? "1" : "0",
      ]);
    }
  });
  return lireReglages(s);
}
