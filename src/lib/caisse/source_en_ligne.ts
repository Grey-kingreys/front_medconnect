import { ApiError } from "../api_auth";
import {
  assurerPosteWeb,
  enregistrerMouvement,
  fermerSession,
  getBilan,
  getReferentiels,
  getSessionCourante,
  ouvrirSession,
  saisirComptage,
} from "../api_caisse";
import { getMyStock } from "../api_pharmacie";
import { annulerVente, creerVente, getVente, listerVentes } from "../api_ventes";
import type { SourceCaisse } from "./source";

/** Source de la caisse par l'API. Les erreurs remontent telles quelles. */
export const sourceEnLigne: SourceCaisse = {
  enLigneSeulement: true,
  async chargerStock(structureId) {
    const res = await getMyStock(structureId);
    return res.data.stocks;
  },
  async chargerReferentiels(structureId) {
    const res = await getReferentiels(structureId);
    return res.data;
  },
  async etatCaisse(structureId, utilisateurId) {
    const poste = (await assurerPosteWeb(structureId, utilisateurId)).data;
    const session = (await getSessionCourante(structureId, poste.id)).data;
    return { poste, session };
  },
  async creerVente(structureId, corps, cleIdempotence) {
    const res = await creerVente(structureId, corps, cleIdempotence);
    return res.data;
  },
  ouvrirSession(structureId, corps) {
    if (!corps.posteId) throw new ApiError("Le poste de caisse est requis.", 400);
    return ouvrirSession(structureId, { ...corps, posteId: corps.posteId });
  },
  saisirComptage: (structureId, sessionId, corps) => saisirComptage(structureId, sessionId, corps),
  enregistrerMouvement: (structureId, sessionId, corps) => enregistrerMouvement(structureId, sessionId, corps),
  getBilan: (structureId, sessionId) => getBilan(structureId, sessionId),
  fermerSession(structureId, sessionId, corps) {
    if (!corps.comptageFermeture) throw new ApiError("Le comptage de fermeture est requis.", 400);
    return fermerSession(structureId, sessionId, { ...corps, comptageFermeture: corps.comptageFermeture });
  },
  listerVentes: (structureId, options) => listerVentes(structureId, options),
  getVente: (structureId, venteId) => getVente(structureId, venteId),
  annulerVente: (structureId, venteId, motif) => annulerVente(structureId, venteId, motif),
};
