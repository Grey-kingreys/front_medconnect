import { MESSAGE_CATALOGUE_ABSENT } from "./messages";
import { RefusCaisse } from "./refus";
import type { Stockage } from "./stockage";
import type { Photographie } from "./types_synchro";

export interface Referentiels {
  pharmacie: Photographie["pharmacie"];
  parametres: Photographie["parametres"];
  modesPaiement: Photographie["modesPaiement"];
  coupures: Photographie["coupures"];
}

export interface Outils {
  horloge: () => Date;
  genererId: () => string;
}

export interface EtatPoste {
  appareilId: string | null;
  structureId: string | null;
  posteId: string | null;
  posteCode: string | null;
  posteLibelle: string | null;
  ordrePointDeVente: number | null;
  pointDeVenteId: string | null;
  sequenceAppliquee: number;
  prochaineSequence: number;
  prochainSecours: number;
  photographieLe: string | null;
  etag: string | null;
  heureServeurEcartMs: number | null;
  plageDemandeeId: string | null;
}

export type TypeEvenement = "SESSION_OUVERTE" | "COMPTAGE_SAISI" | "MOUVEMENT_CAISSE" | "SESSION_FERMEE" | "VENTE";

/** Accès commun aux fonctions de caisse et de vente : stockage, horloge, état du poste, journal. */
export class Contexte {
  constructor(
    readonly stockage: Stockage,
    readonly outils: Outils,
  ) {}

  etat(): EtatPoste {
    return this.stockage.lireUn<EtatPoste>("SELECT * FROM etat_poste WHERE id = 1") as EtatPoste;
  }

  maintenant(): string {
    return this.outils.horloge().toISOString();
  }

  /** Jour courant en UTC, comme `jourConakry` du back : jamais le fuseau de Windows. */
  jour(): string {
    return this.maintenant().slice(0, 10);
  }

  referentiels(): Referentiels | null {
    if (this.etat().photographieLe === null) return null;
    const lire = <T>(table: string): T =>
      JSON.parse(
        (this.stockage.lireUn<{ document: string }>(`SELECT document FROM ${table} WHERE id = 1`) as { document: string })
          .document,
      ) as T;
    return {
      pharmacie: lire<Referentiels["pharmacie"]>("pharmacie"),
      parametres: lire<Referentiels["parametres"]>("parametres"),
      modesPaiement: lire<Referentiels["modesPaiement"]>("modes_paiement"),
      coupures: lire<Referentiels["coupures"]>("coupures"),
    };
  }

  /** Referentiels et poste, ou un refus clair tant qu'aucun catalogue n'a été chargé. */
  referentielsRequis(): Referentiels & { posteId: string; posteCode: string; ordre: number } {
    const ref = this.referentiels();
    const etat = this.etat();
    if (ref === null || etat.posteId === null || etat.posteCode === null || etat.ordrePointDeVente === null) {
      throw new RefusCaisse(409, "CATALOGUE_ABSENT", MESSAGE_CATALOGUE_ABSENT);
    }
    return { ...ref, posteId: etat.posteId, posteCode: etat.posteCode, ordre: etat.ordrePointDeVente };
  }

  /**
   * Ajoute un événement au journal avec la séquence suivante, puis avance la séquence.
   * À appeler dans la transaction de l'opération qu'il décrit.
   */
  ajouterEvenement(type: TypeEvenement, utilisateurId: string, corps: object): number {
    const sequence = this.etat().prochaineSequence;
    this.stockage.executer(
      "INSERT INTO evenements (sequence, evenementId, type, horodatageLocal, utilisateurId, corps, statut) VALUES (?, ?, ?, ?, ?, ?, 'A_ENVOYER')",
      [sequence, this.outils.genererId(), type, this.maintenant(), utilisateurId, JSON.stringify(corps)],
    );
    this.stockage.executer("UPDATE etat_poste SET prochaineSequence = ? WHERE id = 1", [sequence + 1]);
    return sequence;
  }
}
