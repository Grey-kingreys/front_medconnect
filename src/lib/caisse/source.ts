import type { Poste, Referentiels, SessionCaisse } from "../api_caisse";
import type { StockMedicament } from "../api_pharmacie";
import type { CorpsCreationVente, Vente } from "../api_ventes";

export interface EtatCaisse {
  poste: Poste;
  session: SessionCaisse | null;
}

/** Accès de l'écran de vente aux données : en ligne ici, desktop hors ligne en PD04. */
export interface SourceCaisse {
  chargerStock(structureId: string): Promise<StockMedicament[]>;
  chargerReferentiels(structureId: string): Promise<Referentiels>;
  etatCaisse(structureId: string, utilisateurId: string): Promise<EtatCaisse>;
  creerVente(structureId: string, corps: CorpsCreationVente, cleIdempotence: string): Promise<Vente>;
}
