/**
 * Stock local d'une fiche (D738) : la règle des lectures du back
 * (src/pharmacie/stock/lecture-stock.ts, calculerEtatStock) appliquée à la photographie
 * moins les sorties faites depuis. Pure : aucun import de React, de Next ni d'accès réseau.
 * Jamais de valeur négative en sortie (D713).
 */
import { reliquatLot } from "./quantites";
import { comparerFefo, ordonnerLotsPourVente, type LotCandidat } from "./selection_lots";

export interface LotPhoto {
  id: string;
  numeroLot: string | null;
  dateExpiration: string | null;
  dateReception: string;
  coefficientReception: number;
  solde: number;
  lotTechnique: boolean;
}

export interface FichePhoto {
  quantite: number;
  quantiteARegulariser: number;
  lots: LotPhoto[];
}

/**
 * Mouvement de stock fait sur le poste et pas encore appliqué par le serveur. `quantiteUm` est signée :
 * négative pour une sortie (vente, sortie manuelle), positive pour une entrée (réception, inventaire).
 * `lotId` nul = part provisoire (sans lot).
 */
export interface MouvementLocal {
  lotId: string | null;
  quantiteUm: number;
}

export interface StockLocal {
  quantite: number;
  quantiteARegulariser: number;
  quantiteVendable: number;
  /** Lots restants (solde positif), en ordre FEFO. */
  lots: LotPhoto[];
  reliquat: { lotId: string; unitesRestantes: number }[];
  dateExpiration: string | null;
}

function versCandidat(lot: LotPhoto): LotCandidat {
  return { ...lot, coutUnitaire: 0 };
}

/** Calcule le stock d'une fiche pour le jour donné (AAAA-MM-JJ, UTC). */
export function calculerStockLocal(
  fiche: FichePhoto,
  mouvements: MouvementLocal[],
  jour: string,
  lotsLocaux: LotPhoto[] = [],
): StockLocal {
  const sommeLots0 = fiche.lots.reduce((s, l) => s + l.solde, 0);
  const agregat0 = fiche.quantite > 0 ? fiche.quantite : sommeLots0 - fiche.quantiteARegulariser;

  const variationParLot = new Map<string, number>();
  let variationTotale = 0;
  for (const m of mouvements) {
    variationTotale += m.quantiteUm;
    if (m.lotId !== null) variationParLot.set(m.lotId, (variationParLot.get(m.lotId) ?? 0) + m.quantiteUm);
  }

  // Un lot local déjà connu de la photographie (même identifiant) n'est pas compté deux fois.
  const idsPhoto = new Set(fiche.lots.map((l) => l.id));
  const lots = [...fiche.lots, ...lotsLocaux.filter((l) => !idsPhoto.has(l.id)).map((l) => ({ ...l, solde: 0 }))];

  const restants: LotPhoto[] = [];
  for (const lot of lots) {
    const solde = Math.max(0, lot.solde + (variationParLot.get(lot.id) ?? 0));
    if (solde > 0) restants.push({ ...lot, solde });
  }

  const agregat = agregat0 + variationTotale;
  const sommeLots = restants.reduce((s, l) => s + l.solde, 0);

  const candidats = restants.map(versCandidat);
  const ordre = ordonnerLotsPourVente(candidats, jour);

  let dateExpiration: string | null = null;
  if (ordre.length > 0) {
    dateExpiration = ordre[0].dateExpiration;
  } else {
    for (const l of restants) {
      if (l.dateExpiration !== null && (dateExpiration === null || l.dateExpiration < dateExpiration)) {
        dateExpiration = l.dateExpiration;
      }
    }
  }

  const parId = new Map(restants.map((l) => [l.id, l]));
  return {
    quantite: Math.max(0, agregat),
    quantiteARegulariser: Math.max(0, sommeLots - agregat),
    quantiteVendable: Math.min(
      ordre.reduce((s, c) => s + c.solde, 0),
      Math.max(0, agregat),
    ),
    lots: [...candidats].sort(comparerFefo).map((c) => parId.get(c.id) as LotPhoto),
    reliquat: ordre
      .map((c) => ({ lotId: c.id, unitesRestantes: reliquatLot(c.solde, c.coefficientReception) }))
      .filter((r) => r.unitesRestantes > 0),
    dateExpiration,
  };
}
