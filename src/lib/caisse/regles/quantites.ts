/**
 * Règles de quantité de la caisse, portées de back_medconnect (src/pharmacie/domaine/quantites.ts).
 * Pures : aucun import de React, de Next ni d'accès réseau.
 */
import type { UniteMinimale } from "../../api_pharmacie";

/** Lève une RangeError si la valeur n'est pas un entier supérieur ou égal au minimum. */
function exigerEntier(valeur: number, nom: string, minimum: number): void {
  if (!Number.isInteger(valeur) || valeur < minimum) {
    throw new RangeError(`${nom} doit être un entier supérieur ou égal à ${minimum} (reçu : ${valeur}).`);
  }
}

/** Nombre de boîtes vers unités minimales : n x coefficient. */
export function boitesVersUm(nombreBoites: number, coefficientBoite: number): number {
  exigerEntier(nombreBoites, "nombreBoites", 0);
  exigerEntier(coefficientBoite, "coefficientBoite", 1);
  return nombreBoites * coefficientBoite;
}

export interface BoitesEtUnites {
  boites: number;
  unites: number;
}

/** Unités minimales vers boîtes entières et unités restantes, tronqué vers zéro (symétrique pour un stock négatif). */
export function umVersBoites(quantiteUm: number, coefficientBoite: number): BoitesEtUnites {
  exigerEntier(quantiteUm, "quantiteUm", Number.MIN_SAFE_INTEGER);
  exigerEntier(coefficientBoite, "coefficientBoite", 1);
  const boites = Math.trunc(quantiteUm / coefficientBoite);
  const unites = quantiteUm - boites * coefficientBoite;
  return { boites: boites === 0 ? 0 : boites, unites: unites === 0 ? 0 : unites };
}

export const LIBELLES_UNITE_MINIMALE: Record<UniteMinimale, { singulier: string; pluriel: string }> = {
  COMPRIME: { singulier: "comprimé", pluriel: "comprimés" },
  GELULE: { singulier: "gélule", pluriel: "gélules" },
  ML: { singulier: "ml", pluriel: "ml" },
  SACHET: { singulier: "sachet", pluriel: "sachets" },
  GRAMME: { singulier: "gramme", pluriel: "grammes" },
  AMPOULE: { singulier: "ampoule", pluriel: "ampoules" },
  UNITE: { singulier: "unité", pluriel: "unités" },
};

const nombre = (n: number) => n.toLocaleString("fr-FR");
const boiteAvecNombre = (n: number) => `${nombre(n)} ${n > 1 ? "boîtes" : "boîte"}`;

/** Quantité lisible : « 12 boîtes », « 2 boîtes et 6 comprimés », « 6 comprimés », « 1 boîte », « 0 boîte », « -3 comprimés » (négatif : en unités seulement). */
export function formaterQuantite(um: number, coefficient: number, unite: UniteMinimale): string {
  const libelle = LIBELLES_UNITE_MINIMALE[unite];
  const unites = (n: number) => `${nombre(n)} ${Math.abs(n) > 1 ? libelle.pluriel : libelle.singulier}`;

  if (coefficient <= 1) {
    return um < 0 ? `-${boiteAvecNombre(-um)}` : boiteAvecNombre(um);
  }
  if (um < 0) return `-${unites(-um)}`;
  const { boites, unites: reste } = umVersBoites(um, coefficient);
  if (boites === 0) return reste === 0 ? boiteAvecNombre(0) : unites(reste);
  if (reste === 0) return boiteAvecNombre(boites);
  return `${boiteAvecNombre(boites)} et ${unites(reste)}`;
}
