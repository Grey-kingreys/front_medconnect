/**
 * Passerelle du pont (PD04a) : tout ce qu'un message du rendu déclenche, sans Electron.
 * `electron/ipc.ts` contrôle l'origine de l'expéditeur puis appelle ce module, qui :
 * valide les arguments (Zod), exige un utilisateur connecté, une pharmacie conforme à celle du poste
 * et le droit `caisse:utiliser`, puis appelle le cœur. Un refus du cœur devient une réponse enveloppée
 * (une `Error` perd ses propriétés en traversant `contextBridge`). Le jeton n'entre jamais ici.
 */
import type { Referentiels } from "@/lib/api_caisse";
import type { EtatPosteDesktop, ReponsePont, UtilisateurPoste } from "@/lib/caisse/contrat_desktop";
import { schemaUtilisateur, schemasPont, type NomMethodeCaisse } from "@/lib/caisse/contrat_desktop_schemas";
import type { CoeurCaisse, ReponseAnnulation } from "./coeur";
import { RefusCaisse } from "./refus";
import type { EtatSynchro } from "./synchro";
import type { Utilisateur } from "./types_caisse";

export const MESSAGE_VALIDATION = "Cette demande n'est pas valide.";
export const MESSAGE_AUTRE_PHARMACIE = "Ce poste est rattaché à une autre pharmacie.";
export const MESSAGE_CATALOGUE_A_CHARGER = "Connectez ce poste à internet une première fois pour charger le catalogue.";
export const MESSAGE_NON_CONNECTE = "Vous n'êtes pas authentifié.";
/** Même texte que le garde de permissions du back. */
export const MESSAGE_PERMISSION_REFUSEE = "Vous n'avez pas la permission d'effectuer cette action.";
export const MESSAGE_ECHEC_ENREGISTREMENT =
  "L'enregistrement sur ce poste a échoué. Réessayez. Si cela persiste, redémarrez l'application.";

/** Vrai si l'adresse a exactement l'origine du serveur local lancé (`http://127.0.0.1:<port>`). */
export function origineAutorisee(url: string | undefined, origine: string): boolean {
  if (url === undefined || origine === "") return false;
  try {
    return new URL(url).origin === origine;
  } catch {
    return false;
  }
}

/**
 * Identité du poste à partir d'un profil (`data` de `/auth/me`, ou profil local déjà normalisé).
 * Pharmacie : `structure.id`, à défaut `structureId`. Null si un champ manque ou est invalide.
 */
export function identiteDepuisProfil(brut: unknown): UtilisateurPoste | null {
  if (brut === null || typeof brut !== "object") return null;
  const p = brut as Record<string, unknown>;
  const structure = p.structure as { id?: unknown } | undefined;
  const nomComplet = [p.prenom, p.nom].filter((x): x is string => typeof x === "string" && x !== "").join(" ");
  const lu = schemaUtilisateur.safeParse([
    {
      id: p.id,
      nom: nomComplet !== "" ? nomComplet : p.nom,
      structureId: structure?.id ?? p.structureId,
      permissions: p.permissions,
    },
  ]);
  return lu.success ? lu.data[0] : null;
}

const CLES_JETON = new Set(["access_token", "refresh_token", "refreshToken"]);

/** Copie du profil sans aucune clé de jeton, à tout niveau : le profil local n'en garde jamais. */
function sansJeton(valeur: unknown): Record<string, unknown> {
  const copier = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(copier);
    if (v !== null && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>)
          .filter(([cle]) => !CLES_JETON.has(cle))
          .map(([cle, x]) => [cle, copier(x)]),
      );
    }
    return v;
  };
  return copier(valeur) as Record<string, unknown>;
}

export interface DepsPasserelle {
  coeur: CoeurCaisse;
  /** Lance un cycle de synchronisation sans l'attendre (après une vente). */
  apresVente(): void;
  /** Le poste vient d'être rattaché à une pharmacie : enregistrement et catalogue à lancer. */
  apresRattachement(): void;
  /** L'état du poste a changé : le rendu doit le relire. */
  etatChange(): void;
  /** Journal sans corps, sans jeton, sans donnée de vente. */
  journal(message: string): void;
}

const echec = (status: number, code: string, message: string): ReponsePont<never> => ({ ok: false, status, code, message });
const succes = <T>(data: T, message: string): ReponsePont<T> => ({ ok: true, data, message });

/** Méthodes qui écrivent dans la caisse locale : elles déclenchent la notification d'état. */
const ECRITURES: ReadonlySet<NomMethodeCaisse> = new Set([
  "creerVente",
  "ouvrirSession",
  "saisirComptage",
  "enregistrerMouvement",
  "fermerSession",
  "enregistrerAnnulationServeur",
]);

