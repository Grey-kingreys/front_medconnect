import type { LotFiche, StockMedicament, UniteMinimale } from "@/lib/api_pharmacie";
import { calculerStockLocal, type SortieLocale } from "@/lib/caisse/regles/stock_local";
import type { BilanCaisse, ComptageCaisse, MouvementCaisse, SessionCaisse, SessionCaisseOuverte } from "@/lib/api_caisse";
import type { CorpsCreationVente, Vente, VentesDuJour } from "@/lib/api_ventes";
import {
  bilan,
  enregistrerMouvement,
  fermerSession,
  ouvrirSession,
  saisirComptage,
  sessionOuverteLigne,
  versSession,
} from "./caisse_session";
import { Contexte, type Outils, type Referentiels } from "./contexte";
import { plageRestante } from "./plages_locales";
import type { Stockage } from "./stockage";
import type { ComptageEntree, EtatLocal, FermetureEntree, MouvementEntree, Utilisateur } from "./types_caisse";
import type {
  EtatPourSynchro,
  EvenementAEnvoyer,
  FicheSynchro,
  PlageLue,
  Photographie,
  ResultatLocal,
} from "./types_synchro";
import {
  enregistrerAnnulationServeur,
  enregistrerVente,
  listerVentes,
  lireVente,
  type ReponseAnnulation,
} from "./vente_locale";

export type { ReponseAnnulation } from "./vente_locale";

export type { Outils, Referentiels } from "./contexte";

/** Fiche au format que l'écran de vente lit déjà. */
export type FicheLocale = StockMedicament;

const UNITES: readonly UniteMinimale[] = ["COMPRIME", "GELULE", "ML", "SACHET", "GRAMME", "AMPOULE", "PLAQUETTE", "UNITE"];

function uniteConnue(valeur: string): UniteMinimale {
  return (UNITES as readonly string[]).includes(valeur) ? (valeur as UniteMinimale) : "UNITE";
}

/**
 * Cœur de la caisse locale : indépendant d'Electron, de Next et de React.
 * Tout passe par le `Stockage` injecté.
 */
export class CoeurCaisse {
  private readonly ctx: Contexte;

  constructor(
    private readonly stockage: Stockage,
    private readonly outils: Outils,
  ) {
    this.ctx = new Contexte(stockage, outils);
  }

