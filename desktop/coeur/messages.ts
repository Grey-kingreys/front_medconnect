/**
 * Messages affichés au vendeur. Repris à la lettre de back_medconnect :
 * src/pharmacie/caisse/sessions-caisse.service.ts (caisse), src/pharmacie/vente-regles.ts
 * et vente.service.ts (vente), pharmacie.service.ts (MESSAGE_LOT_INTROUVABLE) et
 * stock/mouvements-stock.service.ts (MESSAGE_STOCK_LOT_INSUFFISANT).
 */

/** Montant lisible : séparateur de milliers = espace ordinaire, signe conservé (-10 000). */
export function formaterGnf(montant: number): string {
  return String(montant).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// Caisse (sessions-caisse.service.ts)
export const MESSAGE_SESSION_INTROUVABLE = "Cette session de caisse est introuvable.";
export const MESSAGE_SESSION_AUTRE_VENDEUR =
  "Cette caisse appartient à un autre vendeur : seul un responsable peut la consulter ou la modifier.";
export const MESSAGE_SESSION_FERMEE = "Cette caisse est déjà fermée : ouvrez une nouvelle caisse pour continuer.";
export const MESSAGE_IDENTIFIANT_DEJA_UTILISE = "Cet identifiant est déjà utilisé par un autre enregistrement de caisse.";
export const MESSAGE_COMPTAGE_FERMETURE_REQUIS = "Comptez les billets du tiroir avant de fermer la caisse.";
export const MESSAGE_MOTIF_MOUVEMENT_REQUIS = "Indiquez le motif de ce mouvement de caisse (3 caractères au moins).";

export function messageSessionAutreUtilisateur(nom: string): string {
  return `La caisse de ce poste est ouverte par ${nom}. Elle doit être fermée avant que vous puissiez encaisser ici.`;
}

export function messageComptageDejaSaisi(moment: "OUVERTURE" | "FERMETURE"): string {
  return moment === "OUVERTURE"
    ? "Le comptage d'ouverture de cette caisse est déjà enregistré."
    : "Le comptage de fermeture de cette caisse est déjà enregistré.";
}

export function messageModeInconnu(code: string): string {
  return `Le mode de paiement ${code} n'existe pas ou n'est plus accepté.`;
}

export function messageCommentaireRequis(ecart: number, seuil: number): string {
  return `L'écart d'espèces est de ${formaterGnf(ecart)} GNF, au-delà du seuil de ${formaterGnf(seuil)} GNF : ajoutez un commentaire pour fermer la caisse.`;
}

export const MESSAGE_COUPURES_EN_DOUBLE = "Chaque billet ne doit être compté qu'une fois.";
export const MESSAGE_RELEVE_FERMETURE_SEULEMENT = "Les relevés Orange Money et MTN MoMo se saisissent à la fermeture.";
export const MESSAGE_RELEVE_EN_DOUBLE = "Chaque mode de paiement ne doit être relevé qu'une fois.";
export const MESSAGE_RELEVE_ESPECES = "Les espèces se comptent billet par billet, pas par relevé.";

export function messageCoupureInconnue(valeur: number): string {
  return `La coupure de ${formaterGnf(valeur)} GNF n'existe pas : comptez uniquement les billets proposés.`;
}

export const MESSAGES_MOUVEMENT: Record<"PRELEVEMENT" | "APPORT" | "REMBOURSEMENT", string> = {
  PRELEVEMENT: "Prélèvement enregistré.",
  APPORT: "Apport enregistré.",
  REMBOURSEMENT: "Remboursement enregistré.",
};

// Vente (vente-regles.ts, vente.service.ts)
export const MESSAGE_MOTIF_SORTIE_REQUIS = "Indiquez le motif de la sortie de ce lot (3 caractères au moins).";
export const MESSAGE_LOT_INTROUVABLE = "Ce lot est introuvable pour ce médicament.";
export const MESSAGE_STOCK_LOT_INSUFFISANT = "Ce lot n'a pas assez de stock pour cette sortie.";
export const MESSAGE_PANIER_DOUBLON =
  "Un même médicament ne peut apparaître qu'une fois par unité dans la vente (une ligne à la boîte, une ligne à l'unité). Regroupez les quantités.";
export const MESSAGE_TOTAL_TROP_ELEVE = "Le montant total de la vente est trop élevé. Divisez-la en plusieurs ventes.";
export const MESSAGE_MODE_EN_DOUBLE = "Un même mode de paiement ne peut apparaître qu’une fois. Regroupez les montants.";
export const MESSAGE_MONTANT_RECU_INSUFFISANT = "La somme reçue en espèces est inférieure au montant à payer en espèces.";
export const MESSAGE_ORDONNANCE_NON_CONFIRMEE =
  "Ce panier contient un médicament vendu sur ordonnance. Cochez « J'ai vu l'ordonnance » pour valider la vente.";

export function messageStockIntrouvable(nombre: number): string {
  return nombre === 1
    ? "Un médicament du panier n'est plus dans le stock de la pharmacie. Retirez-le du panier puis validez de nouveau."
    : "Certains médicaments du panier ne sont plus dans le stock de la pharmacie. Retirez-les du panier puis validez de nouveau.";
}

export function messageVenteUniteInterdite(noms: string[]): string {
  return noms.length === 1
    ? `Ce médicament se vend uniquement à la boîte : « ${noms[0]} ». Passez-le en vente à la boîte.`
    : `${noms.length} médicaments du panier se vendent uniquement à la boîte. Passez-les en vente à la boîte.`;
}

export function messagePrixUniteManquant(noms: string[]): string {
  return noms.length === 1
    ? `Vente impossible : « ${noms[0]} » n'a pas de prix à l'unité. Ajoutez son prix à l'unité dans la fiche du médicament, ou vendez-le à la boîte.`
    : `Vente impossible : ${noms.length} médicaments du panier n'ont pas de prix à l'unité. Ajoutez leur prix à l'unité dans leur fiche, ou vendez-les à la boîte.`;
}

export function messagePrixManquant(noms: string[]): string {
  return noms.length === 1
    ? `Vente impossible : « ${noms[0]} » n'a pas de prix. Ajoutez son prix dans le stock puis validez de nouveau.`
    : `Vente impossible : ${noms.length} médicaments du panier n'ont pas de prix. Ajoutez leur prix dans le stock puis validez de nouveau.`;
}

export function messageSortieManuelleRequise(noms: string[]): string {
  return noms.length === 1
    ? `Le stock non périmé de « ${noms[0]} » ne suffit pas : il ne reste que des lots périmés. Réduisez la quantité, ou choisissez un lot et indiquez le motif de la sortie.`
    : `Le stock non périmé de ${noms.length} médicaments du panier ne suffit pas : il ne reste que des lots périmés. Réduisez les quantités, ou choisissez un lot et indiquez le motif de chaque sortie.`;
}

export function messagePaiementsIncoherents(somme: number, total: number): string {
  return `Le total des paiements (${somme} GNF) ne correspond pas au montant de la vente (${total} GNF). Corrigez les montants puis validez de nouveau.`;
}

// Messages propres au poste (aucun équivalent côté serveur)
export const MESSAGE_CATALOGUE_ABSENT =
  "Le catalogue de la pharmacie n'a pas encore été chargé sur ce poste. Connectez-vous à internet une première fois, puis réessayez.";
