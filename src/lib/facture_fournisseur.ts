/** Aides de saisie et contrôles non bloquants de la facture fournisseur (réception). */

const PLAFOND = 2147483647;

/**
 * Lit un montant entier de GNF. Tolère les espaces (y compris insécables) et le point ou la virgule
 * comme séparateur de milliers : « 95.630 », « 95,630 » et « 95 630 » valent 95630.
 * Un point ou une virgule qui ne sépare pas des groupes de trois chiffres (« 95.5 ») n'est pas un montant.
 */
export function lireMontant(texte: string): number | null {
  const net = texte.replace(/[\s  ]/g, "");
  if (net === "") return null;
  let chiffres: string;
  if (/^\d+$/.test(net)) chiffres = net;
  else if (/^\d{1,3}([.,]\d{3})+$/.test(net)) chiffres = net.replace(/[.,]/g, "");
  else return null;
  const n = Number(chiffres);
  return Number.isSafeInteger(n) && n <= PLAFOND ? n : null;
}

/** Taux de TVA saisi en pourcentage (« 18 », « 5,5 ») converti en pour mille (180, 55) ; 0 à 100 %. */
export function lireTauxTva(texte: string): number | null {
  const net = texte.replace(/[\s  %]/g, "").replace(",", ".");
  if (!/^\d{1,3}(\.\d)?$/.test(net)) return null;
  const pourMille = Math.round(Number(net) * 10);
  return pourMille <= 1000 ? pourMille : null;
}

/** Taux en pour mille affiché en pourcentage : 180 devient « 18 % », 55 devient « 5,5 % ». */
export function formaterTauxTva(pourMille: number): string {
  const pct = pourMille / 10;
  return `${Number.isInteger(pct) ? pct : String(pct).replace(".", ",")} %`;
}

export interface LigneControlee {
  /** Quantité livrée en boîtes, `null` si inconnue ou saisie en unités. */
  quantiteLivree: number | null;
  quantiteCommandee: number | null;
  /** Prix unitaire d'achat de la boîte. */
  prixUnitaire: number | null;
  montantHTLigne: number | null;
}

export interface AvertissementsLigne {
  montant?: { attendu: number; saisi: number };
  quantite?: { livree: number; commandee: number };
}

/** Contrôles d'une ligne : jamais un refus, seulement des écarts à signaler. */
export function controlerLigne(l: LigneControlee): AvertissementsLigne {
  const res: AvertissementsLigne = {};
  if (l.quantiteLivree !== null && l.prixUnitaire !== null && l.montantHTLigne !== null) {
    const attendu = l.quantiteLivree * l.prixUnitaire;
    if (attendu !== l.montantHTLigne) res.montant = { attendu, saisi: l.montantHTLigne };
  }
  if (l.quantiteLivree !== null && l.quantiteCommandee !== null && l.quantiteLivree !== l.quantiteCommandee) {
    res.quantite = { livree: l.quantiteLivree, commandee: l.quantiteCommandee };
  }
  return res;
}

/**
 * Somme des montants des lignes comparée au montant HT de l'en-tête. Sans avertissement tant qu'une des
 * deux données manque, ou qu'une ligne remplie n'a pas de montant (la somme serait forcément partielle).
 */
export function controlerSomme(montantsLignes: (number | null)[], montantHT: number | null) {
  if (montantHT === null || montantsLignes.length === 0 || montantsLignes.some((m) => m === null)) return null;
  const somme = (montantsLignes as number[]).reduce((s, m) => s + m, 0);
  return somme === montantHT ? null : { somme, montantHT };
}
