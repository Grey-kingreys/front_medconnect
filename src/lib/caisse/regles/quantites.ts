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

/** Libellés d'une unité : mot, article défini (« la plaquette ») et article indéfini (« une plaquette », D725). */
export const LIBELLES_UNITE_MINIMALE: Record<
  UniteMinimale,
  { singulier: string; pluriel: string; article: string; unArticle: string }
> = {
  COMPRIME: { singulier: "comprimé", pluriel: "comprimés", article: "le comprimé", unArticle: "un" },
  GELULE: { singulier: "gélule", pluriel: "gélules", article: "la gélule", unArticle: "une" },
  ML: { singulier: "ml", pluriel: "ml", article: "le ml", unArticle: "un" },
  SACHET: { singulier: "sachet", pluriel: "sachets", article: "le sachet", unArticle: "un" },
  GRAMME: { singulier: "gramme", pluriel: "grammes", article: "le gramme", unArticle: "un" },
  AMPOULE: { singulier: "ampoule", pluriel: "ampoules", article: "l'ampoule", unArticle: "une" },
  PLAQUETTE: { singulier: "plaquette", pluriel: "plaquettes", article: "la plaquette", unArticle: "une" },
  UNITE: { singulier: "unité", pluriel: "unités", article: "l'unité", unArticle: "une" },
};

/** « de plaquettes », « d'ampoules », « d'unités » : « d' » devant une voyelle ou un h muet. */
export function deOuD(mot: string): string {
  return /^[aeiouyhàâäéèêëîïôöùûü]/i.test(mot) ? `d'${mot}` : `de ${mot}`;
}

/** « à la plaquette », « à l'unité », « au comprimé » : l'article défini de l'unité précédé de « à ». */
export function aArticle(article: string): string {
  return article.startsWith("le ") ? `au ${article.slice(3)}` : `à ${article}`;
}

const nombre = (n: number) => n.toLocaleString("fr-FR");
const boiteAvecNombre = (n: number) => `${nombre(n)} ${n > 1 ? "boîtes" : "boîte"}`;

/**
 * Quantité lisible : « 12 boîtes », « 2 boîtes et 6 comprimés », « 6 comprimés », « 1 boîte », « 0 boîte ».
 * Filet (D713) : une valeur négative s'affiche comme 0, jamais de signe moins à l'écran.
 */
export function formaterQuantite(umBrut: number, coefficient: number, unite: UniteMinimale): string {
  const um = umBrut < 0 ? 0 : umBrut;
  const libelle = LIBELLES_UNITE_MINIMALE[unite];
  const unites = (n: number) => `${nombre(n)} ${Math.abs(n) > 1 ? libelle.pluriel : libelle.singulier}`;

  if (coefficient <= 1) return boiteAvecNombre(um);
  const { boites, unites: reste } = umVersBoites(um, coefficient);
  if (boites === 0) return reste === 0 ? boiteAvecNombre(0) : unites(reste);
  if (reste === 0) return boiteAvecNombre(boites);
  return `${boiteAvecNombre(boites)} et ${unites(reste)}`;
}

/** Mention d'une part de vente à régulariser (D717) : « 1 boîte à régulariser », null s'il n'y en a pas. */
export function formaterARegulariser(
  um: number | null | undefined,
  coefficient: number,
  unite: UniteMinimale,
): string | null {
  if (um === null || um === undefined || um <= 0) return null;
  return `${formaterQuantite(um, coefficient, unite)} à régulariser`;
}
