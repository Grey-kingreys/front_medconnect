import { getMyStock } from "../api_pharmacie";
import type { SourcePharmacie } from "./source_pharmacie";

/** Source de la pharmacie par l'API. Les erreurs remontent telles quelles. */
export const sourcePharmacieEnLigne: SourcePharmacie = {
  enLigneSeulement: true,
  async chargerStock(structureId) {
    const res = await getMyStock(structureId);
    return res.data.stocks;
  },
};
