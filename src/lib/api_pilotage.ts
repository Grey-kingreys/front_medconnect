/**
 * Pilotage d'une pharmacie : anomalies, alertes de péremption, marge. Contrat aligné sur back_medconnect
 * (orch/pharmacie-t1-back, CLAUDE.md puces PB15a et PB16a).
 */
import { authFetch } from "./api_auth";

/** Types connus du serveur. Un type inconnu reste affichable grâce au libellé que le serveur envoie. */
export const TYPES_ANOMALIE = [
  "STOCK_NEGATIF",
  "ECART_INVENTAIRE",
  "CONDITIONNEMENT_CONCURRENT",
  "REMONTEE_APRES_CLOTURE",
  "ECART_CAISSE",
  "FOND_NON_COMPTE",
  "PLAGE_EPUISEE",
  "PRIX_DIVERGENT",
  "ORDONNANCE_NON_CONFIRMEE",
  "VENTE_UNITE_INTERDITE",
  "PRODUIT_ARCHIVE",
  "EVENEMENT_REJETE",
  "SEQUENCE_MANQUANTE",
] as const;
export type TypeAnomalie = (typeof TYPES_ANOMALIE)[number];

export type EtatRattachement = "EN_ATTENTE" | "PARTIELLE" | "RATTACHEE" | "VENTE_ANNULEE";

export interface Rattachement {
  etat: EtatRattachement;
  quantiteInitiale: number;
  quantiteEnAttente: number;
  message: string;
}

export interface PersonneAnomalie {
  id: string;
  nom: string;
}

export interface Anomalie {
  id: string;
  /** Peut être un type ajouté plus tard par le serveur : ne jamais l'afficher, lire `libelle`. */
  type: TypeAnomalie | (string & {});
  libelle: string;
  statut: "OUVERTE" | "TRAITEE";
  creeLe: string;
  pieceType: string;
  pieceId: string | null;
  /** `message` est un texte lisible à afficher tel quel. */
  details: { message?: string } & Record<string, unknown>;
  attribueeA: PersonneAnomalie | null;
  traiteeLe: string | null;
  traiteePar: PersonneAnomalie | null;
  commentaireTraitement: string | null;
  rattachement: Rattachement | null;
}

export interface PageAnomalies {
  anomalies: Anomalie[];
  page: number;
  parPage: number;
  total: number;
  /** Nombre d'anomalies ouvertes, indépendant du filtre. */
  ouvertes: number;
}

export interface OptionsListeAnomalies {
  statut?: "OUVERTE" | "TRAITEE";
  type?: TypeAnomalie;
  page?: number;
}

/** File d'anomalies (`anomalie:gerer`). Les paramètres absents ne sont pas envoyés. */
export function listerAnomalies(structureId: string, options: OptionsListeAnomalies = {}) {
  const parametres = new URLSearchParams();
  if (options.statut) parametres.set("statut", options.statut);
  if (options.type) parametres.set("type", options.type);
  if (options.page !== undefined) parametres.set("page", String(options.page));
  const requete = parametres.toString();
  return authFetch<PageAnomalies>(
    `/pharmacie/${encodeURIComponent(structureId)}/anomalies${requete === "" ? "" : `?${requete}`}`,
  );
}

/**
 * Un lot en stock classé dans une alerte de péremption. `quantite` est en unités ; une valeur nulle est inconnue.
 * Les clés de coût sont absentes sans `marge:read` : se testent par leur présence (D698).
 */
export interface LotAlerte {
  lotId: string;
  stockId: string;
  nom: string;
  numeroLot: string | null;
  dateExpiration: string;
  /** Négatif si le lot est périmé. */
  joursRestants: number;
  quantite: number;
  quantiteBoites: number;
  unitesEnPlus: number;
  lotTechnique: boolean;
  ficheArchivee: boolean;
  valeurVente: number | null;
  valeurCout?: number | null;
  coutConnu?: boolean;
}

export interface GroupeAlerte {
  nombreLots: number;
  valeurVente: number | null;
  nombreLotsSansPrix: number;
  valeurCout?: number | null;
  nombreLotsCoutInconnu?: number;
  lots: LotAlerte[];
}

export interface AlertesPeremption {
  jour: string;
  /** Ordre décroissant (90, 30, 7) : un lot est dans le plus petit horizon qui le contient. */
  horizons: (GroupeAlerte & { jours: number })[];
  perimes: GroupeAlerte;
  sansDate: { nombreLots: number };
}

/** Alertes de péremption par lot (`stock:read`). */
export function getAlertesPeremption(structureId: string) {
  return authFetch<AlertesPeremption>(`/pharmacie/${encodeURIComponent(structureId)}/stock/alertes-peremption`);
}

export interface RapportMarge {
  du: string;
  au: string;
  /** Jour AAAA-MM-JJ depuis lequel les ventes portent un coût d'achat. */
  debutFiabilite: string | null;
  periodeAvantFiabilite: boolean;
  nombrePieces: number;
  chiffreAffairesTotal: number;
  chiffreAffairesValorise: number;
  coutAlloue: number;
  marge: number;
  nonValorisable: { nombreVentes: number; chiffreAffaires: number };
  provisoires: { nombreLignes: number; chiffreAffaires: number };
}

/** Rapport de marge de la période (`marge:read`, 92 jours au plus). Les dates absentes ne sont pas envoyées. */
export function getRapportMarge(structureId: string, periode: { du?: string; au?: string } = {}) {
  const parametres = new URLSearchParams();
  if (periode.du) parametres.set("du", periode.du);
  if (periode.au) parametres.set("au", periode.au);
  const requete = parametres.toString();
  return authFetch<RapportMarge>(
    `/pharmacie/${encodeURIComponent(structureId)}/rapports/marge${requete === "" ? "" : `?${requete}`}`,
  );
}

/** Marque une anomalie comme traitée, une seule fois (409 ANOMALIE_DEJA_TRAITEE ensuite). */
export function traiterAnomalie(structureId: string, anomalieId: string, commentaire: string) {
  return authFetch<Anomalie>(
    `/pharmacie/${encodeURIComponent(structureId)}/anomalies/${encodeURIComponent(anomalieId)}`,
    { method: "PATCH", body: JSON.stringify({ commentaire }) },
  );
}