  private etat() {
    return this.ctx.etat();
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
      // Base en retard sur le serveur (D752) : remise à vide ou copie restaurée. Le serveur a reçu
      // des événements que ce poste ne connaît plus (jamais vrai en marche normale), donc des
      // numéros ont pu être donnés à des clients : aucun numéro de plage ne doit être réutilisé.
      if (photo.poste.sequenceMaxRecue >= etat.prochaineSequence) {
        const recues = [...photo.poste.plages].sort((a, b) => a.debut - b.debut);
        // Deux plages ouvertes au serveur : seule la plus récente sert, elle est intacte (si elle
        // portait un numéro, l'ancienne serait épuisée et absente de la réponse, D632).
        // Une seule : abandonnée, elle a pu servir en partie.
        const gardee = recues.length === 2 ? recues[1].id : null;
        s.executer("UPDATE plages SET dernierUtilise = fin WHERE id <> ?", [gardee ?? ""]);
        s.executer("UPDATE etat_poste SET prochainSecours = MAX(prochainSecours, ?) WHERE id = 1", [
          photo.poste.sequenceMaxRecue + 1,
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
    return this.ctx.jour();
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
    return this.ctx.referentiels();
  }

  // ------------------------------------------------------------------ caisse (PD02b)

  /** Caisse ouverte sur le poste, ou null. */
  sessionOuverte(): SessionCaisse | null {
    const s = sessionOuverteLigne(this.ctx);
    return s ? versSession(this.ctx, s) : null;
  }

  ouvrirSession(entree: { id: string; comptage?: { coupures: { valeurFaciale: number; nombre: number }[] } }, u: Utilisateur): SessionCaisseOuverte {
    return ouvrirSession(this.ctx, entree, u);
  }

  saisirComptage(sessionId: string, entree: ComptageEntree, u: Utilisateur): ComptageCaisse {
    return saisirComptage(this.ctx, sessionId, entree, u);
  }

  enregistrerMouvement(sessionId: string, entree: MouvementEntree, u: Utilisateur): MouvementCaisse {
    return enregistrerMouvement(this.ctx, sessionId, entree, u);
  }

  bilan(sessionId: string, u: Utilisateur): BilanCaisse {
    return bilan(this.ctx, sessionId, u);
  }

  fermerSession(sessionId: string, entree: FermetureEntree, u: Utilisateur): BilanCaisse {
    return fermerSession(this.ctx, sessionId, entree, u);
  }

  // ------------------------------------------------------------------ ventes (PD02b)

  /** Vente, numéro, sorties et événement en une seule transaction ; jamais de refus de stock (D713.2). */
  enregistrerVente(corps: CorpsCreationVente, cle: string, u: Utilisateur): Vente {
    return enregistrerVente(this.ctx, corps, cle, u);
  }

  lireVente(id: string): Vente | null {
    return lireVente(this.ctx, id);
  }

  listerVentes(jour: string): VentesDuJour {
    return listerVentes(this.ctx, jour);
  }

  /** Annulation faite en ligne (D745) : théorique local, caisse adoptée, vente marquée annulée. Aucun événement. */
  enregistrerAnnulationServeur(reponse: ReponseAnnulation): void {
    enregistrerAnnulationServeur(this.ctx, reponse);
  }

  // ------------------------------------------------------------------ synchronisation (PD03)

  /** État lu par le moteur de synchronisation. */
  etatPourSynchro(): EtatPourSynchro {
    const e = this.etat();
    const local = this.etatLocal();
    const ref = this.ctx.referentiels();
    return {
      structureId: e.structureId,
      posteId: e.posteId,
      etag: e.etag,
      photographieLe: e.photographieLe,
      plageDemandeeId: e.plageDemandeeId,
      sequenceAppliquee: e.sequenceAppliquee,
      plagesLocales: this.stockage.lireUn<{ n: number }>("SELECT COUNT(*) AS n FROM plages")?.n ?? 0,
      plageRestante: local.plageRestante,
      taillePlage: ref?.parametres.taillePlageTickets ?? null,
      seuilRechargementPct: ref?.parametres.seuilRechargementPlagePct ?? null,
      sessionOuverte: local.sessionOuverte,
      fileEnAttente: local.fileEnAttente,
      rejetes: local.rejetes,
    };
  }

  /** Événements `A_ENVOYER` par séquence croissante, `limite` au plus. */
  evenementsAEnvoyer(limite: number): EvenementAEnvoyer[] {
    return this.stockage.lire<EvenementAEnvoyer>(
      "SELECT sequence, evenementId, type, horodatageLocal, utilisateurId, corps FROM evenements WHERE statut = 'A_ENVOYER' ORDER BY sequence LIMIT ?",
      [limite],
    );
  }

  /** Vrai s'il reste un événement à envoyer ou qui attend un trou au serveur, au-delà de `sequenceMax`. */
  resteApres(sequenceMax: number): { aEnvoyer: boolean; enAttente: boolean } {
    const n = (sql: string, p: unknown[] = []) => this.stockage.lireUn<{ n: number }>(sql, p)?.n ?? 0;
    return {
      aEnvoyer: n("SELECT COUNT(*) AS n FROM evenements WHERE statut = 'A_ENVOYER' AND sequence > ?", [sequenceMax]) > 0,
      enAttente: n("SELECT COUNT(*) AS n FROM evenements WHERE statut = 'EN_ATTENTE'") > 0,
    };
  }

  /**
   * Range les sorts rendus par le serveur. Une ligne déjà `ENVOYE` ou `REJETE` ne bouge plus.
   * N'écrit JAMAIS `sequenceAppliquee` : seule `appliquerPhotographie` le fait (D437, D742).
   */
  appliquerResultats(resultats: ResultatLocal[]): void {
    this.stockage.transaction(() => {
      for (const r of resultats) {
        this.stockage.executer(
          "UPDATE evenements SET statut = ?, code = ?, message = ? WHERE evenementId = ? AND statut IN ('A_ENVOYER', 'EN_ATTENTE')",
          [r.statut, r.code ?? null, r.message ?? null, r.evenementId],
        );
      }
    });
  }

  /** Mémorise l'identifiant de la plage demandée (rejoué tel quel après une réponse perdue), ou l'efface. */
  memoriserPlageDemandee(id: string | null): void {
    this.stockage.executer("UPDATE etat_poste SET plageDemandeeId = ? WHERE id = 1", [id]);
  }

  /** Ajoute les plages que le serveur dit en cours ; celles que le poste connaît déjà ne bougent pas. */
  ajouterPlages(plages: PlageLue[]): void {
    this.stockage.transaction(() => {
      for (const p of plages) {
        this.stockage.executer("INSERT OR IGNORE INTO plages (id, debut, fin, dernierUtilise) VALUES (?, ?, ?, NULL)", [p.id, p.debut, p.fin]);
      }
    });
  }

  /** Réponse 304 : catalogue inchangé, seuls la date de la photographie et l'écart d'heure sont mis à jour. */
  confirmerPhotographie(dateServeur: Date | null): void {
    const maintenant = this.outils.horloge();
    this.stockage.executer("UPDATE etat_poste SET photographieLe = ? WHERE id = 1", [maintenant.toISOString()]);
    if (dateServeur !== null) {
      this.stockage.executer("UPDATE etat_poste SET heureServeurEcartMs = ? WHERE id = 1", [dateServeur.getTime() - maintenant.getTime()]);
    }
  }

  etatLocal(): EtatLocal {
    const nombre = (sql: string) => this.stockage.lireUn<{ n: number }>(sql)?.n ?? 0;
    const restante = plageRestante(this.ctx);
    return {
      fileEnAttente: nombre("SELECT COUNT(*) AS n FROM evenements WHERE statut IN ('A_ENVOYER', 'EN_ATTENTE')"),
      rejetes: nombre("SELECT COUNT(*) AS n FROM evenements WHERE statut = 'REJETE'"),
      plageRestante: restante,
      plageEpuisee: restante === 0,
      sessionOuverte: sessionOuverteLigne(this.ctx) !== undefined,
    };
  }
}
