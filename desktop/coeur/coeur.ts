import type { LotFiche, StockMedicament, UniteMinimale } from "@/lib/api_pharmacie";
import { calculerStockLocal, type SortieLocale } from "@/lib/caisse/regles/stock_local";
import type { Stockage } from "./stockage";
import type { FicheSynchro, Photographie } from "./types_synchro";

/** Fiche au format que l'écran de vente lit déjà. */
export type FicheLocale = StockMedicament;

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

interface EtatPoste {
  appareilId: string | null;
  structureId: string | null;
  posteId: string | null;
  sequenceAppliquee: number;
  prochaineSequence: number;
  photographieLe: string | null;
}

const UNITES: readonly UniteMinimale[] = ["COMPRIME", "GELULE", "ML", "SACHET", "GRAMME", "AMPOULE", "PLAQUETTE", "UNITE"];

function uniteConnue(valeur: string): UniteMinimale {
  return (UNITES as readonly string[]).includes(valeur) ? (valeur as UniteMinimale) : "UNITE";
}

/**
 * Cœur de la caisse locale : indépendant d'Electron, de Next et de React.
 * Tout passe par le `Stockage` injecté.
 */
export class CoeurCaisse {
  constructor(
    private readonly stockage: Stockage,
    private readonly outils: Outils,
  ) {}

  private etat(): EtatPoste {
    return this.stockage.lireUn<EtatPoste>("SELECT * FROM etat_poste WHERE id = 1") as EtatPoste;
  }

  /** Crée l'UUID de l'appareil au premier appel ; il ne change jamais ensuite. */
  appareilId(): string {
    const existant = this.etat().appareilId;
    if (existant) return existant;
    const id = this.outils.genererId();
    this.stockage.executer("UPDATE etat_poste SET appareilId = ? WHERE id = 1 AND appareilId IS NULL", [id]);
    return this.etat().appareilId as string;
  }

  /** Un poste appartient à une seule pharmacie, fixée une fois (D741). */
  rattacher(entree: { structureId: string }): void {
    const actuelle = this.etat().structureId;
    if (actuelle !== null && actuelle !== entree.structureId) {
      throw new Error("Ce poste est déjà rattaché à une autre pharmacie.");
    }
    this.stockage.executer("UPDATE etat_poste SET structureId = ? WHERE id = 1", [entree.structureId]);
  }

  structureRattachee(): string | null {
    return this.etat().structureId;
  }

  enregistrerPoste(p: { id: string; code: string; libelle: string }): void {
    this.stockage.executer("UPDATE etat_poste SET posteId = ?, posteCode = ?, posteLibelle = ? WHERE id = 1", [
      p.id,
      p.code,
      p.libelle,
    ]);
  }

  /** Remplace le catalogue par la photographie du serveur, en une transaction. */
  appliquerPhotographie(photo: Photographie, etag: string | null, dateServeur: Date | null): void {
    const etat = this.etat();
    if (etat.structureId === null) {
      throw new Error("Ce poste n'est rattaché à aucune pharmacie : rattachez-le avant d'enregistrer un catalogue.");
    }
    if (etat.structureId !== photo.pharmacie.id) {
      throw new Error("Cette photographie vient d'une autre pharmacie que celle de ce poste.");
    }
    if (etat.posteId !== null && etat.posteId !== photo.poste.id) {
      throw new Error("Cette photographie vient d'un autre poste que celui-ci.");
    }
    const maintenant = this.outils.horloge();

    this.stockage.transaction(() => {
      const s = this.stockage;
      for (const [table, document] of [
        ["pharmacie", photo.pharmacie],
        ["parametres", photo.parametres],
        ["modes_paiement", photo.modesPaiement],
        ["coupures", photo.coupures],
      ] as const) {
        s.executer(`INSERT OR REPLACE INTO ${table} (id, document) VALUES (1, ?)`, [JSON.stringify(document)]);
      }

      s.executer("DELETE FROM fiches");
      for (const fiche of photo.fiches) {
        s.executer("INSERT INTO fiches (stockId, document, nom) VALUES (?, ?, ?)", [
          fiche.stockId,
          JSON.stringify(fiche),
          fiche.nom,
        ]);
      }

      // Une plage locale entamée ne bouge jamais ; une plage absente de la réponse est retirée
      // seulement si tous ses numéros sont déjà utilisés.
      for (const plage of photo.poste.plages) {
        s.executer("INSERT OR IGNORE INTO plages (id, debut, fin, dernierUtilise) VALUES (?, ?, ?, NULL)", [
          plage.id,
          plage.debut,
          plage.fin,
        ]);
      }
      const connues = new Set(photo.poste.plages.map((p) => p.id));
      for (const locale of s.lire<{ id: string; fin: number; dernierUtilise: number | null }>(
        "SELECT id, fin, dernierUtilise FROM plages",
      )) {
        if (!connues.has(locale.id) && locale.dernierUtilise !== null && locale.dernierUtilise >= locale.fin) {
          s.executer("DELETE FROM plages WHERE id = ?", [locale.id]);
        }
      }

      s.executer(
        `UPDATE etat_poste SET
           pointDeVenteId = ?, ordrePointDeVente = ?,
           posteId = ?, posteCode = ?, posteLibelle = ?,
           sequenceAppliquee = ?,
           prochaineSequence = MAX(prochaineSequence, ?),
           etag = ?, photographieLe = ?
         WHERE id = 1`,
        [
          photo.pointDeVente.id,
          photo.pointDeVente.ordre,
          photo.poste.id,
          photo.poste.code,
          photo.poste.libelle,
          photo.poste.sequenceAppliquee,
          photo.poste.sequenceMaxRecue + 1,
          etag,
          maintenant.toISOString(),
        ],
      );
      if (dateServeur !== null) {
        s.executer("UPDATE etat_poste SET heureServeurEcartMs = ? WHERE id = 1", [
          dateServeur.getTime() - maintenant.getTime(),
        ]);
      }
    });
  }

