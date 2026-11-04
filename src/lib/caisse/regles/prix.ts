/**
 * Calcul d'une ligne de vente, porté de back_medconnect (src/pharmacie/domaine/prix.ts).
 * Estimation affichée au comptoir : le serveur recalcule et fait foi.
 * Pure : aucun import de React, de Next ni d'accès réseau.
 */
import type { UniteVente } from "../../api_ventes";

export interface EntreeLigne {
  unite: UniteVente;
  /** Nombre saisi : boîtes ou unités minimales. */
  nombre: number;
  coefficientBoite: number;
  /** Prix de vente de la boîte (`prixUnitaire` de la fiche). */
  prixBoite: number | null;
  prixUnite: number | null;
  deconditionnable: boolean;
}

export type CodeRefusLigne = "VENTE_UNITE_INTERDITE" | "PRIX_UNITE_MANQUANT" | "PRIX_MANQUANT";

export interface LigneCalculee {
  ok: true;
  uniteAffichee: UniteVente;
  nombreAffiche: number;
  coefficientApplique: number;
  quantiteUm: number;
  prixAppliqueParUm: number;
  montantLigne: number;
}

export interface RefusLigne {
  ok: false;
  code: CodeRefusLigne;
}

export type ResultatLigne = LigneCalculee | RefusLigne;

/** Arrondi à l'entier GNF le plus proche, moitié éloignée de zéro ; jamais -0. */
function arrondiGnf(valeur: number): number {
  const r = Math.sign(valeur) * Math.round(Math.abs(valeur));
  return r === 0 ? 0 : r;
}

const estEntierMin = (valeur: number, minimum: number) => Number.isInteger(valeur) && valeur >= minimum;

/**
 * Vente au détail moins chère que la boîte : renvoie le total des unités et ce qu'il manque pour égaler la boîte.
 * Null si une valeur n'est pas un entier positif ou si le détail rapporte au moins autant que la boîte.
 */
export function manqueVenteAuDetail(
  prixBoite: number | null,
  prixUnite: number | null,
  unitesParBoite: number | null,
): { totalDetail: number; manque: number } | null {
  if (prixBoite === null || prixUnite === null || unitesParBoite === null) return null;
  if (!estEntierMin(prixBoite, 1) || !estEntierMin(prixUnite, 1) || !estEntierMin(unitesParBoite, 1)) return null;
  const totalDetail = prixUnite * unitesParBoite;
  return totalDetail < prixBoite ? { totalDetail, manque: prixBoite - totalDetail } : null;
}

/** Calcule une ligne de vente : quantité en unités minimales, prix appliqué par unité minimale (affichage), montant de ligne (référence des totaux). Une entrée non entière est refusée sans exception. */
export function calculerLigne(entree: EntreeLigne): ResultatLigne {
  const refus: RefusLigne = { ok: false, code: "PRIX_MANQUANT" };
  if (!estEntierMin(entree.nombre, 1) || !estEntierMin(entree.coefficientBoite, 1)) return refus;
  if (entree.prixBoite !== null && !estEntierMin(entree.prixBoite, 0)) return refus;
  if (entree.prixUnite !== null && !estEntierMin(entree.prixUnite, 0)) return refus;

  if (entree.unite === "UNITE") {
    if (!entree.deconditionnable) return { ok: false, code: "VENTE_UNITE_INTERDITE" };
    if (entree.prixUnite === null || entree.prixUnite === 0) return { ok: false, code: "PRIX_UNITE_MANQUANT" };
    return {
      ok: true,
      uniteAffichee: "UNITE",
      nombreAffiche: entree.nombre,
      coefficientApplique: 1,
      quantiteUm: entree.nombre,
      prixAppliqueParUm: entree.prixUnite,
      montantLigne: entree.nombre * entree.prixUnite,
    };
  }

  if (entree.prixBoite === null || entree.prixBoite === 0) return refus;
  return {
    ok: true,
    uniteAffichee: "BOITE",
    nombreAffiche: entree.nombre,
    coefficientApplique: entree.coefficientBoite,
    quantiteUm: entree.nombre * entree.coefficientBoite,
    prixAppliqueParUm: arrondiGnf(entree.prixBoite / entree.coefficientBoite),
    montantLigne: entree.nombre * entree.prixBoite,
  };
}
