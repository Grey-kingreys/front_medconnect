/**
 * Affichage du cahier de crédit : badges de statut, saisies filtrées. Logique pure, sans React.
 */
import { ui } from "@/theme/ui";
import { LIBELLES_STATUT_CREDIT, type StatutCredit } from "@/lib/api_credit";

export const CLASSE_BADGE_STATUT: Record<StatutCredit, string> = {
  EN_COURS: ui.badge.info,
  EN_RETARD: ui.badge.danger,
  SOLDE: ui.badge.succes,
};

export const libelleStatut = (statut: StatutCredit): string => LIBELLES_STATUT_CREDIT[statut];

/** Un montant se saisit en chiffres seulement (les lettres et espaces sont retirés). */
export const filtrerMontant = (saisie: string): string => saisie.replace(/\D/g, "");

/** Montant entier saisi, ou null s'il est vide ou invalide. */
export function lireMontant(saisie: string): number | null {
  if (!/^\d+$/.test(saisie)) return null;
  const n = Number(saisie);
  return Number.isSafeInteger(n) && n >= 1 ? n : null;
}

/** Texte de date AAAA-MM-JJ lisible (JJ/MM/AAAA), vide si absent. */
export function formaterJourCourt(jour: string | null): string {
  if (!jour) return "";
  const [a, m, j] = jour.slice(0, 10).split("-");
  return `${j}/${m}/${a}`;
}
