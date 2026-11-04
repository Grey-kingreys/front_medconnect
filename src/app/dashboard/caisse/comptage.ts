/**
 * Règles pures du comptage de caisse par coupure. Aucune dépendance à React.
 */
import type { Coupure, LigneComptage } from "@/lib/api_caisse";

/** Nombre maximal de billets d'une même coupure accepté par le serveur. */
export const NOMBRE_MAX_BILLETS = 10000;

/** Somme de la valeur faciale multipliée par le nombre de billets. */
export function totalComptage(lignes: LigneComptage[]): number {
  return lignes.reduce((somme, l) => somme + l.valeurFaciale * l.nombre, 0);
}

/** Une ligne à zéro par coupure du référentiel, rangées par ordre. */
export function lignesDepuisReferentiel(coupures: Coupure[]): LigneComptage[] {
  return [...coupures].sort((a, b) => a.ordre - b.ordre).map((c) => ({ valeurFaciale: c.valeurFaciale, nombre: 0 }));
}

/** Lignes à envoyer : seulement celles dont le nombre est positif (un fond nul donne un tableau vide). */
export function lignesAEnvoyer(lignes: LigneComptage[]): LigneComptage[] {
  return lignes.filter((l) => l.nombre > 0);
}
