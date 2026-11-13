/**
 * Relais vers src/theme/ui.ts, source unique du design.
 * Ce fichier ne doit plus être enrichi : ajouter les nouvelles entrées dans src/theme/ui.ts.
 * Les noms exportés sont conservés pour les écrans qui les importent encore.
 */
import { ui } from "@/theme/ui";

export const POLICE_TITRE = { fontFamily: "var(--font-outfit, var(--font-inter))" } as const;

export const CARTE = ui.carte;
export const CHAMP = ui.champ;
export const FOCUS = "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500";
export const BOUTON_PRIMAIRE = ui.bouton.primaire;
export const BOUTON_ICONE = ui.bouton.icone;
export const BOUTON_SECONDAIRE = ui.bouton.secondaire;

export const ALERTE_ERREUR = ui.alerte.erreur;
export const ALERTE_ATTENTION = ui.alerte.attention;
export const ALERTE_INFO = ui.alerte.info;
export const ALERTE_SUCCES = ui.alerte.succes;
