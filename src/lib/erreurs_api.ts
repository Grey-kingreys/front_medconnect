/**
 * Lecture du corps d'erreur renvoyé par le serveur (code métier, lignes citées, champs refusés).
 * Aucune de ces fonctions ne lève d'exception : tout objet qui n'est pas une ApiError donne null, [] ou faux.
 */
import { ApiError } from "./api_auth";

export interface ChampRefuse {
  champ: string;
  contraintes: string[];
}

const estObjet = (valeur: unknown): valeur is Record<string, unknown> =>
  typeof valeur === "object" && valeur !== null && !Array.isArray(valeur);

/** Code métier du corps d'erreur (`code`), ou null. */
export function codeErreur(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null;
  const code = err.details?.code;
  return typeof code === "string" && code !== "" ? code : null;
}

/** Tableau `details` du corps d'erreur (codes à lignes), [] sinon ; éléments non objets ignorés. */
export function detailsErreur(err: unknown): Record<string, unknown>[] {
  if (!(err instanceof ApiError)) return [];
  const tableau = err.details?.details;
  if (!Array.isArray(tableau)) return [];
  return (tableau as unknown[]).filter(estObjet);
}

/** `champs` d'une erreur VALIDATION, [] sinon ; éléments mal formés ignorés. */
export function champsErreur(err: unknown): ChampRefuse[] {
  if (!(err instanceof ApiError)) return [];
  const tableau = err.details?.champs;
  if (!Array.isArray(tableau)) return [];
  const champs: ChampRefuse[] = [];
  for (const element of tableau as unknown[]) {
    if (!estObjet(element)) continue;
    const { champ, contraintes } = element;
    if (typeof champ !== "string" || champ === "") continue;
    if (!Array.isArray(contraintes)) continue;
    champs.push({ champ, contraintes: (contraintes as unknown[]).filter((c): c is string => typeof c === "string") });
  }
  return champs;
}

/** Vrai pour une erreur dont l'issue est inconnue : ApiError de statut 0, 502, 503 ou 504. */
export function estErreurReseau(err: unknown): boolean {
  return err instanceof ApiError && [0, 502, 503, 504].includes(err.status);
}

/** Vrai pour un 403 (droit manquant ou pharmacie inaccessible). */
export function estRefusDroit(err: unknown): boolean {
  return err instanceof ApiError && err.status === 403;
}
