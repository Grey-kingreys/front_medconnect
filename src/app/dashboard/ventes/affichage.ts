/**
 * Affichage des ventes d'une pharmacie : format du reçu, dates en heure de Conakry, motif d'annulation.
 * Logique pure, aucune dépendance à React.
 */
import type { LigneVente, StatutVente, TypePiece } from "@/lib/api_ventes";
import { deOuD } from "@/lib/caisse/regles/quantites";

export type FormatRecu = "58" | "80" | "A4";
export const FORMATS_RECU: readonly { valeur: FormatRecu; libelle: string }[] = [
  { valeur: "58", libelle: "Ticket 58 mm" },
  { valeur: "80", libelle: "Ticket 80 mm" },
  { valeur: "A4", libelle: "Feuille A4" },
];
export const FORMAT_RECU_PAR_DEFAUT: FormatRecu = "58";
export const CLE_FORMAT_RECU = "medconnecte:format-recu";
export const LONGUEUR_MIN_MOTIF = 3;
export const LONGUEUR_MAX_MOTIF = 300;

export const LIBELLES_STATUT: Record<StatutVente, string> = { VALIDEE: "Validée", ANNULEE: "Annulée" };

export const LIBELLES_TYPE_PIECE: Record<TypePiece, string> = {
  VENTE: "Vente",
  ANNULATION: "Annulation",
  REGULARISATION: "Régularisation",
};

/** « 2 boîtes de Paracétamol », « 6 unités de Paracétamol » : le libellé exact de l'unité n'est pas connu côté reçu. */
export function libelleLigneVente(ligne: Pick<LigneVente, "uniteAffichee" | "nombreAffiche" | "nomMedicament">): string {
  // Une pièce d'annulation porte des nombres négatifs : le libellé compte toujours en positif.
  const n = Math.abs(ligne.nombreAffiche);
  const mot = ligne.uniteAffichee === "BOITE" ? (n > 1 ? "boîtes" : "boîte") : n > 1 ? "unités" : "unité";
  return `${n.toLocaleString("fr-FR")} ${mot} ${deOuD(ligne.nomMedicament)}`;
}

/** Prix d'une boîte ou d'une unité affiché : le sous-total fait foi, divisé par le nombre affiché et arrondi. */
export function prixUnitaireAffiche(ligne: Pick<LigneVente, "sousTotal" | "nombreAffiche">): number {
  return ligne.nombreAffiche !== 0 ? Math.round(Math.abs(ligne.sousTotal / ligne.nombreAffiche)) : Math.abs(ligne.sousTotal);
}

const estFormatRecu = (valeur: unknown): valeur is FormatRecu => FORMATS_RECU.some((f) => f.valeur === valeur);

/** Format de reçu mémorisé sur ce poste, ou le format par défaut. */
export function lireFormatRecu(): FormatRecu {
  if (typeof window === "undefined") return FORMAT_RECU_PAR_DEFAUT;
  try {
    const valeur = localStorage.getItem(CLE_FORMAT_RECU);
    return estFormatRecu(valeur) ? valeur : FORMAT_RECU_PAR_DEFAUT;
  } catch {
    return FORMAT_RECU_PAR_DEFAUT;
  }
}

export function enregistrerFormatRecu(format: FormatRecu): void {
  try {
    localStorage.setItem(CLE_FORMAT_RECU, format);
  } catch {
    // Stockage indisponible : le choix n'est pas mémorisé.
  }
}

/** Jour AAAA-MM-JJ d'une date. Conakry est à UTC+0 : le jour UTC est le jour local. */
export function jourConakry(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formaterDateCourte(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Conakry",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

export function formaterHeure(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Conakry",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formaterDateHeure(iso: string): string {
  return `${formaterDateCourte(iso)} à ${formaterHeure(iso)}`;
}

/** Jour AAAA-MM-JJ en toutes lettres, par exemple « jeudi 22 octobre 2026 ». */
export function formaterJour(jour: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${jour}T00:00:00.000Z`));
}

export function motifValide(motif: string): boolean {
  const longueur = motif.trim().length;
  return longueur >= LONGUEUR_MIN_MOTIF && longueur <= LONGUEUR_MAX_MOTIF;
}

export function libelleArticles(n: number): string {
  // Une pièce d'annulation porte un nombre d'articles négatif : l'écran compte en positif.
  const positif = Math.abs(n);
  return positif === 1 ? "1 article" : `${positif} articles`;
}
