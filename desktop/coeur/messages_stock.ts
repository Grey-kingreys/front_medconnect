/**
 * Messages de la sortie de stock et de la correction de quantité faites sur le poste. Repris à la lettre de
 * back_medconnect : src/pharmacie/stock/operations-stock.ts et pharmacie.service.ts.
 */
export const MESSAGE_RAISON_SORTIE_REQUISE =
  "Choisissez la raison de la sortie : périmé, cassé ou abîmé, perdu ou volé, retour au fournisseur, ou autre.";
export const MESSAGE_COMMENTAIRE_SORTIE_REQUIS = "Précisez la raison de la sortie en quelques mots (3 caractères au moins).";
export const MESSAGE_SORTIE_QUANTITE_INVALIDE = "Indiquez une quantité entière d'au moins 1.";
export const MESSAGE_SORTIE_QUANTITE_TROP_GRANDE = "La quantité sortie est trop grande. Vérifiez la quantité.";
export const MESSAGE_SORTIE_ENREGISTREE = "Sortie de stock enregistrée sur ce poste.";
export const MESSAGE_SORTIE_REJOUEE = "Cette sortie de stock était déjà enregistrée.";
export const MESSAGE_STOCK_INTROUVABLE = "Ce médicament est introuvable dans le stock de cette pharmacie.";
export const MESSAGE_MOTIF_CORRECTION_REQUIS = "Indiquez le motif de la correction (3 caractères au moins).";
export const MESSAGE_VARIATION_INVALIDE = "La variation doit être un nombre entier différent de zéro.";
export const MESSAGE_LOT_REQUIS_AUCUN =
  "Ce médicament n'a aucun lot en stock : modifiez la fiche pour saisir la quantité et la date de péremption.";
export const MESSAGE_LOT_REQUIS_CHOIX = "Ce médicament a plusieurs lots : choisissez le lot à corriger.";

export function messageSortieLotInsuffisante(solde: number): string {
  return `Ce lot n'a que ${solde} unité(s) en stock : la sortie ne peut pas dépasser ce stock.`;
}

export function messageStockLotNegatif(solde: number): string {
  return `Ce lot n'a que ${solde} unité(s) en stock : la correction ne peut pas le rendre négatif.`;
}

export function messageCorrectionEnregistree(variation: number, quantite: number): string {
  return `Stock ${variation > 0 ? "augmenté" : "réduit"} sur ce poste (nouvelle quantité : ${Math.max(0, quantite)})`;
}
