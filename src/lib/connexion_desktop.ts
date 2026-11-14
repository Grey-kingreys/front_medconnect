import { pontDesktop } from "./caisse/contrat_desktop";

/**
 * Connexion de l'application desktop (PD04b). Tout est inerte sans pont : le web garde son comportement exact.
 * Le test de panne lit les propriétés de l'erreur au lieu d'importer `ApiError`, pour ne pas créer de cycle avec `api_auth`.
 */

/** Statuts d'une panne de réseau ou d'un serveur injoignable (0 : aucune réponse). */
const STATUTS_PANNE = [0, 502, 503, 504];

/** Vrai si l'application desktop tourne et que l'erreur est une panne de réseau, pas un refus du serveur. */
export function panneReseauDesktop(err: unknown): boolean {
  if (pontDesktop() === null) return false;
  if (err instanceof TypeError) return true;
  if (err instanceof Error && err.name === "ApiError") {
    const status = (err as Error & { status?: unknown }).status;
    return typeof status === "number" && STATUTS_PANNE.includes(status);
  }
  return false;
}

/** Sans effet sur le web, et jamais d'exception : le jeton passe au processus principal, en mémoire seulement. */
export function pousserJeton(jeton: string | null): void {
  try {
    const pont = pontDesktop();
    if (pont === null) return;
    void Promise.resolve(pont.definirJeton(jeton)).catch(() => {});
  } catch {
    // Le pont est indisponible : la connexion web continue
  }
}

/** Déconnexion du poste (D756) à toute purge réelle du rendu : identité et profil local effacés. Sans effet sur le web. */
export function deconnecterPoste(): void {
  try {
    const pont = pontDesktop();
    if (pont === null) return;
    void Promise.resolve(pont.deconnexion()).catch(() => {});
  } catch {
    // Le pont est indisponible : la déconnexion du rendu continue
  }
}
