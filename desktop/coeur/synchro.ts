/**
 * Moteur de synchronisation du poste (PD03) : enregistre le poste, envoie le journal, recharge les
 * plages et la photographie du catalogue. Le client HTTP est injecté (compression, jeton et minuterie
 * viennent de PD04a) : ce fichier n'importe ni electron ni node:zlib, et ne voit jamais de jeton.
 *
 * Règles qui comptent (D742, D437) :
 * - un accusé du serveur ne change JAMAIS `sequenceAppliquee` : seule la photographie l'écrit ;
 * - un rejet n'arrête pas la file, une panne réseau ne perd rien ;
 * - jamais d'exception hors de `cycle`.
 */
import type { CoeurCaisse } from "./coeur";
import type { EtatPourSynchro, EvenementAEnvoyer, Photographie, PlageLue, ResultatLocal } from "./types_synchro";

export interface ReponseHttp {
  status: number;
  entetes: Record<string, string>;
  /** Texte de la réponse, déjà décompressé par le client HTTP. */
  corps: string;
}

export interface ClientHttp {
  requete(
    methode: "GET" | "POST",
    chemin: string,
    options?: { entetes?: Record<string, string>; corps?: string; gzip?: boolean },
  ): Promise<ReponseHttp>;
}

/**
 * `DEMARRAGE` : poste rattaché, aucun contact tenté ni échoué pour l'instant. Ce n'est PAS une coupure :
 * `HORS_LIGNE` n'est posé qu'après un échec réel de contact avec le serveur.
 */
export type EtatMoteur = "EN_LIGNE" | "HORS_LIGNE" | "CONNEXION_A_REFAIRE" | "NON_ENREGISTRE" | "DEMARRAGE";

export type MotifCycle = "minuterie" | "apres-vente" | "demarrage";

export interface OptionsMoteur {
  versionApp: string;
  libellePoste: string;
  horloge: () => Date;
  genererId: () => string;
  /** Journal sans donnée sensible : jamais de jeton, de corps de requête ni de donnée de vente. */
  journal?: (message: string) => void;
}

export interface BilanCycle {
  motif: MotifCycle;
  etat: EtatMoteur;
  /** Événements que le serveur a acceptés (appliqués ou déjà connus) pendant ce cycle. */
  evenementsAcceptes: number;
  rejets: number;
  enAttente: number;
  aRenvoyer: number;
  photographie: "aucune" | "appliquee" | "inchangee";
  plageDemandee: boolean;
  /** Raison de l'arrêt avant la fin des étapes, ou null. */
  arret: string | null;
}

export interface EtatSynchro {
  etat: EtatMoteur;
  dernierContactLe: string | null;
  echecsConsecutifs: number;
  prochainDelaiMs: number;
  posteDesactive: boolean;
  heureFausse: boolean;
  ecartHeureMs: number | null;
  /** Événements que le serveur garde en attente d'un trou, d'après sa dernière réponse. */
  enAttenteServeur: number;
  /** Information seulement : le stock local ne s'en sert pas, seule la photographie compte (D437). */
  sequenceAppliqueeServeur: number | null;
  /** Message du serveur pour un refus (403, 400...), affiché tel quel (D660). */
  erreur: string | null;
  rejets: number;
  fileEnAttente: number;
}

/** Limites d'un lot (D742, D663). */
export const LOT_EVENEMENTS_MAX = 200;
export const LOT_OCTETS_MAX = 1_500_000;

const DELAI_ECHEC_MIN_MS = 5_000;
const DELAI_ECHEC_MAX_MS = 5 * 60_000;
const DELAI_FILE_MS = 30_000;
const DELAI_BATTEMENT_MS = 5 * 60_000;
const PHOTOGRAPHIE_PERIODE_MS = 15 * 60_000;
const ECART_HEURE_MAX_MS = 5 * 60_000;

const encodeur = new TextEncoder();

export const MESSAGE_ENVOI_BLOQUE =
  "Des ventes de ce poste ne peuvent pas être envoyées. Elles restent enregistrées ici. Contactez l'assistance.";

interface CorpsReponse {
  data?: unknown;
  message?: string;
  code?: string;
}

interface ResultatServeur {
  evenementId: string;
  statut: string;
  code?: string;
  message?: string;
  differe?: boolean;
}

interface DonneesEnvoi {
  resultats?: ResultatServeur[];
  sequenceAppliquee?: number;
  enAttente?: number;
}

