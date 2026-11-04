import type { UserProfile } from "../api_auth";
import type {
  BilanCaisse,
  ComptageCaisse,
  LigneComptage,
  MouvementCaisse,
  Referentiels,
  SessionCaisseOuverte,
  TypeMouvementCaisse,
} from "../api_caisse";
import type { StockMedicament } from "../api_pharmacie";
import type { CorpsCreationVente, Vente, VentesDuJour } from "../api_ventes";
import type { EtatCaisse } from "./source";

/**
 * Pont exposé par le préchargement Electron. Absent sur le web : c'est le seul test de mode (D438).
 * Les schémas Zod qui valident chaque message vivent dans `contrat_desktop_schemas.ts`, pour que
 * les écrans web n'importent jamais Zod par ce fichier.
 */

/** Réponse enveloppée : une `Error` perd ses propriétés en traversant `contextBridge`. */
export type ReponsePont<T> =
  | { ok: true; data: T; message: string }
  | { ok: false; status: number; message: string; code?: string; details?: unknown };

export interface UtilisateurPoste {
  id: string;
  nom: string;
  structureId: string;
  permissions: string[];
}

export interface EtatPosteDesktop {
  enLigne: boolean;
  /** Vrai seulement après un échec réel de contact avec le serveur. Au démarrage, `enLigne` et `horsLigne` sont faux tous deux. */
  horsLigne: boolean;
  connexionARefaire: boolean;
  nonEnregistre: boolean;
  catalogueDisponible: boolean;
  fileEnAttente: number;
  rejetes: number;
  plageEpuisee: boolean;
  heureFausse: boolean;
  posteDesactive: boolean;
  autrePharmacie: boolean;
  dernierContactLe: string | null;
  photographieLe: string | null;
  /** Message de `moteur.etat().erreur` (envoi bloqué D754, refus 403), null sinon. */
  messageEnvoi: string | null;
}

export interface CorpsOuverture {
  id: string;
  posteId?: string;
  comptage?: { coupures: LigneComptage[] };
}
export interface CorpsComptage {
  id: string;
  moment: "OUVERTURE" | "FERMETURE";
  coupures: LigneComptage[];
  releves?: { mode: string; montant: number }[];
}
export interface CorpsMouvement {
  id: string;
  type: TypeMouvementCaisse;
  montant: number;
  motif: string;
  mode?: string;
}
export interface CorpsFermeture {
  comptageFermeture?: { id: string; coupures: LigneComptage[]; releves?: { mode: string; montant: number }[] };
  commentaire?: string;
}

export interface PontDesktop {
  version: string;
  /** Le rendu ne pousse que le jeton : le processus principal en tire l'identité auprès du serveur (`/auth/me`). */
  definirJeton(jeton: string | null): Promise<void>;
  /** Déconnexion volontaire ou session refusée par le serveur : identité effacée, même hors ligne (D756). `definirJeton(null)` ne l'efface pas. */
  deconnexion(): Promise<void>;
  surDemandeJeton(rappel: () => void): () => void;
  /** Dernier profil confirmé par le serveur, sans jeton, lu en base locale : lecture seule, le rendu ne l'écrit jamais. */
  profil: { lire(): Promise<UserProfile | null> };
  etat(): Promise<EtatPosteDesktop>;
  surEtat(rappel: (e: EtatPosteDesktop) => void): () => void;
  caisse: {
    chargerStock(s: string): Promise<ReponsePont<StockMedicament[]>>;
    chargerReferentiels(s: string): Promise<ReponsePont<Referentiels>>;
    etatCaisse(s: string, u: string): Promise<ReponsePont<EtatCaisse>>;
    creerVente(s: string, corps: CorpsCreationVente, cle: string): Promise<ReponsePont<Vente>>;
    ouvrirSession(s: string, corps: CorpsOuverture): Promise<ReponsePont<SessionCaisseOuverte>>;
    saisirComptage(s: string, sessionId: string, corps: CorpsComptage): Promise<ReponsePont<ComptageCaisse>>;
    enregistrerMouvement(s: string, sessionId: string, corps: CorpsMouvement): Promise<ReponsePont<MouvementCaisse>>;
    getBilan(s: string, sessionId: string): Promise<ReponsePont<BilanCaisse>>;
    fermerSession(s: string, sessionId: string, corps: CorpsFermeture): Promise<ReponsePont<BilanCaisse>>;
    listerVentes(s: string, options: { date?: string; page?: number }): Promise<ReponsePont<VentesDuJour>>;
    getVente(s: string, venteId: string): Promise<ReponsePont<Vente | null>>;
    enregistrerAnnulationServeur(reponse: Vente): Promise<ReponsePont<null>>;
  };
}

declare global {
  interface Window {
    medconnecteDesktop?: PontDesktop;
  }
}

export function pontDesktop(): PontDesktop | null {
  return typeof window !== "undefined" && window.medconnecteDesktop ? window.medconnecteDesktop : null;
}
