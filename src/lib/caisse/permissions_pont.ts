/**
 * Permission exigée par chaque fonction du pont, par domaine. La passerelle du poste la vérifie avant d'appeler
 * le cœur, avec les permissions du profil confirmé par le serveur (relues hors ligne). Le serveur refait le contrôle
 * au rejeu de l'opération (table `PERMISSIONS_PAR_TYPE` du back) : un droit retiré pendant la coupure la fait rejeter.
 * Une fonction exige TOUTES les permissions listées. Aucune fonction d'un domaine sans permission listée n'existe.
 */
import { schemasPont, type DomainePont } from "./contrat_desktop_schemas";

export const PERMISSION_CAISSE = "caisse:utiliser";

/** Permissions des fonctions de caisse et de vente : `caisse:utiliser`, comme avant. */
const PERMISSIONS_CAISSE: Record<string, readonly string[]> = Object.fromEntries(
  Object.keys(schemasPont).map((nom) => [nom, [PERMISSION_CAISSE] as readonly string[]]),
);

/**
 * Domaines à venir : ajouter ici la permission de chaque fonction en même temps que son schéma, par exemple
 * `reception: { enregistrerReception: ["reception:write"] }`, `stock: { sortirStock: ["stock:write"] }`,
 * `inventaire: { enregistrerInventaire: ["inventaire:write"] }`, `anomalie: { traiterAnomalie: ["anomalie:gerer"] }`,
 * `credit: { enregistrerRemboursement: ["credit:write"] }`.
 */
export const PERMISSIONS_PAR_FONCTION: Record<DomainePont, Record<string, readonly string[]>> = {
  caisse: PERMISSIONS_CAISSE,
  stock: { sortir: ["stock:write"], corriger: ["stock:write"] },
  reception: {},
  inventaire: {},
  credit: {},
  anomalie: {},
};

/** Permissions exigées par une fonction, ou null si la fonction n'existe pas dans ce domaine. */
export function permissionsRequises(domaine: DomainePont, methode: string): readonly string[] | null {
  const table = PERMISSIONS_PAR_FONCTION[domaine];
  return Object.prototype.hasOwnProperty.call(table, methode) ? table[methode] : null;
}
