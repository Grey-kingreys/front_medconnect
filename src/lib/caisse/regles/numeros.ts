/**
 * Numéros de pièces, portés de back_medconnect
 * (src/pharmacie/vente-regles.ts et synchro/rejeu-regles.ts).
 * Pures : aucun import de React, de Next ni d'accès réseau.
 */

/** Numéro lisible d'un ticket : T<ordre du PV>-<numéro sur 7 chiffres au moins> (D423, D539). */
export function formaterNumeroTicket(ordre: number, numero: number): string {
  if (!Number.isInteger(ordre) || ordre < 1) {
    throw new RangeError(`L'ordre du point de vente doit être un entier supérieur ou égal à 1 (reçu : ${ordre}).`);
  }
  if (!Number.isInteger(numero) || numero < 1) {
    throw new RangeError(`Le numéro de ticket doit être un entier supérieur ou égal à 1 (reçu : ${numero}).`);
  }
  return `T${ordre}-${String(numero).padStart(7, "0")}`;
}

/** Numéro d'une vente faite avec un numéro de secours du poste (D655). */
export function numeroSecours(ordre: number, codePoste: string, n: number): string {
  return `S${ordre}-${codePoste}-${n}`;
}
