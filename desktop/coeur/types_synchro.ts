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
  /** Écart d'inventaire toléré, en unités minimales. Absent d'un serveur plus ancien. */
  toleranceInventaire?: number | null;
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

export interface FournisseurSynchro {
  id: string;
  nom: string;
  telephone: string | null;
}

/** Lot d'une réception récente : aucun coût ni montant de facture n'arrive sur le poste. */
export interface LotReceptionSynchro {
  id: string;
  stockId: string;
  nom: string;
  numeroLot: string | null;
  dateExpiration: string | null;
  quantiteRecue: number;
  coefficientReception: number;
  solde: number;
  codeArticleFournisseur: string | null;
  codeBarres: string | null;
  quantiteCommandee: number | null;
  prixPublicBoite: number | null;
  codeTva: string | null;
  tauxTvaPourMille: number | null;
  colisage: number | null;
  tableau: string | null;
  bonPreparation: string | null;
}

/** Réception des 30 derniers jours, telle que la photographie la donne. */
export interface ReceptionSynchro {
  id: string;
  reference: string | null;
  recueLe: string;
  createdAt: string;
  auteurId: string;
  numeroFacture: string | null;
  referenceCommande: string | null;
  dateFacture: string | null;
  nombrePages: number | null;
  fournisseur: { id: string; nom: string } | null;
  lots: LotReceptionSynchro[];
}

/** Ligne d'un inventaire récent : aucun coût n'arrive sur le poste. */
export interface LigneInventaireSynchro {
  id: string;
  stockId: string;
  nom: string;
  lotId: string | null;
  numeroLot: string | null;
  dateExpiration: string | null;
  lotTechnique: boolean;
  quantiteTheorique: number;
  quantiteARegulariser: number;
  quantiteComptee: number;
  ecart: number;
  sousTolerance: boolean;
  anomalieId: string | null;
}

/** Inventaire des derniers jours, tel que la photographie le donne (le poste n'en montre que 30 jours). */
export interface InventaireSynchro {
  id: string;
  createdAt: string;
  commentaire: string | null;
  auteur: { id: string; nom: string };
  lignes: LigneInventaireSynchro[];
}

/** Médicament du catalogue global, allégé : seulement de quoi ajouter une fiche au stock (aucun prix, aucun coût). */
export interface MedicamentAllegeSynchro {
  id: string;
  nom: string;
  nomGenerique: string | null;
  categorie: string;
  formes: string[];
  ordonnanceRequise: boolean;
}

/** Ligne d'une prise à crédit de la photographie : nom, quantité affichée et montant, jamais de coût. */
export interface LignePriseSynchro {
  nomMedicament: string;
  nombreAffiche: number;
  uniteAffichee: "BOITE" | "UNITE";
  sousTotal: number;
}

/** Prise à crédit d'un client (une vente en mode CREDIT) ; la date limite est brute, le poste calcule le retard avec son horloge. */
export interface PriseCreditSynchro {
  venteId: string;
  numero: string;
  createdAt: string;
  jourMetier: string;
  vendeurNom: string;
  total: number;
  annulee: boolean;
  motifAnnulation: string | null;
  dateLimite: string | null;
  resteSurPrise: number;
  lignes: LignePriseSynchro[];
}

export interface RemboursementCreditSynchro {
  id: string;
  montant: number;
  note: string | null;
  verseEnCaisse: boolean;
  auteurNom: string | null;
  createdAt: string;
}

/** Client du cahier de crédit de la photographie (statut EN_COURS ou SOLDE : EN_RETARD se calcule sur le poste). */
export interface ClientCreditSynchro {
  id: string;
  nomComplet: string;
  telephone: string | null;
  note: string | null;
  createdAt: string;
  resteAPayer: number;
  totalPris: number;
  totalRembourse: number;
  statut: "EN_COURS" | "SOLDE";
  prises: PriseCreditSynchro[];
  remboursements: RemboursementCreditSynchro[];
  /** Ce que la borne de la photographie a retiré de l'historique (plus anciennes prises et remboursements). Absent d'un serveur plus ancien. */
  anterieur?: { totalPris: number; totalRembourse: number };
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
  /** Fournisseurs et réceptions des 30 derniers jours, sans coût (absents d'un serveur plus ancien). */
  fournisseurs?: FournisseurSynchro[];
  receptions?: ReceptionSynchro[];
  /** Les 200 derniers inventaires, sans coût (absents d'un serveur plus ancien). */
  inventaires?: InventaireSynchro[];
  /** Clients du cahier de crédit, avec prises et remboursements, sans coût (absents d'un serveur plus ancien). */
  clientsCredit?: ClientCreditSynchro[];
  /** Catalogue global allégé, trié par identifiant (absent d'un serveur plus ancien). */
  medicaments?: MedicamentAllegeSynchro[];
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
