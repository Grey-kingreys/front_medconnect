/**
 * Logique pure du panier d'une vente en pharmacie : aucune dépendance à React, testable seule.
 * Chaque fonction renvoie un nouvel objet et ne modifie jamais ses arguments.
 */
import type { StockMedicament } from "@/lib/api_pharmacie";
import type { CorpsCreationVente, LigneErreurVente } from "@/lib/api_ventes";

export type RaisonNonVendable = "perime" | "rupture" | "sans-prix";
export const LIBELLES_RAISON: Record<RaisonNonVendable, string> = {
  perime: "Date de péremption dépassée",
  rupture: "Rupture de stock",
  "sans-prix": "Prix non renseigné",
};

export interface LignePanier {
  stockId: string;
  quantite: number;
}
export interface PanierVente {
  cleIdempotence: string | null;
  lignes: LignePanier[];
  clientNom: string;
  clientTelephone: string;
  ordonnanceVue: boolean;
}
export const PANIER_VIDE: PanierVente = {
  cleIdempotence: null,
  lignes: [],
  clientNom: "",
  clientTelephone: "",
  ordonnanceVue: false,
};

/** Changement imposé au panier : apres = 0 veut dire ligne retirée. */
export interface CorrectionPanier {
  nom: string;
  avant: number;
  apres: number;
}
export const NOMBRE_MAX_RESULTATS = 50;
/** Limites imposées par le back : 50 lignes par vente, 10000 unités par ligne. */
export const MAX_LIGNES_PANIER = 50;
export const QUANTITE_MAX_LIGNE = 10000;
export const LONGUEUR_MAX_NOM_CLIENT = 100;
export const FORMAT_TELEPHONE_CLIENT = /^\+?[0-9 ]{8,20}$/;

const NOM_PAR_DEFAUT = "Un médicament";

