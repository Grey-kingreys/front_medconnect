/**
 * Faux serveur de synchronisation, fidèle au contrat réel (back_medconnect/src/pharmacie/synchro/ et
 * points-de-vente.service.ts) : séquence stricte par poste, EN_ATTENTE sur un trou puis application
 * différée, idempotence par evenementId, ETag faible, plages comptées (deux au plus non épuisées).
 * Il valide chaque corps d'envoi avec les listes de clés du back (valider_dto.ts) et rejette en 400
 * ce qu'un vrai serveur rejetterait. Aucun accès réseau, aucune base de dev.
 */
import { MAINTENANT, fiche, photo } from "../aide_tests";
import type { ClientHttp, ReponseHttp } from "../synchro";
import type { FicheSynchro, PlageLue } from "../types_synchro";
import { ecartsLot } from "./valider_dto";

interface EvenementServeur {
  evenementId: string;
  sequence: number;
  type: string;
  corps: Record<string, unknown>;
}

interface Connu {
  sequence: number;
  statut: "APPLIQUE" | "EN_ATTENTE" | "REJETE";
  code?: string;
  message?: string;
  evenement: EvenementServeur;
}

export interface RequeteVue {
  methode: "GET" | "POST";
  chemin: string;
  entetes: Record<string, string>;
  gzip: boolean;
  corps: string | undefined;
}

function enveloppe(status: number, corps: unknown, entetes: Record<string, string> = {}): ReponseHttp {
  return { status, entetes, corps: corps === undefined ? "" : JSON.stringify(corps) };
}

function erreur(status: number, code: string | null, message: string): ReponseHttp {
  return enveloppe(status, { statusCode: status, message, error: "Erreur", ...(code ? { code } : {}) });
}

