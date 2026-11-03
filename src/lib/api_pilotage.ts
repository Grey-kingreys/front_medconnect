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

/** Marque une anomalie comme traitée, une seule fois (409 ANOMALIE_DEJA_TRAITEE ensuite). */
export function traiterAnomalie(structureId: string, anomalieId: string, commentaire: string) {
  return authFetch<Anomalie>(
    `/pharmacie/${encodeURIComponent(structureId)}/anomalies/${encodeURIComponent(anomalieId)}`,
    { method: "PATCH", body: JSON.stringify({ commentaire }) },
  );
}
