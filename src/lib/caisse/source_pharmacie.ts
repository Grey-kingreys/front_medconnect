import type { StockMedicament } from "../api_pharmacie";

/**
 * Accès des écrans de la pharmacie (stock, réception, inventaire, crédit, anomalies) aux données : en ligne par
 * l'API (`api_*.ts`), ou local par le pont desktop. Même principe que `SourceCaisse`. Elle ne contient pour
 * l'instant que la lecture du stock ; chaque fonction hors ligne y entre avec sa fonctionnalité, en même temps que
 * sa fonction du pont, son événement et sa permission. Aucune page n'est branchée dessus pour le moment.
 */
export interface SourcePharmacie {
  /** Vrai pour la source en ligne : les écrans qui exigent le réseau s'appuient dessus. */
  readonly enLigneSeulement: boolean;
  /** Fiches de stock de la pharmacie avec leurs lots (photographie du poste plus mouvements locaux sur le desktop). */
  chargerStock(structureId: string): Promise<StockMedicament[]>;
}