export class Passerelle {
  private utilisateur: UtilisateurPoste | null = null;

  /** L'identité vient du serveur seulement (`/auth/me` lu par le processus principal), jamais du rendu. */
  constructor(private readonly deps: DepsPasserelle) {
    this.utilisateur = identiteDepuisProfil(deps.coeur.lireProfil());
  }

  utilisateurCourant(): UtilisateurPoste | null {
    return this.utilisateur;
  }

  /** Profil confirmé par le serveur, relu de la base locale pour le rendu hors ligne (lecture seule) ; null si absent. */
  profilLocal(): Record<string, unknown> | null {
    const brut = this.deps.coeur.lireProfil();
    if (brut === null || typeof brut !== "object") return null;
    const profil = sansJeton(brut);
    delete profil.utilisateurId;
    return profil;
  }

  /**
   * Installe l'identité confirmée par le serveur (`donnees` : le champ `data` de `/auth/me`) et la garde en base
   * locale, sans jeton. Le premier compte de pharmacie (droit `caisse:utiliser`) rattache le poste à sa pharmacie
   * (D741) ; un compte d'une autre pharmacie est gardé mais ne peut rien écrire. Renvoie faux si la réponse n'est
   * pas exploitable : l'identité courante ne change pas.
   */
  confirmerIdentite(donnees: unknown): boolean {
    const u = identiteDepuisProfil(donnees);
    if (u === null) return false;
    this.utilisateur = u;
    // Le profil complet de `/auth/me` (type de structure, rôle, etc.) pour le menu hors ligne, jamais un jeton.
    this.deps.coeur.enregistrerProfil({ ...sansJeton(donnees), utilisateurId: u.id });
    if (u.permissions.includes("caisse:utiliser") && this.deps.coeur.structureRattachee() === null) {
      try {
        this.deps.coeur.rattacher({ structureId: u.structureId });
        this.deps.apresRattachement();
      } catch {
        this.deps.journal("rattachement du poste refusé");
      }
    }
    this.deps.etatChange();
    return true;
  }

  /**
   * Déconnexion volontaire, session retirée par le serveur ou jeton d'un autre compte (D756) : plus d'écriture sans
   * nouvelle confirmation, en mémoire comme au redémarrage hors ligne. Les ventes déjà en file restent.
   */
  effacerIdentite(): void {
    this.utilisateur = null;
    this.deps.coeur.effacerProfil();
    this.deps.etatChange();
  }

  async appeler(nom: string, args: unknown[]): Promise<ReponsePont<unknown>> {
    if (!Object.prototype.hasOwnProperty.call(schemasPont, nom)) return echec(400, "VALIDATION", MESSAGE_VALIDATION);
    const methode = nom as NomMethodeCaisse;
    const lu = (schemasPont[methode] as { safeParse(v: unknown): { success: boolean; data?: unknown } }).safeParse(args);
    if (!lu.success) return echec(400, "VALIDATION", MESSAGE_VALIDATION);
    const valeurs = lu.data as unknown[];

    const refus = this.controler(methode, valeurs);
    if (refus !== null) return refus;

    try {
      const reponse = this.executer(methode, valeurs, this.utilisateur as UtilisateurPoste);
      if (ECRITURES.has(methode)) this.deps.etatChange();
      if (methode === "creerVente") this.deps.apresVente();
      return reponse;
    } catch (e) {
      if (e instanceof RefusCaisse) {
        return { ok: false, status: e.status, code: e.code, message: e.message, details: e.details };
      }
      // Ni message ni corps : seulement le type de l'erreur.
      this.deps.journal(`échec ${methode} : ${e instanceof Error ? e.name : "inconnue"}`);
      return echec(500, "ECHEC_ENREGISTREMENT", MESSAGE_ECHEC_ENREGISTREMENT);
    }
  }