function empreinte(texte: string): string {
  let h = 5381;
  for (let i = 0; i < texte.length; i++) h = ((h << 5) + h + texte.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export class FauxServeur {
  readonly structureId = "ph1";
  jetonValide = true;
  /** Taille décompressée au-delà de laquelle un envoi est refusé en 413 (2 Mo sur le vrai serveur). */
  limiteOctets = 2_000_000;
  taillePlage = 500;
  dateServeur: () => Date = () => new Date(MAINTENANT);
  fiches: FicheSynchro[] = [fiche(1)];

  /** Postes enregistrés : appareilId vers poste. */
  postes = new Map<string, { id: string; code: string; libelle: string }>();
  /** Plages réservées, dans l'ordre ; `epuisees` les retire de la liste « en cours ». */
  plages: (PlageLue & { posteId: string })[] = [];
  epuisees = new Set<string>();
  prochainNumero = 1;

  sequenceAppliquee = 0;
  sequenceMaxRecue = 0;
  connus = new Map<string, Connu>();
  /** Séquences dans l'ordre où le serveur les a appliquées. */
  ordreApplication: number[] = [];
  /** Nombre d'effets par evenementId (une vente ne doit jamais en avoir deux). */
  effets = new Map<string, number>();
  /** Événements que le serveur rejette au moment de l'application. */
  rejeter = new Set<string>();
  /** Événements pour lesquels le serveur répond A_RENVOYER une seule fois. */
  renvoyerUneFois = new Set<string>();

  /** Corps envoyés refusés par la validation (doit rester vide). */
  ecartsValidation: string[] = [];
  /** Taille décompressée de chaque envoi d'événements accepté. */
  taillesEnvois: number[] = [];
  /** Nombre d'événements de chaque envoi (battements compris). */
  evenementsParEnvoi: number[] = [];
  etatsVus: { fileVide: boolean; sessionOuverte: boolean; versionApp: string }[] = [];

  constructor(posteExistant?: { id: string; code: string; appareilId: string; libelle?: string }) {
    if (posteExistant) {
      this.postes.set(posteExistant.appareilId, {
        id: posteExistant.id,
        code: posteExistant.code,
        libelle: posteExistant.libelle ?? "Comptoir",
      });
    }
  }

  /** Réserve une plage déjà en cours au serveur (poste réinstallé, plage entamée). */
  ouvrirPlage(id: string, debut: number, fin: number, posteId = "po1"): void {
    this.plages.push({ id, debut, fin, posteId });
    this.prochainNumero = Math.max(this.prochainNumero, fin + 1);
  }

  /** Historique d'un poste dont la base locale a été perdue : `n` événements déjà reçus. */
  simulerHistorique(n: number): void {
    this.sequenceAppliquee = n;
    this.sequenceMaxRecue = n;
  }

  private posteConnu(posteId: string): boolean {
    return [...this.postes.values()].some((p) => p.id === posteId);
  }

  private plagesEnCours(posteId: string): PlageLue[] {
    return this.plages.filter((p) => p.posteId === posteId && !this.epuisees.has(p.id)).map(({ id, debut, fin }) => ({ id, debut, fin }));
  }

  private entetesBase(): Record<string, string> {
    return { Date: this.dateServeur().toUTCString() };
  }

  traiter(methode: "GET" | "POST", chemin: string, options: { corps?: string; gzip?: boolean; entetes?: Record<string, string> } | undefined, autorisation: string): ReponseHttp {
    const rep = this.router(methode, chemin, options, autorisation);
    return { ...rep, entetes: { ...this.entetesBase(), ...rep.entetes } };
  }

  private router(methode: "GET" | "POST", chemin: string, options: { corps?: string; gzip?: boolean; entetes?: Record<string, string> } | undefined, autorisation: string): ReponseHttp {
    if (!this.jetonValide || !autorisation.startsWith("Bearer ")) return erreur(401, null, "Votre session a expiré.");
    const [route, requete = ""] = chemin.split("?");
    const parties = route.split("/").filter(Boolean);
    if (parties[0] !== "pharmacie" || parties[1] !== this.structureId) return erreur(403, "ACCES_PHARMACIE", "Vous n'avez pas accès à cette pharmacie.");
    const reste = parties.slice(2).join("/");

    if (methode === "POST" && reste === "postes") return this.enregistrerPoste(options?.corps);
    if (methode === "POST" && reste === "synchro/evenements") return this.recevoir(options);
    if (methode === "GET" && reste === "synchro/catalogue") return this.catalogue(new URLSearchParams(requete).get("posteId"), options?.entetes ?? {});
    if (methode === "POST" && parties[2] === "postes" && parties[4] === "plages" && parties.length === 5) return this.attribuerPlage(parties[3], options?.corps);
    return erreur(404, null, "Route inconnue.");
  }

  // ------------------------------------------------------------------ poste

  private enregistrerPoste(corps: string | undefined): ReponseHttp {
    const dto = JSON.parse(corps ?? "{}") as Record<string, unknown>;
    const cles = Object.keys(dto).sort().join(",");
    if (cles !== "appareilId,libelle,type" || dto.type !== "DESKTOP" || typeof dto.appareilId !== "string") {
      this.ecartsValidation.push(`postes : corps invalide (${cles})`);
      return erreur(400, "VALIDATION", "Le corps de la demande est invalide.");
    }
    let poste = this.postes.get(dto.appareilId);
    const cree = poste === undefined;
    if (!poste) {
      const n = this.postes.size + 1;
      poste = { id: n === 1 ? "po1" : `po${n}`, code: `D${n}`, libelle: String(dto.libelle) };
      this.postes.set(dto.appareilId, poste);
    }
    return enveloppe(200, { data: { ...poste, type: "DESKTOP", actif: true, appareilId: dto.appareilId, cree }, message: "Poste enregistré.", success: true });
  }

  // ------------------------------------------------------------------ événements

  private recevoir(options: { corps?: string; gzip?: boolean } | undefined): ReponseHttp {
    if (options?.gzip !== true) return erreur(415, null, "Le format de la demande n'est pas pris en charge.");
    const texte = options.corps ?? "";
    const octets = new TextEncoder().encode(texte).length;
    if (octets > this.limiteOctets) return erreur(413, null, "La demande est trop volumineuse.");
    const lot = JSON.parse(texte) as { posteId: string; etat: { fileVide: boolean; sessionOuverte: boolean; versionApp: string }; evenements: EvenementServeur[] };
    const ecarts = ecartsLot(lot);
    if (ecarts.length > 0) {
      this.ecartsValidation.push(...ecarts);
      return erreur(400, "VALIDATION", "Le corps de la demande est invalide.");
    }
    if (!this.posteConnu(lot.posteId)) return erreur(409, "POSTE_INCONNU", "Ce poste est inconnu.");
    this.taillesEnvois.push(octets);
    this.evenementsParEnvoi.push(lot.evenements.length);
    this.etatsVus.push(lot.etat);

    const resultats: Record<string, unknown>[] = [];
    let arretLot = false;
    for (const e of lot.evenements) {
      if (arretLot || this.renvoyerUneFois.delete(e.evenementId)) {
        // Rien d'écrit pour cet événement ni pour les suivants du lot (D640).
        arretLot = true;
        resultats.push({ evenementId: e.evenementId, sequence: e.sequence, statut: "A_RENVOYER", code: "SERVICE_INDISPONIBLE" });
        continue;
      }
      const deja = this.connus.get(e.evenementId);
      if (deja) {
        resultats.push(this.resultat(deja, deja.statut === "APPLIQUE" ? "DEJA_APPLIQUE" : deja.statut));
        continue;
      }
      this.sequenceMaxRecue = Math.max(this.sequenceMaxRecue, e.sequence);
      if (e.sequence <= this.sequenceAppliquee) {
        resultats.push({ evenementId: e.evenementId, sequence: e.sequence, statut: "REJETE", code: "SEQUENCE_DEJA_UTILISEE", message: "Cette séquence est déjà prise." });
        continue;
      }
      if (e.sequence > this.sequenceAppliquee + 1) {
        const c: Connu = { sequence: e.sequence, statut: "EN_ATTENTE", evenement: e };
        this.connus.set(e.evenementId, c);
        resultats.push(this.resultat(c, "EN_ATTENTE"));
        continue;
      }
      resultats.push(this.resultat(this.appliquer(e), undefined));
      // Un trou comblé : les événements en attente passent, dans l'ordre (D643).
      for (;;) {
        const suivant = [...this.connus.values()].find((c) => c.statut === "EN_ATTENTE" && c.sequence === this.sequenceAppliquee + 1);
        if (!suivant) break;
        resultats.push({ ...this.resultat(this.appliquer(suivant.evenement), undefined), differe: true });
      }
    }
    const enAttente = [...this.connus.values()].filter((c) => c.statut === "EN_ATTENTE").length;
    return enveloppe(200, { data: { resultats, sequenceAppliquee: this.sequenceAppliquee, enAttente }, message: "Opérations traitées.", success: true });
  }

  private resultat(c: Connu, statut?: string): Record<string, unknown> {
    const s = statut ?? c.statut;
    return { evenementId: c.evenement.evenementId, sequence: c.sequence, statut: s, ...(c.code ? { code: c.code, message: c.message } : {}) };
  }

  private appliquer(e: EvenementServeur): Connu {
    const existant = this.connus.get(e.evenementId);
    const c: Connu = existant ?? { sequence: e.sequence, statut: "APPLIQUE", evenement: e };
    this.connus.set(e.evenementId, c);
    this.sequenceAppliquee = e.sequence;
    this.ordreApplication.push(e.sequence);
    if (this.rejeter.has(e.evenementId)) {
      c.statut = "REJETE";
      c.code = "STOCK_INTROUVABLE";
      c.message = "Un médicament de cette vente n'existe plus dans le stock de la pharmacie.";
      return c;
    }
    c.statut = "APPLIQUE";
    this.effets.set(e.evenementId, (this.effets.get(e.evenementId) ?? 0) + 1);
    if (e.type === "VENTE") {
      for (const l of e.corps.lignes as { stockId: string; unite: string; nombre: number }[]) {
        const f = this.fiches.find((x) => x.stockId === l.stockId);
        if (!f) continue;
        const retrait = l.unite === "BOITE" ? l.nombre * f.coefficientBoite : l.nombre;
        f.quantite = Math.max(0, f.quantite - retrait);
        if (f.lots[0]) f.lots[0] = { ...f.lots[0], solde: Math.max(0, f.lots[0].solde - retrait) };
      }
    }
    return c;
  }

  // ------------------------------------------------------------------ plages

  private attribuerPlage(posteId: string, corps: string | undefined): ReponseHttp {
    const dto = JSON.parse(corps ?? "{}") as Record<string, unknown>;
    if (Object.keys(dto).join(",") !== "id" || typeof dto.id !== "string") {
      this.ecartsValidation.push("plages : corps invalide");
      return erreur(400, "VALIDATION", "Le corps de la demande est invalide.");
    }
    if (!this.posteConnu(posteId)) return erreur(409, "POSTE_INCONNU", "Ce poste est inconnu.");
    const existante = this.plages.find((p) => p.id === dto.id);
    if (existante) {
      if (existante.posteId !== posteId) return erreur(409, "IDENTIFIANT_DEJA_UTILISE", "Cet identifiant est déjà pris.");
      return this.reponsePlage(existante, false, posteId);
    }
    if (this.plagesEnCours(posteId).length >= 2) return erreur(409, "PLAGES_SUFFISANTES", "Ce poste a déjà assez de numéros de tickets en réserve.");
    const neuve = { id: dto.id, debut: this.prochainNumero, fin: this.prochainNumero + this.taillePlage - 1, posteId };
    this.prochainNumero = neuve.fin + 1;
    this.plages.push(neuve);
    return this.reponsePlage(neuve, true, posteId);
  }

  private reponsePlage(p: PlageLue, cree: boolean, posteId: string): ReponseHttp {
    return enveloppe(200, {
      data: { id: p.id, debut: p.debut, fin: p.fin, taille: p.fin - p.debut + 1, cree, plages: this.plagesEnCours(posteId) },
      message: "Numéros de tickets réservés.",
      success: true,
    });
  }

  // ------------------------------------------------------------------ catalogue

  private catalogue(posteId: string | null, entetes: Record<string, string>): ReponseHttp {
    const poste = [...this.postes.values()].find((p) => p.id === posteId);
    if (!poste) return erreur(409, "POSTE_INCONNU", "Ce poste est inconnu.");
    const modele = photo(this.fiches, {
      id: poste.id,
      code: poste.code,
      libelle: poste.libelle,
      sequenceAppliquee: this.sequenceAppliquee,
      sequenceMaxRecue: this.sequenceMaxRecue,
      plages: this.plagesEnCours(poste.id),
    });
    modele.parametres.taillePlageTickets = this.taillePlage;
    const texte = JSON.stringify({ data: modele, message: "Catalogue du poste.", success: true });
    const etag = `W/"${empreinte(texte)}"`;
    const siAucun = Object.entries(entetes).find(([k]) => k.toLowerCase() === "if-none-match")?.[1];
    if (siAucun === etag || siAucun === "*") return { status: 304, entetes: { ETag: etag }, corps: "" };
    return { status: 200, entetes: { ETag: etag }, corps: texte };
  }
}

/** Client HTTP de test : parle au faux serveur, garde un jeton à lui (que le moteur ne voit jamais). */
export class FauxClient implements ClientHttp {
  readonly requetes: RequeteVue[] = [];
  /** Vrai : le réseau est coupé, la requête échoue avant d'atteindre le serveur. */
  coupure = false;
  /** Réponses à perdre APRES traitement par le serveur : chemin contenant `motif`, `restant` fois. */
  perdre: { motif: string; restant: number } | null = null;
  /** Réponse imposée (statut inventé), évaluée avant tout. */
  forcer: ((methode: "GET" | "POST", chemin: string) => ReponseHttp | undefined) | null = null;

  constructor(
    readonly serveur: FauxServeur,
    readonly jeton = "JETON-SECRET-DE-TEST-9f3c",
  ) {}

  async requete(
    methode: "GET" | "POST",
    chemin: string,
    options?: { entetes?: Record<string, string>; corps?: string; gzip?: boolean },
  ): Promise<ReponseHttp> {
    this.requetes.push({ methode, chemin, entetes: { ...(options?.entetes ?? {}) }, gzip: options?.gzip === true, corps: options?.corps });
    if (this.coupure) throw new Error("ECONNRESET");
    const imposee = this.forcer?.(methode, chemin);
    if (imposee) return imposee;
    const rep = this.serveur.traiter(methode, chemin, options, `Bearer ${this.jeton}`);
    if (this.perdre && this.perdre.restant > 0 && chemin.includes(this.perdre.motif)) {
      this.perdre.restant -= 1;
      throw new Error("ECONNRESET apres traitement");
    }
    return rep;
  }

  /** Requêtes d'une route, par suffixe de chemin (sans paramètres). */
  vers(methode: "GET" | "POST", fin: string): RequeteVue[] {
    return this.requetes.filter((r) => r.methode === methode && r.chemin.split("?")[0].endsWith(fin));
  }
}
