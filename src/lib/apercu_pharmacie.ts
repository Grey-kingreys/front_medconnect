/** Chiffres de l'aperçu d'une pharmacie, calculés à partir de son stock (aucune valeur inventée). */
import type { StockMedicament } from "./api_pharmacie";

/** Même seuil que le serveur (alerte « stock bas » sous 10 unités). */
export const SEUIL_STOCK_BAS = 10;
/** Fenêtre des péremptions proches, en jours (aujourd'hui compris). */
export const JOURS_EXPIRATION_PROCHE = 60;
/** Nombre de lignes de la liste « À surveiller ». */
export const LIGNES_A_SURVEILLER = 5;

export type RaisonSurveillance = "perime" | "rupture" | "stockBas" | "expireBientot";

export interface LigneASurveiller {
  stockId: string;
  nom: string;
  raison: RaisonSurveillance;
  /** Phrase affichée sous le nom, par exemple « Plus que 4 unités en stock ». */
  detail: string;
}

export interface ApercuStock {
  /** Nombre de lignes du stock. */
  total: number;
  disponibles: number;
  ruptures: number;
  stockBas: number;
  expirentBientot: number;
  perimes: number;
  /** Somme quantité × prix des lignes disponibles qui ont un prix, en GNF. */
  valeur: number;
  /** Lignes disponibles exclues de la valeur faute de prix. */
  sansPrix: number;
  /** Au plus LIGNES_A_SURVEILLER lignes, les plus urgentes d'abord. */
  aSurveiller: LigneASurveiller[];
  /** Nombre total de médicaments à surveiller (avant la coupe à LIGNES_A_SURVEILLER). */
  aSurveillerTotal: number;
}

const pluriel = (n: number, singulier: string, plurielTexte: string) => `${n} ${n > 1 ? plurielTexte : singulier}`;

const JOUR_MS = 24 * 60 * 60 * 1000;

function jourUTC(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Jours avant la péremption (négatif = périmé), ou null si la date est absente ou illisible. */
function joursRestants(dateExpiration: string | null | undefined, maintenant: Date): number | null {
  if (!dateExpiration) return null;
  const d = new Date(dateExpiration);
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((jourUTC(d) - jourUTC(maintenant)) / JOUR_MS);
}

function dateCourte(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { timeZone: "UTC" });
}

function prixValide(prix: unknown): prix is number {
  return typeof prix === "number" && Number.isFinite(prix) && prix > 0;
}

interface LigneListable extends LigneASurveiller {
  /** Clés de tri internes : jours restants et quantité. */
  jours: number;
  quantite: number;
}

const ORDRE_RAISONS: readonly RaisonSurveillance[] = ["perime", "rupture", "stockBas", "expireBientot"];

export function calculerApercuStock(stocks: readonly StockMedicament[], maintenant: Date): ApercuStock {
  let disponibles = 0;
  let ruptures = 0;
  let stockBas = 0;
  let expirentBientot = 0;
  let perimes = 0;
  let valeur = 0;
  let sansPrix = 0;
  const listables: LigneListable[] = [];

  for (const s of stocks) {
    const q = s.quantite;
    const j = joursRestants(s.dateExpiration, maintenant);
    const perime = q > 0 && j !== null && j < 0;
    const rupture = q <= 0;
    const bas = q > 0 && q < SEUIL_STOCK_BAS;
    const expireBientot = q > 0 && j !== null && j >= 0 && j <= JOURS_EXPIRATION_PROCHE;
    const disponible = q > 0 && !perime;

    if (disponible) disponibles += 1;
    if (rupture) ruptures += 1;
    if (bas) stockBas += 1;
    if (expireBientot) expirentBientot += 1;
    if (perime) perimes += 1;
    if (disponible) {
      if (prixValide(s.prixUnitaire)) valeur += q * s.prixUnitaire;
      else sansPrix += 1;
    }

    const base = { stockId: s.id, nom: s.medicament.nom, jours: j ?? 0, quantite: q };
    const date = s.dateExpiration ? dateCourte(s.dateExpiration) : "";
    if (perime) {
      listables.push({ ...base, raison: "perime", detail: `Périmé depuis le ${date}` });
    } else if (rupture) {
      listables.push({ ...base, raison: "rupture", detail: "Rupture de stock" });
    } else if (bas) {
      listables.push({ ...base, raison: "stockBas", detail: `Plus que ${pluriel(q, "unité", "unités")} en stock` });
    } else if (expireBientot) {
      const detail =
        j === 0
          ? `Expire aujourd'hui (${date})`
          : j === 1
            ? `Expire demain (${date})`
            : `Expire le ${date}, dans ${j} jours`;
      listables.push({ ...base, raison: "expireBientot", detail });
    }
  }

  listables.sort((a, b) => {
    const groupe = ORDRE_RAISONS.indexOf(a.raison) - ORDRE_RAISONS.indexOf(b.raison);
    if (groupe !== 0) return groupe;
    const parNom = a.nom.localeCompare(b.nom, "fr");
    switch (a.raison) {
      case "perime":
        return a.jours - b.jours;
      case "rupture":
        return parNom;
      case "stockBas":
        return a.quantite - b.quantite || parNom;
      case "expireBientot":
        return a.jours - b.jours || parNom;
    }
  });

  return {
    total: stocks.length,
    disponibles,
    ruptures,
    stockBas,
    expirentBientot,
    perimes,
    valeur,
    sansPrix,
    aSurveiller: listables
      .slice(0, LIGNES_A_SURVEILLER)
      .map(({ stockId, nom, raison, detail }) => ({ stockId, nom, raison, detail })),
    aSurveillerTotal: listables.length,
  };
}
