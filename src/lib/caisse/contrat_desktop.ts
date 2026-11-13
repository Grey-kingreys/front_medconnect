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
  /** Version d'une mise à jour téléchargée, prête à s'installer à la fermeture. Absent ou null : aucune. */
  majPrete?: string | null;
  /** Vrai si la règle autorise l'installation tout de suite (caisse fermée, ventes toutes envoyées). */
  majInstallable?: boolean;
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

/** Format du ticket : rouleau de 58 ou 80 mm, ou feuille A4. */
export type FormatTicket = "58" | "80" | "A4";

/** Réglages d'impression de ce poste, gardés dans sa base locale. */
export interface ReglagesPoste {
  /** Nom système de l'imprimante choisie, null tant qu'aucune n'est choisie. */
  imprimante: string | null;
  formatRecu: FormatTicket;
  /** Vrai par défaut dès qu'une imprimante est choisie (D746). */
  impressionAutomatique: boolean;
}

export interface ImprimanteSysteme {
  name: string;
  displayName: string;
  isDefault: boolean;
}

/** Ce que la page « Ce poste » affiche en plus des réglages. */
export interface InfosPoste {
  posteCode: string | null;
  posteLibelle: string | null;
  derniereVenteId: string | null;
  /** Adresse de l'API figée à la construction de l'application (adresse seule). Absent côté base locale, ajouté par le processus principal. */
  adresseApi?: string;
  /** Vrai si les mises à jour se font toutes seules, faux si elles sont manuelles. */
  majAutomatique?: boolean;
  /** Dossier des données de ce poste (base, appareil.json, journal.log), ajouté par le processus principal. */
  dossierDonnees?: string;
}

/** Codes d'échec d'une impression (ReponsePont, `code`). */
export const CODE_IMPRIMANTE_NON_CHOISIE = "IMPRIMANTE_NON_CHOISIE";
export const CODE_IMPRESSION_ECHOUEE = "IMPRESSION_ECHOUEE";
export const MESSAGE_IMPRESSION_ECHOUEE =
  "Le ticket n'a pas pu être imprimé. Vérifiez que l'imprimante est allumée et réessayez. La vente est bien enregistrée.";

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
  maj: {
    /** Installe la mise à jour prête et relance l'application ; refusé si une caisse est ouverte ou si des ventes attendent. */
    installer(): Promise<ReponsePont<null>>;
  };
  impression: {
    listerImprimantes(): Promise<ReponsePont<ImprimanteSysteme[]>>;
    lireReglages(): Promise<ReponsePont<ReglagesPoste>>;
    enregistrerReglages(modif: Partial<ReglagesPoste>): Promise<ReponsePont<ReglagesPoste>>;
    lireInfosPoste(): Promise<ReponsePont<InfosPoste>>;
    /** Ouvre le dossier des données de ce poste dans l'explorateur de fichiers. */
    ouvrirDossierDonnees(): Promise<ReponsePont<null>>;
    /** Imprime le ticket de la vente locale sans dialogue, avec l'imprimante et le format réglés. */
    imprimerVente(venteId: string): Promise<ReponsePont<null>>;
    /** Appelé par la fenêtre cachée d'impression quand le reçu est rendu (logo chargé ou replié). */
    signalerPret(): Promise<void>;
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
