/**
 * Règles pures de la saisie des espèces de la caisse (montant total, sans coupures).
 * Aucune dépendance à React.
 */

/** Plafond accepté par le serveur pour un total d'espèces, en GNF. */
export const MONTANT_ESPECES_MAX = 1_000_000_000;

/** Garde les chiffres d'une saisie (lettres, espaces et séparateurs de milliers retirés), plafonnée au maximum du serveur. */
export function chiffresDepuisSaisie(texte: string): string {
  const chiffres = texte.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (chiffres.length > 10 || Number(chiffres) > MONTANT_ESPECES_MAX) return String(MONTANT_ESPECES_MAX);
  return chiffres;
}

/** Montant saisi, ou null tant que le champ est vide. */
export function montantDepuisChiffres(chiffres: string): number | null {
  return chiffres === "" ? null : Number.parseInt(chiffres, 10);
}

/** Affichage du champ : milliers séparés par une espace (« 350 000 »). */
export function afficherSaisie(chiffres: string): string {
  return chiffres.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