interface Passe {
  motif: MotifCycle;
  forcer: boolean;
  echec: boolean;
  horsLigne: boolean;
  arret: string | null;
  bilan: BilanCycle;
}

function lireCorps(rep: ReponseHttp): CorpsReponse | null {
  try {
    const v: unknown = JSON.parse(rep.corps);
    return v !== null && typeof v === "object" ? (v as CorpsReponse) : null;
  } catch {
    return null;
  }
}

function entete(rep: ReponseHttp, nom: string): string | null {
  const cle = Object.keys(rep.entetes).find((k) => k.toLowerCase() === nom);
  return cle === undefined ? null : rep.entetes[cle];
}

function dateEntete(rep: ReponseHttp): Date | null {
  const v = entete(rep, "date");
  if (v === null) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export class MoteurSynchro {
  private etatMoteur: EtatMoteur;
  private dernierContact: string | null = null;
  private echecs = 0;
  private posteDesactive = false;
  private heureFausse = false;
  private ecartHeureMs: number | null = null;
  private enAttenteServeur = 0;
  private sequenceServeur: number | null = null;
  private erreur: string | null = null;
  /** Des ventes sont bloquées (voir `bloquerEnvoi`) : `erreur` reste affichée jusqu'au prochain envoi accepté. */
  private envoiBloque = false;
  private enCours: Promise<BilanCycle> | null = null;
  /** Une photographie est demandée au prochain cycle (`force`). */
  private photographieDemandee = false;

  constructor(
    private readonly coeur: CoeurCaisse,
    private readonly http: ClientHttp,
    private readonly options: OptionsMoteur,
  ) {
    this.etatMoteur = coeur.structureRattachee() === null ? "NON_ENREGISTRE" : "DEMARRAGE";
  }

  /**
   * Résultat d'un contact léger (route publique, avec ou sans jeton), répété entre deux cycles : sans lui, une
   * coupure ne se verrait qu'au prochain cycle, jusqu'à 5 minutes plus tard. Un échec réel pose HORS_LIGNE ; un
   * contact réussi sort d'une coupure vers DEMARRAGE (le cycle suivant dira EN_LIGNE). Sans effet quand la
   * connexion est à refaire ou le poste non enregistré : ces états ont leur propre message.
   */
  signalerContact(reussi: boolean): void {
    if (this.etatMoteur === "CONNEXION_A_REFAIRE" || this.etatMoteur === "NON_ENREGISTRE") return;
    if (!reussi) this.etatMoteur = "HORS_LIGNE";
    else if (this.etatMoteur === "HORS_LIGNE") this.etatMoteur = "DEMARRAGE";
  }

  /** Demande une photographie complète au prochain cycle, même si elle n'est pas due. */
  forcerPhotographie(): void {
    this.photographieDemandee = true;
  }

  /** Nouveau jeton disponible : le moteur repart au prochain cycle. */
  reprendreApresConnexion(): void {
    if (this.etatMoteur === "CONNEXION_A_REFAIRE") this.etatMoteur = "DEMARRAGE";
  }

  /** Un seul cycle à la fois : un second appel attend le même cycle, pas d'envois croisés. */
  cycle(motif: MotifCycle): Promise<BilanCycle> {
    if (this.enCours !== null) return this.enCours;
    const travail = this.executer(motif).finally(() => {
      this.enCours = null;
    });
    this.enCours = travail;
    return travail;
  }

  etat(): EtatSynchro {
    const local = this.coeur.etatLocal();
    return {
      etat: this.etatMoteur,
      dernierContactLe: this.dernierContact,
      echecsConsecutifs: this.echecs,
      prochainDelaiMs: this.prochainDelaiMs(),
      posteDesactive: this.posteDesactive,
      heureFausse: this.heureFausse,
      ecartHeureMs: this.ecartHeureMs,
      enAttenteServeur: this.enAttenteServeur,
      sequenceAppliqueeServeur: this.sequenceServeur,
      erreur: this.erreur,
      rejets: local.rejetes,
      fileEnAttente: local.fileEnAttente,
    };
  }

  /**
   * Échecs : 5 s, 10 s, 20 s... jusqu'à 5 min ; file non vide : 30 s ; file vide : battement de 5 min (D742).
   * Pour PD04a : rappeler `cycle` après chaque cycle, au délai rendu ici (ne jamais s'arrêter, même en erreur).
   */
  prochainDelaiMs(): number {
    if (this.echecs > 0) return Math.min(DELAI_ECHEC_MIN_MS * 2 ** (this.echecs - 1), DELAI_ECHEC_MAX_MS);
    return this.coeur.etatLocal().fileEnAttente > 0 ? DELAI_FILE_MS : DELAI_BATTEMENT_MS;
  }

  // ------------------------------------------------------------------ cycle

  private async executer(motif: MotifCycle): Promise<BilanCycle> {
    const passe: Passe = {
      motif,
      forcer: this.photographieDemandee,
      echec: false,
      horsLigne: false,
      arret: null,
      bilan: {
        motif,
        etat: this.etatMoteur,
        evenementsAcceptes: 0,
        rejets: 0,
        enAttente: 0,
        aRenvoyer: 0,
        photographie: "aucune",
        plageDemandee: false,
        arret: null,
      },
    };
    try {
      if (this.coeur.structureRattachee() === null) {
        this.etatMoteur = "NON_ENREGISTRE";
        passe.arret = "Ce poste n'est rattaché à aucune pharmacie.";
        return this.cloturer(passe, false);
      }
      if (this.etatMoteur === "CONNEXION_A_REFAIRE") {
        passe.arret = "La connexion est à refaire.";
        return this.cloturer(passe, false);
      }
      if (this.etatMoteur === "NON_ENREGISTRE") this.etatMoteur = "DEMARRAGE";
      if (!this.envoiBloque) this.erreur = null;
      if (motif === "demarrage") this.posteDesactive = false;

      await this.enregistrerPoste(passe);
      if (passe.arret === null) await this.envoyer(passe);
      if (passe.arret === null && !this.posteDesactive) await this.plage(passe);
      if (passe.arret === null && !this.posteDesactive) await this.photographier(passe);
      return this.cloturer(passe, true);
    } catch (e) {
      // Garde-fou : une erreur imprévue ne sort jamais du moteur et ne perd rien (le journal local est intact).
      this.journal(`erreur interne du moteur (${e instanceof Error ? e.name : "inconnue"})`);
      passe.echec = true;
      passe.horsLigne = true;
      passe.arret = "Erreur interne de synchronisation.";
      return this.cloturer(passe, true);
    }
  }

  private cloturer(passe: Passe, compter: boolean): BilanCycle {
    if (compter && this.etatMoteur !== "CONNEXION_A_REFAIRE") {
      if (passe.echec) this.echecs += 1;
      else this.echecs = 0;
      if (passe.horsLigne) this.etatMoteur = "HORS_LIGNE";
      else this.etatMoteur = "EN_LIGNE";
    }
    // Une demande est servie dès que la photographie a répondu, même si l'envoi reste bloqué.
    if (passe.forcer && passe.bilan.photographie !== "aucune") this.photographieDemandee = false;
    passe.bilan.etat = this.etatMoteur;
    passe.bilan.arret = passe.arret;
    return passe.bilan;
  }

  // ------------------------------------------------------------------ HTTP

  /**
   * Appelle le serveur et traite ce qui est commun à toutes les routes. Rend la réponse quand l'appelant
   * doit encore la lire (2xx, 304, 409, 413), sinon null : le cycle est alors arrêté.
   */
  private async appeler(
    passe: Passe,
    methode: "GET" | "POST",
    chemin: string,
    options?: { entetes?: Record<string, string>; corps?: string; gzip?: boolean },
    rendre400 = false,
  ): Promise<ReponseHttp | null> {
    let rep: ReponseHttp;
    try {
      rep = await this.http.requete(methode, chemin, options);
    } catch {
      this.journal(`${methode} ${this.nomRoute(chemin)} : panne réseau`);
      return this.panne(passe, "Le serveur est injoignable.");
    }
    const s = rep.status;
    if (s === 401) {
      this.etatMoteur = "CONNEXION_A_REFAIRE";
      passe.arret = "La connexion est à refaire.";
      this.journal(`${methode} ${this.nomRoute(chemin)} : 401`);
      return null;
    }
    if (s === 429 || s >= 500) {
      this.journal(`${methode} ${this.nomRoute(chemin)} : ${s}`);
      return this.panne(passe, "Le serveur est indisponible.");
    }
    // Le serveur répond : dernier contact à jour, même pour un refus.
    this.dernierContact = this.options.horloge().toISOString();
    if (s === 400 && rendre400) return rep;
    if (s === 403 || s === 400) {
      this.journal(`${methode} ${this.nomRoute(chemin)} : ${s}`);
      passe.echec = true;
      passe.arret = lireCorps(rep)?.message ?? "Le serveur a refusé la demande.";
      this.erreur = s === 403 ? passe.arret : this.erreur;
      return null;
    }
    return rep;
  }

  private panne(passe: Passe, raison: string): null {
    passe.echec = true;
    passe.horsLigne = true;
    passe.arret = raison;
    return null;
  }

  /** Nom de route sans identifiant ni paramètre, pour le journal. */
  private nomRoute(chemin: string): string {
    return chemin.split("?")[0].replace(/\/[0-9a-f-]{8,}/gi, "/:id");
  }

  private refusInattendu(passe: Passe, rep: ReponseHttp): void {
    passe.echec = true;
    passe.arret = lireCorps(rep)?.message ?? `Réponse inattendue du serveur (${rep.status}).`;
    this.erreur = passe.arret;
  }

  private base(structureId: string): string {
    return `/pharmacie/${structureId}`;
  }

  // ------------------------------------------------------------------ poste

  private async enregistrerPoste(passe: Passe): Promise<void> {
    const e = this.coeur.etatPourSynchro();
    if (e.posteId !== null || e.structureId === null) return;
    const rep = await this.appeler(passe, "POST", `${this.base(e.structureId)}/postes`, {
      entetes: { "Content-Type": "application/json" },
      corps: JSON.stringify({ type: "DESKTOP", appareilId: this.coeur.appareilId(), libelle: this.options.libellePoste }),
    });
    if (rep === null) return;
    const data = lireCorps(rep)?.data as { id?: string; code?: string; libelle?: string } | undefined;
    if (rep.status !== 200 || !data?.id || !data.code || !data.libelle) {
      this.refusInattendu(passe, rep);
      return;
    }
    this.coeur.enregistrerPoste({ id: data.id, code: data.code, libelle: data.libelle });
  }

  // ------------------------------------------------------------------ envoi

  /** Prépare le prochain lot : 200 événements et 1,5 Mo de JSON au plus avant compression. */
  private preparerLot(maxEvenements: number, posteId: string): { evenements: EvenementAEnvoyer[]; corps: string } {
    const lignes = this.coeur.evenementsAEnvoyer(Math.min(maxEvenements, LOT_EVENEMENTS_MAX));
    const etatBase = { fileVide: false, sessionOuverte: false, versionApp: this.options.versionApp };
    let octets = encodeur.encode(JSON.stringify({ posteId, etat: etatBase, evenements: [] })).length + 1024;
    const retenus: EvenementAEnvoyer[] = [];
    const objets: object[] = [];
    for (const l of lignes) {
      const objet = {
        evenementId: l.evenementId,
        sequence: l.sequence,
        type: l.type,
        horodatageLocal: l.horodatageLocal,
        utilisateurId: l.utilisateurId,
        corps: JSON.parse(l.corps) as unknown,
      };
      const taille = encodeur.encode(JSON.stringify(objet)).length + 1;
      if (retenus.length > 0 && octets + taille > LOT_OCTETS_MAX) break;
      octets += taille;
      retenus.push(l);
      objets.push(objet);
    }
    const dernier = retenus.length > 0 ? retenus[retenus.length - 1].sequence : 0;
    const reste = this.coeur.resteApres(dernier);
    const local = this.coeur.etatPourSynchro();
    const corps = JSON.stringify({
      posteId,
      etat: { fileVide: !reste.aEnvoyer && !reste.enAttente, sessionOuverte: local.sessionOuverte, versionApp: this.options.versionApp },
      evenements: objets,
    });
    return { evenements: retenus, corps };
  }

  private async envoyer(passe: Passe): Promise<void> {
    const debut = this.coeur.etatPourSynchro();
    if (debut.structureId === null || debut.posteId === null) return;
    const chemin = `${this.base(debut.structureId)}/synchro/evenements`;
    let taille = LOT_EVENEMENTS_MAX;
    let premier = true;

    for (;;) {
      const lot = this.preparerLot(taille, debut.posteId);
      // Le premier envoi du cycle part même vide : c'est le battement de cœur.
      if (!premier && lot.evenements.length === 0) return;
      premier = false;

      const rep = await this.appeler(passe, "POST", chemin, {
        entetes: { "Content-Type": "application/json" },
        corps: lot.corps,
        gzip: true,
      }, true);
      if (rep === null) return;

      if (rep.status === 400) {
        this.bloquerEnvoi(passe, "400 sur l'envoi des événements");
        return;
      }
      if (rep.status === 413) {
        if (lot.evenements.length <= 1) {
          this.bloquerEnvoi(passe, "413 sur un événement seul");
          return;
        }
        taille = Math.max(1, Math.floor(lot.evenements.length / 2));
        continue;
      }
      if (rep.status === 409 && lireCorps(rep)?.code === "POSTE_INCONNU") {
        this.posteDesactive = true;
        return;
      }
      if (rep.status !== 200) {
        this.refusInattendu(passe, rep);
        return;
      }
      const donnees = lireCorps(rep)?.data as DonneesEnvoi | undefined;
      if (!donnees || !Array.isArray(donnees.resultats)) {
        passe.echec = true;
        passe.arret = "Réponse du serveur illisible.";
        return;
      }
      const toutAccuse = this.ranger(passe, lot.evenements, donnees);
      if (!toutAccuse) return;
      if (lot.evenements.length === 0 || !this.coeur.resteApres(0).aEnvoyer) return;
    }
  }

  /**
   * Des ventes ne peuvent pas partir (400, 413 sur un événement seul, statut inconnu) : jamais écartées,
   * toujours A_ENVOYER. Blocage visible (`erreur`), échec compté pour la reprise de 5 s à 5 min, et le
   * cycle continue (plage, photographie) pour que le poste reste utilisable. Raison technique au journal
   * seulement, sans corps de vente.
   */
  private bloquerEnvoi(passe: Passe, raison: string): void {
    this.journal(`envoi bloqué : ${raison}`);
    passe.echec = true;
    this.envoiBloque = true;
    this.erreur = MESSAGE_ENVOI_BLOQUE;
  }

  /** Range les résultats ; vrai si chaque événement du lot a reçu un sort définitif ou en attente. */
  private ranger(passe: Passe, lot: EvenementAEnvoyer[], donnees: DonneesEnvoi): boolean {
    const locaux: ResultatLocal[] = [];
    const ids = new Set<string>();
    let aRenvoyer = false;
    let inconnu = false;
    for (const r of donnees.resultats ?? []) {
      switch (r.statut) {
        case "APPLIQUE":
        case "DEJA_APPLIQUE":
          locaux.push({ evenementId: r.evenementId, statut: "ENVOYE" });
          passe.bilan.evenementsAcceptes += 1;
          ids.add(r.evenementId);
          break;
        case "EN_ATTENTE":
          locaux.push({ evenementId: r.evenementId, statut: "EN_ATTENTE" });
          passe.bilan.enAttente += 1;
          ids.add(r.evenementId);
          break;
        case "REJETE":
          // Un rejet est définitif et n'arrête pas la file : code et message du serveur gardés tels quels.
          locaux.push({ evenementId: r.evenementId, statut: "REJETE", code: r.code ?? null, message: r.message ?? null });
          passe.bilan.rejets += 1;
          ids.add(r.evenementId);
          break;
        case "A_RENVOYER":
          aRenvoyer = true;
          passe.bilan.aRenvoyer += 1;
          break;
        default:
          // Statut que ce poste ne connaît pas (contrat changé ?) : la ligne reste A_ENVOYER.
          inconnu = true;
          break;
      }
    }
    this.coeur.appliquerResultats(locaux);
    if (lot.length === 0 || locaux.some((l) => l.statut === "ENVOYE")) {
      // Envoi accepté, ou battement à vide accepté : le blocage est levé.
      this.envoiBloque = false;
      this.erreur = null;
    }
    if (inconnu) {
      this.bloquerEnvoi(passe, "statut de résultat inconnu");
      return false;
    }
    if (typeof donnees.sequenceAppliquee === "number") this.sequenceServeur = donnees.sequenceAppliquee;
    if (typeof donnees.enAttente === "number") this.enAttenteServeur = donnees.enAttente;
    if (aRenvoyer) {
      passe.echec = true;
      passe.arret = "Le serveur demande de renvoyer plus tard.";
      return false;
    }
    return lot.every((e) => ids.has(e.evenementId));
  }

  // ------------------------------------------------------------------ plages

  private async plage(passe: Passe): Promise<void> {
    const e = this.coeur.etatPourSynchro();
    if (e.structureId === null || e.posteId === null) return;
    const sous =
      e.taillePlage !== null && e.seuilRechargementPct !== null && e.plageRestante < (e.taillePlage * e.seuilRechargementPct) / 100;
    // Une demande dont la réponse s'est perdue est rejouée avec le même identifiant (D632).
    if (e.plageDemandeeId === null && e.plageRestante > 0 && !sous) return;

    const id = e.plageDemandeeId ?? this.options.genererId();
    if (e.plageDemandeeId === null) this.coeur.memoriserPlageDemandee(id);
    passe.bilan.plageDemandee = true;

    const rep = await this.appeler(passe, "POST", `${this.base(e.structureId)}/postes/${e.posteId}/plages`, {
      entetes: { "Content-Type": "application/json" },
      corps: JSON.stringify({ id }),
    });
    if (rep === null) return;

    if (rep.status === 200) {
      const data = lireCorps(rep)?.data as { plages?: PlageLue[] } | undefined;
      if (!data || !Array.isArray(data.plages)) {
        passe.echec = true;
        passe.arret = "Réponse du serveur illisible.";
        return;
      }
      this.coeur.ajouterPlages(data.plages);
      this.coeur.memoriserPlageDemandee(null);
      return;
    }
    const code = lireCorps(rep)?.code;
    if (rep.status === 409 && code === "PLAGES_SUFFISANTES") {
      // Pas une erreur : le poste se contente de ce qu'il a.
      this.coeur.memoriserPlageDemandee(null);
      return;
    }
    if (rep.status === 409 && code === "POSTE_INCONNU") {
      this.posteDesactive = true;
      return;
    }
    if (rep.status === 409 && code === "IDENTIFIANT_DEJA_UTILISE") this.coeur.memoriserPlageDemandee(null);
    this.refusInattendu(passe, rep);
  }

  // ------------------------------------------------------------------ photographie

  private photographieDue(passe: Passe, e: EtatPourSynchro): boolean {
    if (passe.forcer || passe.motif === "demarrage" || e.photographieLe === null) return true;
    if (passe.bilan.evenementsAcceptes > 0 && !this.coeur.resteApres(0).aEnvoyer) return true;
    const depuis = this.options.horloge().getTime() - Date.parse(e.photographieLe);
    return !(depuis < PHOTOGRAPHIE_PERIODE_MS);
  }

  private async photographier(passe: Passe): Promise<void> {
    const e = this.coeur.etatPourSynchro();
    if (e.structureId === null || e.posteId === null || !this.photographieDue(passe, e)) return;

    const entetes: Record<string, string> = { "Accept-Encoding": "br, gzip" };
    if (e.etag !== null) entetes["If-None-Match"] = e.etag;
    const rep = await this.appeler(
      passe,
      "GET",
      `${this.base(e.structureId)}/synchro/catalogue?posteId=${encodeURIComponent(e.posteId)}`,
      { entetes },
    );
    if (rep === null) return;

    if (rep.status === 409 && lireCorps(rep)?.code === "POSTE_INCONNU") {
      this.posteDesactive = true;
      return;
    }
    const dateServeur = dateEntete(rep);
    if (rep.status === 304) {
      this.coeur.confirmerPhotographie(dateServeur);
      this.noterHeure(dateServeur);
      passe.bilan.photographie = "inchangee";
      return;
    }
    if (rep.status !== 200) {
      this.refusInattendu(passe, rep);
      return;
    }
    const photo = lireCorps(rep)?.data as Photographie | undefined;
    if (!photo || !Array.isArray(photo.fiches)) {
      passe.echec = true;
      passe.arret = "Réponse du serveur illisible.";
      return;
    }
    try {
      this.coeur.appliquerPhotographie(photo, entete(rep, "etag"), dateServeur);
    } catch (err) {
      // Photographie d'une autre pharmacie ou d'un autre poste : refusée sans rien écrire.
      passe.echec = true;
      passe.arret = err instanceof Error ? err.message : "Catalogue refusé.";
      this.erreur = passe.arret;
      return;
    }
    this.noterHeure(dateServeur);
    passe.bilan.photographie = "appliquee";
  }

  /** Écart d'heure avec le serveur (en-tête `Date`) : au-delà de 5 min, avertissement non bloquant. */
  private noterHeure(dateServeur: Date | null): void {
    if (dateServeur === null) return;
    this.ecartHeureMs = dateServeur.getTime() - this.options.horloge().getTime();
    this.heureFausse = Math.abs(this.ecartHeureMs) > ECART_HEURE_MAX_MS;
  }

  private journal(message: string): void {
    this.options.journal?.(message);
  }
}
