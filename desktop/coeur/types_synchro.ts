/**
 * Photographie du catalogue d'un poste, recopiée de
 * back_medconnect/src/pharmacie/synchro/catalogue-synchro.service.ts (CatalogueSynchro),
 * telle qu'elle arrive en JSON (les dates sont des chaînes).
 */

export interface LotSynchro {
  id: string;
  numeroLot: string | null;
  dateExpiration: string | null;
  dateReception: string;
  coefficientReception: number;
  solde: number;
  lotTechnique: boolean;
}

export interface FicheSynchro {
  stockId: string;
  medicamentId: string;
  nom: string;
  nomGenerique: string | null;
  categorie: string;
  formes: string[];
  ordonnanceRequise: boolean;
  prixUnitaire: number | null;
  prixUnite: number | null;
  coefficientBoite: number;
  uniteMinimale: string;
  deconditionnable: boolean;
  /** Faux : la fiche reste à qualifier. Absent d'un serveur plus ancien. */
  qualifie?: boolean;
  notes?: string | null;
  /** Jamais négative (D719) : le poste affiche 0 et `quantiteARegulariser`. */
  quantite: number;
  quantiteARegulariser: number;
  lots: LotSynchro[];
}

export interface PlageLue {
  id: string;
  debut: number;
  fin: number;
}

export interface ParametresReponse {
  horizonsPeremptionJours: number[];
  seuilEcartCaisse: number;
  seuilAvertissementPrixPct: number;
  seuilStockBas: number;
  taillePlageTickets: number;
  seuilRechargementPlagePct: number;
  /** Date ISO. */
  debutCaisse: string;
}

export interface ModePaiementSynchro {
  code: string;
  libelle: string;
  comptagePhysique: boolean;
  referenceAutorisee: boolean;
  ordre: number;
}

export interface CoupureSynchro {
  devise: string;
  valeurFaciale: number;
  type: string;
  ordre: number;
}

/** Anomalie ouverte de la pharmacie, telle que la photographie la donne (détails lisibles, aucun coût). */
export interface AnomalieSynchro {
  id: string;
  type: string;
  libelle: string;
  statut: "OUVERTE" | "TRAITEE";
  creeLe: string;
  pieceType: string;
  pieceId: string | null;
  details: Record<string, unknown> | null;
  attribueeA: { id: string; nom: string } | null;
  traiteeLe: string | null;
  traiteePar: { id: string; nom: string } | null;
  commentaireTraitement: string | null;
  rattachement: { etat: string; quantiteInitiale: number; quantiteEnAttente: number; message: string } | null;
}

export interface Photographie {
  pharmacie: {
    id: string;
    nom: string;
    adresse: string | null;
    ville: string | null;
    telephone: string | null;
    logoUrl: string | null;
  };
  pointDeVente: { id: string; ordre: number };
  poste: {
    id: string;
    code: string;
    libelle: string;
    sequenceAppliquee: number;
    sequenceMaxRecue: number;
    plages: PlageLue[];
  };
  parametres: ParametresReponse;
  modesPaiement: ModePaiementSynchro[];
  coupures: CoupureSynchro[];
  fiches: FicheSynchro[];
  /** Anomalies ouvertes (absent d'un serveur plus ancien). */
  anomalies?: AnomalieSynchro[];
}

/** Ligne du journal local prête à partir : `corps` est le texte stocké, jamais retransformé. */
export interface EvenementAEnvoyer {
  sequence: number;
  evenementId: string;
  type: string;
  horodatageLocal: string;
  utilisateurId: string;
  corps: string;
}

/** Sort d'un événement après un accusé du serveur (A_RENVOYER n'a pas d'équivalent : la ligne ne bouge pas). */
export interface ResultatLocal {
  evenementId: string;
  statut: "ENVOYE" | "EN_ATTENTE" | "REJETE";
  code?: string | null;
  message?: string | null;
}

/** Ce que le moteur de synchronisation lit de l'état du poste. */
export interface EtatPourSynchro {
  structureId: string | null;
  posteId: string | null;
  etag: string | null;
  photographieLe: string | null;
  plageDemandeeId: string | null;
  sequenceAppliquee: number;
  plagesLocales: number;
  /** Numéros restants dans toutes les plages, et paramètres de la dernière photographie (null sans catalogue). */
  plageRestante: number;
  taillePlage: number | null;
  seuilRechargementPct: number | null;
  sessionOuverte: boolean;
  fileEnAttente: number;
  rejetes: number;
}
