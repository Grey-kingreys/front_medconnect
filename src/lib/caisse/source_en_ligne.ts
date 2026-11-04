import { assurerPosteWeb, getReferentiels, getSessionCourante } from "../api_caisse";
import { getMyStock } from "../api_pharmacie";
import { creerVente } from "../api_ventes";
import type { SourceCaisse } from "./source";

/** Source de la caisse par l'API. Les erreurs remontent telles quelles. */
export const sourceEnLigne: SourceCaisse = {
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
};
