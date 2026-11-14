/**
 * Règles d'affichage de la marge (D698). Pures : aucun accès réseau.
 * Une valeur nulle est inconnue et ne devient jamais « 0 ».
 */
import type { RapportMarge } from "./api_pilotage";

/** Taux de marge en pour cent, à une décimale, sur les seules ventes au coût connu ; null s'il n'y en a pas. */
export function tauxMarge(r: Pick<RapportMarge, "marge" | "chiffreAffairesValorise">): number | null {
  if (!(r.chiffreAffairesValorise > 0)) return null;
  return Math.round((r.marge / r.chiffreAffairesValorise) * 1000) / 10;
}

/** « 23,5 % » (espace insécable) ou « inconnu ». */
export function formaterTaux(taux: number | null): string {
  if (taux === null) return "inconnu";
  return `${taux.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

/** Vrai si le serveur a transmis la clé, même avec une valeur nulle (les clés de coût manquent sans `marge:read`). */
export function aCoutTransmis(objet: object, cle: string): boolean {
  return Object.prototype.hasOwnProperty.call(objet, cle);
}
