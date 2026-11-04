/** Pont exposé par le préchargement Electron. Absent sur le web : c'est le seul test de mode (D438). */
export interface PontDesktop {
  version: string;
}
declare global {
  interface Window {
    medconnecteDesktop?: PontDesktop;
  }
}
export function pontDesktop(): PontDesktop | null {
  return typeof window !== "undefined" && window.medconnecteDesktop ? window.medconnecteDesktop : null;
}
