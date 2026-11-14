import type { ApiResponse } from "../api_auth";
import type {
  BilanCaisse,
  ComptageCaisse,
  MouvementCaisse,
  Poste,
  Referentiels,
  SessionCaisse,
  SessionCaisseOuverte,
} from "../api_caisse";
import type { StockMedicament } from "../api_pharmacie";
import type { CorpsCreationVente, Vente, VentesDuJour } from "../api_ventes";
import type { CorpsComptage, CorpsFermeture, CorpsMouvement, CorpsOuverture } from "./contrat_desktop";

export interface EtatCaisse {
  poste: Poste;
  session: SessionCaisse | null;
}

/**
 * Accès des écrans de caisse aux données : en ligne par l'API, ou local par le pont desktop.
 * Les méthodes de lecture du stock et de la vente rendent la donnée seule ; les autres rendent
 * la réponse de l'API (`ApiResponse`), comme `api_caisse`, car les pages lisent `res.message`.
 */
export interface SourceCaisse {
  /** Vrai pour la source en ligne : les écrans qui exigent le réseau s'appuient dessus. */
  readonly enLigneSeulement: boolean;
  chargerStock(structureId: string): Promise<StockMedicament[]>;
  chargerReferentiels(structureId: string): Promise<Referentiels>;
  etatCaisse(structureId: string, utilisateurId: string): Promise<EtatCaisse>;
  creerVente(structureId: string, corps: CorpsCreationVente, cleIdempotence: string): Promise<Vente>;
  ouvrirSession(structureId: string, corps: CorpsOuverture): Promise<ApiResponse<SessionCaisseOuverte>>;
  saisirComptage(structureId: string, sessionId: string, corps: CorpsComptage): Promise<ApiResponse<ComptageCaisse>>;
  enregistrerMouvement(structureId: string, sessionId: string, corps: CorpsMouvement): Promise<ApiResponse<MouvementCaisse>>;
  getBilan(structureId: string, sessionId: string): Promise<ApiResponse<BilanCaisse>>;
  fermerSession(structureId: string, sessionId: string, corps: CorpsFermeture): Promise<ApiResponse<BilanCaisse>>;
  listerVentes(structureId: string, options: { date?: string; page?: number }): Promise<ApiResponse<VentesDuJour>>;
  getVente(structureId: string, venteId: string): Promise<ApiResponse<Vente | null>>;
  /**
   * Annule une vente. `utilisateurId` ne sert qu'au poste desktop, qui envoie son propre poste au serveur (D745) ;
   * en ligne il est ignoré.
   */
  annulerVente(structureId: string, venteId: string, motif: string, utilisateurId?: string): Promise<ApiResponse<Vente>>;
}
