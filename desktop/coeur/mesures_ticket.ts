/**
 * Mesures de la page d'un ticket (PD05). Electron attend la taille de page en microns ;
 * un pixel CSS fait 264,58 microns (96 pixels par pouce).
 */
import type { FormatTicket } from "@/lib/caisse/contrat_desktop";

export const MICRONS_PAR_PIXEL = 264.58;
/** Marge de sécurité sous le ticket, pour que le coupeur ne rogne pas la dernière ligne. */
export const MARGE_BAS_MICRONS = 3_000;

export function largeurMicrons(format: Exclude<FormatTicket, "A4">): number {
  return format === "58" ? 58_000 : 80_000;
}

export function hauteurMicrons(hauteurPixels: number): number {
  const px = Number.isFinite(hauteurPixels) && hauteurPixels > 0 ? hauteurPixels : 0;
  return Math.ceil(px * MICRONS_PAR_PIXEL) + MARGE_BAS_MICRONS;
}

export type TaillePage = "A4" | { width: number; height: number };

export function taillePage(format: FormatTicket, hauteurPixels: number): TaillePage {
  return format === "A4" ? "A4" : { width: largeurMicrons(format), height: hauteurMicrons(hauteurPixels) };
}
