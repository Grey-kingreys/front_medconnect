// Règle d'installation d'une mise à jour (plan 4.7, D747) : jamais pendant une caisse ouverte,
// jamais tant que des ventes n'ont pas été acceptées par le serveur. L'un ou l'autre suffit à refuser.
import type { EtatLocal } from "./types_caisse";

export type EtatPourMaj = Pick<EtatLocal, "sessionOuverte" | "fileEnAttente">;

export function peutInstaller(etat: EtatPourMaj): boolean {
  return !etat.sessionOuverte && etat.fileEnAttente === 0;
}

/** Une adresse de mise à jour n'est utilisée qu'en `https`, ou en `http` sur 127.0.0.1 (preuve sur ce poste). */
export function adresseMajValide(adresse: string | undefined): boolean {
  if (!adresse) return false;
  try {
    const url = new URL(adresse);
    return url.protocol === "https:" || (url.protocol === "http:" && url.hostname === "127.0.0.1");
  } catch {
    return false;
  }
}

export const MESSAGE_MAJ_INTERDITE = "Fermez d'abord la caisse et attendez l'envoi des ventes.";

export function messageMajPrete(version: string): string {
  return `Mise à jour ${version} prête : elle s'installera à la fermeture.`;
}
