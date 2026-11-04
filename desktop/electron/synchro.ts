// Service de synchronisation du processus principal : minuterie, jeton en mémoire, identité, notifications.
// Le moteur (coeur/synchro.ts) ne connaît ni la minuterie ni le jeton.
import { MoteurSynchro, type EtatSynchro, type MotifCycle } from "../coeur/synchro";
import type { CoeurCaisse } from "../coeur/coeur";
import { creerClientHttp } from "./client_http";

export interface OptionsService {
  coeur: CoeurCaisse;
  urlApi: string;
  versionApp: string;
  libellePoste: string;
  horloge?: () => Date;
  genererId: () => string;
  /** Après chaque cycle : l'état a pu changer. */
  notifier: () => void;
  /** Le serveur a répondu 401 : le rendu doit rafraîchir sa session et repousser le jeton. */
  demanderJeton: () => void;
  /**
   * Identité du poste, tirée de `GET /auth/me` avec le jeton reçu (jamais du rendu) :
   * `confirmer` reçoit le champ `data` de la réponse, `effacer` retire l'identité et le profil local (D756).
   * Une panne, une erreur serveur ou un jeton simplement expiré ne change rien : la dernière identité confirmée reste.
   */
  identite: { confirmer: (donnees: unknown) => void; effacer: () => void; idCourant: () => string | null };
  /** Sans donnée sensible : jamais de jeton, de corps ni de donnée de vente. */
  journal: (message: string) => void;
}

export interface ServiceSynchro {
  moteur: MoteurSynchro;
  /**
   * Jeton gardé en mémoire seulement ; confirme l'identité puis déclenche un cycle.
   * `null` : jeton absent ou expiré, la minuterie s'arrête et l'identité reste (reprise hors ligne, D756).
   */
  definirJeton(jeton: string | null): void;
  /** Déconnexion volontaire, ou session refusée par le serveur : jeton et identité effacés, y compris hors ligne (D756). */
  deconnecter(): void;
  /** Cycle sans attendre (après une vente, après un rattachement). */
  declencher(motif: MotifCycle): void;
  etat(): EtatSynchro;
  /** Plus aucun cycle ne démarre ; celui qui est en vol continue (voir `attendreFinCycle`). */
  arreter(): void;
  /** Se résout quand le cycle en cours est terminé (jamais rejetée). */
  attendreFinCycle(): Promise<void>;
}

/** Codes du serveur qui retirent la session pour de bon ; un 401 sans ces codes est un jeton expiré (D756). */
const CODES_SESSION_RETIREE = new Set(["SESSION_REVOQUEE", "REFRESH_REUTILISE", "COMPTE_DESACTIVE"]);

/**
 * Utilisateur annoncé par le jeton, sans vérifier sa signature : ne sert qu'à RETIRER l'identité d'un autre
 * compte en attendant le serveur, jamais à en installer une. Null si le jeton est illisible.
 */
export function utilisateurDuJeton(jeton: string): string | null {
  try {
    // Charge signée par `signerAcces` du back : `userId`.
    const charge = JSON.parse(Buffer.from(jeton.split(".")[1], "base64url").toString("utf8")) as { userId?: unknown };
    return typeof charge.userId === "string" ? charge.userId : null;
  } catch {
    return null;
  }
}

