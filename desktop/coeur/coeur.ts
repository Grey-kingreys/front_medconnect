import type { SortieStockEnregistree, StockMedicament } from "@/lib/api_pharmacie";
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
import type { InfosPoste, ReglagesPoste } from "@/lib/caisse/contrat_desktop";
import { Contexte, type Outils, type Referentiels } from "./contexte";
import { fichesLocales } from "./fiche_locale";
import { CLE_ANOMALIES_PHOTOGRAPHIE_LE, listerAnomaliesLocales, traiterAnomalieLocale, type OptionsListeAnomaliesLocale } from "./anomalies_locales";
import type { Anomalie, PageAnomalies } from "@/lib/api_pilotage";
import { preparerExportStock, type ExportStockPret } from "./export_stock";
import {
  creerFournisseurLocal,
  enregistrerReceptionLocale,
  listerFournisseursLocaux,
  listerReceptionsLocales,
  lireReceptionLocale,
} from "./reception_locale";
import type { CorpsImportDiffere, ImportDiffere, CorpsInventaire, CorpsReception, Fournisseur, Inventaire, PageInventaires, PageReceptions, Reception } from "@/lib/api_pharmacie";
import type { CorpsClientCredit, CorpsModifClientCredit, FicheClientCredit, ListeCredits, ResultatRemboursement } from "@/lib/api_credit";
import {
  creerClientCreditLocal,
  enregistrerRemboursementLocal,
  listerCreditsLocaux,
  lireFicheCreditLocale,
  modifierClientCreditLocal,
  modifierDateLimiteLocale,
  type CorpsRemboursementLocal,
  type OptionsListeCredits,
} from "./credit_locale";
import { importDejaMisDeCote, listerImportsDifferesLocaux, mettreImportDeCoteLocal, rangerImportsDifferesPhoto } from "./import_differe_locale";
import { enregistrerInventaireLocal, listerInventairesLocaux, lireInventaireLocal } from "./inventaire_locale";
import {
  creerFicheLocale,
  modifierFicheLocale,
  rechercherCatalogueLocal,
  type ChampsFicheModifiables,
  type CorpsFicheCreee,
  type ResultatCreation,
  type ResultatModification,
} from "./fiche_edition_locale";
import type { Medicament } from "@/lib/api_pharmacie";
import { corrigerQuantite, sortirStock, type CorpsCorrectionLocale, type CorpsSortieLocale } from "./stock_operations";
import { plageRestante } from "./plages_locales";
import { enregistrerReglages, lireReglages } from "./reglages";
import type { Stockage } from "./stockage";
import type { ComptageEntree, EtatLocal, FermetureEntree, MouvementEntree, Utilisateur } from "./types_caisse";
import type {
  EtatPourSynchro,
  EvenementAEnvoyer,
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

  /** Identifiant du poste déjà porté par la base, sans jamais en créer un. */
  appareilIdConnu(): string | null {
    return this.etat().appareilId ?? null;
  }

  /** Crée l'UUID de l'appareil au premier appel ; il ne change jamais ensuite. */
  appareilId(): string {
    const existant = this.etat().appareilId;
    if (existant) return existant;
    const id = this.outils.genererId();
    this.stockage.executer("UPDATE etat_poste SET appareilId = ? WHERE id = 1 AND appareilId IS NULL", [id]);
    return this.etat().appareilId as string;
  }

  /**
   * Reprend l'identifiant du poste gardé hors de la base (`appareil.json`, D752) quand la base n'en a pas
   * encore, après une remise à vide : même poste au serveur. Sans effet si la base en a déjà un.
   */
  fixerAppareilId(id: string): void {
    this.stockage.executer("UPDATE etat_poste SET appareilId = ? WHERE id = 1 AND appareilId IS NULL", [id]);
  }

  /** Un poste appartient à une seule pharmacie, fixée une fois (D741). */
  rattacher(entree: { structureId: string }): void {
    const actuelle = this.etat().structureId;
    if (actuelle !== null && actuelle !== entree.structureId) {
      throw new Error("Ce poste est déjà rattaché à une autre pharmacie.");
    }
    this.stockage.executer("UPDATE etat_poste SET structureId = ? WHERE id = 1", [entree.structureId]);
  }

  /** Poste enregistré au serveur par la dernière photographie, ou null tant qu'aucun catalogue n'est chargé. */
  poste(): { id: string; code: string; libelle: string } | null {
    const e = this.etat();
    if (e.posteId === null || e.posteCode === null) return null;
    return { id: e.posteId, code: e.posteCode, libelle: e.posteLibelle ?? "" };
  }

  /** Dernière identité confirmée par le serveur (`/auth/me`), sans jeton : relue hors ligne et au redémarrage. */
  enregistrerProfil(profil: { utilisateurId: string } & Record<string, unknown>): void {
    this.stockage.executer(
      "INSERT OR REPLACE INTO profil_local (id, document, utilisateurId, enregistreLe) VALUES (1, ?, ?, ?)",
      [JSON.stringify(profil), profil.utilisateurId, this.outils.horloge().toISOString()],
    );
  }

  /** Retire l'identité locale (D756), jamais le journal ni les ventes. */
  effacerProfil(): void {
    this.stockage.executer("DELETE FROM profil_local", []);
  }

  lireProfil(): unknown {
    const ligne = this.stockage.lireUn<{ document: string }>("SELECT document FROM profil_local WHERE id = 1");
    return ligne ? (JSON.parse(ligne.document) as unknown) : null;
  }

  structureRattachee(): string | null {
    return this.etat().structureId;
  }

  /** Réglages d'impression de ce poste (PD05). */
  lireReglages(): ReglagesPoste {
    return lireReglages(this.stockage);
  }

  enregistrerReglages(modif: Partial<ReglagesPoste>): ReglagesPoste {
    return enregistrerReglages(this.stockage, modif);
  }

  /** Poste et dernière vente locale, pour la page « Ce poste » (ticket d'essai). */
  infosPoste(): InfosPoste {
    const poste = this.poste();
    const derniere = this.stockage.lireUn<{ id: string }>("SELECT id FROM ventes WHERE typePiece = 'VENTE' ORDER BY createdAt DESC, sequence DESC LIMIT 1");
    return { posteCode: poste?.code ?? null, posteLibelle: poste?.libelle ?? null, derniereVenteId: derniere?.id ?? null };
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

      // Un serveur plus ancien n'envoie pas les anomalies : la table (vide) n'est pas touchée.
      if (photo.anomalies !== undefined) {
        s.executer("DELETE FROM anomalies_locales");
        s.executer("INSERT OR REPLACE INTO reglages (cle, valeur) VALUES (?, ?)", [CLE_ANOMALIES_PHOTOGRAPHIE_LE, maintenant.toISOString()]);
        photo.anomalies.forEach((a, rang) => {
          s.executer("INSERT INTO anomalies_locales (id, rang, document) VALUES (?, ?, ?)", [a.id, rang, JSON.stringify(a)]);
        });
      }

      // Un serveur plus ancien n'envoie ni fournisseurs ni réceptions : les tables ne sont pas touchées.
      if (photo.fournisseurs !== undefined) {
        s.executer("DELETE FROM fournisseurs_photo");
        photo.fournisseurs.forEach((f, rang) => {
          s.executer("INSERT INTO fournisseurs_photo (id, rang, document) VALUES (?, ?, ?)", [f.id, rang, JSON.stringify(f)]);
        });
      }
      if (photo.receptions !== undefined) {
        s.executer("DELETE FROM receptions_photo");
        photo.receptions.forEach((r, rang) => {
          s.executer("INSERT INTO receptions_photo (id, rang, document) VALUES (?, ?, ?)", [r.id, rang, JSON.stringify(r)]);
        });
      }

      // Un serveur plus ancien n'envoie pas d'inventaires : la table n'est pas touchée.
      if (photo.inventaires !== undefined) {
        s.executer("DELETE FROM inventaires_photo");
        photo.inventaires.forEach((i, rang) => {
          s.executer("INSERT INTO inventaires_photo (id, rang, document) VALUES (?, ?, ?)", [i.id, rang, JSON.stringify(i)]);
        });
      }

      // Un serveur plus ancien n'envoie pas les imports mis de côté : le réglage n'est pas touché.
      if (photo.importsDifferes !== undefined) rangerImportsDifferesPhoto(this.ctx, photo.importsDifferes);

      // Un serveur plus ancien n'envoie pas le cahier de crédit : la table n'est pas touchée.
      if (photo.clientsCredit !== undefined) {
        s.executer("DELETE FROM clients_credit_photo");
        photo.clientsCredit.forEach((cl, rang) => {
          s.executer("INSERT INTO clients_credit_photo (id, rang, document) VALUES (?, ?, ?)", [cl.id, rang, JSON.stringify(cl)]);
        });
      }

      // Un serveur plus ancien n'envoie pas le catalogue allégé : la table n'est pas touchée.
      if (photo.medicaments !== undefined) {
        s.executer("DELETE FROM medicaments_catalogue");
        photo.medicaments.forEach((m, rang) => {
          s.executer("INSERT INTO medicaments_catalogue (id, rang, document) VALUES (?, ?, ?)", [m.id, rang, JSON.stringify(m)]);
        });
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

  /** Fiches avec leur stock local : photographie plus les mouvements et lots locaux de séquence supérieure à `sequenceAppliquee`. */
  lireStock(): FicheLocale[] {
    return fichesLocales(this.ctx).map((f) => f.fiche);
  }

  /** Référentiels de la dernière photographie, ou null sans catalogue. */
  lireReferentiels(): Referentiels | null {
    return this.ctx.referentiels();
  }

  // ------------------------------------------------------------------ stock hors ligne

  /** Sortie de stock : mouvement local et événement `SORTIE_STOCK` en une transaction. */
  sortirStock(corps: CorpsSortieLocale, u: Utilisateur): SortieStockEnregistree {
    return sortirStock(this.ctx, corps, u);
  }

  /** Correction de quantité d'un lot : mouvement local et événement `CORRECTION_QUANTITE` en une transaction. */
  corrigerQuantite(stockId: string, corps: CorpsCorrectionLocale, u: Utilisateur): { fiche: StockMedicament; variation: number } {
    return corrigerQuantite(this.ctx, stockId, corps, u);
  }

  /** Classeur .xlsx du stock local, sans coût, avec son nom de fichier. */
  preparerExportStock(options: { filtre?: "tous" | "alertes" | "rupture" | "qualifier"; q?: string }): ExportStockPret {
    return preparerExportStock(this.ctx, options);
  }

  // ------------------------------------------------------------------ réception hors ligne

  /** Fournisseurs de la photographie et ceux créés sur ce poste. */
  listerFournisseurs(): Fournisseur[] {
    return listerFournisseursLocaux(this.ctx);
  }

  /** Crée un fournisseur (ou rend celui du même nom) : écriture locale et événement `FOURNISSEUR_CREE`. */
  creerFournisseur(corps: { nom: string; telephone?: string }, u: Utilisateur): Fournisseur & { cree: boolean } {
    return creerFournisseurLocal(this.ctx, corps, u);
  }

  /** Réception : lots locaux, mouvements positifs et événement `RECEPTION_ENREGISTREE` en une transaction. */
  enregistrerReception(corps: CorpsReception, u: Utilisateur): Reception {
    return enregistrerReceptionLocale(this.ctx, corps, u);
  }

  /** Réceptions des 30 derniers jours (photographie plus celles faites ici), sans aucun montant. */
  listerReceptions(page = 1): PageReceptions {
    return listerReceptionsLocales(this.ctx, page);
  }

  lireReception(id: string): Reception {
    return lireReceptionLocale(this.ctx, id);
  }

  /** Inventaire : lots locaux des lots trouvés, mouvements qui amènent le stock au compté et événement `INVENTAIRE_ENREGISTRE` en une transaction. */
  enregistrerInventaire(corps: CorpsInventaire, u: Utilisateur): Inventaire {
    return enregistrerInventaireLocal(this.ctx, corps, u);
  }

  /** Import Excel mis de côté hors ligne : un seul événement, aucun aperçu, aucune écriture dans le stock local. */
  mettreImportDeCote(corps: CorpsImportDiffere & { id: string }, u: Utilisateur): { import: ImportDiffere; dejaMisDeCote: boolean } {
    const dejaMisDeCote = importDejaMisDeCote(this.ctx, corps.id);
    return { import: mettreImportDeCoteLocal(this.ctx, corps, u), dejaMisDeCote };
  }

  /** Les 20 derniers imports mis de côté : en attente, envoyés ou traités (résultat de la photographie). */
  listerImportsDifferes(): ImportDiffere[] {
    return listerImportsDifferesLocaux(this.ctx);
  }

  /** Inventaires des 30 derniers jours (photographie plus ceux faits ici), sans aucun coût. */
  listerInventaires(page = 1): PageInventaires {
    return listerInventairesLocaux(this.ctx, page);
  }

  lireInventaire(id: string): Inventaire {
    return lireInventaireLocal(this.ctx, id);
  }

  // ------------------------------------------------------------------ cahier de crédit hors ligne

  /** Clients du cahier : photographie plus opérations du poste pas encore appliquées, reste et statut calculés ici. */
  listerCredits(options: OptionsListeCredits = {}): ListeCredits {
    return listerCreditsLocaux(this.ctx, options);
  }

  lireFicheCredit(clientId: string): FicheClientCredit {
    return lireFicheCreditLocale(this.ctx, clientId);
  }

  creerClientCredit(corps: CorpsClientCredit & { id: string }, u: Utilisateur): FicheClientCredit {
    return creerClientCreditLocal(this.ctx, corps, u);
  }

  modifierClientCredit(clientId: string, corps: CorpsModifClientCredit, u: Utilisateur): FicheClientCredit {
    return modifierClientCreditLocal(this.ctx, clientId, corps, u);
  }

  modifierDateLimiteCredit(venteId: string, dateLimite: string | null, u: Utilisateur): FicheClientCredit {
    return modifierDateLimiteLocale(this.ctx, venteId, dateLimite, u);
  }

  /** Remboursement : ligne locale, entrée de caisse locale si versé en caisse, et événement `REMBOURSEMENT_CREDIT`. */
  enregistrerRemboursementCredit(clientId: string, corps: CorpsRemboursementLocal, u: Utilisateur): ResultatRemboursement {
    return enregistrerRemboursementLocal(this.ctx, clientId, corps, u);
  }

  // ------------------------------------------------------------------ fiches hors ligne

  /** Modifie les champs sûrs d'une fiche (prix, tolérance, notes) : surcouche locale et événement `FICHE_MODIFIEE`. */
  modifierFiche(stockId: string, champs: ChampsFicheModifiables, u: Utilisateur): ResultatModification {
    return modifierFicheLocale(this.ctx, stockId, champs, u);
  }

  /** Ajoute un médicament du catalogue au stock, sans quantité : fiche locale et événement `FICHE_CREEE`. */
  creerFiche(corps: CorpsFicheCreee, u: Utilisateur): ResultatCreation {
    return creerFicheLocale(this.ctx, corps, u);
  }

  /** Médicaments du catalogue global allégé (copie de la dernière photographie). */
  rechercherCatalogue(recherche: string): Medicament[] {
    return rechercherCatalogueLocal(this.ctx, recherche);
  }

  // ------------------------------------------------------------------ anomalies hors ligne

  /** Anomalies ouvertes de la dernière photographie (moins celles traitées ici), ou traitées sur ce poste. */
  listerAnomalies(options: OptionsListeAnomaliesLocale = {}): PageAnomalies {
    return listerAnomaliesLocales(this.ctx, options);
  }

  /** Marque une anomalie traitée : marque locale et événement `ANOMALIE_TRAITEE` en une transaction. */
  traiterAnomalie(anomalieId: string, commentaire: string, u: Utilisateur): Anomalie {
    return traiterAnomalieLocale(this.ctx, anomalieId, commentaire, u);
  }

  // ------------------------------------------------------------------ caisse (PD02b)

  /** Caisse ouverte sur le poste, ou null. */
  sessionOuverte(): SessionCaisse | null {
    const s = sessionOuverteLigne(this.ctx);
    return s ? versSession(this.ctx, s) : null;
  }

  ouvrirSession(entree: { id: string; comptage?: { montantEspeces?: number; coupures?: { valeurFaciale: number; nombre: number }[] } }, u: Utilisateur): SessionCaisseOuverte {
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
