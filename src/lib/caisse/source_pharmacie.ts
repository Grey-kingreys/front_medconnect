import type { ApiResponse } from "../api_auth";
import type {
  CorpsSortieStock,
  LotEnStock,
  SortieStockEnregistree,
  StockInfo,
  StockMedicament,
} from "../api_pharmacie";

/** Corps d'une correction de quantité : `id` (UUID) rend l'envoi rejouable sans doublon. */
export interface CorpsCorrectionQuantite {
  id: string;
  variation: number;
  lotId?: string;
  motif: string;
}

/**
 * Accès des écrans de la pharmacie (stock, réception, inventaire, crédit, anomalies) aux données : en ligne par
 * l'API (`api_*.ts`), ou local par le pont desktop. Même principe que `SourceCaisse`. Chaque fonction hors ligne y
 * entre avec sa fonctionnalité, en même temps que sa fonction du pont, son événement et sa permission.
 */
export interface SourcePharmacie {
  /** Vrai pour la source en ligne : les écrans qui exigent le réseau s'appuient dessus. */
  readonly enLigneSeulement: boolean;
  /** Fiches de stock de la pharmacie avec leurs lots (photographie du poste plus mouvements locaux sur le desktop). */
  chargerStock(structureId: string): Promise<StockMedicament[]>;
  /** Fiches et alertes de la page du stock (sur le desktop, alertes calculées avec les seuils de la photographie). */
  chargerStockInfo(structureId: string): Promise<StockInfo>;
  /** Lots à solde positif d'une fiche, dans l'ordre de sortie. */
  listerLots(structureId: string, stockId: string): Promise<LotEnStock[]>;
  /** Sort un lot du stock avec une raison ; rejouable avec le même `id`. */
  sortirDuStock(structureId: string, corps: CorpsSortieStock): Promise<ApiResponse<SortieStockEnregistree>>;
  /** Corrige la quantité d'un lot (variation signée en unités minimales) ; rejouable avec le même `id`. */
  corrigerQuantite(structureId: string, stockId: string, corps: CorpsCorrectionQuantite): Promise<ApiResponse<StockMedicament>>;
}