/** Jour (UTC) d'une date ISO, ou null si elle est illisible. */
function jourUtc(date: string | Date): string | null {
  const d = typeof date === "string" ? new Date(date) : date;
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** Pourquoi ce stock ne peut pas être vendu, ou null s'il est vendable. Le jour même de la péremption reste vendable. */
export function raisonNonVendable(stock: StockMedicament, maintenant: Date): RaisonNonVendable | null {
  if (stock.dateExpiration) {
    const jourExpiration = jourUtc(stock.dateExpiration);
    const jourCourant = jourUtc(maintenant);
    if (jourExpiration !== null && jourCourant !== null && jourExpiration < jourCourant) return "perime";
  }
  if (stock.quantite <= 0) return "rupture";
  if (stock.prixUnitaire === undefined || stock.prixUnitaire === null || stock.prixUnitaire <= 0) return "sans-prix";
  return null;
}

/** Quantité maximale vendable sur une ligne : le stock, dans la limite d'une vente. */
export function quantiteMaxLigne(stock: StockMedicament): number {
  return Math.max(0, Math.min(stock.quantite, QUANTITE_MAX_LIGNE));
}

export function panierPlein(panier: PanierVente): boolean {
  return panier.lignes.length >= MAX_LIGNES_PANIER;
}

export function prixArrondi(stock: StockMedicament): number {
  return Math.round(stock.prixUnitaire ?? 0);
}

const normaliser = (texte: string): string =>
  texte.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Recherche sans casse ni accents sur le nom et le nom générique ; ordre d'origine conservé. */
export function rechercherDansStock(stocks: StockMedicament[], texte: string): StockMedicament[] {
  const recherche = normaliser(texte.trim());
  const trouves =
    recherche === ""
      ? stocks
      : stocks.filter(
          (s) =>
            normaliser(s.medicament.nom).includes(recherche) ||
            normaliser(s.medicament.nomGenerique ?? "").includes(recherche),
        );
  return trouves.slice(0, NOMBRE_MAX_RESULTATS);
}

/** Un panier sans ligne n'a plus de clé d'envoi ni d'ordonnance vue ; le client est conservé. */
function sansLigneSiVide(panier: PanierVente): PanierVente {
  if (panier.lignes.length > 0) return panier;
  return { ...panier, cleIdempotence: null, ordonnanceVue: false };
}

export function ajouterAuPanier(
  panier: PanierVente,
  stock: StockMedicament,
  nouvelleCle: () => string,
  maintenant: Date,
): PanierVente {
  if (raisonNonVendable(stock, maintenant) !== null) return panier;
  const existante = panier.lignes.find((l) => l.stockId === stock.id);
  if (existante) {
    if (existante.quantite >= quantiteMaxLigne(stock)) return panier;
    return {
      ...panier,
      lignes: panier.lignes.map((l) => (l.stockId === stock.id ? { ...l, quantite: l.quantite + 1 } : l)),
    };
  }
  if (panierPlein(panier)) return panier;
  return {
    ...panier,
    cleIdempotence: panier.lignes.length === 0 ? nouvelleCle() : panier.cleIdempotence,
    lignes: [...panier.lignes, { stockId: stock.id, quantite: 1 }],
    ordonnanceVue: stock.medicament.ordonnanceRequise ? false : panier.ordonnanceVue,
  };
}

export function changerQuantite(panier: PanierVente, stock: StockMedicament, delta: number): PanierVente {
  return {
    ...panier,
    lignes: panier.lignes.map((l) =>
      l.stockId === stock.id ? { ...l, quantite: Math.min(Math.max(l.quantite + delta, 1), quantiteMaxLigne(stock)) } : l,
    ),
  };
}

export function retirerDuPanier(panier: PanierVente, stockId: string): PanierVente {
  return sansLigneSiVide({ ...panier, lignes: panier.lignes.filter((l) => l.stockId !== stockId) });
}

export function retirerLignes(panier: PanierVente, stockIds: string[]): PanierVente {
  return sansLigneSiVide({ ...panier, lignes: panier.lignes.filter((l) => !stockIds.includes(l.stockId)) });
}

/** Aligne le panier sur le stock actuel : lignes devenues invendables retirées, quantités ramenées au stock. */
export function reconcilierPanier(
  panier: PanierVente,
  stocks: StockMedicament[],
  maintenant: Date,
): { panier: PanierVente; corrections: CorrectionPanier[] } {
  const corrections: CorrectionPanier[] = [];
  const lignes: LignePanier[] = [];
  for (const ligne of panier.lignes) {
    const stock = stocks.find((s) => s.id === ligne.stockId);
    if (!stock) {
      corrections.push({ nom: NOM_PAR_DEFAUT, avant: ligne.quantite, apres: 0 });
    } else if (raisonNonVendable(stock, maintenant) !== null) {
      corrections.push({ nom: stock.medicament.nom, avant: ligne.quantite, apres: 0 });
    } else if (ligne.quantite > quantiteMaxLigne(stock)) {
      corrections.push({ nom: stock.medicament.nom, avant: ligne.quantite, apres: quantiteMaxLigne(stock) });
      lignes.push({ ...ligne, quantite: quantiteMaxLigne(stock) });
    } else {
      lignes.push(ligne);
    }
  }
  return { panier: sansLigneSiVide({ ...panier, lignes }), corrections };
}

/** Applique les quantités disponibles citées par une erreur de stock insuffisant. */
export function appliquerStockInsuffisant(
  panier: PanierVente,
  lignesErreur: LigneErreurVente[],
  stocks: StockMedicament[],
): { panier: PanierVente; corrections: CorrectionPanier[] } {
  const corrections: CorrectionPanier[] = [];
  const lignes: LignePanier[] = [];
  for (const ligne of panier.lignes) {
    const erreur = lignesErreur.find((e) => e.stockId === ligne.stockId);
    if (!erreur || erreur.disponible === undefined || erreur.disponible >= ligne.quantite) {
      lignes.push(ligne);
      continue;
    }
    const nom = erreur.nom ?? stocks.find((s) => s.id === ligne.stockId)?.medicament.nom ?? NOM_PAR_DEFAUT;
    corrections.push({ nom, avant: ligne.quantite, apres: erreur.disponible });
    if (erreur.disponible > 0) lignes.push({ ...ligne, quantite: erreur.disponible });
  }
  return { panier: sansLigneSiVide({ ...panier, lignes }), corrections };
}

export function totalPanier(panier: PanierVente, stocks: StockMedicament[]): number {
  return panier.lignes.reduce((somme, ligne) => {
    const stock = stocks.find((s) => s.id === ligne.stockId);
    return stock ? somme + prixArrondi(stock) * ligne.quantite : somme;
  }, 0);
}

/** Noms des médicaments du panier qui exigent une ordonnance, dans l'ordre du panier. */
export function medicamentsSurOrdonnance(panier: PanierVente, stocks: StockMedicament[]): string[] {
  const noms: string[] = [];
  for (const ligne of panier.lignes) {
    const stock = stocks.find((s) => s.id === ligne.stockId);
    if (stock?.medicament.ordonnanceRequise) noms.push(stock.medicament.nom);
  }
  return noms;
}

export function telephoneClientValide(telephone: string): boolean {
  const propre = telephone.trim();
  return propre === "" || FORMAT_TELEPHONE_CLIENT.test(propre);
}

export function corpsVente(panier: PanierVente, surOrdonnance: boolean): CorpsCreationVente {
  const corps: CorpsCreationVente = {
    lignes: panier.lignes.map((l) => ({ stockId: l.stockId, quantite: l.quantite })),
  };
  const nom = panier.clientNom.trim();
  const telephone = panier.clientTelephone.trim();
  if (nom !== "") corps.clientNom = nom;
  if (telephone !== "") corps.clientTelephone = telephone;
  if (surOrdonnance && panier.ordonnanceVue) corps.ordonnanceVerifiee = true;
  return corps;
}

export function messageCorrections(corrections: CorrectionPanier[]): string {
  const elements = corrections.map((c) =>
    c.apres === 0 ? `${c.nom} (épuisé, retiré)` : `${c.nom} (${c.apres} au lieu de ${c.avant})`,
  );
  return `Le panier a été corrigé : ${elements.join(", ")}.`;
}

// ─── Stockage local du panier ───────────────────────────────────

export function cleStockagePanier(structureId: string, userId: string): string {
  return `medconnecte:panier-vente:${structureId}:${userId}`;
}

const estObjet = (valeur: unknown): valeur is Record<string, unknown> =>
  typeof valeur === "object" && valeur !== null && !Array.isArray(valeur);

export function lirePanierStocke(cle: string): PanierVente {
  try {
    const brut = localStorage.getItem(cle);
    if (brut === null) return PANIER_VIDE;
    const valeur: unknown = JSON.parse(brut);
    if (!estObjet(valeur) || valeur.version !== 1 || !Array.isArray(valeur.lignes)) return PANIER_VIDE;
    const lignes: LignePanier[] = [];
    for (const element of valeur.lignes as unknown[]) {
      if (!estObjet(element)) continue;
      const { stockId, quantite } = element;
      if (typeof stockId !== "string" || stockId === "") continue;
      if (typeof quantite !== "number" || !Number.isInteger(quantite) || quantite < 1) continue;
      lignes.push({ stockId, quantite });
    }
    lignes.splice(MAX_LIGNES_PANIER);
    return {
      cleIdempotence: typeof valeur.cleIdempotence === "string" ? valeur.cleIdempotence : null,
      lignes,
      clientNom: typeof valeur.clientNom === "string" ? valeur.clientNom : "",
      clientTelephone: typeof valeur.clientTelephone === "string" ? valeur.clientTelephone : "",
      ordonnanceVue: typeof valeur.ordonnanceVue === "boolean" ? valeur.ordonnanceVue : false,
    };
  } catch {
    return PANIER_VIDE;
  }
}

export function enregistrerPanier(cle: string, panier: PanierVente): void {
  try {
    if (panier.lignes.length === 0 && panier.clientNom === "" && panier.clientTelephone === "") {
      localStorage.removeItem(cle);
    } else {
      localStorage.setItem(cle, JSON.stringify({ version: 1, ...panier }));
    }
  } catch {
    // Stockage indisponible : le panier reste seulement en mémoire.
  }
}
