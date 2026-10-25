/**
 * Déconnexion forcée : appareil déconnecté à distance ou compte désactivé.
 * Déclencheurs : 401 avec code (api_auth), événement en direct « sessionRevoquee ».
 * Effet : nettoyage local, motif gardé pour la page de connexion, AuthProvider prévenu.
 */

export type MotifDeconnexion = "SESSION_REVOQUEE" | "COMPTE_DESACTIVE";

export const MESSAGES_DECONNEXION: Record<MotifDeconnexion, string> = {
  SESSION_REVOQUEE: "Vous avez été déconnecté de cet appareil.",
  COMPTE_DESACTIVE: "Votre compte a été désactivé. Contactez votre structure.",
};

/** Nom de l'événement window écouté par AuthProvider. */
export const EVENEMENT_DECONNEXION_FORCEE = "mc:deconnexion-forcee";

export interface DetailDeconnexionForcee {
  motif: MotifDeconnexion;
}

const CLE_MOTIF = "mc_motif_deconnexion";

/** Code reçu du serveur vers un motif ; null si le code ne force pas la déconnexion. */
export function motifDepuisCode(code: unknown): MotifDeconnexion | null {
  if (code === "COMPTE_DESACTIVE") return "COMPTE_DESACTIVE";
  if (code === "SESSION_REVOQUEE" || code === "REFRESH_REUTILISE") return "SESSION_REVOQUEE";
  return null;
}

/** Motif d'une réponse en erreur : seulement pour un 401 portant un code connu. */
export function motifDepuisReponse(status: number, details?: Record<string, unknown>): MotifDeconnexion | null {
  return status === 401 ? motifDepuisCode(details?.code) : null;
}

function nettoyerConnexionLocale(): void {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user");
  // Cookie témoin lu par src/proxy.ts (voir useAuth.tsx)
  document.cookie = "mc_connecte=; path=/; max-age=0; SameSite=Lax";
}

export function deconnexionForcee(motif: MotifDeconnexion): void {
  if (typeof window === "undefined") return;
  nettoyerConnexionLocale();
  try {
    sessionStorage.setItem(CLE_MOTIF, motif);
  } catch {
    // Stockage indisponible : la redirection se fait quand même, sans message
  }
  window.dispatchEvent(
    new CustomEvent<DetailDeconnexionForcee>(EVENEMENT_DECONNEXION_FORCEE, { detail: { motif } }),
  );
}

/** Lit puis efface le motif gardé pour la page de connexion. */
export function lireEtEffacerMotif(): MotifDeconnexion | null {
  if (typeof window === "undefined") return null;
  try {
    const valeur = sessionStorage.getItem(CLE_MOTIF);
    sessionStorage.removeItem(CLE_MOTIF);
    return valeur === "SESSION_REVOQUEE" || valeur === "COMPTE_DESACTIVE" ? valeur : null;
  } catch {
    return null;
  }
}

/** Gestionnaire de l'événement en direct « sessionRevoquee » ({ code, message }). */
export function gererSessionRevoquee(donnees: unknown): void {
  const code = donnees && typeof donnees === "object" ? (donnees as { code?: unknown }).code : undefined;
  deconnexionForcee(motifDepuisCode(code) ?? "SESSION_REVOQUEE");
}
