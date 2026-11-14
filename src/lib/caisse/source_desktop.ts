import { ApiError, type ApiResponse } from "../api_auth";
import { annulerVente, getVente, listerVentes, type VenteResume, type VentesDuJour } from "../api_ventes";
import { estErreurReseau } from "../erreurs_api";
import type { PontDesktop, ReponsePont } from "./contrat_desktop";
import type { SourceCaisse } from "./source";

export const MESSAGE_ACTION_EN_LIGNE = "Cette action demande une connexion.";
export const MESSAGE_ANNULATION_EN_LIGNE = "L'annulation demande une connexion.";
const MESSAGE_ENVOI_EN_COURS = "Envoi des ventes en cours : réessayez dans un instant.";
const MESSAGE_ANNULATION_FAITE = "L'annulation est faite, ne la refaites pas. ";
const CODES_REFUS_APRES_ANNULATION = ["ANNULATION_AUTRE_POSTE", "ANNULATION_AUTRE_CAISSE", "ANNULATION_CAISSE_FERMEE"];

/** Lève l'erreur d'une réponse refusée, au format que lisent `codeErreur`, `codeErreurVente` et `lignesErreurVente`. */
export function lire<T>(reponse: ReponsePont<T>): ApiResponse<T> {
  if (reponse.ok) return { data: reponse.data, message: reponse.message, success: true };
  throw new ApiError(reponse.message, reponse.status, {
    code: reponse.code,
    details: reponse.details,
    message: reponse.message,
  });
}

/** Source de la caisse par le pont desktop (cœur local). Un refus devient une `ApiError` comme en ligne. */
export function creerSourceDesktop(pont: PontDesktop): SourceCaisse {
  const c = pont.caisse;

  /** Ventes du serveur pour le jour, puis ventes du poste que le serveur ne connaît pas encore, en tête (D745). */
  async function ventesEnLigne(s: string, options: { date?: string; page?: number }): Promise<ApiResponse<VentesDuJour>> {
    const serveur = await listerVentes(s, options);
    const etat = await pont.etat();
    // Rien à ajouter quand tout est parti, ou hors première page (la liste du serveur est paginée).
    if (etat.fileEnAttente === 0 || (options.page ?? 1) !== 1 || serveur.data.totalPages > 1) return serveur;
    const connues = new Set(serveur.data.ventes.map((v) => v.id));
    const locales = lire(await c.listerVentes(s, options.date === undefined ? {} : { date: options.date })).data;
    const enAttente: VenteResume[] = locales.ventes
      .filter((v) => v.typePiece === "VENTE" && !connues.has(v.id))
      .map((v) => ({ ...v, enCoursEnvoi: true }));
    if (enAttente.length === 0) return serveur;
    return {
      ...serveur,
      data: {
        ...serveur.data,
        totalJour: serveur.data.totalJour + enAttente.reduce((somme, v) => somme + v.total, 0),
        nombre: serveur.data.nombre + enAttente.length,
        ventes: [...enAttente, ...serveur.data.ventes],
      },
    };
  }

  return {
    enLigneSeulement: false,
    async chargerStock(s) {
      return lire(await c.chargerStock(s)).data;
    },
    async chargerReferentiels(s) {
      return lire(await c.chargerReferentiels(s)).data;
    },
    async etatCaisse(s, u) {
      return lire(await c.etatCaisse(s, u)).data;
    },
    async creerVente(s, corps, cle) {
      return lire(await c.creerVente(s, corps, cle)).data;
    },
    async ouvrirSession(s, corps) {
      return lire(await c.ouvrirSession(s, corps));
    },
    async saisirComptage(s, sessionId, corps) {
      return lire(await c.saisirComptage(s, sessionId, corps));
    },
    async enregistrerMouvement(s, sessionId, corps) {
      return lire(await c.enregistrerMouvement(s, sessionId, corps));
    },
    async getBilan(s, sessionId) {
      return lire(await c.getBilan(s, sessionId));
    },
    async fermerSession(s, sessionId, corps) {
      return lire(await c.fermerSession(s, sessionId, corps));
    },
    async listerVentes(s, options) {
      const etat = await pont.etat();
      // Hors coupure avérée (démarrage compris), le serveur est interrogé d'abord.
      if (!etat.horsLigne) {
        try {
          return await ventesEnLigne(s, options);
        } catch (err) {
          // Réseau tombé, ou session à refaire, entre l'état et la lecture : les ventes de ce poste restent lisibles.
          if (!estErreurReseau(err) && !etat.connexionARefaire) throw err;
        }
      }
      return lire(await c.listerVentes(s, options));
    },
    async getVente(s, venteId) {
      // Le reçu d'une vente de ce poste se lit sur le poste, sans réseau ; sinon l'API.
      const locale = lire(await c.getVente(s, venteId));
      if (locale.data !== null) return locale;
      const etat = await pont.etat();
      if (etat.horsLigne) throw new ApiError(MESSAGE_ACTION_EN_LIGNE, 503, { code: "HORS_LIGNE", message: MESSAGE_ACTION_EN_LIGNE });
      return getVente(s, venteId);
    },
    async annulerVente(s, venteId, motif, utilisateurId) {
      const etat = await pont.etat();
      if (etat.horsLigne) {
        throw new ApiError(MESSAGE_ANNULATION_EN_LIGNE, 503, { code: "HORS_LIGNE", message: MESSAGE_ANNULATION_EN_LIGNE });
      }
      // Annuler une vente que le serveur n'a pas encore serait un 404 (D745).
      if (etat.fileEnAttente > 0) {
        throw new ApiError(MESSAGE_ENVOI_EN_COURS, 409, { code: "ENVOI_EN_COURS", message: MESSAGE_ENVOI_EN_COURS });
      }
      const caisse = lire(await c.etatCaisse(s, utilisateurId ?? "poste"));
      // Le serveur rattache le remboursement à la caisse de CE poste, pas à la caisse web du vendeur.
      const reponse = await annulerVente(s, venteId, motif, caisse.data.poste.id);
      const enregistree = await c.enregistrerAnnulationServeur(reponse.data);
      if (!enregistree.ok) {
        // L'annulation est déjà faite au serveur : on le dit, sans proposer de recommencer.
        const message = `${MESSAGE_ANNULATION_FAITE}${enregistree.message}`;
        throw new ApiError(message, enregistree.status, {
          code: enregistree.code !== undefined && CODES_REFUS_APRES_ANNULATION.includes(enregistree.code) ? enregistree.code : "ANNULATION_AUTRE_CAISSE",
          message,
        });
      }
      return reponse;
    },
  };
}
