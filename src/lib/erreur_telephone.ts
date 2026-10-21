/**
 * Erreurs du champ téléphone renvoyées par le serveur : numéro déjà pris par un
 * autre compte (TB17) ou numéro refusé par la validation.
 * Utilisé par l'inscription, le profil et la création d'utilisateur (UserModal).
 */
import { ApiError } from "./api_auth";

export const MSG_TELEPHONE_DEJA_UTILISE = "Ce numéro est déjà utilisé par un autre compte.";
export const MSG_TELEPHONE_INVALIDE = "Ce numéro de téléphone n'est pas valide.";
export const AIDE_TELEPHONE = "Exemple : 620 00 00 00";

const CHAMP_TELEPHONE = "telephone";

/** Noms des champs refusés par la validation du serveur (`details.champs`). */
function champsRefuses(details?: Record<string, unknown>): string[] {
  const champs = details?.champs;
  if (!Array.isArray(champs)) return [];
  return champs
    .map((c) => (c && typeof c === "object" ? (c as { champ?: unknown }).champ : undefined))
    .filter((c): c is string => typeof c === "string");
}

/** Message à afficher sous le champ téléphone, ou null si l'erreur ne le concerne pas. */
export function messageErreurTelephone(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null;
  const code = err.details?.code;
  if (code === "TELEPHONE_DEJA_UTILISE") return MSG_TELEPHONE_DEJA_UTILISE;
  if (code === "VALIDATION" && champsRefuses(err.details).includes(CHAMP_TELEPHONE)) {
    return MSG_TELEPHONE_INVALIDE;
  }
  return null;
}

/** Vrai si l'erreur ne concerne que le téléphone : le bandeau général est alors inutile. */
export function erreurSeulementTelephone(err: unknown): boolean {
  if (!(err instanceof ApiError) || messageErreurTelephone(err) === null) return false;
  if (err.details?.code === "TELEPHONE_DEJA_UTILISE") return true;
  return champsRefuses(err.details).every((c) => c === CHAMP_TELEPHONE);
}
