import type { LigneComptage, TypeMouvementCaisse } from "@/lib/api_caisse";

export interface Utilisateur {
  id: string;
  nom: string;
  superviseur: boolean;
}

export interface ReleveEntree {
  mode: string;
  montant: number;
}

export interface ComptageEntree {
  id: string;
  moment: "OUVERTURE" | "FERMETURE";
  /** Total des espèces saisi directement ; exclusif avec `coupures` (ancien format, toujours accepté). */
  montantEspeces?: number;
  coupures?: LigneComptage[];
  releves?: ReleveEntree[];
}

export interface MouvementEntree {
  id: string;
  type: TypeMouvementCaisse;
  montant: number;
  motif: string;
  mode?: string;
}

export interface FermetureEntree {
  comptageFermeture?: { id: string; montantEspeces?: number; coupures?: LigneComptage[]; releves?: ReleveEntree[] };
  commentaire?: string;
}

export interface EtatLocal {
  /** Événements pas encore acceptés par le serveur (à envoyer ou en attente). */
  fileEnAttente: number;
  rejetes: number;
  /** Numéros de plage encore libres. */
  plageRestante: number;
  plageEpuisee: boolean;
  sessionOuverte: boolean;
}
