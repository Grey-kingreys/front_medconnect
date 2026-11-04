import { ApiError, type ApiResponse } from "../api_auth";
import type { PontDesktop, ReponsePont } from "./contrat_desktop";
import type { SourceCaisse } from "./source";

/** Lève l'erreur d'une réponse refusée, au format que lisent `codeErreur`, `codeErreurVente` et `lignesErreurVente`. */
function lire<T>(reponse: ReponsePont<T>): ApiResponse<T> {
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
      return lire(await c.listerVentes(s, options));
    },
    async getVente(s, venteId) {
      return lire(await c.getVente(s, venteId));
    },
  };
}
