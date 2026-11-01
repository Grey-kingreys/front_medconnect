/**
 * Logique pure du panier d'une vente en pharmacie : aucune dépendance à React, testable seule.
 * Chaque fonction renvoie un nouvel objet et ne modifie jamais ses arguments.
 */
import type { StockMedicament } from "@/lib/api_pharmacie";
import type { CorpsCreationVente, PaiementDemande, UniteVente } from "@/lib/api_ventes";
import { calculerLigne, type EntreeLigne } from "@/lib/caisse/regles/prix";

export type RaisonNonVendable = "sans-prix" | "unite-interdite";
export const LIBELLES_RAISON: Record<RaisonNonVendable, string> = {
  "sans-prix": "Prix non renseigné",
  "unite-interdite": "Se vend uniquement à la boîte",
};

export type AvertissementStock = "attente-stock" | "perime-seulement";
export const LIBELLES_AVERTISSEMENT: Record<AvertissementStock, string> = {
  "attente-stock": "Stock insuffisant : la vente sera enregistrée en attente de livraison.",
  "perime-seulement": "Il ne reste que des boîtes périmées : vous devrez choisir le lot à sortir.",
};

/** Lot périmé choisi par le vendeur pour une ligne ; jamais enregistré dans le stockage local. */
export interface SortieManuelleLigne {
  lotId: string;
  motif: string;
}
export interface LignePanier {
  stockId: string;
  unite: UniteVente;
  nombre: number;
  sortieManuelle?: SortieManuelleLigne;
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
/** Limites imposées par le back : 50 lignes par vente, 10000 par ligne. */
export const MAX_LIGNES_PANIER = 50;
export const QUANTITE_MAX_LIGNE = 10000;
export const LONGUEUR_MAX_NOM_CLIENT = 100;
export const FORMAT_TELEPHONE_CLIENT = /^\+?[0-9 ]{8,20}$/;

const NOM_PAR_DEFAUT = "Un médicament";

/** Clé d'une ligne : une fiche peut avoir une ligne en boîtes et une ligne en unités. */
export function cleLigne(stockId: string, unite: UniteVente): string {
  return `${stockId}:${unite}`;
}
export const cleDe = (ligne: LignePanier): string => cleLigne(ligne.stockId, ligne.unite);

export function autreUnite(unite: UniteVente): UniteVente {
  return unite === "BOITE" ? "UNITE" : "BOITE";
}

function entreeLigne(stock: StockMedicament, unite: UniteVente, nombre: number): EntreeLigne {
  return {
    unite,
    nombre,
    coefficientBoite: stock.coefficientBoite ?? 1,
    prixBoite: stock.prixUnitaire ?? null,
    prixUnite: stock.prixUnite ?? null,
    deconditionnable: stock.deconditionnable === true,
  };
}

/** Unité proposée d'abord (D690) : l'unité si la fiche se déconditionne avec un prix à l'unité, sinon la boîte. */
export function uniteParDefaut(stock: StockMedicament): UniteVente {
  const prix = stock.prixUnite;
  return stock.deconditionnable === true && typeof prix === "number" && Number.isInteger(prix) && prix > 0
    ? "UNITE"
    : "BOITE";
}

/** Pourquoi ce stock ne peut pas être vendu dans cette unité, ou null. Ni la rupture ni la péremption ne bloquent (D689). */
export function raisonNonVendable(stock: StockMedicament, unite: UniteVente): RaisonNonVendable | null {
  const calcul = calculerLigne(entreeLigne(stock, unite, 1));
  if (calcul.ok) return null;
  return calcul.code === "VENTE_UNITE_INTERDITE" ? "unite-interdite" : "sans-prix";
}

/** Quantité en unités minimales qu'une ligne demande. */
function quantiteDemandee(stock: StockMedicament, unite: UniteVente, nombre: number): number {
  return unite === "UNITE" ? nombre : nombre * (stock.coefficientBoite ?? 1);
}

/** Avertissement non bloquant sur le stock pour ce nombre dans cette unité. */
export function avertissementStock(
  stock: StockMedicament,
  unite: UniteVente,
  nombreDansPanier: number,
): AvertissementStock | null {
  if (stock.quantite > 0 && stock.quantiteVendable === 0) return "perime-seulement";
  const vendable = stock.quantiteVendable ?? stock.quantite;
  return quantiteDemandee(stock, unite, nombreDansPanier) > vendable ? "attente-stock" : null;
}

export function panierPlein(panier: PanierVente): boolean {
  return panier.lignes.length >= MAX_LIGNES_PANIER;
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
  unite: UniteVente,
  nouvelleCle: () => string,
): PanierVente {
  if (raisonNonVendable(stock, unite) !== null) return panier;
  const existante = panier.lignes.find((l) => l.stockId === stock.id && l.unite === unite);
  if (existante) {
    if (existante.nombre >= QUANTITE_MAX_LIGNE) return panier;
    return {
      ...panier,
      lignes: panier.lignes.map((l) => (l === existante ? { ...l, nombre: l.nombre + 1 } : l)),
    };
  }
  if (panierPlein(panier)) return panier;
  return {
    ...panier,
    cleIdempotence: panier.lignes.length === 0 ? nouvelleCle() : panier.cleIdempotence,
    lignes: [...panier.lignes, { stockId: stock.id, unite, nombre: 1 }],
    ordonnanceVue: stock.medicament.ordonnanceRequise ? false : panier.ordonnanceVue,
  };
}

export function changerNombre(panier: PanierVente, cle: string, delta: number): PanierVente {
  return {
    ...panier,
    lignes: panier.lignes.map((l) =>
      cleDe(l) === cle ? { ...l, nombre: Math.min(Math.max(l.nombre + delta, 1), QUANTITE_MAX_LIGNE) } : l,
    ),
  };
}

/** Bascule la ligne entre boîte et unité si l'autre unité est vendable ; fusionne avec la ligne de l'autre unité si elle existe. */
export function changerUnite(panier: PanierVente, cle: string, stock: StockMedicament): PanierVente {
  const ligne = panier.lignes.find((l) => cleDe(l) === cle);
  if (!ligne || stock.id !== ligne.stockId) return panier;
  const unite = autreUnite(ligne.unite);
  if (raisonNonVendable(stock, unite) !== null) return panier;
  const existante = panier.lignes.find((l) => l.stockId === ligne.stockId && l.unite === unite);
  if (existante) {
    const somme = Math.min(existante.nombre + ligne.nombre, QUANTITE_MAX_LIGNE);
    return {
      ...panier,
      lignes: panier.lignes.filter((l) => l !== ligne).map((l) => (l === existante ? { ...l, nombre: somme } : l)),
    };
  }
  return { ...panier, lignes: panier.lignes.map((l) => (l === ligne ? { ...l, unite } : l)) };
}

/** Ajoute le lot périmé choisi (et son motif) aux lignes de la fiche citée ; null le retire. */
export function definirSortieManuelle(
  panier: PanierVente,
  stockId: string,
  sortie: SortieManuelleLigne | null,
): PanierVente {
  return {
    ...panier,
    lignes: panier.lignes.map((l) => {
      if (l.stockId !== stockId) return l;
      const sans: LignePanier = { stockId: l.stockId, unite: l.unite, nombre: l.nombre };
      return sortie === null ? sans : { ...sans, sortieManuelle: sortie };
    }),
  };
}

export function retirerDuPanier(panier: PanierVente, cle: string): PanierVente {
  return sansLigneSiVide({ ...panier, lignes: panier.lignes.filter((l) => cleDe(l) !== cle) });
}

export function retirerLignes(panier: PanierVente, stockIds: string[]): PanierVente {
  return sansLigneSiVide({ ...panier, lignes: panier.lignes.filter((l) => !stockIds.includes(l.stockId)) });
}

/** Aligne le panier sur le stock actuel : lignes dont la fiche a disparu ou qui ne se vendent plus dans leur unité retirées. */
export function reconcilierPanier(
  panier: PanierVente,
  stocks: StockMedicament[],
): { panier: PanierVente; corrections: CorrectionPanier[] } {
  const corrections: CorrectionPanier[] = [];
  const lignes: LignePanier[] = [];
  for (const ligne of panier.lignes) {
    const stock = stocks.find((s) => s.id === ligne.stockId);
    if (!stock) {
      corrections.push({ nom: NOM_PAR_DEFAUT, avant: ligne.nombre, apres: 0 });
    } else if (raisonNonVendable(stock, ligne.unite) !== null) {
      corrections.push({ nom: stock.medicament.nom, avant: ligne.nombre, apres: 0 });
    } else {
      lignes.push(ligne);
    }
  }
  return { panier: sansLigneSiVide({ ...panier, lignes }), corrections };
}

/** Montant d'une ligne selon la fiche, ou null si elle n'est pas vendable (estimation, le serveur fait foi). */
export function montantLigne(ligne: LignePanier, stock: StockMedicament): number | null {
  const calcul = calculerLigne(entreeLigne(stock, ligne.unite, ligne.nombre));
  return calcul.ok ? calcul.montantLigne : null;
}

export function totalPanier(panier: PanierVente, stocks: StockMedicament[]): number {
  return panier.lignes.reduce((somme, ligne) => {
    const stock = stocks.find((s) => s.id === ligne.stockId);
    const montant = stock ? montantLigne(ligne, stock) : null;
    return montant === null ? somme : somme + montant;
  }, 0);
}

/** Noms des médicaments du panier qui exigent une ordonnance, dans l'ordre du panier, sans doublon. */
export function medicamentsSurOrdonnance(panier: PanierVente, stocks: StockMedicament[]): string[] {
  const noms: string[] = [];
  for (const ligne of panier.lignes) {
    const stock = stocks.find((s) => s.id === ligne.stockId);
    if (stock?.medicament.ordonnanceRequise && !noms.includes(stock.medicament.nom)) noms.push(stock.medicament.nom);
  }
  return noms;
}

export function telephoneClientValide(telephone: string): boolean {
  const propre = telephone.trim();
  return propre === "" || FORMAT_TELEPHONE_CLIENT.test(propre);
}

/** Corps de la vente. `paiements` n'est envoyé que s'il est fourni : sans lui, le serveur encaisse le total en espèces (D691). */
export function corpsVente(
  panier: PanierVente,
  surOrdonnance: boolean,
  paiements: PaiementDemande[] | null = null,
): CorpsCreationVente {
  const corps: CorpsCreationVente = {
    lignes: panier.lignes.map((l) => ({
      stockId: l.stockId,
      quantite: l.nombre,
      unite: l.unite,
      ...(l.sortieManuelle ? { sortieManuelle: l.sortieManuelle } : {}),
    })),
  };
  if (paiements !== null) corps.paiements = paiements;
  const nom = panier.clientNom.trim();
  const telephone = panier.clientTelephone.trim();
  if (nom !== "") corps.clientNom = nom;
  if (telephone !== "") corps.clientTelephone = telephone;
  if (surOrdonnance && panier.ordonnanceVue) corps.ordonnanceVerifiee = true;
  return corps;
}

export function messageCorrections(corrections: CorrectionPanier[]): string {
  const elements = corrections.map((c) =>
    c.apres === 0 ? `${c.nom} (retiré)` : `${c.nom} (${c.apres} au lieu de ${c.avant})`,
  );
  return `Le panier a été corrigé : ${elements.join(", ")}.`;
}

// ─── Stockage local du panier ───────────────────────────────────

export function cleStockagePanier(structureId: string, userId: string): string {
  return `medconnecte:panier-vente:${structureId}:${userId}`;
}

const estObjet = (valeur: unknown): valeur is Record<string, unknown> =>
  typeof valeur === "object" && valeur !== null && !Array.isArray(valeur);

/** Relit un panier version 2, ou version 1 (quantité en boîtes) ; tout autre contenu donne un panier vide. */
export function lirePanierStocke(cle: string): PanierVente {
  try {
    const brut = localStorage.getItem(cle);
    if (brut === null) return PANIER_VIDE;
    const valeur: unknown = JSON.parse(brut);
    if (!estObjet(valeur) || (valeur.version !== 1 && valeur.version !== 2) || !Array.isArray(valeur.lignes)) {
      return PANIER_VIDE;
    }
    const version = valeur.version;
    const lignes: LignePanier[] = [];
    for (const element of valeur.lignes as unknown[]) {
      if (!estObjet(element)) continue;
      const { stockId } = element;
      if (typeof stockId !== "string" || stockId === "") continue;
      const nombre = version === 1 ? element.quantite : element.nombre;
      if (typeof nombre !== "number" || !Number.isInteger(nombre) || nombre < 1) continue;
      const unite: UniteVente = version === 1 ? "BOITE" : element.unite === "UNITE" ? "UNITE" : "BOITE";
      if (version === 2 && element.unite !== "UNITE" && element.unite !== "BOITE") continue;
      lignes.push({ stockId, unite, nombre });
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
      const lignes = panier.lignes.map(({ stockId, unite, nombre }) => ({ stockId, unite, nombre }));
      localStorage.setItem(cle, JSON.stringify({ version: 2, ...panier, lignes }));
    }
  } catch {
    // Stockage indisponible : le panier reste seulement en mémoire.
  }
}
