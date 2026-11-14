/**
 * Règles d'une sortie de stock, copiées de back_medconnect/src/pharmacie/domaine/sortie.ts : raisons, type du
 * mouvement et motif enregistré. Pures : aucun import de React, de Next ni d'accès réseau.
 */
export const RAISONS_SORTIE_CODES = ["PERIME", "CASSE", "PERDU", "RETOUR_FOURNISSEUR", "AUTRE"] as const;
export type RaisonSortieCode = (typeof RAISONS_SORTIE_CODES)[number];

export const LIBELLES_RAISON: Record<RaisonSortieCode, string> = {
  PERIME: "Périmé",
  CASSE: "Cassé ou abîmé",
  PERDU: "Perdu ou volé",
  RETOUR_FOURNISSEUR: "Retour au fournisseur",
  AUTRE: "Autre",
};

/** Type du mouvement de stock d'une sortie. */
export function typeMouvementSortie(raison: RaisonSortieCode): "PEREMPTION" | "PERTE" | "RETOUR" {
  if (raison === "PERIME") return "PEREMPTION";
  if (raison === "RETOUR_FOURNISSEUR") return "RETOUR";
  return "PERTE";
}

export type MotifSortie = { ok: true; motif: string } | { ok: false; code: "RAISON_REQUISE" | "COMMENTAIRE_REQUIS" };

/**
 * Motif enregistré : « Autre » exige un commentaire de 3 caractères au moins (le motif est ce commentaire) ;
 * les autres raisons donnent leur libellé, suivi de « : commentaire » si un commentaire non vide est donné.
 */
export function motifSortie(raison: RaisonSortieCode | null, commentaire: string | null): MotifSortie {
  if (raison === null || !(RAISONS_SORTIE_CODES as readonly string[]).includes(raison)) return { ok: false, code: "RAISON_REQUISE" };
  const texte = (commentaire ?? "").trim();
  if (raison === "AUTRE") return texte.length < 3 ? { ok: false, code: "COMMENTAIRE_REQUIS" } : { ok: true, motif: texte };
  const libelle = LIBELLES_RAISON[raison];
  return { ok: true, motif: texte ? `${libelle} : ${texte}` : libelle };
}
