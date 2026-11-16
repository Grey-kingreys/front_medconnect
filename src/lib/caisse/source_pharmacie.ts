import type { ApiResponse } from "../api_auth";
import type { ChampsFicheSurs } from "./contrat_desktop";
import type { Anomalie, OptionsListeAnomalies, PageAnomalies } from "../api_pilotage";
import type {
  CorpsReception,
  CorpsSortieStock,
  Fournisseur,
  Medicament,
  PageReceptions,
  Reception,
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

/** Options de l'export du stock : mêmes filtres que la route du serveur. */
export interface OptionsExportStock {
  filtre?: "tous" | "alertes" | "rupture" | "qualifier";
  q?: string;
}

/** Résultat d'un export : `enregistre` est faux si la personne a fermé la boîte « Enregistrer sous » sans enregistrer. */
export interface ResultatExport {
  enregistre: boolean;
  nomFichier: string;
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
  /** File des anomalies (à traiter ou traitées). Sur le desktop : anomalies ouvertes de la photographie, moins celles traitées ici. */
  listerAnomalies(structureId: string, options: OptionsListeAnomalies): Promise<ApiResponse<PageAnomalies>>;
  /** Marque une anomalie traitée, une seule fois. Sur le desktop : écriture locale et événement `ANOMALIE_TRAITEE`. */
  traiterAnomalie(structureId: string, anomalieId: string, commentaire: string): Promise<ApiResponse<Anomalie>>;
  /** Fournisseurs de la pharmacie. Sur le desktop : photographie plus ceux créés sur ce poste. */
  listerFournisseurs(structureId: string): Promise<ApiResponse<Fournisseur[]>>;
  /** Crée un fournisseur ; un nom déjà pris rend le fournisseur existant sur le desktop (`cree` faux). */
  creerFournisseur(structureId: string, corps: { nom: string; telephone?: string }): Promise<ApiResponse<Fournisseur & { cree: boolean }>>;
  /** Enregistre une livraison ; rejouable avec le même `id`. Sur le desktop : écriture locale et événement `RECEPTION_ENREGISTREE`. */
  enregistrerReception(structureId: string, corps: CorpsReception): Promise<ApiResponse<Reception>>;
  /** Réceptions, les plus récentes d'abord. Sur le desktop : 30 derniers jours, sans aucun montant. */
  listerReceptions(structureId: string, page: number): Promise<ApiResponse<PageReceptions>>;
  /** Détail d'une réception. Sur le desktop : sans coût ni montant de facture (ils ne descendent pas sur le poste). */
  lireReception(structureId: string, receptionId: string): Promise<ApiResponse<Reception>>;
  /** Recherche dans le catalogue des médicaments. Sur le desktop : copie allégée de la dernière photographie (nom, générique, catégorie, formes, ordonnance). */
  rechercherCatalogue(structureId: string, recherche: string): Promise<Medicament[]>;
  /** Ajoute un médicament du catalogue au stock, sans quantité ; rejouable avec le même `id`. Sur le desktop : fiche locale et événement `FICHE_CREEE`. */
  creerFiche(structureId: string, corps: { id?: string; medicamentId: string; prixUnitaire?: number | null; notes?: string | null }): Promise<ApiResponse<{ fiche: StockMedicament; cree: boolean }>>;
  /** Modifie les champs sûrs d'une fiche (prix de la boîte, prix à l'unité, tolérance, notes). Sur le desktop : écriture locale et événement `FICHE_MODIFIEE`. */
  modifierFiche(structureId: string, fiche: { id: string; medicamentId: string }, champs: ChampsFicheSurs): Promise<ApiResponse<{ fiche: StockMedicament; modifiee: boolean }>>;
  /** Exporte le stock en .xlsx. Sur le desktop : fichier fait sur le poste (sans coût), enregistré par « Enregistrer sous ». */
  exporterStock(structureId: string, options: OptionsExportStock): Promise<ResultatExport>;
}