  /** Utilisateur connecté, pharmacie du poste, droit de caisse, catalogue : dans cet ordre. */
  private controler(methode: NomMethodeCaisse, valeurs: unknown[]): ReponsePont<never> | null {
    const u = this.utilisateur;
    if (u === null) return echec(401, "NON_AUTHENTIFIE", MESSAGE_NON_CONNECTE);

    const rattachee = this.deps.coeur.structureRattachee();
    const structureDemandee = methode === "enregistrerAnnulationServeur" ? undefined : (valeurs[0] as string);
    if (structureDemandee !== undefined && rattachee !== null && structureDemandee !== rattachee) {
      return echec(403, "POSTE_AUTRE_PHARMACIE", MESSAGE_AUTRE_PHARMACIE);
    }
    if (rattachee !== null && u.structureId !== rattachee) {
      return echec(403, "POSTE_AUTRE_PHARMACIE", MESSAGE_AUTRE_PHARMACIE);
    }
    if (!u.permissions.includes("caisse:utiliser")) {
      return echec(403, "PERMISSION_REFUSEE", MESSAGE_PERMISSION_REFUSEE);
    }
    if (rattachee === null) return echec(503, "CATALOGUE_ABSENT", MESSAGE_CATALOGUE_A_CHARGER);
    if (
      (methode === "chargerStock" || methode === "chargerReferentiels" || methode === "etatCaisse") &&
      !this.deps.coeur.aUnCatalogue()
    ) {
      return echec(503, "CATALOGUE_ABSENT", MESSAGE_CATALOGUE_A_CHARGER);
    }
    return null;
  }

  private executer(methode: NomMethodeCaisse, v: unknown[], u: UtilisateurPoste): ReponsePont<unknown> {
    const coeur = this.deps.coeur;
    const utilisateur: Utilisateur = { id: u.id, nom: u.nom, superviseur: u.permissions.includes("caisse:superviser") };
    switch (methode) {
      case "chargerStock":
        return succes(coeur.lireStock(), "Stock du poste.");
      case "chargerReferentiels": {
        const ref = coeur.lireReferentiels();
        if (ref === null) return echec(503, "CATALOGUE_ABSENT", MESSAGE_CATALOGUE_A_CHARGER);
        return succes(
          { modesPaiement: ref.modesPaiement, coupures: ref.coupures, parametres: ref.parametres } as unknown as Referentiels,
          "Référentiels du poste.",
        );
      }
      case "etatCaisse": {
        const poste = coeur.poste();
        if (poste === null) return echec(503, "CATALOGUE_ABSENT", MESSAGE_CATALOGUE_A_CHARGER);
        return succes({ poste: { ...poste, type: "DESKTOP" as const }, session: coeur.sessionOuverte() }, "Caisse du poste.");
      }
      case "creerVente":
        return succes(
          coeur.enregistrerVente(v[1] as never, v[2] as string, utilisateur),
          "Vente enregistrée sur ce poste.",
        );
      case "ouvrirSession":
        return succes(coeur.ouvrirSession(v[1] as never, utilisateur), "Caisse ouverte.");
      case "saisirComptage":
        return succes(coeur.saisirComptage(v[1] as string, v[2] as never, utilisateur), "Comptage enregistré.");
      case "enregistrerMouvement":
        return succes(coeur.enregistrerMouvement(v[1] as string, v[2] as never, utilisateur), "Mouvement de caisse enregistré.");
      case "getBilan":
        return succes(coeur.bilan(v[1] as string, utilisateur), "Bilan de la caisse.");
      case "fermerSession":
        return succes(coeur.fermerSession(v[1] as string, v[2] as never, utilisateur), "Caisse fermée.");
      case "listerVentes": {
        const options = v[1] as { date?: string; page?: number };
        return succes(coeur.listerVentes(options.date ?? coeur.jour()), "Ventes du poste.");
      }
      case "getVente":
        return succes(coeur.lireVente(v[1] as string), "Vente du poste.");
      case "enregistrerAnnulationServeur":
        coeur.enregistrerAnnulationServeur(v[0] as ReponseAnnulation);
        return succes(null, "Annulation enregistrée sur ce poste.");
    }
  }
}

/** État du poste pour le rendu, calculé à partir du moteur de synchronisation et du cœur. */
export function construireEtat(coeur: CoeurCaisse, moteur: EtatSynchro, utilisateur: UtilisateurPoste | null): EtatPosteDesktop {
  const local = coeur.etatLocal();
  const rattachee = coeur.structureRattachee();
  return {
    enLigne: moteur.etat === "EN_LIGNE",
    connexionARefaire: moteur.etat === "CONNEXION_A_REFAIRE",
    nonEnregistre: moteur.etat === "NON_ENREGISTRE",
    catalogueDisponible: coeur.aUnCatalogue(),
    fileEnAttente: moteur.fileEnAttente,
    rejetes: moteur.rejets,
    plageEpuisee: local.plageEpuisee,
    heureFausse: moteur.heureFausse,
    posteDesactive: moteur.posteDesactive,
    autrePharmacie: utilisateur !== null && rattachee !== null && utilisateur.structureId !== rattachee,
    dernierContactLe: moteur.dernierContactLe,
    photographieLe: coeur.etatPourSynchro().photographieLe,
    messageEnvoi: moteur.erreur,
  };
}