export function creerServiceSynchro(options: OptionsService): ServiceSynchro {
  let jeton: string | null = null;
  /** Jeton pour lequel le serveur a confirmé l'identité : sinon, nouvel essai avant chaque cycle. */
  let confirmePour: string | null = null;
  let minuterie: ReturnType<typeof setTimeout> | null = null;
  let arrete = false;
  let enVol: Promise<unknown> = Promise.resolve();

  const client = creerClientHttp({ urlApi: options.urlApi, jeton: () => jeton });
  const moteur = new MoteurSynchro(options.coeur, client, {
    versionApp: options.versionApp,
    libellePoste: options.libellePoste,
    horloge: options.horloge ?? (() => new Date()),
    genererId: options.genererId,
    journal: options.journal,
  });

  const planifier = () => {
    if (minuterie !== null) clearTimeout(minuterie);
    minuterie = null;
    // Sans jeton : en attente, sans erreur. Le prochain jeton relance tout.
    if (arrete || jeton === null || options.urlApi === "") return;
    minuterie = setTimeout(() => void lancer("minuterie"), moteur.prochainDelaiMs());
  };

  const lancer = async (motif: MotifCycle, identiteTentee = false): Promise<void> => {
    if (arrete || jeton === null || options.urlApi === "") return;
    if (!identiteTentee && confirmePour !== jeton) await confirmerIdentite(jeton);
    if (arrete || jeton === null) return;
    try {
      const cycle = moteur.cycle(motif);
      enVol = cycle.catch(() => undefined);
      await cycle;
    } catch {
      // Le moteur ne lève pas ; garde-fou pour que la minuterie ne s'arrête jamais.
      options.journal("cycle de synchronisation interrompu");
    }
    // Un cycle en vol pendant une déconnexion ou un arrêt ne réclame plus de jeton.
    if (jeton !== null && !arrete && moteur.etat().etat === "CONNEXION_A_REFAIRE") options.demanderJeton();
    options.notifier();
    // Rappelé après chaque cycle, au délai que le moteur indique (30 s, 5 min, reprise sur échec).
    planifier();
  };

  const sessionRetiree = (corps: string): boolean => {
    try {
      const code = (JSON.parse(corps) as { code?: unknown } | null)?.code;
      return typeof code === "string" && CODES_SESSION_RETIREE.has(code);
    } catch {
      return false;
    }
  };

  const confirmerIdentite = async (pour: string): Promise<void> => {
    try {
      const reponse = await client.requete("GET", "/auth/me");
      if (jeton !== pour) return; // le jeton a changé pendant l'appel
      if (reponse.status === 200) {
        const corps: unknown = JSON.parse(reponse.corps);
        options.identite.confirmer((corps as { data?: unknown } | null)?.data);
        if (options.identite.idCourant() !== null) confirmePour = pour;
      } else if (reponse.status === 403 || (reponse.status === 401 && sessionRetiree(reponse.corps))) {
        options.identite.effacer();
      } else {
        options.journal(`identité non confirmée : ${reponse.status}`);
      }
    } catch {
      options.journal("identité non confirmée : serveur injoignable");
    }
  };

  return {
    moteur,
    definirJeton(nouveau) {
      const premier = jeton === null;
      const arefaire = moteur.etat().etat === "CONNEXION_A_REFAIRE";
      jeton = nouveau;
      if (nouveau === null) {
        planifier();
        options.notifier();
        return;
      }
      // Jeton d'un autre compte : le précédent ne vend plus, même si le serveur tarde ou ne répond pas.
      const annonce = utilisateurDuJeton(nouveau);
      const courant = options.identite.idCourant();
      if (annonce !== null && courant !== null && annonce !== courant) {
        confirmePour = null;
        options.identite.effacer();
      }
      moteur.reprendreApresConnexion();
      if (options.urlApi === "") return;
      // L'identité d'abord : le rattachement du poste en dépend, et le cycle enregistre le poste.
      void confirmerIdentite(nouveau).then(() => lancer(premier || arefaire ? "demarrage" : "minuterie", true));
    },
    deconnecter() {
      jeton = null;
      confirmePour = null;
      options.identite.effacer();
      planifier();
      options.notifier();
    },
    declencher(motif) {
      void lancer(motif);
    },
    etat: () => moteur.etat(),
    arreter() {
      arrete = true;
      if (minuterie !== null) clearTimeout(minuterie);
      minuterie = null;
    },
    attendreFinCycle: () => enVol.then(() => undefined),
  };
}