  aUnCatalogue(): boolean {
    return this.etat().photographieLe !== null;
  }

  /** Jour courant en UTC, comme `jourConakry` du back : jamais le fuseau de Windows. */
  jour(): string {
    return this.outils.horloge().toISOString().slice(0, 10);
  }

  /** Fiches avec leur stock local : photographie moins les sorties de séquence supérieure à `sequenceAppliquee`. */
  lireStock(): FicheLocale[] {
    const etat = this.etat();
    const structureId = etat.structureId ?? "";
    const jour = this.jour();

    const sortiesParFiche = new Map<string, SortieLocale[]>();
    for (const s of this.stockage.lire<{ stockId: string; lotId: string | null; quantiteUm: number }>(
      "SELECT stockId, lotId, quantiteUm FROM sorties_stock WHERE sequence > ?",
      [etat.sequenceAppliquee],
    )) {
      const liste = sortiesParFiche.get(s.stockId) ?? [];
      liste.push({ lotId: s.lotId, quantiteUm: s.quantiteUm });
      sortiesParFiche.set(s.stockId, liste);
    }

    return this.stockage
      .lire<{ document: string }>("SELECT document FROM fiches ORDER BY rowid")
      .map(({ document }) => {
        const f = JSON.parse(document) as FicheSynchro;
        const stock = calculerStockLocal(f, sortiesParFiche.get(f.stockId) ?? [], jour);
        const lots: LotFiche[] = stock.lots.map((l) => ({
          id: l.id,
          numeroLot: l.numeroLot,
          dateExpiration: l.dateExpiration,
          quantite: l.solde,
          lotTechnique: l.lotTechnique,
          coefficientReception: l.coefficientReception,
        }));
        return {
          id: f.stockId,
          medicamentId: f.medicamentId,
          medicament: {
            id: f.medicamentId,
            nom: f.nom,
            nomGenerique: f.nomGenerique ?? undefined,
            categorie: f.categorie,
            formes: f.formes,
            ordonnanceRequise: f.ordonnanceRequise,
          },
          structureId,
          quantite: stock.quantite,
          quantiteARegulariser: stock.quantiteARegulariser,
          prixUnitaire: f.prixUnitaire ?? 0,
          prixUnite: f.prixUnite,
          coefficientBoite: f.coefficientBoite,
          uniteMinimale: uniteConnue(f.uniteMinimale),
          deconditionnable: f.deconditionnable,
          disponible: stock.quantite > 0,
          reliquat: stock.reliquat,
          quantiteVendable: stock.quantiteVendable,
          lots,
          dateExpiration: stock.dateExpiration ?? undefined,
        };
      });
  }

  /** Référentiels de la dernière photographie, ou null sans catalogue. */
  lireReferentiels(): Referentiels | null {
    if (!this.aUnCatalogue()) return null;
    const lire = <T>(table: string): T =>
      JSON.parse((this.stockage.lireUn<{ document: string }>(`SELECT document FROM ${table} WHERE id = 1`) as { document: string }).document) as T;
    return {
      pharmacie: lire<Referentiels["pharmacie"]>("pharmacie"),
      parametres: lire<Referentiels["parametres"]>("parametres"),
      modesPaiement: lire<Referentiels["modesPaiement"]>("modes_paiement"),
      coupures: lire<Referentiels["coupures"]>("coupures"),
    };
  }
}
