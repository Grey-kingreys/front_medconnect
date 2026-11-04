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
}
